import type { Abi } from "viem";
import { keccak256, toHex } from "viem";
import { getWalletClient, publicClient } from "./chain";
import type { MeraWallet } from "./wallet";
import { decodeError, el, explorerTxUrl, toast } from "./ui";

export type FieldSpec =
  | { kind: "text"; key: string; label: string; placeholder?: string }
  | { kind: "hash"; key: string; label: string; placeholder?: string } // free text, hashed with keccak256 before send
  | { kind: "number"; key: string; label: string; placeholder?: string }
  | { kind: "mon"; key: string; label: string; placeholder?: string } // MON amount, parsed with parseEther
  | { kind: "bool"; key: string; label: string; trueLabel: string; falseLabel: string }
  | { kind: "address-list"; key: string; label: string; max: number };

export type ActionSpec = {
  id: string;
  label: string;
  danger?: boolean;
  fields?: FieldSpec[];
  /** Whether this action is currently valid to show, given loaded on-chain state. */
  visible: boolean;
  /** Human reason it's hidden/disabled right now (e.g. a countdown). */
  disabledReason?: string;
};

export function buildFieldInputs(container: HTMLElement, fields: FieldSpec[]): () => Record<string, unknown> {
  const getters: Record<string, () => unknown> = {};

  for (const field of fields) {
    if (field.kind === "address-list") {
      const wrap = el("div", {}, [el("label", {}, [field.label])]);
      const rows: HTMLInputElement[] = [];
      const rowsContainer = el("div", {});
      const addRow = () => {
        if (rows.length >= field.max) return;
        const input = el("input", { type: "text", placeholder: "0x...", class: "mono" }) as HTMLInputElement;
        rows.push(input);
        rowsContainer.append(el("div", { class: "panel-members-row" }, [input]));
      };
      addRow();
      const addBtn = el("button", { type: "button", class: "secondary" }, ["+ add panel member"]);
      addBtn.addEventListener("click", addRow);
      wrap.append(rowsContainer, addBtn);
      container.append(wrap);
      getters[field.key] = () => rows.map((r) => r.value.trim()).filter((v) => v.length > 0);
      continue;
    }

    const wrap = el("div", {}, [el("label", {}, [field.label])]);
    if (field.kind === "bool") {
      const select = el("select", {}, [
        el("option", { value: "true" }, [field.trueLabel]),
        el("option", { value: "false" }, [field.falseLabel]),
      ]) as HTMLSelectElement;
      wrap.append(select);
      container.append(wrap);
      getters[field.key] = () => select.value === "true";
      continue;
    }

    const input = el("input", {
      type: field.kind === "number" ? "number" : "text",
      placeholder: field.placeholder ?? "",
      class: field.kind === "hash" ? "mono" : "",
    }) as HTMLInputElement;
    wrap.append(input);
    container.append(wrap);

    if (field.kind === "hash") {
      getters[field.key] = () => (input.value ? keccak256(toHex(input.value)) : "0x" + "0".repeat(64));
    } else if (field.kind === "number") {
      getters[field.key] = () => BigInt(input.value || "0");
    } else if (field.kind === "mon") {
      getters[field.key] = () => input.value;
    } else {
      getters[field.key] = () => input.value.trim();
    }
  }

  return () => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(getters)) out[key] = getters[key]();
    return out;
  };
}

export async function sendAction(opts: {
  wallet: MeraWallet | null;
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args: unknown[];
  value?: bigint;
  onSettled: () => void | Promise<void>;
}) {
  if (!opts.wallet) {
    toast("Sign in with a passkey first.", "error");
    return;
  }
  try {
    const walletClient = getWalletClient(opts.wallet.account);
    const hash = await walletClient.writeContract({
      address: opts.address,
      abi: opts.abi,
      functionName: opts.functionName,
      args: opts.args,
      value: opts.value,
    });
    toast(`${opts.functionName} submitted`, "success", { href: explorerTxUrl(hash), label: "view tx" });
    await publicClient.waitForTransactionReceipt({ hash });
    toast(`${opts.functionName} confirmed`, "success", { href: explorerTxUrl(hash), label: "view tx" });
    await opts.onSettled();
  } catch (err) {
    toast(decodeError(err), "error");
  }
}
