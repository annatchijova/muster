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

## Founder & Market Readiness: the market for future availability

MUSTER's business thesis is that **a professional's future availability can
be sold as a bounded, transferable commitment**. Today, a buyer often pays
for standing capacity through payroll or a retainer, or waits until an
urgent incident to find someone available and negotiate under pressure.
Both options have a cost: money tied up in capacity that may sit unused,
or time and bargaining power lost when the need is already urgent. MUSTER
tests whether specifying that capacity in advance — for example, a set
number of response hours within a time window and an acknowledgement SLA —
can make it easier to buy, pool, and transfer.

The specific first users are two sides, not generic "crypto traders":

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

**The market gap MUSTER is testing:** existing tools can hire specialists,
broker engagements, or arrange retainers. We are not claiming that no
comparable service exists. The narrower thesis is that these arrangements
do not necessarily combine, in one instrument, a defined block of future
capacity, pooled supply from multiple providers, a transferable buyer
reservation, provider collateral, and automatic handling of an SLA
deadline. That combination could let a buyer secure readiness before an
incident, then pass the unused reservation to another buyer if priorities
change. In the current prototype, `transfer()` and
`transferReservation()` change who holds the reservation; they do not
execute or price a resale. Whether counterparties will arrange and pay for
those transfers — and whether enough buyers and providers will participate
to create liquidity — is an open market question for the pilot, not a
result already demonstrated.

The contract makes the reservation and its deadline enforceable between
parties without an operator having to adjudicate every missed
acknowledgement. It does not determine service quality or prove that a
provider was available. Its business value depends on an offchain market
forming around the standardized commitment.

**The same hypothesis applies beyond security.** Accounting, forensic
accounting, construction trades such as electricians and bricklayers,
structural inspection, and other specialist services can have irregular
demand, costly idle availability, and urgent response needs. A buyer could
specify a credential or skill class and reserve units from a pool rather
than depend on one named provider. `CapacityPool` supports exact-match
terms classes and multi-provider assignment; the current live demonstration
is security response, not evidence that these other verticals already have
buyers or supply. They are candidates for validation after the first
security pilot.

## Traction & Path Forward

**Real usage, not simulated**: this isn't a UI over static data. A real
`CapacityPosition` was listed, reserved, and activated on Monad testnet
with a live 45-second SLA clock; when the deadline passed, Chainlink's CRE
workflow — not a human, not a script run by hand — read the chain, found
the breach, and submitted the report that made `CapacityMarket` emit
`Defaulted`. That is the "handful of test trades" bar the rubric names,
cleared with the automated-enforcement path exercised end-to-end, which is
the harder path to demonstrate than a plain happy-path settlement. A second,
independent system confirms the same claim from outside this project's own
test suite: the Envio HyperIndex indexer (`envio/`), synced live against
Monad testnet, read that exact position back from the chain as `Defaulted`
into its own Postgres store (the same data its GraphQL API serves) — not
re-asserted by the same code that produced it.

