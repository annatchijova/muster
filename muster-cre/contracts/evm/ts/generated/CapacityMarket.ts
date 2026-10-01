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
 * Filter params for Accepted. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type AcceptedTopics = {
  positionId?: bigint
}

/**
 * Decoded Accepted event data.
 */
export type AcceptedDecoded = {
  positionId: bigint
}


/**
 * Filter params for Activated. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ActivatedTopics = {
  positionId?: bigint
}

/**
 * Decoded Activated event data.
 */
export type ActivatedDecoded = {
  positionId: bigint
  activationDeadline: bigint
}


/**
 * Filter params for Defaulted. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type DefaultedTopics = {
  positionId?: bigint
}

/**
 * Decoded Defaulted event data.
 */
export type DefaultedDecoded = {
  positionId: bigint
}


/**
 * Filter params for DeliveryClaimed. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type DeliveryClaimedTopics = {
  positionId?: bigint
}

/**
 * Decoded DeliveryClaimed event data.
 */
export type DeliveryClaimedDecoded = {
  positionId: bigint
  evidenceHash: `0x${string}`
  disputeDeadline: bigint
}


/**
 * Filter params for DisputeResolved. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type DisputeResolvedTopics = {
  positionId?: bigint
}

/**
 * Decoded DisputeResolved event data.
 */
export type DisputeResolvedDecoded = {
  positionId: bigint
  providerWon: boolean
}


/**
 * Filter params for DisputeVoteCast. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type DisputeVoteCastTopics = {
  positionId?: bigint
  voter?: `0x${string}`
}

/**
 * Decoded DisputeVoteCast event data.
 */
export type DisputeVoteCastDecoded = {
  positionId: bigint
  voter: `0x${string}`
  providerWins: boolean
  providerVotes: bigint
  buyerVotes: bigint
}


/**
 * Filter params for Disputed. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type DisputedTopics = {
  positionId?: bigint
}

/**
 * Decoded Disputed event data.
 */
export type DisputedDecoded = {
  positionId: bigint
  reasonHash: `0x${string}`
  resolutionDeadline: bigint
}


/**
 * Filter params for Expired. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ExpiredTopics = {
  positionId?: bigint
}

/**
 * Decoded Expired event data.
 */
export type ExpiredDecoded = {
  positionId: bigint
}


/**
 * Filter params for Listed. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ListedTopics = {
  positionId?: bigint
  provider?: `0x${string}`
}

/**
 * Decoded Listed event data.
 */
export type ListedDecoded = {
  positionId: bigint
  provider: `0x${string}`
  domain: `0x${string}`
  quantity: bigint
  validFrom: bigint
  validUntil: bigint
  activationSLA: bigint
  price: bigint
  collateral: bigint
}


/**
 * Filter params for Refunded. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type RefundedTopics = {
  positionId?: bigint
}

/**
 * Decoded Refunded event data.
 */
export type RefundedDecoded = {
  positionId: bigint
}


/**
 * Filter params for Reserved. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type ReservedTopics = {
  positionId?: bigint
  buyer?: `0x${string}`
}

/**
 * Decoded Reserved event data.
 */
export type ReservedDecoded = {
  positionId: bigint
  buyer: `0x${string}`
}


/**
 * Filter params for Settled. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type SettledTopics = {
  positionId?: bigint
}

/**
 * Decoded Settled event data.
 */
export type SettledDecoded = {
  positionId: bigint
}


/**
 * Filter params for Transferred. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type TransferredTopics = {
  positionId?: bigint
  from?: `0x${string}`
  to?: `0x${string}`
}

/**
 * Decoded Transferred event data.
 */
export type TransferredDecoded = {
  positionId: bigint
  from: `0x${string}`
  to: `0x${string}`
}


