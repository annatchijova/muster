import { CapacityPoolAbi } from "./abi";
import { CAPACITY_POOL_ADDRESS } from "./addresses";
import { buildFieldInputs, sendAction, type FieldSpec } from "./actions";
import { publicClient } from "./chain";
import { ASSIGNMENT_STATUS, RESERVATION_STATUS } from "./status";
import { el, evidenceGrid, localDatetimeToUnix, parseMon, formatMon, showErrorPanel, statusPill, unixToLocal } from "./ui";
import type { MeraWallet } from "./wallet";

type TermsClass = {
  domain: `0x${string}`;
  validFrom: bigint;
  validUntil: bigint;
  activationSLA: bigint;
  disputeWindow: bigint;
  panelMembers: readonly `0x${string}`[];
  panelThreshold: bigint;
  pricePerUnit: bigint;
  collateralPerUnit: bigint;
};

function termsFromForm(getValues: () => Record<string, unknown>, panelMembers: readonly string[]): TermsClass {
  const v = getValues();
  return {
    domain: v.domain as `0x${string}`,
    validFrom: localDatetimeToUnix(v.validFrom as string),
    validUntil: localDatetimeToUnix(v.validUntil as string),
    activationSLA: BigInt((v.activationSLA as string) || "0"),
    disputeWindow: BigInt((v.disputeWindow as string) || "0"),
    panelMembers: panelMembers as readonly `0x${string}`[],
    panelThreshold: BigInt((v.panelThreshold as string) || "0"),
    pricePerUnit: parseMon(v.pricePerUnit as string),
    collateralPerUnit: parseMon(v.collateralPerUnit as string),
  };
}

