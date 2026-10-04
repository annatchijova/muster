/**
 * Two supplementary contract reads, used only where the chain's own events
 * genuinely don't carry what's needed (verified against the live Solidity
 * source, not assumed — see config.yaml's and schema.graphql's notes on
 * each field). Both follow Envio's own documented pattern for this exact
 * situation (a cached `createEffect` wrapping a `viem` `readContract` call)
 * rather than inventing a different approach.
 *
 * `rateLimit: false` on both: each effect result is cached forever by its
 * input (Envio's own effect cache, keyed by input), so a given classId or
 * (reservationId, assignmentIndex) pair is only ever read from chain once,
 * regardless of how many times the indexer reprocesses history.
 */
import { createEffect, S } from "envio";
import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import CapacityPoolAbi from "../../abis/CapacityPool.json";

const client = createPublicClient({
  chain: monadTestnet,
  transport: http(process.env.MONAD_TESTNET_RPC_URL, { batch: true }),
});

/**
 * `Contributed(classId, provider, quantity, collateral)` never emits the
 * `TermsClass` that `classId` hashes (domain/window/SLA/price). Called once,
 * the first time a given classId is seen in `CapacityPool.ts`.
 */
export const fetchPoolTerms = createEffect(
  {
    name: "fetchPoolTerms",
    input: { classId: S.string, contractAddress: S.string },
    output: {
      domain: S.string,
      validFrom: S.bigint,
      validUntil: S.bigint,
      activationSLA: S.bigint,
      pricePerUnit: S.bigint,
      collateralPerUnit: S.bigint,
    },
    rateLimit: false,
  },
  async ({ input, context }) => {
    try {
      const [terms] = (await client.readContract({
        address: input.contractAddress as `0x${string}`,
        abi: CapacityPoolAbi as any,
        functionName: "poolInfo",
        args: [input.classId as `0x${string}`],
      })) as [
        {
          domain: `0x${string}`;
          validFrom: bigint;
          validUntil: bigint;
          activationSLA: bigint;
          disputeWindow: bigint;
          panelMembers: `0x${string}`[];
          panelThreshold: bigint;
          pricePerUnit: bigint;
          collateralPerUnit: bigint;
        },
        bigint,
        bigint,
        bigint,
      ];
      return {
        domain: terms.domain,
        validFrom: terms.validFrom,
        validUntil: terms.validUntil,
        activationSLA: terms.activationSLA,
        pricePerUnit: terms.pricePerUnit,
        collateralPerUnit: terms.collateralPerUnit,
      };
    } catch (err) {
      context.log.warn(
        `fetchPoolTerms(${input.classId}) failed, PoolClass terms fields will stay null: ${err}`,
      );
      // Rethrow: a half-populated PoolClass (quantities right, terms wrong)
      // is worse than the handler retrying this event later. Envio retries
      // a failed effect; it does not silently swallow it the way returning
      // placeholder zeros here would.
      throw err;
    }
  },
);

/**
 * `ReservationActivated(reservationId, activationDeadline, assignmentCount)`
 * names how many assignments were created, not what's in each one —
 * `provider`/`quantity`/`price`/`collateral` per slice are never emitted
 * together anywhere. Called once per assignment index, right after
 * `ReservationActivated`, in `CapacityPool.ts`.
 */
export const fetchAssignmentDetails = createEffect(
  {
    name: "fetchAssignmentDetails",
    input: {
      contractAddress: S.string,
      reservationId: S.bigint,
      assignmentIndex: S.bigint,
    },
    output: {
      provider: S.string,
      quantity: S.bigint,
      price: S.bigint,
      collateral: S.bigint,
    },
    rateLimit: false,
  },
  async ({ input, context }) => {
    try {
      const result = (await client.readContract({
        address: input.contractAddress as `0x${string}`,
        abi: CapacityPoolAbi as any,
        functionName: "assignmentInfo",
        args: [input.reservationId, input.assignmentIndex],
      })) as [`0x${string}`, bigint, bigint, bigint, `0x${string}`, bigint, number];
      const [provider, quantity, price, collateral] = result;
      return { provider, quantity, price, collateral };
    } catch (err) {
      context.log.warn(
        `fetchAssignmentDetails(${input.reservationId}, ${input.assignmentIndex}) failed: ${err}`,
      );
      throw err;
    }
  },
);
