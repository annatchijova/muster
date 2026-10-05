import { BaseError, ContractFunctionRevertedError, formatEther, parseEther } from "viem";
import { statusColorClass } from "./status";

export function formatMon(wei: bigint): string {
  return `${formatEther(wei)} MON`;
}

export function parseMon(value: string): bigint {
  return parseEther(value || "0");
}

export function unixToLocal(ts: bigint | number): string {
  const n = typeof ts === "bigint" ? Number(ts) : ts;
  if (n === 0) return "—";
  return new Date(n * 1000).toLocaleString();
}

export function localDatetimeToUnix(value: string): bigint {
  if (!value) return 0n;
  return BigInt(Math.floor(new Date(value).getTime() / 1000));
}

/** Decodes a viem write-call error into a short, human message — a decoded
 * custom-error name when the revert carries one, never a raw opaque string. */
export function decodeError(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name) {
        const args = revert.data?.args;
        return args && args.length > 0 ? `${name}(${args.join(", ")})` : `${name}()`;
      }
      if (revert.reason) return revert.reason;
    }
    return err.shortMessage ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function statusPill(label: string): HTMLElement {
  return el("span", { class: `status-pill ${statusColorClass(label)}` }, [label]);
}

export function evidenceGrid(items: { label: string; value: string; span2?: boolean }[]): HTMLElement {
  return el(
    "div",
    { class: "evidence-grid" },
    items.map((item) =>
      el("div", { class: `evidence-item${item.span2 ? " span-2" : ""}` }, [
        el("div", { class: "label" }, [item.label]),
        el("div", { class: "value" }, [item.value]),
      ]),
    ),
  );
}

export function showErrorPanel(container: HTMLElement, message: string | null) {
  container.innerHTML = "";
  container.classList.toggle("hidden", !message);
  if (message) container.append(message);
}

export function toast(message: string, kind: "success" | "error" = "success", link?: { href: string; label: string }) {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const node = el("div", { class: `toast ${kind}` }, [message]);
  if (link) {
    node.append(" ");
    node.append(el("a", { href: link.href, target: "_blank", rel: "noreferrer" }, [link.label]));
  }
  root.append(node);
  setTimeout(() => node.remove(), 8000);
}

export function explorerTxUrl(hash: string): string {
  return `https://testnet.monadexplorer.com/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://testnet.monadexplorer.com/address/${address}`;
}
