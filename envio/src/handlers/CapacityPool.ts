/**
 * CapacityPool.sol (Level 2) event handlers. Two fields need a
 * supplementary contract read because the relevant event genuinely doesn't
 * carry them — see effects.ts and each handler's comment below for exactly
 * which fields and why (verified against the live Solidity source, not
 * assumed).
 */
import { indexer } from "envio";
import type { PoolClass, Reservation, Assignment } from "envio";
import { fetchPoolTerms, fetchAssignmentDetails } from "./effects";

const poolClassId = (chainId: number, classId: string) => `${chainId}-${classId}`;
const reservationEntityId = (chainId: number, id: bigint) => `${chainId}-${id}`;
const assignmentEntityId = (chainId: number, reservationId: bigint, index: bigint) =>
  `${chainId}-${reservationId}-${index}`;

async function loadPoolClass(
  context: { PoolClass: { get: (id: string) => Promise<PoolClass | undefined> } },
  chainId: number,
  classId: string,
): Promise<PoolClass | undefined> {
  return context.PoolClass.get(poolClassId(chainId, classId));
}

async function loadReservation(
  context: { Reservation: { get: (id: string) => Promise<Reservation | undefined> } },
  chainId: number,
  reservationId: bigint,
): Promise<Reservation> {
  const existing = await context.Reservation.get(reservationEntityId(chainId, reservationId));
  if (!existing) {
    throw new Error(
      `Reservation ${reservationEntityId(chainId, reservationId)} not found — Reserved should always precede every other reservation-level event.`,
    );
  }
  return existing;
}

async function loadAssignment(
  context: { Assignment: { get: (id: string) => Promise<Assignment | undefined> } },
  chainId: number,
  reservationId: bigint,
  assignmentIndex: bigint,
): Promise<Assignment> {
  const id = assignmentEntityId(chainId, reservationId, assignmentIndex);
  const existing = await context.Assignment.get(id);
  if (!existing) {
    throw new Error(
      `Assignment ${id} not found — ReservationActivated should always precede every assignment-level event.`,
    );
  }
  return existing;
}

