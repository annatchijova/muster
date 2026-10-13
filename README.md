<p align="center"><a href="README.md"><strong>English</strong></a> · <a href="README_ES.md"><strong>Español</strong></a> · <a href="docs/TECHNICAL_README.md"><strong>Technical README</strong></a> (architecture, invariants, trust boundary, test evidence)<br><a href="https://muster-dapp.vercel.app"><strong>→ Live product</strong></a> · <a href="docs/USAGE_GUIDE.md">Judge and demo guide</a> · <a href="https://muster-pitch.vercel.app"><strong>Pitch page</strong></a> · <a href="docs/BUSINESS_CASE.md"><strong>Business case</strong></a></p>

<p align="center"><img src="docs/logo.png" alt="MUSTER logo" width="180"></p>

# MUSTER

The problem is **money, availability, and urgency**. Keeping forensic
specialists on staff means paying salaries even when no case needs them. A
monthly retainer also charges for standing availability, whether it gets
used or not. But when an incident does happen, there may be nobody free —
and finding someone while a case is unfolding means searching and
negotiating under pressure.

**MUSTER is designed as a shared market for reserving professional capacity
in advance.** A buyer reserves a defined block for a future window, with an
agreed price and response SLA backed by collateral. In the pooled market,
that block can be filled across providers who committed to the same terms.
The first use case is forensic incident response; the same market structure
could serve accountants, bricklayers, or other professionals whose work is
needed unpredictably.

If the buyer no longer needs the reservation, they can transfer the right to
use it to another buyer before it expires. This gives the buyer a way to pass
on the reservation before it lapses; if nobody transfers or activates it in
time, the contract's expiry rules apply. In the current contracts, transfer
changes who can activate the reservation; MUSTER does not process a resale
payment or automatically refund the original buyer. The parties arrange any
compensation between themselves.

## What this is

A forensic provider might commit: *"I reserve four hours for incident
response between Oct 1–31 and will acknowledge an activation within 30
minutes."* The first two contracts represent commitments as capacity units
with a window, price, response SLA, and collateral; they do not measure
offchain work hours or certify professional credentials. That commitment
becomes a `CapacityPosition` — an onchain asset with an owner, a time window,
a service-level deadline, and a collateral bond behind it.

A buyer reserves it before an incident. If the incident happens during the
window, they activate the position and the provider's response SLA starts.
The collateral backs the provider's commitment to that deadline; it does not
prove that offchain work was performed or met a quality bar.

```
BEFORE A CASE            IF THE CASE OPENS          IF IT DOESN'T
reserve a block  ───────▶ activate; response SLA
                         starts for the provider
                       └──────────────────────────▶ transfer the right
                                                    before expiry
```

## Beyond forensics: one market, many kinds of work

Forensics is the first example, not the boundary of the idea. The same
availability problem appears wherever demand is irregular: paying a full-time
salary or recurring retainer can be hard to justify, while finding a qualified
person at the moment of need can be difficult.

| Potential market | Example of capacity to reserve |
|---|---|
| Forensics and incident response | A block of specialist response time during a defined window |
| Accounting | Help with a closing, audit, or tax deadline without a permanent hire |
| Building trades | A block of availability for a repair or a small time-sensitive job |
| Other professional services | Any service whose units, availability window, price, and response terms can be agreed in advance |

`CapacityPool` is the mechanism for a shared “pool of professionals”: a buyer
reserves units under one terms class, and activation can route them across
providers who committed to those same terms. A new trade can use a different
domain and terms without adding profession-specific contract logic. The
current demo exercises forensic/security response; the other rows are
potential verticals, not active service categories in the deployed product.
The contracts do not verify licenses, work hours, or workmanship, so those
remain part of how each real-world market recruits and evaluates providers.

## Why a blockchain, specifically

Not because the domain is "crypto" — because the three properties the
product needs are exactly the ones a smart contract is good at making
non-negotiable between two parties who don't trust each other:

