import { CapacityMarketAbi, CapacityPoolAbi } from "./abi";
import { CAPACITY_MARKET_ADDRESS, CAPACITY_POOL_ADDRESS } from "./addresses";
import { publicClient } from "./chain";
import { el, evidenceGrid, showErrorPanel } from "./ui";

export function mountReputation(root: HTMLElement) {
  const card = el("div", { class: "card" }, [
    el("h2", {}, ["Provider reputation"]),
    el("p", { class: "hint" }, [
      "Read-only counters aggregated from each contract's own emitted events — ",
      "not yet consulted by activate()'s routing. See AGENTS.md's \"Reputation tracking\" entry.",
    ]),
  ]);
  const addressInput = el("input", { type: "text", class: "mono", placeholder: "Provider address (0x...)" }) as HTMLInputElement;
  const loadBtn = el("button", { type: "button" }, ["Load"]);
  const errorPanel = el("div", { class: "error-panel hidden" });
  const resultHost = el("div", {});
  card.append(el("div", { class: "row" }, [addressInput, loadBtn]), errorPanel, resultHost);
  root.append(card);

  loadBtn.addEventListener("click", async () => {
    const address = addressInput.value.trim() as `0x${string}`;
    if (!address) return;
    try {
      const [market, pool] = await Promise.all([
        publicClient.readContract({ address: CAPACITY_MARKET_ADDRESS, abi: CapacityMarketAbi, functionName: "providerStats", args: [address] }) as Promise<readonly [bigint, bigint, bigint, bigint]>,
        publicClient.readContract({ address: CAPACITY_POOL_ADDRESS, abi: CapacityPoolAbi, functionName: "providerStats", args: [address] }) as Promise<readonly [bigint, bigint, bigint, bigint]>,
      ]);
      resultHost.innerHTML = "";
      resultHost.append(
        el("h3", {}, ["CapacityMarket (Level 1)"]),
        evidenceGrid([
          { label: "Settled", value: market[0].toString() },
          { label: "Defaulted", value: market[1].toString() },
          { label: "Disputes lost", value: market[2].toString() },
          { label: "Disputes timed out", value: market[3].toString() },
        ]),
        el("h3", {}, ["CapacityPool (Level 2)"]),
        evidenceGrid([
          { label: "Settled", value: pool[0].toString() },
          { label: "Defaulted", value: pool[1].toString() },
          { label: "Disputes lost", value: pool[2].toString() },
          { label: "Disputes timed out", value: pool[3].toString() },
        ]),
      );
      showErrorPanel(errorPanel, null);
    } catch (err) {
      showErrorPanel(errorPanel, `Could not load reputation: ${err instanceof Error ? err.message : String(err)}`);
      resultHost.innerHTML = "";
    }
  });
}
