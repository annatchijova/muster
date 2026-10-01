import { describe, expect } from 'bun:test'
import { TxStatus } from '@chainlink/cre-sdk'
import { EvmMock, newTestRuntime, REPORT_METADATA_HEADER_LENGTH, test } from '@chainlink/cre-sdk/test'
import { bytesToHex, decodeAbiParameters, type Address } from 'viem'
import { newCapacityMarketMock } from '../contracts/evm/ts/generated/CapacityMarket_mock'
import { newCapacityPoolMock } from '../contracts/evm/ts/generated/CapacityPool_mock'
import { newCREDeadlineReceiverMock } from '../contracts/evm/ts/generated/CREDeadlineReceiver_mock'
import { initWorkflow, onCronTrigger } from './workflow'

const CHAIN_SELECTOR = 2183018362218727504n // monad-testnet
const MARKET_ADDRESS = '0x6fDA6975D7d585a772Dc763Ab44Bc206c94a0364' as Address
const POOL_ADDRESS = '0x44f305fbCF56acECe8f79Cd9773351E68634B0D5' as Address
const RECEIVER_ADDRESS = '0x1111111111111111111111111111111111111111' as Address

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

const makeConfig = () => ({
	schedule: '*/30 * * * * *',
	chainSelectorName: 'monad-testnet',
	marketAddress: MARKET_ADDRESS,
	poolAddress: POOL_ADDRESS,
	receiverAddress: RECEIVER_ADDRESS,
})

// A CapacityPosition tuple with every field zeroed except the ones the
// workflow actually reads (activationDeadline, disputeDeadline, status) —
// matches the real `positions(uint256)` return shape exactly (14 fields).
const emptyPosition = (activationDeadline: bigint, disputeDeadline: bigint, status: number) =>
	[
		'0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
		0n,
		0n,
		0n,
		0n,
		0n,
		'0x0000000000000000000000000000000000000000' as `0x${string}`,
		'0x0000000000000000000000000000000000000000' as `0x${string}`,
		0n,
		0n,
		activationDeadline,
		disputeDeadline,
		'0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
		status,
	] as const

