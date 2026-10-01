import { bytesToHex, cre, getNetwork, TxStatus, type Runtime } from '@chainlink/cre-sdk'
import { type Address, encodeAbiParameters } from 'viem'
import { z } from 'zod'
import { CapacityMarket } from '../contracts/evm/ts/generated/CapacityMarket'
import { CapacityPool } from '../contracts/evm/ts/generated/CapacityPool'
import { CREDeadlineReceiver } from '../contracts/evm/ts/generated/CREDeadlineReceiver'

// ─── Config Schema ──────────────────────────────────────────
export const configSchema = z.object({
	schedule: z.string(),
	chainSelectorName: z.string(),
	marketAddress: z.string(),
	poolAddress: z.string(),
	receiverAddress: z.string(),
})
type Config = z.infer<typeof configSchema>

// Mirrors CREDeadlineReceiver.Action (src/CREDeadlineReceiver.sol) — keep in
// sync by hand; there is no automated check that these stay aligned.
enum Action {
	MarketClaimDefault = 0,
	MarketFinalizeDelivery = 1,
	MarketResolveDisputeByTimeout = 2,
	PoolClaimAssignmentDefault = 3,
	PoolFinalizeAssignmentDelivery = 4,
	PoolResolveAssignmentDisputeByTimeout = 5,
}

// Mirrors CapacityMarket.Status (src/CapacityMarket.sol).
const MARKET_STATUS = { Activated: 2, DeliveryClaimed: 4, Disputed: 5 } as const

// Mirrors CapacityPool.AssignmentStatus (src/CapacityPool.sol).
const ASSIGNMENT_STATUS = { Pending: 0, DeliveryClaimed: 2, Disputed: 3 } as const

type DeadlineAction = { action: Action; id: bigint; subId: bigint }

// Matches CREDeadlineReceiver.DeadlineAction exactly — field order and types
// must agree with the Solidity struct for abi.decode to succeed onchain.
const DEADLINE_ACTION_ARRAY_ABI = [
	{
		type: 'tuple[]',
		name: 'actions',
		components: [
			{ name: 'action', type: 'uint8' },
			{ name: 'id', type: 'uint256' },
			{ name: 'subId', type: 'uint256' },
		],
	},
] as const

// ─── Callback ───────────────────────────────────────────────
export const onCronTrigger = (runtime: Runtime<Config>): string => {
	const { chainSelectorName, marketAddress, poolAddress, receiverAddress } = runtime.config

	const network = getNetwork({ chainFamily: 'evm', chainSelectorName, isTestnet: true })
	if (!network) throw new Error(`Network not found: ${chainSelectorName}`)

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)
	const market = new CapacityMarket(evmClient, marketAddress as Address)
	const pool = new CapacityPool(evmClient, poolAddress as Address)
	const receiver = new CREDeadlineReceiver(evmClient, receiverAddress as Address)

	// Approximate, not chain-exact — fine here: this only decides whether to
	// *attempt* an action. The actual gate is CapacityMarket/CapacityPool's
	// own on-chain deadline check inside claimDefault/finalizeDelivery/etc.,
	// which CREDeadlineReceiver already calls via try/catch (see its
	// NatSpec). A few seconds of clock skew costs nothing but one harmless,
	// cheaply-detected `success: false` — it can never cause a wrong action
	// to actually execute.
	const now = BigInt(Math.floor(Date.now() / 1000))
	const actions: DeadlineAction[] = []

	// --- CapacityMarket: scan every listed position -----------------------
	const nextPositionId = market.nextPositionId(runtime)
	for (let id = 0n; id < nextPositionId; id++) {
		const p = market.positions(runtime, id)
		// [domain, quantity, validFrom, validUntil, activationSLA, disputeWindow,
		//  provider, buyer, price, collateral, activationDeadline, disputeDeadline,
		//  deliveryEvidenceHash, status]
		const activationDeadline = p[10]
		const disputeDeadline = p[11]
		const status = p[13]

		if (status === MARKET_STATUS.Activated && now > activationDeadline) {
			actions.push({ action: Action.MarketClaimDefault, id, subId: 0n })
		} else if (status === MARKET_STATUS.DeliveryClaimed && now > disputeDeadline) {
			actions.push({ action: Action.MarketFinalizeDelivery, id, subId: 0n })
		} else if (status === MARKET_STATUS.Disputed && now > disputeDeadline) {
			actions.push({ action: Action.MarketResolveDisputeByTimeout, id, subId: 0n })
		}
	}

	// --- CapacityPool: scan every reservation's assignments -----------------
	const nextReservationId = pool.nextReservationId(runtime)
	for (let reservationId = 0n; reservationId < nextReservationId; reservationId++) {
		// [classId, buyer, quantity, activationDeadline, status, assignmentCount]
		const r = pool.reservationInfo(runtime, reservationId)
		const reservationActivationDeadline = r[3]
		const assignmentCount = r[5]

		for (let idx = 0n; idx < assignmentCount; idx++) {
			// [provider, quantity, price, collateral, deliveryEvidenceHash, disputeDeadline, status]
			const a = pool.assignmentInfo(runtime, reservationId, idx)
			const disputeDeadline = a[5]
			const status = a[6]

			if (status === ASSIGNMENT_STATUS.Pending && now > reservationActivationDeadline) {
				actions.push({ action: Action.PoolClaimAssignmentDefault, id: reservationId, subId: idx })
			} else if (status === ASSIGNMENT_STATUS.DeliveryClaimed && now > disputeDeadline) {
				actions.push({ action: Action.PoolFinalizeAssignmentDelivery, id: reservationId, subId: idx })
			} else if (status === ASSIGNMENT_STATUS.Disputed && now > disputeDeadline) {
				actions.push({ action: Action.PoolResolveAssignmentDisputeByTimeout, id: reservationId, subId: idx })
			}
		}
	}

	if (actions.length === 0) {
		runtime.log('No due deadlines found. Skipping.')
		return 'Skipped — nothing due'
	}

	runtime.log(`Found ${actions.length} due deadline action(s). Submitting report.`)

	const reportPayload = encodeAbiParameters(DEADLINE_ACTION_ARRAY_ABI, [actions])

	// Per-action gas is dominated by one of six simple state-transition calls
	// on CapacityMarket/CapacityPool (status check, a payout, an event) —
	// 150k each is a conservative ceiling with real headroom, plus a fixed
	// 50k base for onReport's own dispatch loop overhead. Not tuned against
	// a live gas profile yet; revisit once this runs against mainnet traffic
	// instead of a handful of demo positions.
	const gasLimit = (50_000n + BigInt(actions.length) * 150_000n).toString()
	const writeResult = receiver.writeReport(runtime, reportPayload, { gasLimit })

	if (writeResult.txStatus !== TxStatus.SUCCESS) {
		throw new Error(`Report submission failed: ${writeResult.errorMessage || writeResult.txStatus}`)
	}

	// A successful tx here only means CREDeadlineReceiver.onReport() itself
	// didn't revert — each individual action inside it can still have
	// `success: false` (ActionAttempted event), which is expected and
	// routine, not an error. See CREDeadlineReceiver's NatSpec.
	const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32))
	return `Submitted ${actions.length} action(s) — tx: ${txHash}`
}

// ─── Workflow Init ──────────────────────────────────────────
export function initWorkflow(config: Config) {
	const cronTrigger = new cre.capabilities.CronCapability()

	return [cre.handler(cronTrigger.trigger({ schedule: config.schedule }), onCronTrigger)]
}