**Specific next step**: run a pilot with 2-3 real security boutiques/DAOs
post-hackathon, listing and reserving real (not synthetic) capacity on
testnet, before any mainnet fee-capture launch. That sequencing — real
counterparties on testnet first, revenue mechanism second — is the
concrete, checkable claim a judge can ask about, instead of a generic
"we'll grow users" line. Security response is the first pilot vertical
deliberately, not the only one the architecture supports (see "Not limited
to security specialists" above) — a named, narrow first cohort is a
stronger, more checkable claim than "any specialist, anywhere," and the
same `TermsClass` mechanism extends to a second vertical without
re-architecting once the first pilot validates the mechanics.

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
legal/compliance response, physical incident response (industrial,
logistics), or a non-security trade entirely — an on-call electrician, a
structural inspector, a notary — are the same contract, a new
`TermsClass` entry. There is no
per-vertical smart contract to write, audit, or redeploy — which is the
concrete answer to "why would this grow beyond one niche market."

### Pooled supply is what makes it a market, not a listings board

Level 1 (`CapacityMarket`) is one provider, one position — a bulletin
board. Level 2 (`CapacityPool`) is what turns it into a market: providers
contribute fungible units to a class, buyers reserve quantity without
naming a provider, and `activate()` routes FIFO across however many
providers are needed to fill the reservation. Depth of supply is what a
marketplace sells as much as the underlying good.

### A pilot must test provider incentives and transfer demand

The two contracts make different choices when a reservation expires unused.
In `CapacityMarket`, if a buyer reserved a named provider's position, that
provider receives the price and gets collateral back. In `CapacityPool`,
the buyer gets the reservation price back, the quantity returns to the pool,
and providers can reclaim collateral for unassigned capacity after the
window closes. No provider receives a reservation premium in that pool
expiry path; a provider receives the price when an assignment settles.
That choice follows the fact that no particular provider was assigned
before activation, but it raises a market question: will providers commit
capacity to a pool on those terms?

The pilot should ask 2-3 providers directly whether that payout model is
acceptable, what minimum commitment or cancellation terms they need, and
whether they would list capacity that might be reserved and later released
without a fee. It should also test whether buyers would pay to take over an
unused reservation. The prototype supports transfer of the reservation;
the parties must arrange any transfer payment themselves. These interviews
and trades can show whether the proposed instrument is attractive enough to
support supply and secondary demand.

### Automated deadline handling reduces manual monitoring; its compute cost scales with volume

An offchain retainer or SLA typically leaves someone responsible for
noticing a missed deadline and escalating it. MUSTER's CRE workflow runs
on a scheduled cadence and can submit due actions automatically, reducing
that manual monitoring work. Its per-run workload is not constant: the
current implementation reads every listed position and every pool
assignment, so RPC reads and processing grow with the number of records;
the report and transaction work also grow with the number of due actions.
At larger volumes it will need measured limits and likely pagination or
batching. No scale benchmark has established its operating cost yet.

### Where the revenue model goes (not yet built, stated honestly)

No fee-capture mechanism exists in the contracts today — every unit of
value currently goes to provider (price) or buyer (refund), nothing to a
protocol treasury. A basis-point fee at `activate()` or `settle()` — the
same place every onchain marketplace takes its cut — was deliberately
deferred as a monetization decision, not an architecture one: it slots in
at settlement points that already exist without touching the state
machine. Naming this honestly, rather than inventing a number, is itself
part of answering Founder & Market Readiness credibly.

### Provider reputation is tracked onchain and indexed; routing does not use it yet

A provider's track record is no longer something a judge has to take on
faith or reconstruct from raw events by hand: both contracts now emit
`ProviderStatsUpdated` — settled/defaulted/disputes-lost/disputes-timed-out
counts, updated at every terminal outcome — and the Envio indexer
materializes it into a queryable `ProviderStat` row the moment a contract
carrying that event is deployed. The currently deployed contracts do carry
it (redeployed 2026-10-05 specifically to add it; see `README.md`'s "Live
on Monad testnet"). On 2026-10-09, the current deployment recorded the
CRE-triggered default of position `#0`; the direct contract read returned
`defaultedCount == 1`, and Envio indexed a corresponding `ProviderStat`
row with `defaultedCount: 1` (`envio/README.md`, "What's actually
verified"). This is one recorded default, not a meaningful performance
history or proof of reputation-based selection. What's *not* built yet:
`activate()`'s FIFO
fill still picks the
next contributor in a `TermsClass`, not the best one — reputation is
readable, not yet a routing input. This matters specifically for the "what
if enough qualified providers are not available" failure mode the pool
model addresses structurally (above) but does not solve on *quality*.
Routing by reputation needs `activate()`'s contribution walk to change
from strict FIFO to a bucketed, reputation-weighted order — a real
state-machine change, reviewed with the same rigor Levels 3-5 got, not a
quick patch — and
is the honest reason it isn't built yet. Naming the line between "tracked"
and "acted on" precisely, rather than overclaiming the FIFO queue is
already reputation-aware, is the same discipline the revenue-model section
above applies to fees.

## What this document is not claiming

This is not a claim that MUSTER has product-market fit today, has paying
customers, or has validated demand beyond the hackathon's own
demonstration and the pilot plan above. It is a claim that the
architecture does not have to be rebuilt to go from one vertical and a
testnet deployment to many verticals and a fee-generating mainnet
deployment, because Levels 2 through 5 were built, from the start, as the
fungible, multi-vertical, dispute-safe version — not as a single-provider
prototype later outgrown.
