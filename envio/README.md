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
cp .env.example .env
# Add ENVIO_API_TOKEN (free — https://envio.dev/app/api-tokens) to .env.
# HyperSync log ingestion requires one; the two supplementary poolInfo/
# assignmentInfo reads in effects.ts do not (they use MONAD_TESTNET_RPC_URL).
npm run codegen
npm run dev             # local Postgres via Docker, auto-codegen, live reload
```

A plain-RPC fallback (`chains[0].rpc: { url: ..., for: sync }`, no token
needed) was tried and rejected: Monad testnet's public RPC caps
`eth_getLogs` at a 100-block range, and at ~400ms blocks the full range
from deploy to head is roughly 840k blocks — confirmed empirically to
converge far too slowly to be practical, not just assumed. HyperSync (and
therefore a free API token) is the only practical path for this chain.

## What's actually verified, as of 2026-10-04

Run for real, end to end, with Docker Postgres and a free `ENVIO_API_TOKEN`
— not just code-reviewed:

- `npx envio codegen` and `npx tsc --noEmit` (`strict: true`) — both clean,
  confirmed via `--listFiles` that `src/handlers/*.ts` were actually
  compiled.
- `npm run dev` — synced from the configured `start_block` to chain head in
  under 5 seconds ("All events have been fetched... switching to realtime
  indexing"), then queried directly against Postgres (bypassing a local
  Hasura/port-8080 collision with an unrelated service on this machine):
  **2 real `Position` rows**, both status `Defaulted`, matching exactly the
  live-exercised position from `README.md`'s "Live on Monad testnet"
  section — `provider`/`buyer`/`domain`/`price` all correctly decoded from
  `Listed`, carried through `Reserved`/`Activated` to the final `Defaulted`
  status written by `claimDefault`'s handler.
- `PoolClass`/`Reservation`/`Assignment` rows: **0**, correctly — there is
  no live `Contributed`/`reserve`/`activate` activity on the deployed Level
  5 `CapacityPool` yet (only the earlier pre-Level-4 pair was ever
  exercised live on `CapacityPool`), so `fetchAssignmentDetails` has not
  been exercised against real chain data, only against the type system and
  one isolated live `poolInfo` call (confirmed separately, decode shape
  matches `fetchPoolTerms`'s destructuring exactly).
- **`ProviderStat` rows: 0 — and this one is structural, not "not reached
  yet".** The deployed `CapacityMarket`/`CapacityPool` (redeployed
  2026-10-01 per `README.md`) predate `ProviderStatsUpdated`, which this
  repo's `src/CapacityMarket.sol`/`CapacityPool.sol` only gained in the
  commit that added `ProviderStats` (2026-10-04, after that deploy). The
  live contracts' bytecode does not contain that event at all — no amount
  of waiting or re-syncing will produce a `ProviderStat` row against the
  currently deployed addresses. The handler is correct and will populate
  this entity the moment a contract containing `_recordOutcome` is
  (re)deployed and `config.yaml`'s addresses/`start_block` are updated to
  match — but until then, 0 rows is the only correct answer, not a bug.

## Deployment addresses indexed

| Contract | Address | Deploy block (binary-searched via `cast code`, 2026-10-04) |
|---|---|---|
| `CapacityMarket` | `0x6fDA6975D7d585a772Dc763Ab44Bc206c94a0364` | 67351825 |
| `CapacityPool` | `0x44f305fbCF56acECe8f79Cd9773351E68634B0D5` | 67351828 |

If either contract is redeployed (another Level, or a bug fix), update
both the address and `start_block` in `config.yaml` — do not leave a stale
address indexing a contract nobody uses anymore.
