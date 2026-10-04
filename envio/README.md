# MUSTER — Envio HyperIndex indexer

Indexes `CapacityMarket.sol` (Level 1) and `CapacityPool.sol` (Level 2) on
Monad testnet, so capacity can be browsed via a GraphQL query instead of
raw `cast call`/`cast logs` — the gap named in `AGENTS.md`'s sponsor-bounty
scope decision this fills.

## What's indexed

- **`Position`** — one row per `CapacityMarket` position, kept in sync by
  every lifecycle event (`Listed` through `Settled`/`Expired`/`Defaulted`/
  `Refunded`). Fully derivable from events; no contract reads needed.
- **`PoolClass`** — one row per `CapacityPool` terms class (`classId`),
  with `totalCommitted`/`available` maintained by event arithmetic.
  `domain`/`validFrom`/`validUntil`/`activationSLA`/`pricePerUnit`/
  `collateralPerUnit` need one `poolInfo(classId)` read the first time a
  class is seen — `Contributed` never emits them. See `schema.graphql`.
- **`Reservation`** / **`Assignment`** — `CapacityPool`'s per-reservation
  and per-slice state. Assignment's `provider`/`quantity`/`price`/
  `collateral` need one `assignmentInfo(reservationId, index)` read right
  after `ReservationActivated` — that event only names how many
  assignments exist, not what's in each one.
- **`ProviderStat`** — mirrors the `ProviderStatsUpdated` event both
  contracts emit (see `AGENTS.md`'s "Reputation tracking" entry). A plain
  upsert; the event already carries the running totals.

Deliberately not indexed, and why: see the comment block at the top of
`config.yaml`. In short — `DisputeVoteCast`/`DisputeResolved` and their
`CapacityPool` equivalents are redundant with the `Settled`/`Refunded`
status transition that follows in the same transaction, and
`ContributionWithdrawn` was checked against `withdrawContribution`'s actual
body and confirmed to never touch `pool.totalCommitted`/`pool.available` —
there is no entity field for it to update.

## Setup

```bash
npm install
cp .env.example .env   # fill in MONAD_TESTNET_RPC_URL if not using the default
npm run codegen
npm run dev             # local Postgres via Docker, auto-codegen, live reload
```

`npm run dev`/`npm run start` need Docker (Envio's local Postgres) and were
**not run in the session that built this indexer** — only `envio codegen`
and `tsc --noEmit` (both clean, see below) plus a direct `viem.readContract`
call against the live deployed `CapacityPool` to confirm the `poolInfo`
decode shape matches what `effects.ts` expects. Running the actual
historical sync against Monad testnet, and confirming the GraphQL API
returns the expected rows, is the next concrete step before calling this
bounty entry complete — not yet demonstrated end-to-end the way the CRE
integration was.

## What's actually verified, as of 2026-10-04

- `npx envio codegen` — succeeds against this `config.yaml` +
  `schema.graphql` (exit 0, `.envio/types.d.ts` generated).
- `npx tsc --noEmit` — succeeds against the generated types with
  `strict: true` (exit 0, confirmed `--listFiles` actually compiled
  `src/handlers/*.ts`, not skipped them).
- `poolInfo` decode shape — called live against the deployed `CapacityPool`
  (`0x44f305fbCF56acECe8f79Cd9773351E68634B0D5`) with a nonexistent
  `classId` via a standalone `viem` script; the returned tuple's field
  names/order matched `fetchPoolTerms`'s destructuring exactly.
- **Not verified**: there is currently no live `Contributed`/`reserve`/
  `activate` activity on the deployed Level 5 `CapacityPool` to index
  against (only the earlier pre-Level-4 pair was ever exercised live on
  `CapacityPool` — see `README.md`'s "Live on Monad testnet"), so the
  `fetchAssignmentDetails` effect and the full event-to-entity pipeline
  have not been exercised against real chain data, only against the
  type system and one isolated contract read.

## Deployment addresses indexed

| Contract | Address | Deploy block (binary-searched via `cast code`, 2026-10-04) |
|---|---|---|
| `CapacityMarket` | `0x6fDA6975D7d585a772Dc763Ab44Bc206c94a0364` | 67351825 |
| `CapacityPool` | `0x44f305fbCF56acECe8f79Cd9773351E68634B0D5` | 67351828 |

If either contract is redeployed (another Level, or a bug fix), update
both the address and `start_block` in `config.yaml` — do not leave a stale
address indexing a contract nobody uses anymore.
