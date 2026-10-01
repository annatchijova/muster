// Code generated — DO NOT EDIT.
import {
  decodeEventLog,
  decodeFunctionResult,
  encodeEventTopics,
  encodeFunctionData,
  zeroAddress,
} from 'viem'
import type { Address, Hex } from 'viem'
import {
  bytesToHex,
  encodeCallMsg,
  EVMClient,
  hexToBase64,
  LAST_FINALIZED_BLOCK_NUMBER,
  prepareReportRequest,
  type EVMLog,
  type Runtime,
} from '@chainlink/cre-sdk'

export interface DecodedLog<T> extends Omit<EVMLog, 'data'> { data: T }

const encodeTopicValue = (t: Hex | Hex[] | null): string[] => {
  if (t == null) return []
  if (Array.isArray(t)) return t.map(hexToBase64)
  return [hexToBase64(t)]
}





/**
 * Filter params for AssignmentAccepted. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type AssignmentAcceptedTopics = {
  reservationId?: bigint
  assignmentIndex?: bigint
  provider?: `0x${string}`
}

/**
 * Decoded AssignmentAccepted event data.
 */
export type AssignmentAcceptedDecoded = {
  reservationId: bigint
  assignmentIndex: bigint
  provider: `0x${string}`
}


/**
 * Filter params for AssignmentDefaulted. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type AssignmentDefaultedTopics = {
  reservationId?: bigint
  assignmentIndex?: bigint
  provider?: `0x${string}`
}

/**
 * Decoded AssignmentDefaulted event data.
 */
export type AssignmentDefaultedDecoded = {
  reservationId: bigint
  assignmentIndex: bigint
  provider: `0x${string}`
}


/**
 * Filter params for AssignmentDeliveryClaimed. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type AssignmentDeliveryClaimedTopics = {
  reservationId?: bigint
  assignmentIndex?: bigint
}

/**
 * Decoded AssignmentDeliveryClaimed event data.
 */
export type AssignmentDeliveryClaimedDecoded = {
  reservationId: bigint
  assignmentIndex: bigint
  evidenceHash: `0x${string}`
  disputeDeadline: bigint
}


/**
 * Filter params for AssignmentDisputeResolved. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type AssignmentDisputeResolvedTopics = {
  reservationId?: bigint
  assignmentIndex?: bigint
}

/**
 * Decoded AssignmentDisputeResolved event data.
 */
export type AssignmentDisputeResolvedDecoded = {
  reservationId: bigint
  assignmentIndex: bigint
  providerWon: boolean
}


/**
 * Filter params for AssignmentDisputeVoteCast. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type AssignmentDisputeVoteCastTopics = {
  reservationId?: bigint
  assignmentIndex?: bigint
  voter?: `0x${string}`
}

/**
 * Decoded AssignmentDisputeVoteCast event data.
 */
export type AssignmentDisputeVoteCastDecoded = {
  reservationId: bigint
  assignmentIndex: bigint
  voter: `0x${string}`
  providerWins: boolean
  providerVotes: bigint
  buyerVotes: bigint
}


/**
 * Filter params for AssignmentDisputed. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type AssignmentDisputedTopics = {
  reservationId?: bigint
  assignmentIndex?: bigint
}

/**
 * Decoded AssignmentDisputed event data.
 */
export type AssignmentDisputedDecoded = {
  reservationId: bigint
  assignmentIndex: bigint
  reasonHash: `0x${string}`
  resolutionDeadline: bigint
}


/**
 * Filter params for AssignmentRefunded. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type AssignmentRefundedTopics = {
  reservationId?: bigint
  assignmentIndex?: bigint
  buyer?: `0x${string}`
}

/**
 * Decoded AssignmentRefunded event data.
 */
export type AssignmentRefundedDecoded = {
  reservationId: bigint
  assignmentIndex: bigint
  buyer: `0x${string}`
}


