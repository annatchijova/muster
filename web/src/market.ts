import { CapacityMarketAbi } from "./abi";
import { CAPACITY_MARKET_ADDRESS } from "./addresses";
import { buildFieldInputs, sendAction, type FieldSpec } from "./actions";
import { publicClient } from "./chain";
import { POSITION_STATUS } from "./status";
import { el, evidenceGrid, localDatetimeToUnix, showErrorPanel, statusPill, unixToLocal, parseMon, formatMon } from "./ui";
import type { MeraWallet } from "./wallet";

type Position = {
  domain: `0x${string}`;
  quantity: bigint;
  validFrom: bigint;
  validUntil: bigint;
  activationSLA: bigint;
  disputeWindow: bigint;
  provider: `0x${string}`;
  buyer: `0x${string}`;
  price: bigint;
  collateral: bigint;
  activationDeadline: bigint;
  disputeDeadline: bigint;
  deliveryEvidenceHash: `0x${string}`;
  status: number;
};

async function readPosition(id: bigint): Promise<Position> {
  const result = await publicClient.readContract({
    address: CAPACITY_MARKET_ADDRESS,
    abi: CapacityMarketAbi,
    functionName: "positions",
    args: [id],
  });
  const [
    domain, quantity, validFrom, validUntil, activationSLA, disputeWindow,
    provider, buyer, price, collateral, activationDeadline, disputeDeadline,
    deliveryEvidenceHash, status,
  ] = result as readonly [
    `0x${string}`, bigint, bigint, bigint, bigint, bigint,
    `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint,
    `0x${string}`, number,
  ];
  return {
    domain, quantity, validFrom, validUntil, activationSLA, disputeWindow,
    provider, buyer, price, collateral, activationDeadline, disputeDeadline,
    deliveryEvidenceHash, status,
  };
}

export function mountMarket(root: HTMLElement, getWallet: () => MeraWallet | null) {
  const lookupCard = el("div", { class: "card" }, [
    el("h2", {}, ["Look up a position"]),
  ]);
  const lookupRow = el("div", { class: "row" });
  const idInput = el("input", { type: "number", min: "0", placeholder: "Position ID" }) as HTMLInputElement;
  const loadBtn = el("button", { type: "button" }, ["Load"]);
  lookupRow.append(idInput, loadBtn);
  lookupCard.append(lookupRow);

  const errorPanel = el("div", { class: "error-panel hidden" });
  const resultHost = el("div", {});
  lookupCard.append(errorPanel, resultHost);

  const recentCard = el("div", { class: "card" }, [el("h2", {}, ["Recent positions"])]);
  const recentList = el("div", {});
  const refreshRecentBtn = el("button", { type: "button", class: "secondary" }, ["Refresh"]);
  recentCard.append(refreshRecentBtn, recentList);

  const listCard = el("div", { class: "card" }, [el("h2", {}, ["List new capacity"])]);
  const listFieldsHost = el("div", {});
  const listSubmitBtn = el("button", { type: "button" }, ["List capacity"]);
  listCard.append(listFieldsHost, listSubmitBtn);

  root.append(lookupCard, listCard, recentCard);

  async function loadPosition(id: bigint) {
    try {
      // positions(id) returns zeroed defaults (status index 0 = "Listed") for an
      // id that was never written — bound-check against nextPositionId() first so
      // a nonexistent id renders as "not found," not as a fake, actionable Listed
      // position someone could click "Reserve" on and waste gas reverting.
      const nextId = (await publicClient.readContract({
        address: CAPACITY_MARKET_ADDRESS,
        abi: CapacityMarketAbi,
        functionName: "nextPositionId",
      })) as bigint;
      if (id >= nextId) {
        showErrorPanel(
          errorPanel,
          nextId === 0n
            ? "No positions have been listed yet."
            : `Position #${id} does not exist yet — only #0 through #${nextId - 1n} have been listed.`,
        );
        resultHost.innerHTML = "";
        return;
      }
      const pos = await readPosition(id);
      renderPosition(id, pos);
      showErrorPanel(errorPanel, null);
    } catch (err) {
      showErrorPanel(errorPanel, `Could not load position ${id}: ${err instanceof Error ? err.message : String(err)}`);
      resultHost.innerHTML = "";
    }
  }

  function renderPosition(id: bigint, pos: Position) {
    resultHost.innerHTML = "";
    const statusLabel = POSITION_STATUS[pos.status] ?? `unknown(${pos.status})`;
    const now = BigInt(Math.floor(Date.now() / 1000));

    const header = el("div", {}, [
      el("h3", {}, [`Position #${id}`]),
      statusPill(statusLabel),
    ]);
    resultHost.append(header);

    resultHost.append(
      evidenceGrid([
        { label: "Domain (bytes32)", value: pos.domain, span2: true },
        { label: "Quantity", value: pos.quantity.toString() },
        { label: "Provider", value: pos.provider },
        { label: "Buyer", value: pos.buyer === "0x0000000000000000000000000000000000000000" ? "— (not yet reserved)" : pos.buyer },
        { label: "Price", value: formatMon(pos.price) },
        { label: "Collateral", value: formatMon(pos.collateral) },
        { label: "Valid from", value: unixToLocal(pos.validFrom) },
        { label: "Valid until", value: unixToLocal(pos.validUntil) },
        { label: "Activation deadline", value: pos.activationDeadline === 0n ? "—" : unixToLocal(pos.activationDeadline) },
        { label: "Dispute deadline", value: pos.disputeDeadline === 0n ? "—" : unixToLocal(pos.disputeDeadline) },
        { label: "Delivery evidence hash", value: pos.deliveryEvidenceHash, span2: true },
      ]),
    );

    const actionsHost = el("div", { class: "actions" });
    resultHost.append(actionsHost);

    const reload = () => loadPosition(id);

    const addAction = (
      label: string,
      functionName: string,
      fields: FieldSpec[],
      opts: { value?: bigint; danger?: boolean } = {},
    ) => {
      const fieldsHost = el("div", {});
      const getValues = buildFieldInputs(fieldsHost, fields);
      const btn = el("button", { type: "button", class: opts.danger ? "danger" : "" }, [label]);
      btn.addEventListener("click", async () => {
        const values = getValues();
        const args = fields.map((f) => values[f.key]);
        const value = opts.value ?? (fields.find((f) => f.kind === "mon") ? parseMon(values[fields.find((f) => f.kind === "mon")!.key] as string) : undefined);
        await sendAction({
          wallet: getWallet(),
          address: CAPACITY_MARKET_ADDRESS,
          abi: CapacityMarketAbi,
          functionName,
          args,
          value,
          onSettled: reload,
        });
      });
      actionsHost.append(el("div", { class: "card" }, [fieldsHost, btn]));
    };

    const validUntilPassed = now > pos.validUntil;
    const activationDeadlinePassed = pos.activationDeadline !== 0n && now > pos.activationDeadline;
    const disputeDeadlinePassed = pos.disputeDeadline !== 0n && now > pos.disputeDeadline;

    if (statusLabel === "Listed") {
      addAction("Reserve (pay price)", "reserve", [], { value: pos.price });
      if (validUntilPassed) addAction("Expire (window closed, never reserved)", "expire", []);
    }
    if (statusLabel === "Reserved") {
      addAction("Transfer to another buyer", "transfer", [{ kind: "text", key: "to", label: "New buyer address" }]);
      addAction("Activate", "activate", []);
      if (validUntilPassed) addAction("Expire (window closed, never activated)", "expire", []);
    }
    if (statusLabel === "Activated") {
      addAction("Accept activation (provider)", "acceptActivation", []);
      if (activationDeadlinePassed) addAction("Claim default (SLA missed)", "claimDefault", [], { danger: true });
    }
    if (statusLabel === "Accepted") {
      addAction("Claim delivery (provider)", "claimDelivery", [{ kind: "hash", key: "evidenceHash", label: "Evidence description (hashed client-side)" }]);
    }
    if (statusLabel === "DeliveryClaimed") {
      addAction("Settle (buyer approves)", "settle", []);
      addAction("Dispute (buyer)", "dispute", [{ kind: "hash", key: "reasonHash", label: "Dispute reason (hashed client-side)" }], { danger: true });
      if (disputeDeadlinePassed) addAction("Finalize delivery (anyone, window passed unchallenged)", "finalizeDelivery", []);
    }
    if (statusLabel === "Disputed") {
      addAction("Vote (arbitration panel member)", "voteDispute", [
        { kind: "bool", key: "providerWins", label: "Verdict", trueLabel: "Provider wins", falseLabel: "Buyer wins" },
      ]);
      if (disputeDeadlinePassed) addAction("Resolve by timeout (anyone, refunds buyer)", "resolveDisputeByTimeout", []);
    }

    resultHost.append(el("h3", {}, ["Arbitration panel"]));
    const panelHost = el("div", { class: "state-loading" }, ["Loading…"]);
    resultHost.append(panelHost);
    publicClient
      .readContract({ address: CAPACITY_MARKET_ADDRESS, abi: CapacityMarketAbi, functionName: "arbitrationPanel", args: [id] })
      .then((panelResult) => {
        const [members, threshold] = panelResult as readonly [readonly `0x${string}`[], bigint];
        panelHost.className = "";
        panelHost.innerHTML = "";
        if (members.length === 0) {
          panelHost.className = "state-empty";
          panelHost.append("No panel set — falls back to the timeout path only.");
        } else {
          panelHost.append(
            evidenceGrid([
              { label: "Threshold", value: `${threshold} of ${members.length}` },
              { label: "Members", value: members.join(", "), span2: true },
            ]),
          );
        }
      })
      .catch(() => {
        panelHost.className = "state-empty";
        panelHost.textContent = "Could not load arbitration panel.";
      });
  }

  loadBtn.addEventListener("click", () => {
    if (!idInput.value) return;
    loadPosition(BigInt(idInput.value));
  });

  async function refreshRecent() {
    recentList.className = "state-loading";
    recentList.textContent = "Loading…";
    try {
      const nextId = (await publicClient.readContract({
        address: CAPACITY_MARKET_ADDRESS,
        abi: CapacityMarketAbi,
        functionName: "nextPositionId",
      })) as bigint;
      if (nextId === 0n) {
        recentList.className = "state-empty";
        recentList.textContent = "No positions listed yet.";
        return;
      }
      const count = 10n;
      const from = nextId > count ? nextId - count : 0n;
      const ids: bigint[] = [];
      for (let i = nextId - 1n; i >= from; i--) ids.push(i);
      const results = await Promise.allSettled(ids.map((id) => readPosition(id)));
      recentList.className = "";
      recentList.innerHTML = "";
      ids.forEach((id, i) => {
        const r = results[i];
        if (r.status !== "fulfilled") return;
        const status = r.value.status;
        const item = el("div", { class: "list-item" }, [
          el("span", {}, [`#${id}`]),
          statusPill(POSITION_STATUS[status] ?? `unknown(${status})`),
        ]);
        item.addEventListener("click", () => {
          idInput.value = id.toString();
          loadPosition(id);
        });
        recentList.append(item);
      });
    } catch {
      recentList.className = "state-empty";
      recentList.textContent = "Could not load recent positions.";
    }
  }
  refreshRecentBtn.addEventListener("click", refreshRecent);
  refreshRecent();

  const listFields: FieldSpec[] = [
    { kind: "hash", key: "domain", label: "Domain label (hashed client-side, e.g. ZK_SECURITY_L2)" },
    { kind: "number", key: "quantity", label: "Quantity" },
  ];
  const getListValues = buildFieldInputs(listFieldsHost, listFields);

  // Extra fields that need custom widgets (datetime, address list, two MON amounts).
  const extraHost = el("div", {});
  listFieldsHost.append(extraHost);
  const validFromInput = el("input", { type: "datetime-local" }) as HTMLInputElement;
  const validUntilInput = el("input", { type: "datetime-local" }) as HTMLInputElement;
  const slaInput = el("input", { type: "number", placeholder: "Activation SLA (seconds)" }) as HTMLInputElement;
  const disputeWindowInput = el("input", { type: "number", placeholder: "Dispute window (seconds)" }) as HTMLInputElement;
  const priceInput = el("input", { type: "text", placeholder: "Price (MON)" }) as HTMLInputElement;
  const collateralInput = el("input", { type: "text", placeholder: "Collateral (MON, this is msg.value)" }) as HTMLInputElement;
  const thresholdInput = el("input", { type: "number", placeholder: "Panel threshold (0 = no panel)" }) as HTMLInputElement;

  extraHost.append(
    el("div", { class: "row" }, [
      el("div", {}, [el("label", {}, ["Valid from"]), validFromInput]),
      el("div", {}, [el("label", {}, ["Valid until"]), validUntilInput]),
    ]),
    el("div", { class: "row" }, [
      el("div", {}, [el("label", {}, ["Activation SLA (seconds)"]), slaInput]),
      el("div", {}, [el("label", {}, ["Dispute window (seconds)"]), disputeWindowInput]),
    ]),
    el("div", { class: "row" }, [
      el("div", {}, [el("label", {}, ["Price (MON)"]), priceInput]),
      el("div", {}, [el("label", {}, ["Collateral (MON, msg.value)"]), collateralInput]),
    ]),
  );
  const panelHost = el("div", {}, [el("label", {}, ["Arbitration panel members (optional, up to 9)"])]);
  extraHost.append(panelHost, el("div", {}, [el("label", {}, ["Panel threshold"]), thresholdInput]));
  const panelFields = buildFieldInputs(panelHost, [{ kind: "address-list", key: "panelMembers", label: "", max: 9 }]);

  listSubmitBtn.addEventListener("click", async () => {
    const base = getListValues();
    const panel = panelFields();
    await sendAction({
      wallet: getWallet(),
      address: CAPACITY_MARKET_ADDRESS,
      abi: CapacityMarketAbi,
      functionName: "listCapacity",
      args: [
        base.domain,
        base.quantity,
        localDatetimeToUnix(validFromInput.value),
        localDatetimeToUnix(validUntilInput.value),
        BigInt(slaInput.value || "0"),
        BigInt(disputeWindowInput.value || "0"),
        panel.panelMembers,
        BigInt(thresholdInput.value || "0"),
        parseMon(priceInput.value),
      ],
      value: parseMon(collateralInput.value),
      onSettled: refreshRecent,
    });
  });
}
