<p align="center"><a href="docs/TECHNICAL_README.md"><strong>→ Technical README</strong></a> (architecture, invariants, trust boundary, test evidence)</p>

# MUSTER

A security incident doesn't wait for you to find a specialist. By the time
you need a ZK-security responder or a supply-chain DFIR team, the market for
their time is gone — they're either busy, or you're negotiating a rate under
pressure, or both.

**MUSTER lets you buy that capacity before you need it.**

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
| An unused reservation is a sunk cost | An unused position transfers to another buyer before it expires |
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
What it still doesn't do: decide who's actually right in a dispute — that's
real arbitration, explicitly out of scope for now and named as the next
level in the Technical README.

- Foundry project, Solidity contracts (`src/CapacityMarket.sol`,
  `src/CapacityPool.sol`).
- 60/60 tests passing (`test/`), covering all three levels' lifecycles and
  every invariant violation.
- Not yet deployed to Monad testnet. Not yet audited.

```bash
forge build
forge test
```

## Track & scope

Built for the Monad hackathon (**Onchain Finance & Trading** track): a new
asset primitive — future response capacity — and the market structure that
makes it transferable before it's needed. See
[`docs/TECHNICAL_README.md`](docs/TECHNICAL_README.md) for the state machine
in full, the trust boundary (what's provable onchain vs. what isn't), known
limitations, and the next levels planned.

## License

Not finalized — the hackathon's licensing requirement hasn't been confirmed
yet. Contracts currently carry `UNLICENSED` as a placeholder. Default plan
once confirmed: Apache-2.0.
