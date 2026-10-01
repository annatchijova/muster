// Code generated — DO NOT EDIT.
import type { Address } from 'viem'
import { addContractMock, type ContractMock, type EvmMock } from '@chainlink/cre-sdk/test'

import { CapacityMarketABI } from './CapacityMarket'

export type CapacityMarketMock = {
  mAXDURATION?: () => bigint
  mAXPANELSIZE?: () => bigint
  arbitrationPanel?: (positionId: bigint) => readonly [readonly `0x${string}`[], bigint]
  nextPositionId?: () => bigint
  positions?: (arg0: bigint) => readonly [`0x${string}`, bigint, bigint, bigint, bigint, bigint, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, `0x${string}`, number]
} & Pick<ContractMock<typeof CapacityMarketABI>, 'writeReport'>

export function newCapacityMarketMock(address: Address, evmMock: EvmMock): CapacityMarketMock {
  return addContractMock(evmMock, { address, abi: CapacityMarketABI }) as CapacityMarketMock
}

