<p align="center"><a href="docs/TECHNICAL_README.md"><strong>→ Technical README</strong></a> (architecture, invariants, trust boundary, test evidence) · <a href="docs/BUSINESS_CASE.md"><strong>→ Business case</strong></a> (why this scales as a market, not just a demo)</p>

# MUSTER

A security incident doesn't wait for you to find a specialist. These
incidents happen often enough that no company can just hope one never comes
— but rare enough that almost nobody can justify a full-time hire, or a
retainer that bills every month whether or not the specialist is ever used.
And when the incident actually happens, you're searching the worst possible
market as a buyer: whoever's free knows you're under pressure and prices
accordingly, assuming anyone's free at all.

**MUSTER lets you buy that capacity before you need it — and it isn't a
subscription.** You reserve a specific, collateral-backed slot ahead of
time. If the incident never comes, you transfer the reservation to someone
who does need it before it expires; you're not stuck paying month after
month for a specialist sitting idle, the way a retainer makes you.

## What this is

A provider commits ahead of time: *"4 units of ZK-security incident response,
usable between Oct 1–31, I'll acknowledge activation within 30 minutes."*
That commitment becomes a `CapacityPosition` — an onchain asset with an
owner, a time window, a service-level deadline, and a collateral bond behind
it.

A buyer reserves it. If the incident never comes, they can transfer it to
someone who needs it, before it expires. If the incident comes, they
activate it — the position becomes a live claim with a ticking SLA clock,
and the provider's collateral is what makes the deadline mean something
instead of just being a promise.

```
TODAY                                      IF THE INCIDENT HAPPENS
 │                                                   │
 ├─ reserve 4 u. ZK response ─────────────────────── ┤── activate() → provider has 30 min
 │                                                   │
 └─ it doesn't ── transfer() to another company ─────┘   to accept, or loses the collateral
```

## Why a blockchain, specifically

Not because the domain is "crypto" — because the three properties the
product needs are exactly the ones a smart contract is good at making
non-negotiable between two parties who don't trust each other:

