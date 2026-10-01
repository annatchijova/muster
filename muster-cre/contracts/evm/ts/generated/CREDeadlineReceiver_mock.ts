// Code generated — DO NOT EDIT.
import type { Address } from 'viem'
import { addContractMock, type ContractMock, type EvmMock } from '@chainlink/cre-sdk/test'

import { CREDeadlineReceiverABI } from './CREDeadlineReceiver'

export type CREDeadlineReceiverMock = {
  getExpectedAuthor?: () => `0x${string}`
  getExpectedWorkflowId?: () => `0x${string}`
  getExpectedWorkflowName?: () => `0x${string}`
  getForwarderAddress?: () => `0x${string}`
  market?: () => `0x${string}`
  owner?: () => `0x${string}`
  pool?: () => `0x${string}`
  supportsInterface?: (interfaceId: `0x${string}`) => boolean
} & Pick<ContractMock<typeof CREDeadlineReceiverABI>, 'writeReport'>

export function newCREDeadlineReceiverMock(address: Address, evmMock: EvmMock): CREDeadlineReceiverMock {
  return addContractMock(evmMock, { address, abi: CREDeadlineReceiverABI }) as CREDeadlineReceiverMock
}

