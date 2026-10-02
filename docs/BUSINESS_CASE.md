# MUSTER — the business case

This document exists for one audience: a judge scoring the Onchain Finance
& Trading track. The track's own rubric (not the generic Terms &
Conditions one) is explicit that it's "weighted toward startup potential,"
and names two criteria that carry 45% of the score between them:

> **Founder & Market Readiness (25%)** — does the team understand who the
> trader, protocol, or counterparty is and why this market doesn't already
> exist? Can they name a specific first user beyond "crypto traders"?
>
> **Traction & Path Forward (20%)** — any evidence of real usage or
> testing (even simulated volume or a handful of test trades), and a
> specific next step — a TVL/volume target, a liquidity partner plan, or a
> concrete fundraising/launch plan.

This document answers those two questions directly, with the architectural
argument for *why it scales* in support — not as a separate pitch. See
[`README.md`](../README.md) for what the product is and
[`TECHNICAL_README.md`](TECHNICAL_README.md) for how it's built.

## Founder & Market Readiness: who, specifically, and why doesn't this exist

**The specific first user is not "crypto traders."** Two named sides:

- **Supply side**: independent and boutique security specialists who
  already sell their time this way informally — a freelance ZK-security
  auditor, a small DFIR shop, an incident-response contractor — who today
  either sit idle between engagements (a sunk cost) or lock into a
  retainer that pays whether or not they're used.
- **Demand side**: the security lead or eng lead at a mid-size Web3
  protocol or DAO who cannot justify a full-time incident-response hire
  but currently has no better option than an informal "call me if
  something happens" arrangement with no SLA, no collateral, and no
  recourse if the person is unavailable when it matters.

**Why this market doesn't already exist**: the thing a retainer cannot do
is make the commitment *tradeable*. A security lead who reserves capacity
and never needs it has paid for nothing transferable — the slot cannot be
resold, and the provider has no collateral obligation that makes the SLA
real instead of a verbal promise. Building this off-chain means someone
has to be the trusted intermediary holding both the provider's
reputation and the buyer's money — which is exactly the retainer-broker
model that already exists and that this market is deliberately not
rebuilding. Making the commitment itself an asset (collateral-backed,
transferable, SLA-enforced without a human referee) is the part that
genuinely needed a smart contract, not just a database with better UX.

## Traction & Path Forward

**Real usage, not simulated**: this isn't a UI over static data. A real
`CapacityPosition` was listed, reserved, and activated on Monad testnet
with a live 45-second SLA clock; when the deadline passed, Chainlink's CRE
workflow — not a human, not a script run by hand — read the chain, found
the breach, and submitted the report that made `CapacityMarket` emit
`Defaulted`. That is the "handful of test trades" bar the rubric names,
cleared with the automated-enforcement path exercised end-to-end, which is
the harder path to demonstrate than a plain happy-path settlement.

**Specific next step**: run a pilot with 2-3 real security boutiques/DAOs
post-hackathon, listing and reserving real (not synthetic) capacity on
testnet, before any mainnet fee-capture launch. That sequencing — real
counterparties on testnet first, revenue mechanism second — is the
concrete, checkable claim a judge can ask about, instead of a generic
"we'll grow users" line.

## How the architecture supports that claim (not a separate pitch)

**MUSTER scales the way a marketplace protocol scales: new supply, new
verticals, and higher transaction volume are additions to configuration and
liquidity, not additions to engineering headcount.** That property is
architectural, not aspirational — it was true at Level 2, before any
business thinking was layered on top.

### New verticals are data, not code

A `TermsClass` in `CapacityPool` — domain, window, SLA, price, arbitration
panel — is the only thing that defines a specialist vertical. ZK-security
incident response is the vertical built and tested; DFIR, pentest-on-call,
legal/compliance response, or physical incident response (industrial,
logistics) are the same contract, a new `TermsClass` entry. There is no
per-vertical smart contract to write, audit, or redeploy — which is the
concrete answer to "why would this grow beyond one niche market."

### Pooled supply is what makes it a market, not a listings board

Level 1 (`CapacityMarket`) is one provider, one position — a bulletin
board. Level 2 (`CapacityPool`) is what turns it into a market: providers
contribute fungible units to a class, buyers reserve quantity without
naming a provider, and `activate()` routes FIFO across however many
providers are needed to fill the reservation. Depth of supply is what a
marketplace sells as much as the underlying good.

### Enforcement is the part that doesn't scale in the competing approach — and here it does

A retainer, an NDA'd SLA document, a Calendly-based booking system all
depend on *someone* noticing a missed deadline and calling the right
person — an ops cost that grows with every concurrent position. The CRE
workflow makes that a fixed cron job regardless of whether there are ten
open positions or ten thousand: the specific, checkable mechanism behind
"this scales operationally," not a general claim about blockchains being
efficient.

### Where the revenue model goes (not yet built, stated honestly)

No fee-capture mechanism exists in the contracts today — every unit of
value currently goes to provider (price) or buyer (refund), nothing to a
protocol treasury. A basis-point fee at `activate()` or `settle()` — the
same place every onchain marketplace takes its cut — was deliberately
deferred as a monetization decision, not an architecture one: it slots in
at settlement points that already exist without touching the state
machine. Naming this honestly, rather than inventing a number, is itself
part of answering Founder & Market Readiness credibly.

## What this document is not claiming

This is not a claim that MUSTER has product-market fit today, has paying
customers, or has validated demand beyond the hackathon's own
demonstration and the pilot plan above. It is a claim that the
architecture does not have to be rebuilt to go from one vertical and a
testnet deployment to many verticals and a fee-generating mainnet
deployment, because Levels 2 through 5 were built, from the start, as the
fungible, multi-vertical, dispute-safe version — not as a single-provider
prototype later outgrown.
