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
LISTED → RESERVED → ACTIVATED → ACCEPTED → SETTLED
            │            │
            ├─ transfer  └─ (SLA missed) → DEFAULTED → collateral to buyer
            └─ (window closes unused) → EXPIRED → collateral to provider
```

There is no path that lets a position be reserved twice, activated twice, or
settled after it has already defaulted — see the Technical README for the
exact invariants and the tests that exercise each one.

## Current build

**Level 1**, by design: one provider owns one position at a time (not yet a
pooled market of fungible capacity across many providers — that's the next
level, and the state machine above is built so it extends into that rather
than being replaced by it).

- Solidity contract (`src/CapacityMarket.sol`), Foundry project.
- 15/15 tests passing (`test/CapacityMarket.t.sol`), covering the full
  lifecycle plus every invariant violation listed above.
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