indexer.onEvent(
  { contract: "CapacityPool", event: "Contributed" },
  async ({ event, context }) => {
    const existing = await loadPoolClass(context, event.chainId, event.params.classId);

    if (!existing) {
      // First time this classId is seen: `Contributed` itself never emits
      // the TermsClass it hashes (domain/window/SLA/price) — one read,
      // cached forever by classId from here on. See effects.ts.
      const terms = await context.effect(fetchPoolTerms, {
        classId: event.params.classId,
        contractAddress: event.srcAddress,
      });
      const poolClass: PoolClass = {
        id: poolClassId(event.chainId, event.params.classId),
        classId: event.params.classId,
        domain: terms.domain,
        validFrom: terms.validFrom,
        validUntil: terms.validUntil,
        activationSLA: terms.activationSLA,
        pricePerUnit: terms.pricePerUnit,
        collateralPerUnit: terms.collateralPerUnit,
        totalCommitted: event.params.quantity,
        available: event.params.quantity,
        lastUpdatedBlock: BigInt(event.block.number),
      };
      context.PoolClass.set(poolClass);
      return;
    }

    context.PoolClass.set({
      ...existing,
      totalCommitted: existing.totalCommitted + event.params.quantity,
      available: existing.available + event.params.quantity,
      lastUpdatedBlock: BigInt(event.block.number),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityPool", event: "Reserved" },
  async ({ event, context }) => {
    const reservation: Reservation = {
      id: reservationEntityId(event.chainId, event.params.reservationId),
      reservationId: event.params.reservationId,
      classId: event.params.classId,
      buyer: event.params.buyer,
      quantity: event.params.quantity,
      activationDeadline: undefined,
      assignmentCount: 0,
      status: "Reserved",
      lastUpdatedBlock: BigInt(event.block.number),
    };
    context.Reservation.set(reservation);

    const poolClass = await loadPoolClass(context, event.chainId, event.params.classId);
    if (poolClass) {
      context.PoolClass.set({
        ...poolClass,
        available: poolClass.available - event.params.quantity,
        lastUpdatedBlock: BigInt(event.block.number),
      });
    }
  },
);

indexer.onEvent(
  { contract: "CapacityPool", event: "ReservationTransferred" },
  async ({ event, context }) => {
    const r = await loadReservation(context, event.chainId, event.params.reservationId);
    context.Reservation.set({
      ...r,
      buyer: event.params.to,
      lastUpdatedBlock: BigInt(event.block.number),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityPool", event: "ReservationExpired" },
  async ({ event, context }) => {
    const r = await loadReservation(context, event.chainId, event.params.reservationId);
    context.Reservation.set({
      ...r,
      status: "Expired",
      lastUpdatedBlock: BigInt(event.block.number),
    });

    const poolClass = await loadPoolClass(context, event.chainId, r.classId);
    if (poolClass) {
      context.PoolClass.set({
        ...poolClass,
        available: poolClass.available + r.quantity,
        lastUpdatedBlock: BigInt(event.block.number),
      });
    }
  },
);

indexer.onEvent(
  { contract: "CapacityPool", event: "ReservationActivated" },
  async ({ event, context }) => {
    const r = await loadReservation(context, event.chainId, event.params.reservationId);
    context.Reservation.set({
      ...r,
      status: "Activated",
      activationDeadline: event.params.activationDeadline,
      assignmentCount: Number(event.params.assignmentCount),
      lastUpdatedBlock: BigInt(event.block.number),
    });

    // `ReservationActivated` names only how many assignments were created,
    // not what's in each one — one `assignmentInfo` read per index, each
    // cached forever by (reservationId, assignmentIndex). See effects.ts.
    const count = event.params.assignmentCount;
    for (let i = 0n; i < count; i++) {
      const details = await context.effect(fetchAssignmentDetails, {
        contractAddress: event.srcAddress,
        reservationId: event.params.reservationId,
        assignmentIndex: i,
      });
      const assignment: Assignment = {
        id: assignmentEntityId(event.chainId, event.params.reservationId, i),
        reservationId: event.params.reservationId,
        assignmentIndex: Number(i),
        provider: details.provider,
        quantity: details.quantity,
        price: details.price,
        collateral: details.collateral,
        disputeDeadline: undefined,
        // Always Pending here: this read happens in the same handler that
        // just processed the activation, before any assignment-level event
        // (Accepted/DeliveryClaimed/...) for this reservation can exist.
        status: "Pending",
        lastUpdatedBlock: BigInt(event.block.number),
      };
      context.Assignment.set(assignment);
    }
  },
);

indexer.onEvent(
  { contract: "CapacityPool", event: "AssignmentAccepted" },
  async ({ event, context }) => {
    const a = await loadAssignment(context, event.chainId, event.params.reservationId, event.params.assignmentIndex);
    context.Assignment.set({ ...a, status: "Accepted", lastUpdatedBlock: BigInt(event.block.number) });
  },
);

indexer.onEvent(
  { contract: "CapacityPool", event: "AssignmentDeliveryClaimed" },
  async ({ event, context }) => {
    const a = await loadAssignment(context, event.chainId, event.params.reservationId, event.params.assignmentIndex);
    context.Assignment.set({
      ...a,
      status: "DeliveryClaimed",
      disputeDeadline: event.params.disputeDeadline,
      lastUpdatedBlock: BigInt(event.block.number),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityPool", event: "AssignmentDisputed" },
  async ({ event, context }) => {
    const a = await loadAssignment(context, event.chainId, event.params.reservationId, event.params.assignmentIndex);
    context.Assignment.set({
      ...a,
      status: "Disputed",
      // Same storage-slot reuse as CapacityMarket.Disputed — see that
      // handler's comment.
      disputeDeadline: event.params.resolutionDeadline,
      lastUpdatedBlock: BigInt(event.block.number),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityPool", event: "AssignmentDefaulted" },
  async ({ event, context }) => {
    const a = await loadAssignment(context, event.chainId, event.params.reservationId, event.params.assignmentIndex);
    context.Assignment.set({ ...a, status: "Defaulted", lastUpdatedBlock: BigInt(event.block.number) });
  },
);

indexer.onEvent(
  { contract: "CapacityPool", event: "AssignmentSettled" },
  async ({ event, context }) => {
    const a = await loadAssignment(context, event.chainId, event.params.reservationId, event.params.assignmentIndex);
    context.Assignment.set({ ...a, status: "Settled", lastUpdatedBlock: BigInt(event.block.number) });
  },
);

indexer.onEvent(
  { contract: "CapacityPool", event: "AssignmentRefunded" },
  async ({ event, context }) => {
    const a = await loadAssignment(context, event.chainId, event.params.reservationId, event.params.assignmentIndex);
    context.Assignment.set({ ...a, status: "Refunded", lastUpdatedBlock: BigInt(event.block.number) });
  },
);

// `ProviderStatsUpdated` already carries the full running totals — a plain
// upsert, same as CapacityMarket.ts. Kept in its own ProviderStat row
// (contractName: "CapacityPool") rather than merged with CapacityMarket's,
// matching the two contracts' own separate storage — see AGENTS.md's
// "Reputation tracking" entry.
indexer.onEvent(
  { contract: "CapacityPool", event: "ProviderStatsUpdated" },
  async ({ event, context }) => {
    context.ProviderStat.set({
      id: `${event.chainId}-CapacityPool-${event.params.provider}`,
      contractName: "CapacityPool",
      provider: event.params.provider,
      settledCount: event.params.settledCount,
      defaultedCount: event.params.defaultedCount,
      disputesLostCount: event.params.disputesLostCount,
      disputesTimedOutCount: event.params.disputesTimedOutCount,
      lastUpdatedBlock: BigInt(event.block.number),
    });
  },
);