/**
 * Filter params for AssignmentSettled. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type AssignmentSettledTopics = {
  reservationId?: bigint
  assignmentIndex?: bigint
  provider?: `0x${string}`
}

/**
 * Decoded AssignmentSettled event data.
 */
export type AssignmentSettledDecoded = {
  reservationId: bigint
  assignmentIndex: bigint
  provider: `0x${string}`
}


/**
 * Filter params for Contributed. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ContributedTopics = {
  classId?: `0x${string}`
  provider?: `0x${string}`
}

/**
 * Decoded Contributed event data.
 */
export type ContributedDecoded = {
  classId: `0x${string}`
  provider: `0x${string}`
  quantity: bigint
  collateral: bigint
}


/**
 * Filter params for ContributionWithdrawn. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ContributionWithdrawnTopics = {
  classId?: `0x${string}`
  index?: bigint
  provider?: `0x${string}`
}

/**
 * Decoded ContributionWithdrawn event data.
 */
export type ContributionWithdrawnDecoded = {
  classId: `0x${string}`
  index: bigint
  provider: `0x${string}`
  amount: bigint
}


/**
 * Filter params for ReservationActivated. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ReservationActivatedTopics = {
  reservationId?: bigint
}

/**
 * Decoded ReservationActivated event data.
 */
export type ReservationActivatedDecoded = {
  reservationId: bigint
  activationDeadline: bigint
  assignmentCount: bigint
}


/**
 * Filter params for ReservationExpired. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ReservationExpiredTopics = {
  reservationId?: bigint
}

/**
 * Decoded ReservationExpired event data.
 */
export type ReservationExpiredDecoded = {
  reservationId: bigint
}


/**
 * Filter params for ReservationTransferred. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ReservationTransferredTopics = {
  reservationId?: bigint
  from?: `0x${string}`
  to?: `0x${string}`
}

/**
 * Decoded ReservationTransferred event data.
 */
export type ReservationTransferredDecoded = {
  reservationId: bigint
  from: `0x${string}`
  to: `0x${string}`
}


/**
 * Filter params for Reserved. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ReservedTopics = {
  reservationId?: bigint
  classId?: `0x${string}`
  buyer?: `0x${string}`
}

/**
 * Decoded Reserved event data.
 */
export type ReservedDecoded = {
  reservationId: bigint
  classId: `0x${string}`
  buyer: `0x${string}`
  quantity: bigint
}