export function mountPool(root: HTMLElement, getWallet: () => MeraWallet | null) {
  // --- Contribute capacity (creates or adds to a class) ---
  const contributeCard = el("div", { class: "card" }, [el("h2", {}, ["Contribute capacity"])]);
  const contributeFieldsHost = el("div", {});
  const contributeFields: FieldSpec[] = [
    { kind: "hash", key: "domain", label: "Domain label (hashed client-side)" },
  ];
  const getContributeBase = buildFieldInputs(contributeFieldsHost, contributeFields);
  const cValidFrom = el("input", { type: "datetime-local" }) as HTMLInputElement;
  const cValidUntil = el("input", { type: "datetime-local" }) as HTMLInputElement;
  const cSla = el("input", { type: "number", placeholder: "Activation SLA (seconds)" }) as HTMLInputElement;
  const cDisputeWindow = el("input", { type: "number", placeholder: "Dispute window (seconds)" }) as HTMLInputElement;
  const cThreshold = el("input", { type: "number", placeholder: "Panel threshold (0 = no panel)" }) as HTMLInputElement;
  const cPricePerUnit = el("input", { type: "text", placeholder: "Price per unit (MON)" }) as HTMLInputElement;
  const cCollateralPerUnit = el("input", { type: "text", placeholder: "Collateral per unit (MON)" }) as HTMLInputElement;
  const cQuantity = el("input", { type: "number", placeholder: "Quantity to contribute" }) as HTMLInputElement;
  contributeFieldsHost.append(
    el("div", { class: "row" }, [
      el("div", {}, [el("label", {}, ["Valid from"]), cValidFrom]),
      el("div", {}, [el("label", {}, ["Valid until"]), cValidUntil]),
    ]),
    el("div", { class: "row" }, [
      el("div", {}, [el("label", {}, ["Activation SLA (s)"]), cSla]),
      el("div", {}, [el("label", {}, ["Dispute window (s)"]), cDisputeWindow]),
    ]),
    el("div", { class: "row" }, [
      el("div", {}, [el("label", {}, ["Price per unit (MON)"]), cPricePerUnit]),
      el("div", {}, [el("label", {}, ["Collateral per unit (MON)"]), cCollateralPerUnit]),
    ]),
    el("div", { class: "row" }, [
      el("div", {}, [el("label", {}, ["Panel threshold"]), cThreshold]),
      el("div", {}, [el("label", {}, ["Quantity"]), cQuantity]),
    ]),
  );
  const cPanelHost = el("div", {}, [el("label", {}, ["Panel members (optional, up to 9)"])]);
  contributeFieldsHost.append(cPanelHost);
  const getCPanel = buildFieldInputs(cPanelHost, [{ kind: "address-list", key: "panelMembers", label: "", max: 9 }]);
  const contributeBtn = el("button", { type: "button" }, ["Contribute"]);
  const contributePreview = el("div", { class: "hint" }, ["classId preview will appear here"]);
  contributeCard.append(contributeFieldsHost, contributePreview, contributeBtn);

  async function currentContributeTerms(): Promise<TermsClass> {
    return termsFromForm(getContributeBase, getCPanel().panelMembers as readonly string[]);
  }

  async function refreshContributePreview() {
    try {
      const terms = await currentContributeTerms();
      const id = (await publicClient.readContract({
        address: CAPACITY_POOL_ADDRESS,
        abi: CapacityPoolAbi,
        functionName: "classId",
        args: [terms],
      })) as `0x${string}`;
      contributePreview.textContent = `classId for these terms: ${id}`;
    } catch {
      contributePreview.textContent = "classId preview will appear here";
    }
  }
  for (const input of [cValidFrom, cValidUntil, cSla, cDisputeWindow, cThreshold, cPricePerUnit, cCollateralPerUnit]) {
    input.addEventListener("change", refreshContributePreview);
  }

  contributeBtn.addEventListener("click", async () => {
    const terms = await currentContributeTerms();
    const quantity = BigInt(cQuantity.value || "0");
    await sendAction({
      wallet: getWallet(),
      address: CAPACITY_POOL_ADDRESS,
      abi: CapacityPoolAbi,
      functionName: "contribute",
      args: [terms, quantity],
      value: terms.collateralPerUnit * quantity,
      onSettled: refreshContributePreview,
    });
  });

  // --- Look up a class, reserve from it, withdraw contributions ---
  const classCard = el("div", { class: "card" }, [el("h2", {}, ["Look up a pool class"])]);
  const classIdInput = el("input", { type: "text", class: "mono", placeholder: "classId (bytes32, 0x...)" }) as HTMLInputElement;
  const classLoadBtn = el("button", { type: "button" }, ["Load"]);
  const classErrorPanel = el("div", { class: "error-panel hidden" });
  const classResultHost = el("div", {});
  classCard.append(el("div", { class: "row" }, [classIdInput, classLoadBtn]), classErrorPanel, classResultHost);

  async function loadClass(classId: `0x${string}`) {
    try {
      const [terms, totalCommitted, available, contributionsCount] = (await publicClient.readContract({
        address: CAPACITY_POOL_ADDRESS,
        abi: CapacityPoolAbi,
        functionName: "poolInfo",
        args: [classId],
      })) as readonly [TermsClass, bigint, bigint, bigint];
      // poolInfo returns a zeroed TermsClass for a classId never contributed to
      // (no "initialized" flag in this view) — contributionsCount === 0 is the
      // only signal available; treat it as "not found" rather than a fake,
      // zero-priced class someone could try to reserve from.
      if (contributionsCount === 0n) {
        showErrorPanel(classErrorPanel, `Class ${classId} has no contributions — it may not exist, or was never contributed to.`);
        classResultHost.innerHTML = "";
        return;
      }
      classResultHost.innerHTML = "";
      classResultHost.append(
        evidenceGrid([
          { label: "Domain", value: terms.domain, span2: true },
          { label: "Valid from", value: unixToLocal(terms.validFrom) },
          { label: "Valid until", value: unixToLocal(terms.validUntil) },
          { label: "Price / unit", value: formatMon(terms.pricePerUnit) },
          { label: "Collateral / unit", value: formatMon(terms.collateralPerUnit) },
          { label: "Total committed", value: totalCommitted.toString() },
          { label: "Available", value: available.toString() },
          { label: "Contributions", value: contributionsCount.toString() },
        ]),
      );

      const reserveRow = el("div", { class: "row" });
      const qtyInput = el("input", { type: "number", placeholder: "Quantity to reserve" }) as HTMLInputElement;
      const reserveBtn = el("button", { type: "button" }, ["Reserve"]);
      reserveBtn.addEventListener("click", async () => {
        const quantity = BigInt(qtyInput.value || "0");
        await sendAction({
          wallet: getWallet(),
          address: CAPACITY_POOL_ADDRESS,
          abi: CapacityPoolAbi,
          functionName: "reserve",
          args: [classId, quantity],
          value: terms.pricePerUnit * quantity,
          onSettled: () => loadClass(classId),
        });
      });
      reserveRow.append(qtyInput, reserveBtn);
      classResultHost.append(reserveRow);

      const contributionsHost = el("div", { class: "card" }, [el("h3", {}, ["Contributions"])]);
      for (let i = 0n; i < contributionsCount; i++) {
        const [provider, remaining] = (await publicClient.readContract({
          address: CAPACITY_POOL_ADDRESS,
          abi: CapacityPoolAbi,
          functionName: "contributionInfo",
          args: [classId, i],
        })) as readonly [`0x${string}`, bigint];
        const row = el("div", { class: "list-item" }, [
          el("span", { class: "mono" }, [`#${i} ${provider} — remaining ${remaining}`]),
        ]);
        const withdrawBtn = el("button", { type: "button", class: "secondary" }, ["Withdraw"]);
        withdrawBtn.addEventListener("click", async () => {
          await sendAction({
            wallet: getWallet(),
            address: CAPACITY_POOL_ADDRESS,
            abi: CapacityPoolAbi,
            functionName: "withdrawContribution",
            args: [classId, i],
            onSettled: () => loadClass(classId),
          });
        });
        row.append(withdrawBtn);
        contributionsHost.append(row);
      }
      classResultHost.append(contributionsHost);
      showErrorPanel(classErrorPanel, null);
    } catch (err) {
      showErrorPanel(classErrorPanel, `Could not load class ${classId}: ${err instanceof Error ? err.message : String(err)}`);
      classResultHost.innerHTML = "";
    }
  }
  classLoadBtn.addEventListener("click", () => {
    if (classIdInput.value) loadClass(classIdInput.value as `0x${string}`);
  });

  // --- Look up / act on a reservation ---
  const reservationCard = el("div", { class: "card" }, [el("h2", {}, ["Look up a reservation"])]);
  const reservationIdInput = el("input", { type: "number", min: "0", placeholder: "Reservation ID" }) as HTMLInputElement;
  const reservationLoadBtn = el("button", { type: "button" }, ["Load"]);
  const reservationErrorPanel = el("div", { class: "error-panel hidden" });
  const reservationResultHost = el("div", {});
  reservationCard.append(
    el("div", { class: "row" }, [reservationIdInput, reservationLoadBtn]),
    reservationErrorPanel,
    reservationResultHost,
  );

  async function loadReservation(id: bigint) {
    try {
      // Same guard as market.ts's loadPosition: reservationInfo(id) returns
      // zeroed defaults (status index 0 = "Reserved") for an id never written,
      // which would otherwise render as a fake, actionable reservation.
      const nextId = (await publicClient.readContract({
        address: CAPACITY_POOL_ADDRESS,
        abi: CapacityPoolAbi,
        functionName: "nextReservationId",
      })) as bigint;
      if (id >= nextId) {
        showErrorPanel(
          reservationErrorPanel,
          nextId === 0n
            ? "No reservations have been made yet."
            : `Reservation #${id} does not exist yet — only #0 through #${nextId - 1n} have been made.`,
        );
        reservationResultHost.innerHTML = "";
        return;
      }
      const [classId, buyer, quantity, activationDeadline, status, assignmentCount] = (await publicClient.readContract({
        address: CAPACITY_POOL_ADDRESS,
        abi: CapacityPoolAbi,
        functionName: "reservationInfo",
        args: [id],
      })) as readonly [`0x${string}`, `0x${string}`, bigint, bigint, number, bigint];

      reservationResultHost.innerHTML = "";
      const statusLabel = RESERVATION_STATUS[status] ?? `unknown(${status})`;
      reservationResultHost.append(el("h3", {}, [`Reservation #${id}`]), statusPill(statusLabel));
      reservationResultHost.append(
        evidenceGrid([
          { label: "Class ID", value: classId, span2: true },
          { label: "Buyer", value: buyer },
          { label: "Quantity", value: quantity.toString() },
          { label: "Activation deadline", value: activationDeadline === 0n ? "—" : unixToLocal(activationDeadline) },
          { label: "Assignments", value: assignmentCount.toString() },
        ]),
      );

      const reservationActions = el("div", { class: "actions" });
      reservationResultHost.append(reservationActions);
      const reload = () => loadReservation(id);
      if (statusLabel === "Reserved") {
        const transferBtn = el("button", { type: "button" }, ["Transfer"]);
        const toInput = el("input", { type: "text", placeholder: "New buyer address" }) as HTMLInputElement;
        transferBtn.addEventListener("click", () =>
          sendAction({
            wallet: getWallet(), address: CAPACITY_POOL_ADDRESS, abi: CapacityPoolAbi,
            functionName: "transferReservation", args: [id, toInput.value.trim()], onSettled: reload,
          }),
        );
        reservationActions.append(el("div", { class: "card" }, [toInput, transferBtn]));

        const activateBtn = el("button", { type: "button" }, ["Activate"]);
        activateBtn.addEventListener("click", () =>
          sendAction({
            wallet: getWallet(), address: CAPACITY_POOL_ADDRESS, abi: CapacityPoolAbi,
            functionName: "activate", args: [id], onSettled: reload,
          }),
        );
        reservationActions.append(activateBtn);

        const expireBtn = el("button", { type: "button", class: "secondary" }, ["Expire (window closed, never activated)"]);
        expireBtn.addEventListener("click", () =>
          sendAction({
            wallet: getWallet(), address: CAPACITY_POOL_ADDRESS, abi: CapacityPoolAbi,
            functionName: "expireReservation", args: [id], onSettled: reload,
          }),
        );
        reservationActions.append(expireBtn);
      }

      const assignmentsHost = el("div", {});
      reservationResultHost.append(assignmentsHost);
      for (let i = 0n; i < assignmentCount; i++) {
        assignmentsHost.append(await renderAssignment(id, i, reload));
      }
      showErrorPanel(reservationErrorPanel, null);
    } catch (err) {
      showErrorPanel(reservationErrorPanel, `Could not load reservation ${id}: ${err instanceof Error ? err.message : String(err)}`);
      reservationResultHost.innerHTML = "";
    }
  }

  async function renderAssignment(reservationId: bigint, index: bigint, reload: () => void): Promise<HTMLElement> {
    const [provider, quantity, price, collateral, deliveryEvidenceHash, disputeDeadline, status] = (await publicClient.readContract({
      address: CAPACITY_POOL_ADDRESS,
      abi: CapacityPoolAbi,
      functionName: "assignmentInfo",
      args: [reservationId, index],
    })) as readonly [`0x${string}`, bigint, bigint, bigint, `0x${string}`, bigint, number];

    const statusLabel = ASSIGNMENT_STATUS[status] ?? `unknown(${status})`;
    const card = el("div", { class: "card" }, [
      el("h3", {}, [`Assignment #${index}`]),
      statusPill(statusLabel),
      evidenceGrid([
        { label: "Provider", value: provider },
        { label: "Quantity", value: quantity.toString() },
        { label: "Price", value: formatMon(price) },
        { label: "Collateral", value: formatMon(collateral) },
        { label: "Dispute deadline", value: disputeDeadline === 0n ? "—" : unixToLocal(disputeDeadline) },
        { label: "Delivery evidence hash", value: deliveryEvidenceHash, span2: true },
      ]),
    ]);
    const actionsHost = el("div", { class: "actions" });
    card.append(actionsHost);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const disputeDeadlinePassed = disputeDeadline !== 0n && now > disputeDeadline;

    const addAction = (label: string, functionName: string, fields: FieldSpec[], danger = false) => {
      const fieldsHost = el("div", {});
      const getValues = buildFieldInputs(fieldsHost, fields);
      const btn = el("button", { type: "button", class: danger ? "danger" : "" }, [label]);
      btn.addEventListener("click", async () => {
        const values = getValues();
        const args = [reservationId, index, ...fields.map((f) => values[f.key])];
        await sendAction({
          wallet: getWallet(), address: CAPACITY_POOL_ADDRESS, abi: CapacityPoolAbi,
          functionName, args, onSettled: reload,
        });
      });
      actionsHost.append(el("div", {}, [fieldsHost, btn]));
    };

    if (statusLabel === "Pending") {
      addAction("Accept (provider)", "acceptAssignment", []);
      addAction("Claim default (SLA missed)", "claimAssignmentDefault", [], true);
    }
    if (statusLabel === "Accepted") {
      addAction("Claim delivery (provider)", "claimAssignmentDelivery", [{ kind: "hash", key: "evidenceHash", label: "Evidence description" }]);
    }
    if (statusLabel === "DeliveryClaimed") {
      addAction("Settle (buyer approves)", "settleAssignment", []);
      addAction("Dispute (buyer)", "disputeAssignment", [{ kind: "hash", key: "reasonHash", label: "Dispute reason" }], true);
      if (disputeDeadlinePassed) addAction("Finalize (anyone, unchallenged)", "finalizeAssignmentDelivery", []);
    }
    if (statusLabel === "Disputed") {
      addAction("Vote (panel member)", "voteAssignmentDispute", [
        { kind: "bool", key: "providerWins", label: "Verdict", trueLabel: "Provider wins", falseLabel: "Buyer wins" },
      ]);
      if (disputeDeadlinePassed) addAction("Resolve by timeout", "resolveAssignmentDisputeByTimeout", []);
    }
    return card;
  }

  reservationLoadBtn.addEventListener("click", () => {
    if (reservationIdInput.value) loadReservation(BigInt(reservationIdInput.value));
  });

  root.append(contributeCard, classCard, reservationCard);
}
