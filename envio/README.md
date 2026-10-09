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

## What's actually verified

**2026-10-04, against the previous deployment (now historical — see
"Deployment addresses indexed" below):** `npx envio codegen` and
`npx tsc --noEmit` (`strict: true`) both clean, confirmed via `--listFiles`
that `src/handlers/*.ts` were actually compiled; `npm run dev` synced from
`start_block` to chain head in under 5 seconds, and a direct Postgres query
(bypassing a local Hasura/port-8080 collision with an unrelated service on
this machine) confirmed 2 real `Position` rows, both `Defaulted`, matching
the live-exercised position from that deployment's history —
`provider`/`buyer`/`domain`/`price` all correctly decoded from `Listed`,
carried through to `Defaulted`. `PoolClass`/`Reservation`/`Assignment`
stayed at 0, correctly: that `CapacityPool` had no live `contribute`/
`reserve`/`activate` activity yet. `ProviderStat` also stayed at 0 — not
"not reached yet": that deployment's bytecode (2026-10-01) predated
`ProviderStatsUpdated` entirely (added 2026-10-04, after it), so no amount
of re-syncing could ever have produced a row against it.

**2026-10-05, re-pointed to the current deployment** (a separate session
redeployed both contracts specifically to add `providerStats()` — see
`README.md`'s "Live on Monad testnet"): re-ran `npx envio codegen` and
`npx tsc --noEmit` clean against the new `config.yaml`; confirmed the ABI
files in `abis/` still match the newly compiled contracts' events exactly
(diff against `out/{CapacityMarket,CapacityPool}.sol/*.json`'s event
lists — identical, since this was a redeploy of the same source, not a
new version); ran `envio dev -r` (full reset — Envio itself refuses to
resume with an incompatible `start_block`/address change, correctly) and
confirmed a clean sync to realtime with **0 rows in every table** — the
*correct* answer here, verified independently via `cast call
nextPositionId`/`nextReservationId` against the new addresses returning
`0`: this deployment is genuinely brand new, not yet used by anything
(`web/`'s frontend exists now and will be what generates the first real
activity). `ProviderStat` is no longer structurally blocked the way it was
against the previous deployment — it will populate the first time anyone
settles, defaults, or loses/times-out a dispute against the new contracts.

**2026-10-09, that first real activity against the current deployment:**
`web/`/`docs/TECHNICAL_README.md`'s "Sponsor integration — Chainlink CRE"
exercise was repeated directly against the pair above (not left resting on
the historical pair's record) — a position listed, reserved, activated
with a 45-second SLA, then defaulted by the real CRE workflow
(`cre workflow simulate deadline-keeper --target staging-settings
--broadcast`). Re-ran `npm run dev` (resumed from the existing checkpoint,
not a reset) against `config.yaml` unchanged from the 2026-10-05 re-point;
synced to within 6 blocks of chain head. Confirmed via direct Postgres
query (same method as 2026-10-04, since local Hasura again collided with
an unrelated service on port 8080 — see note above): `Position` row
`10143-0` reads `status: Defaulted`, `provider`/`buyer` both the funded
demo account; `ProviderStat` row
`10143-CapacityMarket-0x...a51787` reads `defaultedCount: 1` — the first
non-zero `ProviderStat` row this indexer has ever produced, confirming
both the event and the reputation-tracking path end to end against
contracts nobody had exercised before today.

## Deployment addresses indexed

| Contract | Address | Deploy block (binary-searched via `cast code`) |
|---|---|---|
| `CapacityMarket` | `0xb2bEed70CA03F9ae86276f14aAB79F6F36f681C3` | 68451274 |
| `CapacityPool` | `0xA5460952b9445C2CC5daf08D4808C09f4458Aa11` | 68451278 |

**Historical** (indexed and live-exercised 2026-10-01 through 2026-10-05,
superseded — do not re-point back to these without a plan for what happens
to this database's existing rows, since a shared sync across both pairs
would conflate two unrelated deployments' histories):

| Contract | Address | Deploy block |
|---|---|---|
| `CapacityMarket` | `0x6fDA6975D7d585a772Dc763Ab44Bc206c94a0364` | 67351825 |
| `CapacityPool` | `0x44f305fbCF56acECe8f79Cd9773351E68634B0D5` | 67351828 |

If either contract is redeployed again (another Level, or a bug fix),
update both the address and `start_block` in `config.yaml` and this
table — do not leave a stale address indexing a contract nobody uses
anymore.
