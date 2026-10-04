/**
 * CapacityMarket.sol (Level 1) event handlers. Every field on `Position`
 * comes straight from an event param — no supplementary contract read
 * needed here (unlike CapacityPool.ts) because `Listed` emits the full set
 * `domain`/`quantity`/`validFrom`/`validUntil`/`activationSLA`/`price`/
 * `collateral` already. `disputeWindow` and the arbitration panel are the
 * two things `Listed` does NOT emit — see schema.graphql's `Position`
 * NatSpec for why they're left off this entity rather than guessed at.
 */
import { indexer } from "envio";
import type { Position } from "envio";

const positionId = (chainId: number, id: bigint) => `${chainId}-${id}`;

async function loadPosition(
  context: { Position: { get: (id: string) => Promise<Position | undefined> } },
  chainId: number,
  id: bigint,
): Promise<Position> {
  const existing = await context.Position.get(positionId(chainId, id));
  if (!existing) {
    throw new Error(
      `Position ${positionId(chainId, id)} not found — Listed should always precede every other CapacityMarket event for a position.`,
    );
  }
  return existing;
}

indexer.onEvent(
  { contract: "CapacityMarket", event: "Listed" },
  async ({ event, context }) => {
    const position: Position = {
      id: positionId(event.chainId, event.params.positionId),
      positionId: event.params.positionId,
      domain: event.params.domain,
      quantity: event.params.quantity,
      validFrom: event.params.validFrom,
      validUntil: event.params.validUntil,
      activationSLA: event.params.activationSLA,
      provider: event.params.provider,
      buyer: undefined,
      price: event.params.price,
      collateral: event.params.collateral,
      activationDeadline: undefined,
      disputeDeadline: undefined,
      status: "Listed",
      lastUpdatedBlock: BigInt(event.block.number),
      lastUpdatedAt: BigInt(event.block.timestamp),
    };
    context.Position.set(position);
  },
);

indexer.onEvent(
  { contract: "CapacityMarket", event: "Reserved" },
  async ({ event, context }) => {
    const p = await loadPosition(context, event.chainId, event.params.positionId);
    context.Position.set({
      ...p,
      buyer: event.params.buyer,
      status: "Reserved",
      lastUpdatedBlock: BigInt(event.block.number),
      lastUpdatedAt: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityMarket", event: "Transferred" },
  async ({ event, context }) => {
    const p = await loadPosition(context, event.chainId, event.params.positionId);
    context.Position.set({
      ...p,
      buyer: event.params.to,
      lastUpdatedBlock: BigInt(event.block.number),
      lastUpdatedAt: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityMarket", event: "Activated" },
  async ({ event, context }) => {
    const p = await loadPosition(context, event.chainId, event.params.positionId);
    context.Position.set({
      ...p,
      status: "Activated",
      activationDeadline: event.params.activationDeadline,
      lastUpdatedBlock: BigInt(event.block.number),
      lastUpdatedAt: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityMarket", event: "Accepted" },
  async ({ event, context }) => {
    const p = await loadPosition(context, event.chainId, event.params.positionId);
    context.Position.set({
      ...p,
      status: "Accepted",
      lastUpdatedBlock: BigInt(event.block.number),
      lastUpdatedAt: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityMarket", event: "DeliveryClaimed" },
  async ({ event, context }) => {
    const p = await loadPosition(context, event.chainId, event.params.positionId);
    context.Position.set({
      ...p,
      status: "DeliveryClaimed",
      disputeDeadline: event.params.disputeDeadline,
      lastUpdatedBlock: BigInt(event.block.number),
      lastUpdatedAt: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityMarket", event: "Disputed" },
  async ({ event, context }) => {
    const p = await loadPosition(context, event.chainId, event.params.positionId);
    context.Position.set({
      ...p,
      status: "Disputed",
      // The contract reuses `disputeDeadline`'s storage slot as the second
      // (resolution) window — mirrored here rather than adding a field the
      // contract doesn't itself distinguish. See CapacityMarket.sol's
      // `dispute()` NatSpec.
      disputeDeadline: event.params.resolutionDeadline,
      lastUpdatedBlock: BigInt(event.block.number),
      lastUpdatedAt: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityMarket", event: "Settled" },
  async ({ event, context }) => {
    const p = await loadPosition(context, event.chainId, event.params.positionId);
    context.Position.set({
      ...p,
      status: "Settled",
      lastUpdatedBlock: BigInt(event.block.number),
      lastUpdatedAt: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityMarket", event: "Refunded" },
  async ({ event, context }) => {
    const p = await loadPosition(context, event.chainId, event.params.positionId);
    context.Position.set({
      ...p,
      status: "Refunded",
      lastUpdatedBlock: BigInt(event.block.number),
      lastUpdatedAt: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityMarket", event: "Expired" },
  async ({ event, context }) => {
    const p = await loadPosition(context, event.chainId, event.params.positionId);
    context.Position.set({
      ...p,
      status: "Expired",
      lastUpdatedBlock: BigInt(event.block.number),
      lastUpdatedAt: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "CapacityMarket", event: "Defaulted" },
  async ({ event, context }) => {
    const p = await loadPosition(context, event.chainId, event.params.positionId);
    context.Position.set({
      ...p,
      status: "Defaulted",
      lastUpdatedBlock: BigInt(event.block.number),
      lastUpdatedAt: BigInt(event.block.timestamp),
    });
  },
);

// `ProviderStatsUpdated` already carries the full running totals (see
// CapacityMarket.sol's `_recordOutcome`) — a plain upsert, no arithmetic.
indexer.onEvent(
  { contract: "CapacityMarket", event: "ProviderStatsUpdated" },
  async ({ event, context }) => {
    context.ProviderStat.set({
      id: `${event.chainId}-CapacityMarket-${event.params.provider}`,
      contractName: "CapacityMarket",
      provider: event.params.provider,
      settledCount: event.params.settledCount,
      defaultedCount: event.params.defaultedCount,
      disputesLostCount: event.params.disputesLostCount,
      disputesTimedOutCount: event.params.disputesTimedOutCount,
      lastUpdatedBlock: BigInt(event.block.number),
    });
  },
);