export const CapacityPoolABI = [{"type":"function","name":"MAX_DURATION","inputs":[],"outputs":[{"name":"","type":"uint64","internalType":"uint64"}],"stateMutability":"view"},{"type":"function","name":"MAX_PANEL_SIZE","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"acceptAssignment","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"activate","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"assignmentInfo","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"},{"name":"index","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"provider","type":"address","internalType":"address"},{"name":"quantity","type":"uint256","internalType":"uint256"},{"name":"price","type":"uint256","internalType":"uint256"},{"name":"collateral","type":"uint256","internalType":"uint256"},{"name":"deliveryEvidenceHash","type":"bytes32","internalType":"bytes32"},{"name":"disputeDeadline","type":"uint64","internalType":"uint64"},{"name":"status","type":"uint8","internalType":"enumCapacityPool.AssignmentStatus"}],"stateMutability":"view"},{"type":"function","name":"claimAssignmentDefault","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"claimAssignmentDelivery","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","internalType":"uint256"},{"name":"evidenceHash","type":"bytes32","internalType":"bytes32"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"classId","inputs":[{"name":"terms","type":"tuple","internalType":"structCapacityPool.TermsClass","components":[{"name":"domain","type":"bytes32","internalType":"bytes32"},{"name":"validFrom","type":"uint64","internalType":"uint64"},{"name":"validUntil","type":"uint64","internalType":"uint64"},{"name":"activationSLA","type":"uint64","internalType":"uint64"},{"name":"disputeWindow","type":"uint64","internalType":"uint64"},{"name":"panelMembers","type":"address[]","internalType":"address[]"},{"name":"panelThreshold","type":"uint256","internalType":"uint256"},{"name":"pricePerUnit","type":"uint256","internalType":"uint256"},{"name":"collateralPerUnit","type":"uint256","internalType":"uint256"}]}],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"pure"},{"type":"function","name":"contribute","inputs":[{"name":"terms","type":"tuple","internalType":"structCapacityPool.TermsClass","components":[{"name":"domain","type":"bytes32","internalType":"bytes32"},{"name":"validFrom","type":"uint64","internalType":"uint64"},{"name":"validUntil","type":"uint64","internalType":"uint64"},{"name":"activationSLA","type":"uint64","internalType":"uint64"},{"name":"disputeWindow","type":"uint64","internalType":"uint64"},{"name":"panelMembers","type":"address[]","internalType":"address[]"},{"name":"panelThreshold","type":"uint256","internalType":"uint256"},{"name":"pricePerUnit","type":"uint256","internalType":"uint256"},{"name":"collateralPerUnit","type":"uint256","internalType":"uint256"}]},{"name":"quantity","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"id","type":"bytes32","internalType":"bytes32"}],"stateMutability":"payable"},{"type":"function","name":"contributionInfo","inputs":[{"name":"id","type":"bytes32","internalType":"bytes32"},{"name":"index","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"provider","type":"address","internalType":"address"},{"name":"remaining","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"disputeAssignment","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","internalType":"uint256"},{"name":"reasonHash","type":"bytes32","internalType":"bytes32"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"expireReservation","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"finalizeAssignmentDelivery","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"nextReservationId","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"poolInfo","inputs":[{"name":"id","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"terms","type":"tuple","internalType":"structCapacityPool.TermsClass","components":[{"name":"domain","type":"bytes32","internalType":"bytes32"},{"name":"validFrom","type":"uint64","internalType":"uint64"},{"name":"validUntil","type":"uint64","internalType":"uint64"},{"name":"activationSLA","type":"uint64","internalType":"uint64"},{"name":"disputeWindow","type":"uint64","internalType":"uint64"},{"name":"panelMembers","type":"address[]","internalType":"address[]"},{"name":"panelThreshold","type":"uint256","internalType":"uint256"},{"name":"pricePerUnit","type":"uint256","internalType":"uint256"},{"name":"collateralPerUnit","type":"uint256","internalType":"uint256"}]},{"name":"totalCommitted","type":"uint256","internalType":"uint256"},{"name":"available","type":"uint256","internalType":"uint256"},{"name":"contributionsCount","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"reservationInfo","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"classId_","type":"bytes32","internalType":"bytes32"},{"name":"buyer","type":"address","internalType":"address"},{"name":"quantity","type":"uint256","internalType":"uint256"},{"name":"activationDeadline","type":"uint64","internalType":"uint64"},{"name":"status","type":"uint8","internalType":"enumCapacityPool.ReservationStatus"},{"name":"assignmentCount","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"reserve","inputs":[{"name":"id","type":"bytes32","internalType":"bytes32"},{"name":"quantity","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"}],"stateMutability":"payable"},{"type":"function","name":"resolveAssignmentDisputeByTimeout","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"settleAssignment","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"transferReservation","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"},{"name":"to","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"voteAssignmentDispute","inputs":[{"name":"reservationId","type":"uint256","internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","internalType":"uint256"},{"name":"providerWins","type":"bool","internalType":"bool"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"withdrawContribution","inputs":[{"name":"id","type":"bytes32","internalType":"bytes32"},{"name":"index","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"event","name":"AssignmentAccepted","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"provider","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},{"type":"event","name":"AssignmentDefaulted","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"provider","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},{"type":"event","name":"AssignmentDeliveryClaimed","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"evidenceHash","type":"bytes32","indexed":false,"internalType":"bytes32"},{"name":"disputeDeadline","type":"uint64","indexed":false,"internalType":"uint64"}],"anonymous":false},{"type":"event","name":"AssignmentDisputeResolved","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"providerWon","type":"bool","indexed":false,"internalType":"bool"}],"anonymous":false},{"type":"event","name":"AssignmentDisputeVoteCast","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"voter","type":"address","indexed":true,"internalType":"address"},{"name":"providerWins","type":"bool","indexed":false,"internalType":"bool"},{"name":"providerVotes","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"buyerVotes","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"AssignmentDisputed","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"reasonHash","type":"bytes32","indexed":false,"internalType":"bytes32"},{"name":"resolutionDeadline","type":"uint64","indexed":false,"internalType":"uint64"}],"anonymous":false},{"type":"event","name":"AssignmentRefunded","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"buyer","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},{"type":"event","name":"AssignmentSettled","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"assignmentIndex","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"provider","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},{"type":"event","name":"Contributed","inputs":[{"name":"classId","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"provider","type":"address","indexed":true,"internalType":"address"},{"name":"quantity","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"collateral","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"ContributionWithdrawn","inputs":[{"name":"classId","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"index","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"provider","type":"address","indexed":true,"internalType":"address"},{"name":"amount","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"ReservationActivated","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"activationDeadline","type":"uint64","indexed":false,"internalType":"uint64"},{"name":"assignmentCount","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"ReservationExpired","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"ReservationTransferred","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"from","type":"address","indexed":true,"internalType":"address"},{"name":"to","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},{"type":"event","name":"Reserved","inputs":[{"name":"reservationId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"classId","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"buyer","type":"address","indexed":true,"internalType":"address"},{"name":"quantity","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"error","name":"AlreadyVoted","inputs":[]},{"type":"error","name":"DeadlineNotPassed","inputs":[]},{"type":"error","name":"DeadlinePassed","inputs":[]},{"type":"error","name":"DisputeWindowClosed","inputs":[]},{"type":"error","name":"DisputeWindowOpen","inputs":[]},{"type":"error","name":"DurationTooLong","inputs":[]},{"type":"error","name":"InsufficientAvailableCapacity","inputs":[]},{"type":"error","name":"InvalidPanel","inputs":[]},{"type":"error","name":"InvalidWindow","inputs":[]},{"type":"error","name":"NotArbitrator","inputs":[]},{"type":"error","name":"NotBuyer","inputs":[]},{"type":"error","name":"NotProvider","inputs":[]},{"type":"error","name":"WindowClosed","inputs":[]},{"type":"error","name":"WindowNotOpen","inputs":[]},{"type":"error","name":"WindowNotYetClosed","inputs":[]},{"type":"error","name":"WrongAssignmentStatus","inputs":[{"name":"expected","type":"uint8","internalType":"enumCapacityPool.AssignmentStatus"},{"name":"actual","type":"uint8","internalType":"enumCapacityPool.AssignmentStatus"}]},{"type":"error","name":"WrongReservationStatus","inputs":[{"name":"expected","type":"uint8","internalType":"enumCapacityPool.ReservationStatus"},{"name":"actual","type":"uint8","internalType":"enumCapacityPool.ReservationStatus"}]},{"type":"error","name":"WrongValue","inputs":[]}] as const

export class CapacityPool {
  constructor(
    private readonly client: EVMClient,
    public readonly address: Address,
  ) {}

  mAXDURATION(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'MAX_DURATION' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityPoolABI,
      functionName: 'MAX_DURATION' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  mAXPANELSIZE(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'MAX_PANEL_SIZE' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityPoolABI,
      functionName: 'MAX_PANEL_SIZE' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  assignmentInfo(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    index: bigint,
  ): readonly [`0x${string}`, bigint, bigint, bigint, `0x${string}`, bigint, number] {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'assignmentInfo' as const,
      args: [reservationId, index],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityPoolABI,
      functionName: 'assignmentInfo' as const,
      data: bytesToHex(result.data),
    }) as readonly [`0x${string}`, bigint, bigint, bigint, `0x${string}`, bigint, number]
  }

  classId(
    runtime: Runtime<unknown>,
    terms: { domain: `0x${string}`; validFrom: bigint; validUntil: bigint; activationSLA: bigint; disputeWindow: bigint; panelMembers: readonly `0x${string}`[]; panelThreshold: bigint; pricePerUnit: bigint; collateralPerUnit: bigint },
  ): `0x${string}` {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'classId' as const,
      args: [terms],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityPoolABI,
      functionName: 'classId' as const,
      data: bytesToHex(result.data),
    }) as `0x${string}`
  }

  contributionInfo(
    runtime: Runtime<unknown>,
    id: `0x${string}`,
    index: bigint,
  ): readonly [`0x${string}`, bigint] {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'contributionInfo' as const,
      args: [id, index],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityPoolABI,
      functionName: 'contributionInfo' as const,
      data: bytesToHex(result.data),
    }) as readonly [`0x${string}`, bigint]
  }

  nextReservationId(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'nextReservationId' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityPoolABI,
      functionName: 'nextReservationId' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  poolInfo(
    runtime: Runtime<unknown>,
    id: `0x${string}`,
  ): readonly [{ domain: `0x${string}`; validFrom: bigint; validUntil: bigint; activationSLA: bigint; disputeWindow: bigint; panelMembers: readonly `0x${string}`[]; panelThreshold: bigint; pricePerUnit: bigint; collateralPerUnit: bigint }, bigint, bigint, bigint] {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'poolInfo' as const,
      args: [id],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityPoolABI,
      functionName: 'poolInfo' as const,
      data: bytesToHex(result.data),
    }) as readonly [{ domain: `0x${string}`; validFrom: bigint; validUntil: bigint; activationSLA: bigint; disputeWindow: bigint; panelMembers: readonly `0x${string}`[]; panelThreshold: bigint; pricePerUnit: bigint; collateralPerUnit: bigint }, bigint, bigint, bigint]
  }

  reservationInfo(
    runtime: Runtime<unknown>,
    reservationId: bigint,
  ): readonly [`0x${string}`, `0x${string}`, bigint, bigint, number, bigint] {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'reservationInfo' as const,
      args: [reservationId],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityPoolABI,
      functionName: 'reservationInfo' as const,
      data: bytesToHex(result.data),
    }) as readonly [`0x${string}`, `0x${string}`, bigint, bigint, number, bigint]
  }

  writeReportFromAcceptAssignment(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    assignmentIndex: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'acceptAssignment' as const,
      args: [reservationId, assignmentIndex],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromActivate(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'activate' as const,
      args: [reservationId],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromClaimAssignmentDefault(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    assignmentIndex: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'claimAssignmentDefault' as const,
      args: [reservationId, assignmentIndex],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromClaimAssignmentDelivery(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    assignmentIndex: bigint,
    evidenceHash: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'claimAssignmentDelivery' as const,
      args: [reservationId, assignmentIndex, evidenceHash],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromContribute(
    runtime: Runtime<unknown>,
    terms: { domain: `0x${string}`; validFrom: bigint; validUntil: bigint; activationSLA: bigint; disputeWindow: bigint; panelMembers: readonly `0x${string}`[]; panelThreshold: bigint; pricePerUnit: bigint; collateralPerUnit: bigint },
    quantity: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'contribute' as const,
      args: [terms, quantity],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromDisputeAssignment(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    assignmentIndex: bigint,
    reasonHash: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'disputeAssignment' as const,
      args: [reservationId, assignmentIndex, reasonHash],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromExpireReservation(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'expireReservation' as const,
      args: [reservationId],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromFinalizeAssignmentDelivery(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    assignmentIndex: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'finalizeAssignmentDelivery' as const,
      args: [reservationId, assignmentIndex],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromReserve(
    runtime: Runtime<unknown>,
    id: `0x${string}`,
    quantity: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'reserve' as const,
      args: [id, quantity],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromResolveAssignmentDisputeByTimeout(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    assignmentIndex: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'resolveAssignmentDisputeByTimeout' as const,
      args: [reservationId, assignmentIndex],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromSettleAssignment(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    assignmentIndex: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'settleAssignment' as const,
      args: [reservationId, assignmentIndex],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromTransferReservation(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    to: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'transferReservation' as const,
      args: [reservationId, to],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromVoteAssignmentDispute(
    runtime: Runtime<unknown>,
    reservationId: bigint,
    assignmentIndex: bigint,
    providerWins: boolean,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'voteAssignmentDispute' as const,
      args: [reservationId, assignmentIndex, providerWins],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReportFromWithdrawContribution(
    runtime: Runtime<unknown>,
    id: `0x${string}`,
    index: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityPoolABI,
      functionName: 'withdrawContribution' as const,
      args: [id, index],
    })

    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  writeReport(
    runtime: Runtime<unknown>,
    callData: Hex,
    gasConfig?: { gasLimit?: string },
  ) {
    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result()

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result()
  }

  /**
   * Creates a log trigger for AssignmentAccepted events.
   * The returned trigger's adapt method decodes the raw log into AssignmentAcceptedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerAssignmentAccepted(
    filters?: AssignmentAcceptedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentAccepted' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
        assignmentIndex: f.assignmentIndex,
        provider: f.provider,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentAccepted' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
          assignmentIndex: f.assignmentIndex,
          provider: f.provider,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'AssignmentAccepted' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<AssignmentAcceptedDecoded> => contract.decodeAssignmentAccepted(rawOutput),
    }
  }

  /**
   * Decodes a log into AssignmentAccepted data, preserving all log metadata.
   */
  decodeAssignmentAccepted(log: EVMLog): DecodedLog<AssignmentAcceptedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as AssignmentAcceptedDecoded }
  }

  /**
   * Creates a log trigger for AssignmentDefaulted events.
   * The returned trigger's adapt method decodes the raw log into AssignmentDefaultedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerAssignmentDefaulted(
    filters?: AssignmentDefaultedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentDefaulted' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
        assignmentIndex: f.assignmentIndex,
        provider: f.provider,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentDefaulted' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
          assignmentIndex: f.assignmentIndex,
          provider: f.provider,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'AssignmentDefaulted' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<AssignmentDefaultedDecoded> => contract.decodeAssignmentDefaulted(rawOutput),
    }
  }

  /**
   * Decodes a log into AssignmentDefaulted data, preserving all log metadata.
   */
  decodeAssignmentDefaulted(log: EVMLog): DecodedLog<AssignmentDefaultedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as AssignmentDefaultedDecoded }
  }

  /**
   * Creates a log trigger for AssignmentDeliveryClaimed events.
   * The returned trigger's adapt method decodes the raw log into AssignmentDeliveryClaimedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerAssignmentDeliveryClaimed(
    filters?: AssignmentDeliveryClaimedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentDeliveryClaimed' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
        assignmentIndex: f.assignmentIndex,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentDeliveryClaimed' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
          assignmentIndex: f.assignmentIndex,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'AssignmentDeliveryClaimed' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<AssignmentDeliveryClaimedDecoded> => contract.decodeAssignmentDeliveryClaimed(rawOutput),
    }
  }

  /**
   * Decodes a log into AssignmentDeliveryClaimed data, preserving all log metadata.
   */
  decodeAssignmentDeliveryClaimed(log: EVMLog): DecodedLog<AssignmentDeliveryClaimedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as AssignmentDeliveryClaimedDecoded }
  }

  /**
   * Creates a log trigger for AssignmentDisputeResolved events.
   * The returned trigger's adapt method decodes the raw log into AssignmentDisputeResolvedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerAssignmentDisputeResolved(
    filters?: AssignmentDisputeResolvedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentDisputeResolved' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
        assignmentIndex: f.assignmentIndex,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentDisputeResolved' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
          assignmentIndex: f.assignmentIndex,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'AssignmentDisputeResolved' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<AssignmentDisputeResolvedDecoded> => contract.decodeAssignmentDisputeResolved(rawOutput),
    }
  }

  /**
   * Decodes a log into AssignmentDisputeResolved data, preserving all log metadata.
   */
  decodeAssignmentDisputeResolved(log: EVMLog): DecodedLog<AssignmentDisputeResolvedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as AssignmentDisputeResolvedDecoded }
  }

  /**
   * Creates a log trigger for AssignmentDisputeVoteCast events.
   * The returned trigger's adapt method decodes the raw log into AssignmentDisputeVoteCastDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerAssignmentDisputeVoteCast(
    filters?: AssignmentDisputeVoteCastTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentDisputeVoteCast' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
        assignmentIndex: f.assignmentIndex,
        voter: f.voter,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentDisputeVoteCast' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
          assignmentIndex: f.assignmentIndex,
          voter: f.voter,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'AssignmentDisputeVoteCast' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<AssignmentDisputeVoteCastDecoded> => contract.decodeAssignmentDisputeVoteCast(rawOutput),
    }
  }

  /**
   * Decodes a log into AssignmentDisputeVoteCast data, preserving all log metadata.
   */
  decodeAssignmentDisputeVoteCast(log: EVMLog): DecodedLog<AssignmentDisputeVoteCastDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as AssignmentDisputeVoteCastDecoded }
  }

  /**
   * Creates a log trigger for AssignmentDisputed events.
   * The returned trigger's adapt method decodes the raw log into AssignmentDisputedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerAssignmentDisputed(
    filters?: AssignmentDisputedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentDisputed' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
        assignmentIndex: f.assignmentIndex,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentDisputed' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
          assignmentIndex: f.assignmentIndex,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'AssignmentDisputed' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<AssignmentDisputedDecoded> => contract.decodeAssignmentDisputed(rawOutput),
    }
  }

  /**
   * Decodes a log into AssignmentDisputed data, preserving all log metadata.
   */
  decodeAssignmentDisputed(log: EVMLog): DecodedLog<AssignmentDisputedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as AssignmentDisputedDecoded }
  }

  /**
   * Creates a log trigger for AssignmentRefunded events.
   * The returned trigger's adapt method decodes the raw log into AssignmentRefundedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerAssignmentRefunded(
    filters?: AssignmentRefundedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentRefunded' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
        assignmentIndex: f.assignmentIndex,
        buyer: f.buyer,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentRefunded' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
          assignmentIndex: f.assignmentIndex,
          buyer: f.buyer,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'AssignmentRefunded' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<AssignmentRefundedDecoded> => contract.decodeAssignmentRefunded(rawOutput),
    }
  }

  /**
   * Decodes a log into AssignmentRefunded data, preserving all log metadata.
   */
  decodeAssignmentRefunded(log: EVMLog): DecodedLog<AssignmentRefundedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as AssignmentRefundedDecoded }
  }

  /**
   * Creates a log trigger for AssignmentSettled events.
   * The returned trigger's adapt method decodes the raw log into AssignmentSettledDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerAssignmentSettled(
    filters?: AssignmentSettledTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentSettled' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
        assignmentIndex: f.assignmentIndex,
        provider: f.provider,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'AssignmentSettled' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
          assignmentIndex: f.assignmentIndex,
          provider: f.provider,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'AssignmentSettled' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<AssignmentSettledDecoded> => contract.decodeAssignmentSettled(rawOutput),
    }
  }

  /**
   * Decodes a log into AssignmentSettled data, preserving all log metadata.
   */
  decodeAssignmentSettled(log: EVMLog): DecodedLog<AssignmentSettledDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as AssignmentSettledDecoded }
  }

  /**
   * Creates a log trigger for Contributed events.
   * The returned trigger's adapt method decodes the raw log into ContributedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerContributed(
    filters?: ContributedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'Contributed' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        classId: f.classId,
        provider: f.provider,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'Contributed' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          classId: f.classId,
          provider: f.provider,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'Contributed' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<ContributedDecoded> => contract.decodeContributed(rawOutput),
    }
  }

  /**
   * Decodes a log into Contributed data, preserving all log metadata.
   */
  decodeContributed(log: EVMLog): DecodedLog<ContributedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ContributedDecoded }
  }

  /**
   * Creates a log trigger for ContributionWithdrawn events.
   * The returned trigger's adapt method decodes the raw log into ContributionWithdrawnDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerContributionWithdrawn(
    filters?: ContributionWithdrawnTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'ContributionWithdrawn' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        classId: f.classId,
        index: f.index,
        provider: f.provider,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'ContributionWithdrawn' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          classId: f.classId,
          index: f.index,
          provider: f.provider,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'ContributionWithdrawn' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<ContributionWithdrawnDecoded> => contract.decodeContributionWithdrawn(rawOutput),
    }
  }

  /**
   * Decodes a log into ContributionWithdrawn data, preserving all log metadata.
   */
  decodeContributionWithdrawn(log: EVMLog): DecodedLog<ContributionWithdrawnDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ContributionWithdrawnDecoded }
  }

  /**
   * Creates a log trigger for ReservationActivated events.
   * The returned trigger's adapt method decodes the raw log into ReservationActivatedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerReservationActivated(
    filters?: ReservationActivatedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'ReservationActivated' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'ReservationActivated' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'ReservationActivated' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<ReservationActivatedDecoded> => contract.decodeReservationActivated(rawOutput),
    }
  }

  /**
   * Decodes a log into ReservationActivated data, preserving all log metadata.
   */
  decodeReservationActivated(log: EVMLog): DecodedLog<ReservationActivatedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ReservationActivatedDecoded }
  }

  /**
   * Creates a log trigger for ReservationExpired events.
   * The returned trigger's adapt method decodes the raw log into ReservationExpiredDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerReservationExpired(
    filters?: ReservationExpiredTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'ReservationExpired' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'ReservationExpired' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'ReservationExpired' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<ReservationExpiredDecoded> => contract.decodeReservationExpired(rawOutput),
    }
  }

  /**
   * Decodes a log into ReservationExpired data, preserving all log metadata.
   */
  decodeReservationExpired(log: EVMLog): DecodedLog<ReservationExpiredDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ReservationExpiredDecoded }
  }

  /**
   * Creates a log trigger for ReservationTransferred events.
   * The returned trigger's adapt method decodes the raw log into ReservationTransferredDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerReservationTransferred(
    filters?: ReservationTransferredTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'ReservationTransferred' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
        from: f.from,
        to: f.to,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'ReservationTransferred' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
          from: f.from,
          to: f.to,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'ReservationTransferred' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<ReservationTransferredDecoded> => contract.decodeReservationTransferred(rawOutput),
    }
  }

  /**
   * Decodes a log into ReservationTransferred data, preserving all log metadata.
   */
  decodeReservationTransferred(log: EVMLog): DecodedLog<ReservationTransferredDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ReservationTransferredDecoded }
  }

  /**
   * Creates a log trigger for Reserved events.
   * The returned trigger's adapt method decodes the raw log into ReservedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerReserved(
    filters?: ReservedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'Reserved' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        reservationId: f.reservationId,
        classId: f.classId,
        buyer: f.buyer,
      }
      const encoded = encodeEventTopics({
        abi: CapacityPoolABI,
        eventName: 'Reserved' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          reservationId: f.reservationId,
          classId: f.classId,
          buyer: f.buyer,
        }
        return encodeEventTopics({
          abi: CapacityPoolABI,
          eventName: 'Reserved' as const,
          args,
        })
      })
      topics = allEncoded[0].map((_, i) => ({
        values: [...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i])))],
      }))
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    })
    const contract = this
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<ReservedDecoded> => contract.decodeReserved(rawOutput),
    }
  }

  /**
   * Decodes a log into Reserved data, preserving all log metadata.
   */
  decodeReserved(log: EVMLog): DecodedLog<ReservedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityPoolABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ReservedDecoded }
  }
}

