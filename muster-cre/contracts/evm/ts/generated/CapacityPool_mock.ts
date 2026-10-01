// Code generated — DO NOT EDIT.
import type { Address } from 'viem'
import { addContractMock, type ContractMock, type EvmMock } from '@chainlink/cre-sdk/test'

import { CapacityPoolABI } from './CapacityPool'

export type CapacityPoolMock = {
  mAXDURATION?: () => bigint
  mAXPANELSIZE?: () => bigint
  assignmentInfo?: (reservationId: bigint, index: bigint) => readonly [`0x${string}`, bigint, bigint, bigint, `0x${string}`, bigint, number]
  classId?: (terms: { domain: `0x${string}`; validFrom: bigint; validUntil: bigint; activationSLA: bigint; disputeWindow: bigint; panelMembers: readonly `0x${string}`[]; panelThreshold: bigint; pricePerUnit: bigint; collateralPerUnit: bigint }) => `0x${string}`
  contributionInfo?: (id: `0x${string}`, index: bigint) => readonly [`0x${string}`, bigint]
  nextReservationId?: () => bigint
  poolInfo?: (id: `0x${string}`) => readonly [{ domain: `0x${string}`; validFrom: bigint; validUntil: bigint; activationSLA: bigint; disputeWindow: bigint; panelMembers: readonly `0x${string}`[]; panelThreshold: bigint; pricePerUnit: bigint; collateralPerUnit: bigint }, bigint, bigint, bigint]
  reservationInfo?: (reservationId: bigint) => readonly [`0x${string}`, `0x${string}`, bigint, bigint, number, bigint]
} & Pick<ContractMock<typeof CapacityPoolABI>, 'writeReport'>

export function newCapacityPoolMock(address: Address, evmMock: EvmMock): CapacityPoolMock {
  return addContractMock(evmMock, { address, abi: CapacityPoolABI }) as CapacityPoolMock
}

