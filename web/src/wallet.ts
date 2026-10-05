import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getPasskeyPrfOutput,
  type PasskeyCredentialMetadata,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type { LocalAccount } from "viem";

const STORAGE_KEY = "muster.passkeyCredential";
const ETHEREUM_ACCOUNT_PATH = "m/44'/60'/0'/0/0";

export type MeraWallet = {
  account: LocalAccount<"mera">;
  address: `0x${string}`;
  /** Zeroes the in-memory session key. Call on explicit sign-out. */
  endSession: () => void;
};

function deriveViemAccount(prfOutput: Uint8Array): MeraWallet {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(ETHEREUM_ACCOUNT_PATH);
  if (node.privateKey === null) {
    throw new Error("Mera key derivation produced no private key");
  }
  const session = createSecp256k1SigningSession({ privateKey: node.privateKey });
  const account = toViemAccount(session);
  return {
    account,
    address: account.address,
    endSession: () => session.end(),
  };
}

function loadStoredCredential(): PasskeyCredentialMetadata | undefined {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as PasskeyCredentialMetadata;
  } catch {
    return undefined;
  }
}

function storeCredential(credential: PasskeyCredentialMetadata) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ credentialId: credential.credentialId, transports: credential.transports }),
  );
}

export function hasStoredPasskey(): boolean {
  return loadStoredCredential() !== undefined;
}

/** Registers a brand-new passkey for this device and signs in with it immediately. */
export async function registerPasskey(): Promise<MeraWallet> {
  const rpId = location.hostname;
  const created = await createPasskeyWithPrfOutput({
    rp: { id: rpId, name: "MUSTER" },
    user: { name: "muster-account", displayName: "MUSTER account" },
  });
  storeCredential(created);
  return deriveViemAccount(created.prfOutput);
}

/** Signs in with the passkey already registered on this device/browser. */
export async function signIn(): Promise<MeraWallet> {
  const rpId = location.hostname;
  const credential = loadStoredCredential();
  const { prfOutput } = await getPasskeyPrfOutput({ rpId, credential });
  return deriveViemAccount(prfOutput);
}