export const CapacityMarketABI = [{"type":"function","name":"MAX_DURATION","inputs":[],"outputs":[{"name":"","type":"uint64","internalType":"uint64"}],"stateMutability":"view"},{"type":"function","name":"MAX_PANEL_SIZE","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"acceptActivation","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"activate","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"arbitrationPanel","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"members","type":"address[]","internalType":"address[]"},{"name":"threshold","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"claimDefault","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"claimDelivery","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"},{"name":"evidenceHash","type":"bytes32","internalType":"bytes32"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"dispute","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"},{"name":"reasonHash","type":"bytes32","internalType":"bytes32"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"expire","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"finalizeDelivery","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"listCapacity","inputs":[{"name":"domain","type":"bytes32","internalType":"bytes32"},{"name":"quantity","type":"uint256","internalType":"uint256"},{"name":"validFrom","type":"uint64","internalType":"uint64"},{"name":"validUntil","type":"uint64","internalType":"uint64"},{"name":"activationSLA","type":"uint64","internalType":"uint64"},{"name":"disputeWindow","type":"uint64","internalType":"uint64"},{"name":"panelMembers","type":"address[]","internalType":"address[]"},{"name":"panelThreshold","type":"uint256","internalType":"uint256"},{"name":"price","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"positionId","type":"uint256","internalType":"uint256"}],"stateMutability":"payable"},{"type":"function","name":"nextPositionId","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"positions","inputs":[{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"domain","type":"bytes32","internalType":"bytes32"},{"name":"quantity","type":"uint256","internalType":"uint256"},{"name":"validFrom","type":"uint64","internalType":"uint64"},{"name":"validUntil","type":"uint64","internalType":"uint64"},{"name":"activationSLA","type":"uint64","internalType":"uint64"},{"name":"disputeWindow","type":"uint64","internalType":"uint64"},{"name":"provider","type":"address","internalType":"address"},{"name":"buyer","type":"address","internalType":"address"},{"name":"price","type":"uint256","internalType":"uint256"},{"name":"collateral","type":"uint256","internalType":"uint256"},{"name":"activationDeadline","type":"uint64","internalType":"uint64"},{"name":"disputeDeadline","type":"uint64","internalType":"uint64"},{"name":"deliveryEvidenceHash","type":"bytes32","internalType":"bytes32"},{"name":"status","type":"uint8","internalType":"enumCapacityMarket.Status"}],"stateMutability":"view"},{"type":"function","name":"reserve","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"payable"},{"type":"function","name":"resolveDisputeByTimeout","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"settle","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"transfer","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"},{"name":"to","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"voteDispute","inputs":[{"name":"positionId","type":"uint256","internalType":"uint256"},{"name":"providerWins","type":"bool","internalType":"bool"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"event","name":"Accepted","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"Activated","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"activationDeadline","type":"uint64","indexed":false,"internalType":"uint64"}],"anonymous":false},{"type":"event","name":"Defaulted","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"DeliveryClaimed","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"evidenceHash","type":"bytes32","indexed":false,"internalType":"bytes32"},{"name":"disputeDeadline","type":"uint64","indexed":false,"internalType":"uint64"}],"anonymous":false},{"type":"event","name":"DisputeResolved","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"providerWon","type":"bool","indexed":false,"internalType":"bool"}],"anonymous":false},{"type":"event","name":"DisputeVoteCast","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"voter","type":"address","indexed":true,"internalType":"address"},{"name":"providerWins","type":"bool","indexed":false,"internalType":"bool"},{"name":"providerVotes","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"buyerVotes","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"Disputed","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"reasonHash","type":"bytes32","indexed":false,"internalType":"bytes32"},{"name":"resolutionDeadline","type":"uint64","indexed":false,"internalType":"uint64"}],"anonymous":false},{"type":"event","name":"Expired","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"Listed","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"provider","type":"address","indexed":true,"internalType":"address"},{"name":"domain","type":"bytes32","indexed":false,"internalType":"bytes32"},{"name":"quantity","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"validFrom","type":"uint64","indexed":false,"internalType":"uint64"},{"name":"validUntil","type":"uint64","indexed":false,"internalType":"uint64"},{"name":"activationSLA","type":"uint64","indexed":false,"internalType":"uint64"},{"name":"price","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"collateral","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"Refunded","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"Reserved","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"buyer","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},{"type":"event","name":"Settled","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"Transferred","inputs":[{"name":"positionId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"from","type":"address","indexed":true,"internalType":"address"},{"name":"to","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},{"type":"error","name":"AlreadyVoted","inputs":[]},{"type":"error","name":"DeadlineNotPassed","inputs":[]},{"type":"error","name":"DeadlinePassed","inputs":[]},{"type":"error","name":"DisputeWindowClosed","inputs":[]},{"type":"error","name":"DisputeWindowOpen","inputs":[]},{"type":"error","name":"DurationTooLong","inputs":[]},{"type":"error","name":"InvalidPanel","inputs":[]},{"type":"error","name":"InvalidWindow","inputs":[]},{"type":"error","name":"NotArbitrator","inputs":[]},{"type":"error","name":"NotBuyer","inputs":[]},{"type":"error","name":"NotProvider","inputs":[]},{"type":"error","name":"WindowClosed","inputs":[]},{"type":"error","name":"WindowNotOpen","inputs":[]},{"type":"error","name":"WindowNotYetClosed","inputs":[]},{"type":"error","name":"WrongStatus","inputs":[{"name":"expected","type":"uint8","internalType":"enumCapacityMarket.Status"},{"name":"actual","type":"uint8","internalType":"enumCapacityMarket.Status"}]},{"type":"error","name":"WrongValue","inputs":[]}] as const

export class CapacityMarket {
  constructor(
    private readonly client: EVMClient,
    public readonly address: Address,
  ) {}

  mAXDURATION(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'MAX_DURATION' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityMarketABI,
      functionName: 'MAX_DURATION' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  mAXPANELSIZE(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'MAX_PANEL_SIZE' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityMarketABI,
      functionName: 'MAX_PANEL_SIZE' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  arbitrationPanel(
    runtime: Runtime<unknown>,
    positionId: bigint,
  ): readonly [readonly `0x${string}`[], bigint] {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'arbitrationPanel' as const,
      args: [positionId],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityMarketABI,
      functionName: 'arbitrationPanel' as const,
      data: bytesToHex(result.data),
    }) as readonly [readonly `0x${string}`[], bigint]
  }

  nextPositionId(
    runtime: Runtime<unknown>,
  ): bigint {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'nextPositionId' as const,
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityMarketABI,
      functionName: 'nextPositionId' as const,
      data: bytesToHex(result.data),
    }) as bigint
  }

  positions(
    runtime: Runtime<unknown>,
    arg0: bigint,
  ): readonly [`0x${string}`, bigint, bigint, bigint, bigint, bigint, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, `0x${string}`, number] {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'positions' as const,
      args: [arg0],
    })

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data: callData }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: CapacityMarketABI,
      functionName: 'positions' as const,
      data: bytesToHex(result.data),
    }) as readonly [`0x${string}`, bigint, bigint, bigint, bigint, bigint, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, `0x${string}`, number]
  }

  writeReportFromAcceptActivation(
    runtime: Runtime<unknown>,
    positionId: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'acceptActivation' as const,
      args: [positionId],
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
    positionId: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'activate' as const,
      args: [positionId],
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

  writeReportFromClaimDefault(
    runtime: Runtime<unknown>,
    positionId: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'claimDefault' as const,
      args: [positionId],
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

  writeReportFromClaimDelivery(
    runtime: Runtime<unknown>,
    positionId: bigint,
    evidenceHash: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'claimDelivery' as const,
      args: [positionId, evidenceHash],
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

  writeReportFromDispute(
    runtime: Runtime<unknown>,
    positionId: bigint,
    reasonHash: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'dispute' as const,
      args: [positionId, reasonHash],
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

  writeReportFromExpire(
    runtime: Runtime<unknown>,
    positionId: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'expire' as const,
      args: [positionId],
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

  writeReportFromFinalizeDelivery(
    runtime: Runtime<unknown>,
    positionId: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'finalizeDelivery' as const,
      args: [positionId],
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

  writeReportFromListCapacity(
    runtime: Runtime<unknown>,
    domain: `0x${string}`,
    quantity: bigint,
    validFrom: bigint,
    validUntil: bigint,
    activationSLA: bigint,
    disputeWindow: bigint,
    panelMembers: readonly `0x${string}`[],
    panelThreshold: bigint,
    price: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'listCapacity' as const,
      args: [domain, quantity, validFrom, validUntil, activationSLA, disputeWindow, panelMembers, panelThreshold, price],
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
    positionId: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'reserve' as const,
      args: [positionId],
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

  writeReportFromResolveDisputeByTimeout(
    runtime: Runtime<unknown>,
    positionId: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'resolveDisputeByTimeout' as const,
      args: [positionId],
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

  writeReportFromSettle(
    runtime: Runtime<unknown>,
    positionId: bigint,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'settle' as const,
      args: [positionId],
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

  writeReportFromTransfer(
    runtime: Runtime<unknown>,
    positionId: bigint,
    to: `0x${string}`,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'transfer' as const,
      args: [positionId, to],
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

  writeReportFromVoteDispute(
    runtime: Runtime<unknown>,
    positionId: bigint,
    providerWins: boolean,
    gasConfig?: { gasLimit?: string },
  ) {
    const callData = encodeFunctionData({
      abi: CapacityMarketABI,
      functionName: 'voteDispute' as const,
      args: [positionId, providerWins],
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
   * Creates a log trigger for Accepted events.
   * The returned trigger's adapt method decodes the raw log into AcceptedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerAccepted(
    filters?: AcceptedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Accepted' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Accepted' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'Accepted' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<AcceptedDecoded> => contract.decodeAccepted(rawOutput),
    }
  }

  /**
   * Decodes a log into Accepted data, preserving all log metadata.
   */
  decodeAccepted(log: EVMLog): DecodedLog<AcceptedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as AcceptedDecoded }
  }

  /**
   * Creates a log trigger for Activated events.
   * The returned trigger's adapt method decodes the raw log into ActivatedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerActivated(
    filters?: ActivatedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Activated' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Activated' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'Activated' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<ActivatedDecoded> => contract.decodeActivated(rawOutput),
    }
  }

  /**
   * Decodes a log into Activated data, preserving all log metadata.
   */
  decodeActivated(log: EVMLog): DecodedLog<ActivatedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ActivatedDecoded }
  }

  /**
   * Creates a log trigger for Defaulted events.
   * The returned trigger's adapt method decodes the raw log into DefaultedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerDefaulted(
    filters?: DefaultedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Defaulted' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Defaulted' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'Defaulted' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<DefaultedDecoded> => contract.decodeDefaulted(rawOutput),
    }
  }

  /**
   * Decodes a log into Defaulted data, preserving all log metadata.
   */
  decodeDefaulted(log: EVMLog): DecodedLog<DefaultedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as DefaultedDecoded }
  }

  /**
   * Creates a log trigger for DeliveryClaimed events.
   * The returned trigger's adapt method decodes the raw log into DeliveryClaimedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerDeliveryClaimed(
    filters?: DeliveryClaimedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'DeliveryClaimed' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'DeliveryClaimed' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'DeliveryClaimed' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<DeliveryClaimedDecoded> => contract.decodeDeliveryClaimed(rawOutput),
    }
  }

  /**
   * Decodes a log into DeliveryClaimed data, preserving all log metadata.
   */
  decodeDeliveryClaimed(log: EVMLog): DecodedLog<DeliveryClaimedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as DeliveryClaimedDecoded }
  }

  /**
   * Creates a log trigger for DisputeResolved events.
   * The returned trigger's adapt method decodes the raw log into DisputeResolvedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerDisputeResolved(
    filters?: DisputeResolvedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'DisputeResolved' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'DisputeResolved' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'DisputeResolved' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<DisputeResolvedDecoded> => contract.decodeDisputeResolved(rawOutput),
    }
  }

  /**
   * Decodes a log into DisputeResolved data, preserving all log metadata.
   */
  decodeDisputeResolved(log: EVMLog): DecodedLog<DisputeResolvedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as DisputeResolvedDecoded }
  }

  /**
   * Creates a log trigger for DisputeVoteCast events.
   * The returned trigger's adapt method decodes the raw log into DisputeVoteCastDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerDisputeVoteCast(
    filters?: DisputeVoteCastTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'DisputeVoteCast' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
        voter: f.voter,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'DisputeVoteCast' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
          voter: f.voter,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'DisputeVoteCast' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<DisputeVoteCastDecoded> => contract.decodeDisputeVoteCast(rawOutput),
    }
  }

  /**
   * Decodes a log into DisputeVoteCast data, preserving all log metadata.
   */
  decodeDisputeVoteCast(log: EVMLog): DecodedLog<DisputeVoteCastDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as DisputeVoteCastDecoded }
  }

  /**
   * Creates a log trigger for Disputed events.
   * The returned trigger's adapt method decodes the raw log into DisputedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerDisputed(
    filters?: DisputedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Disputed' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Disputed' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'Disputed' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<DisputedDecoded> => contract.decodeDisputed(rawOutput),
    }
  }

  /**
   * Decodes a log into Disputed data, preserving all log metadata.
   */
  decodeDisputed(log: EVMLog): DecodedLog<DisputedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as DisputedDecoded }
  }

  /**
   * Creates a log trigger for Expired events.
   * The returned trigger's adapt method decodes the raw log into ExpiredDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerExpired(
    filters?: ExpiredTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Expired' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Expired' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'Expired' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<ExpiredDecoded> => contract.decodeExpired(rawOutput),
    }
  }

  /**
   * Decodes a log into Expired data, preserving all log metadata.
   */
  decodeExpired(log: EVMLog): DecodedLog<ExpiredDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ExpiredDecoded }
  }

  /**
   * Creates a log trigger for Listed events.
   * The returned trigger's adapt method decodes the raw log into ListedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerListed(
    filters?: ListedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Listed' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
        provider: f.provider,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Listed' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
          provider: f.provider,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'Listed' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<ListedDecoded> => contract.decodeListed(rawOutput),
    }
  }

  /**
   * Decodes a log into Listed data, preserving all log metadata.
   */
  decodeListed(log: EVMLog): DecodedLog<ListedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ListedDecoded }
  }

  /**
   * Creates a log trigger for Refunded events.
   * The returned trigger's adapt method decodes the raw log into RefundedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerRefunded(
    filters?: RefundedTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Refunded' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Refunded' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'Refunded' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<RefundedDecoded> => contract.decodeRefunded(rawOutput),
    }
  }

  /**
   * Decodes a log into Refunded data, preserving all log metadata.
   */
  decodeRefunded(log: EVMLog): DecodedLog<RefundedDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as RefundedDecoded }
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
        abi: CapacityMarketABI,
        eventName: 'Reserved' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
        buyer: f.buyer,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Reserved' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
          buyer: f.buyer,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
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
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as ReservedDecoded }
  }

  /**
   * Creates a log trigger for Settled events.
   * The returned trigger's adapt method decodes the raw log into SettledDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerSettled(
    filters?: SettledTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Settled' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Settled' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'Settled' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<SettledDecoded> => contract.decodeSettled(rawOutput),
    }
  }

  /**
   * Decodes a log into Settled data, preserving all log metadata.
   */
  decodeSettled(log: EVMLog): DecodedLog<SettledDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as SettledDecoded }
  }

  /**
   * Creates a log trigger for Transferred events.
   * The returned trigger's adapt method decodes the raw log into TransferredDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerTransferred(
    filters?: TransferredTopics[],
  ) {
    let topics: { values: string[] }[]
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Transferred' as const,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else if (filters.length === 1) {
      const f = filters[0]
      const args = {
        positionId: f.positionId,
        from: f.from,
        to: f.to,
      }
      const encoded = encodeEventTopics({
        abi: CapacityMarketABI,
        eventName: 'Transferred' as const,
        args,
      })
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }))
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          positionId: f.positionId,
          from: f.from,
          to: f.to,
        }
        return encodeEventTopics({
          abi: CapacityMarketABI,
          eventName: 'Transferred' as const,
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
      adapt: (rawOutput: EVMLog): DecodedLog<TransferredDecoded> => contract.decodeTransferred(rawOutput),
    }
  }

  /**
   * Decodes a log into Transferred data, preserving all log metadata.
   */
  decodeTransferred(log: EVMLog): DecodedLog<TransferredDecoded> {
    const decoded = decodeEventLog({
      abi: CapacityMarketABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    })
    const { data: _, ...rest } = log
    return { ...rest, data: decoded.args as unknown as TransferredDecoded }
  }
}