| Typical approach (a retainer, a Calendly link, an NDA'd SLA doc) | MUSTER |
|---|---|
| Salaries or monthly retainers pay for capacity even when it sits idle | Reserve a defined block for a specific future window instead of keeping a full-time specialist on standby |
| During an incident, search for whoever is free and negotiate under pressure | Reserve the provider, price, and response SLA in advance |
| An unused reservation expires with no way to pass it on | Transfer the right to activate it to another buyer before expiry; any resale payment is arranged between buyers |
| A single provider may not be available when needed | `CapacityPool` can route a reservation across providers who committed to the same terms |
| "Trust me, I was available" | The chain records when capacity was reserved, transferred, activated, accepted, and settled or defaulted |

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
way to browse available capacity today besides raw `cast call`. Re-pointed
2026-10-05 at the current (`providerStats`-carrying) pair below, and
exercised directly against *that same current pair* on 2026-10-09: a real
position (`#0`) was listed (`0x100eb38c…54690`), reserved, and activated
with a 45-second SLA, then found and defaulted by the identical CRE
workflow described above (report tx `0xf6dc7a5c…00303`) — `Defaulted`
confirmed onchain, and `providerStats(provider).defaultedCount` reads `1`
directly against `CapacityMarket`, no indexer needed to see it. See
[`envio/README.md`](envio/README.md) for Envio's own sync against this
same position.

- Foundry project, Solidity contracts (`src/CapacityMarket.sol`,
  `src/CapacityPool.sol`, `src/CREDeadlineReceiver.sol`), plus the
  `muster-cre/` Chainlink CRE workflow project (TypeScript).
- 118/118 Solidity tests passing (`test/`) plus 5/5 CRE workflow tests
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

Redeployed 2026-10-05 to add `providerStats` (the previous Level 5 pair
predated that function entirely — `providerStats(address)` reverted
against it, a real selector-not-found, confirmed via a raw `eth_call`
before redeploying, not assumed). Same Level 5 ABI otherwise. Current,
Sourcify-verified (`exact_match`) contracts:

| Contract | Address |
|---|---|
| `CapacityMarket` | `0xb2bEed70CA03F9ae86276f14aAB79F6F36f681C3` |
| `CapacityPool` | `0xA5460952b9445C2CC5daf08D4808C09f4458Aa11` |

**`CREDeadlineReceiver` instances redeployed alongside it** (same day,
pointing at the pair above; Sourcify-verified `match`), now including the
F4 gas-stipend fix (`docs/SECURITY_AUDIT_ROUND2_2026-10-05.md`):

| Role | Address | Trusts |
|---|---|---|
| Production | `0x7B9d3D1e58AFca458226235Ab2366B4BF36407dD` | Real Monad testnet `KeystoneForwarder` |
| Mock-forwarder staging | `0x28f794F0aFB563118C1ec476Dc304cc303BA9b2A` | Mock `KeystoneForwarder` — what local `cre workflow simulate --broadcast` actually talks to |

`muster-cre/deadline-keeper/config.production.json` and
`config.staging.json` were updated to match; the live CRE exercise
described below ran against the *previous* pair, before this redeploy —
see that pair's row in the history table for the preserved record of it.

**Gap from this redeploy, closed 2026-10-05:** `envio/config.yaml` was
re-pointed at the pair above (new, binary-searched `start_block`s, not a
bare address swap — see `envio/README.md`) and confirmed synced; see the
Envio indexer note above for the live exercise run directly against it.

**Earlier deploys, kept live and verified as this project's audit trail —
do not send value to any of them:**

| Contract | Address | Why it's stale |
|---|---|---|
| `CapacityMarket` | `0x6fDA6975D7d585a772Dc763Ab44Bc206c94a0364` | Level 5, pre-`providerStats` — exercised live end-to-end including the CRE-automated default path (a position listed/reserved/activated with a 45-second SLA, then automatically defaulted once it lapsed — `Defaulted` event, status confirmed onchain). The current pair above has since been exercised the identical way (see "Envio indexer" note above) — this one is kept only as the first such record. |
| `CapacityPool` | `0x44f305fbCF56acECe8f79Cd9773351E68634B0D5` | Same, Level 5 pre-`providerStats`. |
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

## Pitch deck slides

Browse the [14 presentation slides as PNG images](visual/README.md).