| Typical approach (a retainer, a Calendly link, an NDA'd SLA doc) | MUSTER |
|---|---|
| The same hour can informally be promised to two clients | `reserve()` only succeeds once per position — enforced, not policed |
| A missed SLA means a dispute, maybe a chargeback | A collateral bond pays out automatically on a missed deadline |
| An unused reservation is a sunk cost — a retainer bills monthly either way | An unused position transfers to another buyer before it expires; nothing was paid for and lost |
| Searching mid-incident means negotiating with whoever's free, under pressure, at whatever rate they name | Price and provider are locked in at reservation time, before urgency gives anyone leverage |
| "Trust me, I was available" | What happened — reserved, transferred, activated, accepted, settled, defaulted — is a public, ordered, tamper-evident record |

## How it behaves

A `CapacityPosition` moves through one state machine, and every transition
is a specific function call that only succeeds from the right prior state:

```
LISTED → RESERVED → ACTIVATED → ACCEPTED → DELIVERY CLAIMED → SETTLED
            │            │                        │
            │            │                        └─ disputed → refunded on timeout
            ├─ transfer  └─ (SLA missed) → DEFAULTED → collateral to buyer
            └─ (window closes unused) → EXPIRED → collateral to provider
```

Settlement isn't a bare "buyer says so" either: the provider has to claim
delivery first, committing to a hash of whatever evidence backs the claim,
which starts the buyer's window to approve or dispute it. Nobody can go
silent and lock the other side's money — an unanswered claim pays the
provider once the window passes, and an unresolved dispute refunds the
buyer once *its* window passes.

There is no path that lets a position be reserved twice, activated twice, or
settled after it has already defaulted — see the Technical README for the
exact invariants and the tests that exercise each one.

## Current build

**Level 1 — `CapacityMarket.sol`**: one provider owns one position at a
time. The diagram above is this level.

**Level 2 — `CapacityPool.sol`**: the fungible version. A provider
contributes capacity to a class instead of a personal position — *"8 units
of `ZK_SECURITY_L2`"* — and a buyer reserves quantity from that class
without naming a provider:

```
                 ZK_SECURITY_L2  (one terms class: domain, window, SLA, price)
                       │
          ┌────────────┼────────────┐
          │            │            │
       Provider A   Provider B   Provider C
          8 units      4 units      12 units
          └────────────┼────────────┘
                       │
                  24 units committed
                       │
            buyer reserves 10 units
                       │
             activate() routes FIFO:
             8 from A, 2 from B — two independent
             claims, each with its own SLA clock
```

One provider defaulting on their slice of a reservation doesn't sink the
rest — each routed slice is its own accept/settle/default lifecycle,
Level 1's state machine run once per assigned provider instead of once per
position.

**Level 3**: delivery claims and disputes, layered onto both. A provider's
`settle` is no longer a bare approval — it follows a hash-committed delivery
claim and a bounded response window, with a timeout path on each side so
neither a silent buyer nor an unresolved dispute can lock funds forever.

**Level 4/5**: a position can define an arbitration panel — a list of
addresses and a threshold, visible before anyone reserves, like every other
term. Once a dispute is raised, any panel member can vote for either side;
once either side's votes reach the threshold, that verdict executes,
racing the timeout fallback above (whoever gets there first wins). A single
trusted arbitrator (Level 4) is just the one-member, threshold-one case —
Level 5 generalized it to M-of-N so no single address has to be trusted
alone. No panel named (empty, the default) means the position behaves
exactly as it did at Level 3. What this still doesn't do: guarantee the
panel is independent, honest, or even genuinely separate people — that's a
trust assumption the buyer accepts by reserving a position that names one,
not something a contract can verify, and there's no stake or slashing
behind a vote. Genuinely trust-minimized adjudication (staking, an appeals
path, an independent oracle) is the next level, named in the Technical
README.

**Automated enforcement**: several functions above (`claimDefault`,
`finalizeDelivery`, `resolveDisputeByTimeout`, and their `CapacityPool`
equivalents) are deliberately permissionless — anyone can call them once
their deadline passes — but nothing did so automatically until now.
`src/CREDeadlineReceiver.sol` is the onchain half of a real Chainlink CRE
integration: a closed dispatcher (six named actions against two immutable
contract addresses, no arbitrary-calldata forwarding) that Chainlink's
DON-operated Forwarder calls once it reaches consensus on a report. The
offchain half — `muster-cre/deadline-keeper`, a cron-triggered workflow
that reads every position's status/deadline and submits a report once one
is due — is built and was run live: a real position with a 45-second SLA
was listed, reserved, and activated on `CapacityMarket`, and once the
deadline passed, the workflow found it, submitted a report, and
`CapacityMarket` emitted `Defaulted` — fully automatic, no one calling
`claimDefault` by hand. See "Live on Monad testnet" below for the receiver
addresses and docs/TECHNICAL_README.md for the one real wrinkle this
surfaced (local simulation uses a different Forwarder than production —
caught, diagnosed, and worked around with a second receiver instance, not
hidden).

**Envio indexer**: [`envio/`](envio/) indexes both contracts' full
lifecycle plus provider reputation into a queryable GraphQL API — the only
way to browse available capacity today besides raw `cast call`. Synced live
against Monad testnet and confirmed against Postgres directly: both real
`Listed`→`Defaulted` positions from the CRE exercise above came back
correctly. `ProviderStat` currently reads empty against the live
contracts — not a bug, the deployed bytecode predates the
`ProviderStatsUpdated` event added in a later commit; see
[`envio/README.md`](envio/README.md) for the full, honest trace.

- Foundry project, Solidity contracts (`src/CapacityMarket.sol`,
  `src/CapacityPool.sol`, `src/CREDeadlineReceiver.sol`), plus the
  `muster-cre/` Chainlink CRE workflow project (TypeScript).
- 116/116 Solidity tests passing (`test/`) plus 5/5 CRE workflow tests
  (`muster-cre/deadline-keeper`), covering all five levels' lifecycles,
  every invariant violation, the CRE receiver's dispatch logic, and a
  permanent regression suite for the red-team findings below.
- Live on Monad testnet with the current Level 5 bytecode, exercised
  end-to-end including the CRE-automated default path (see "Live on Monad
  testnet" below).

```bash
forge build
forge test
```

## Live on Monad testnet

Redeployed 2026-10-01 after adding Level 5 (`panelMembers`/
`panelThreshold` replaced the single `arbitrator` field, changing the ABI
again). Current, Sourcify-verified (`exact_match`) contracts:

| Contract | Address |
|---|---|
| `CapacityMarket` | `0x6fDA6975D7d585a772Dc763Ab44Bc206c94a0364` |
| `CapacityPool` | `0x44f305fbCF56acECe8f79Cd9773351E68634B0D5` |

**Exercised live**: a position was listed/reserved/activated with a
45-second SLA, then automatically defaulted by the CRE workflow once it
lapsed — `Defaulted` event, position status confirmed onchain afterward.

**`CREDeadlineReceiver` instances** (Sourcify-verified, `match`/partial —
expected with baked-in immutable constructor values, not a red flag):

| Role | Address | Trusts |
|---|---|---|
| Production | `0x544e73b2478B45c46b11E86dFaF07065F596fd05` | Real Monad testnet `KeystoneForwarder` |
| Mock-forwarder staging | `0xD8979A669b360cb02c8bAC95065669f609aFA5b0` | Mock `KeystoneForwarder` — what local `cre workflow simulate --broadcast` actually talks to |

**Earlier deploys, kept live and verified as this project's audit trail —
do not send value to any of them:**

| Contract | Address | Why it's stale |
|---|---|---|
| `CapacityMarket` | `0x1224950b84a86f57cB4AE838D372879960862896` | Level 4 (single `arbitrator` field, not the panel) — not exercised live. |
| `CapacityPool` | `0x29Bf88bDA7c6040713346916DBb2BbeBa3B61271` | Same, Level 4. |
| `CapacityMarket` | `0xD3cfAAaa8159146ed2281EBD87911AF5b683cE8f` | Pre-Level-4: patched (F1/F2/F3), exercised end-to-end live — list → reserve → activate → accept → claim delivery → settle, real MON. Provider collected exactly `price + collateral` (`0.07 MON`), contract balance returned to `0`. Representative tx hashes: `listCapacity` 0x2ef9c44c…ed23b, `claimDelivery` 0xeb6f1522…d709, `settle` 0xddf84f28…dd99. |
| `CapacityPool` | `0x7d59c7CB9579dF0122a6bbB45b19796a91F2D32F` | Same pre-Level-4 patched version, same live exercise (`contribute` 0xefd50828…db13, `settleAssignment` 0xdf771375…da51, `0.03 MON` collected). |
| `CapacityMarket` | `0xb859aF025b8676A5BFFFab6Ec013aBf131f7581c` | **Vulnerable** — the original pre-audit deploy, still has F1/F2/F3. |
| `CapacityPool` | `0x555C4340DA92b6579E26000b2CcAe9a2Ce5810e3` | Same, vulnerable. |

## Deploying to Monad testnet

```bash
cp .env.example .env   # fill in PRIVATE_KEY (a funded Monad testnet account)
source .env

forge script script/Deploy.s.sol \
  --rpc-url monad_testnet \
  --broadcast \
  --verify --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/
```

Needs a Monad testnet account funded with MON from [faucet.monad.xyz](https://faucet.monad.xyz).
`.env` is gitignored; never commit it. Chain id 10143, RPC
`https://testnet-rpc.monad.xyz` — current as of Oct 2026 per
[docs.monad.xyz](https://docs.monad.xyz/); testnets get reset, so re-check
those two values there if a deploy fails with a chain-id mismatch.

## Track & scope

Built for the Monad hackathon (**Onchain Finance & Trading** track): a new
asset primitive — future response capacity — and the market structure that
makes it transferable before it's needed. See
[`docs/TECHNICAL_README.md`](docs/TECHNICAL_README.md) for the state machine
in full, the trust boundary (what's provable onchain vs. what isn't), known
limitations, and the next levels planned — and
[`docs/BUSINESS_CASE.md`](docs/BUSINESS_CASE.md) for why the pooled,
permissionless-enforcement design scales to new verticals and higher volume
without rebuilding the core transaction engine.

## License

Apache-2.0 — see [`LICENSE`](LICENSE). The Monad Hackathon rules require
an OSI-approved license (MIT, Apache 2.0, GPL, or similar) kept publicly
accessible on GitHub during and after the hackathon.