describe('onCronTrigger', () => {
	test('submits MarketClaimDefault for an Activated position past its activationDeadline', async () => {
		const evmMock = EvmMock.testInstance(CHAIN_SELECTOR)
		const marketMock = newCapacityMarketMock(MARKET_ADDRESS, evmMock)
		const poolMock = newCapacityPoolMock(POOL_ADDRESS, evmMock)
		const receiverMock = newCREDeadlineReceiverMock(RECEIVER_ADDRESS, evmMock)

		const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 3600)
		marketMock.nextPositionId = () => 1n
		marketMock.positions = () => emptyPosition(pastDeadline, 0n, 2) // Status.Activated
		poolMock.nextReservationId = () => 0n

		let capturedReport: `0x${string}` | undefined
		receiverMock.writeReport = (input) => {
			// The test runtime's default report() mock prepends a synthetic
			// REPORT_METADATA_HEADER_LENGTH-byte OCR-style header in front of
			// the actual business payload (simulating the lower-level raw
			// report a real KeystoneForwarder parses before ever calling
			// onReport) -- strip it to recover exactly what our workflow
			// encoded, the same payload CREDeadlineReceiver._processReport
			// actually receives as `report` in production.
			capturedReport = bytesToHex(input.report.rawReport.slice(REPORT_METADATA_HEADER_LENGTH))
			return { txStatus: TxStatus.SUCCESS, txHash: new Uint8Array(32) }
		}

		const runtime = newTestRuntime()
		;(runtime as any).config = makeConfig()

		const result = onCronTrigger(runtime as any)

		expect(result).toContain('Submitted 1 action')
		expect(capturedReport).toBeDefined()

		const [decoded] = decodeAbiParameters(DEADLINE_ACTION_ARRAY_ABI, capturedReport!)
		expect(decoded).toHaveLength(1)
		expect(decoded[0].action).toBe(0) // Action.MarketClaimDefault
		expect(decoded[0].id).toBe(0n)
	})

	test('submits PoolClaimAssignmentDefault for a Pending assignment past the reservation activationDeadline', async () => {
		const evmMock = EvmMock.testInstance(CHAIN_SELECTOR)
		const marketMock = newCapacityMarketMock(MARKET_ADDRESS, evmMock)
		const poolMock = newCapacityPoolMock(POOL_ADDRESS, evmMock)
		const receiverMock = newCREDeadlineReceiverMock(RECEIVER_ADDRESS, evmMock)

		marketMock.nextPositionId = () => 0n

		const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 3600)
		poolMock.nextReservationId = () => 1n
		poolMock.reservationInfo = () =>
			[
				'0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
				'0x0000000000000000000000000000000000000000' as `0x${string}`,
				0n,
				pastDeadline, // activationDeadline
				1, // ReservationStatus.Activated
				1n, // assignmentCount
			] as const
		poolMock.assignmentInfo = () =>
			[
				'0x0000000000000000000000000000000000000000' as `0x${string}`,
				0n,
				0n,
				0n,
				'0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
				0n, // disputeDeadline (unused for the Pending/default path)
				0, // AssignmentStatus.Pending
			] as const

		let capturedReport: `0x${string}` | undefined
		receiverMock.writeReport = (input) => {
			capturedReport = bytesToHex(input.report.rawReport.slice(REPORT_METADATA_HEADER_LENGTH))
			return { txStatus: TxStatus.SUCCESS, txHash: new Uint8Array(32) }
		}

		const runtime = newTestRuntime()
		;(runtime as any).config = makeConfig()

		const result = onCronTrigger(runtime as any)

		expect(result).toContain('Submitted 1 action')
		const [decoded] = decodeAbiParameters(DEADLINE_ACTION_ARRAY_ABI, capturedReport!)
		expect(decoded).toHaveLength(1)
		expect(decoded[0].action).toBe(3) // Action.PoolClaimAssignmentDefault
		expect(decoded[0].id).toBe(0n) // reservationId
		expect(decoded[0].subId).toBe(0n) // assignmentIndex
	})

	test('skips when nothing is due', async () => {
		const evmMock = EvmMock.testInstance(CHAIN_SELECTOR)
		const marketMock = newCapacityMarketMock(MARKET_ADDRESS, evmMock)
		const poolMock = newCapacityPoolMock(POOL_ADDRESS, evmMock)
		newCREDeadlineReceiverMock(RECEIVER_ADDRESS, evmMock)

		const future = BigInt(Math.floor(Date.now() / 1000) + 3600)
		marketMock.nextPositionId = () => 1n
		marketMock.positions = () => emptyPosition(future, 0n, 2) // Activated, not due yet
		poolMock.nextReservationId = () => 0n

		const runtime = newTestRuntime()
		;(runtime as any).config = makeConfig()

		const result = onCronTrigger(runtime as any)
		expect(result).toContain('Skipped')
	})

	test('does not act on a Settled position (terminal, no deadline applies)', async () => {
		const evmMock = EvmMock.testInstance(CHAIN_SELECTOR)
		const marketMock = newCapacityMarketMock(MARKET_ADDRESS, evmMock)
		const poolMock = newCapacityPoolMock(POOL_ADDRESS, evmMock)
		newCREDeadlineReceiverMock(RECEIVER_ADDRESS, evmMock)

		const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 3600)
		marketMock.nextPositionId = () => 1n
		marketMock.positions = () => emptyPosition(pastDeadline, pastDeadline, 6) // Status.Settled
		poolMock.nextReservationId = () => 0n

		const runtime = newTestRuntime()
		;(runtime as any).config = makeConfig()

		const result = onCronTrigger(runtime as any)
		expect(result).toContain('Skipped')
	})
})

describe('initWorkflow', () => {
	test('returns a handler subscribed to the configured cron schedule', () => {
		const config = makeConfig()
		const handlers = initWorkflow(config)

		expect(handlers).toHaveLength(1)
		expect(handlers[0].fn).toBe(onCronTrigger)

		const cronTrigger = handlers[0].trigger as { config?: { schedule?: string } }
		expect(cronTrigger.config?.schedule).toBe(config.schedule)
	})
})
