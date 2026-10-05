import { createPublicClient, createWalletClient, http, type Account } from "viem";
import { monadTestnet } from "viem/chains";

const RPC_URL =
  (import.meta.env.VITE_MONAD_TESTNET_RPC_URL as string | undefined) ??
  "https://testnet-rpc.monad.xyz";

export const chain = monadTestnet;

export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

export function getWalletClient(account: Account) {
  return createWalletClient({
    account,
    chain,
    transport: http(RPC_URL),
  });
}
