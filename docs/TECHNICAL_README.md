# MUSTER — Technical README

Audience: engineers auditing, extending, or integrating with the contracts.
Nothing here is softened for a general reader — see [`README.md`](../README.md)
for that.

## Status

Track: **Onchain Finance & Trading** (Monad hackathon, Sep 1 – Oct 13).

- **Level 1 — `CapacityMarket.sol`**: single-provider capacity position, full
  lifecycle plus Level 3's delivery-claim/dispute flow and Level 4/5's
  M-of-N arbitration panels. 43/43 tests passing.
- **Level 2 — `CapacityPool.sol`**: fungible, multi-provider capacity pooled
  by domain class, routed FIFO at activation, same Level 3/4/5 flow at the
  per-assignment grain. 42/42 tests passing.

91/91 tests passing total (including `test/RedTeam.t.sol`'s 6-test
regression suite for `docs/SECURITY_AUDIT_2026-10-01.md`'s three confirmed
and fixed findings). Five generations of deploy to Monad testnet (chain id
10143), all kept live and verified as this project's own audit trail — see
`README.md`'s "Live on Monad testnet" for every address and which is
current. Current (Level 5): `CapacityMarket` at
`0x6fDA6975D7d585a772Dc763Ab44Bc206c94a0364`, `CapacityPool` at
`0x44f305fbCF56acECe8f79Cd9773351E68634B0D5` — **not yet exercised live**,
only in Foundry. The prior pair (Level 4, single `arbitrator` field) was
also never exercised live; the pair before that (pre-Level-4, patched) was
exercised end-to-end with real MON; everything before that is the
still-vulnerable pre-audit deploy. Not independently audited beyond this
project's own red-team pass. Not deployed to mainnet.

**What "deployed" means here, for the pre-Level-4 pair that was actually
exercised:** those contracts were run end-to-end on the live testnet — `listCapacity` →
`reserve` → `activate` → `acceptActivation` → `claimDelivery` → `settle` on
`CapacityMarket`, and `contribute` → `reserve` → `activate` →
`acceptAssignment` → `claimAssignmentDelivery` → `settleAssignment` on
`CapacityPool` — with real MON, not Anvil. The provider's payout
(`price + collateral` exactly, both times) and the contract's
balance returning to `0` after settlement are now confirmed on a real
chain, not only asserted by the local Foundry suite. What this single run
does **not** demonstrate: the default/dispute/expire paths, concurrent
activity from multiple buyers, or anything at the scale or adversarial
conditions a live market would actually see — those remain demonstrated
only by the test suite.

## What MUSTER is, precisely

MUSTER turns **future specialist response capacity** into an onchain,
tradable, state-machine-governed asset. Level 1 is that asset owned by one
named provider (`CapacityPosition`). Level 2 is the same asset pooled across
many providers who satisfy the same terms (`TermsClass` / `Contribution` /
`Assignment`), so a buyer can reserve capacity without naming a provider —
only once a buyer activates does the contract pick, FIFO, which provider's
contribution actually fulfills it.

MUSTER does **not** claim to prove a provider was actually available or that
delivered work met a bar — see "Trust boundary" below. It proves the
narrower, onchain-provable claim: *this capacity was reserved, transferred
(or routed), activated, and settled (or defaulted) exactly once, in that
order, with its terms unchanged.*

---

## Level 1 — `CapacityMarket.sol`: single-provider position

### State machine

```
LISTED
  │  reserve()
  ▼
RESERVED ──transfer()──▶ RESERVED (new buyer, same terms)
  │  │
  │  └─ expire() [window closed, never activated] ──▶ EXPIRED
  │                                              (collateral [+ price] → provider)
  │  activate()
  ▼
ACTIVATED
  │  │
  │  ├─ acceptActivation() [within SLA] ──▶ ACCEPTED
  │  │                                          │  claimDelivery(evidenceHash)
  │  │                                          ▼
  │  │                                    DELIVERY CLAIMED
  │  │                                          │     │
  │  │                                 settle() │     │ dispute(reasonHash)
  │  │                     [buyer approves,     │     │ [within disputeWindow]
  │  │                      any time]           ▼     ▼
  │  │                                      SETTLED  DISPUTED
  │  │                                      (price +    │  resolveDisputeByTimeout()
  │  │                                     collateral    │  [after a second disputeWindow]
  │  │                                     → provider)   ▼
  │  │                                              REFUNDED
  │  │                               finalizeDelivery()  (price + collateral → buyer)
  │  │                          [anyone, after disputeDeadline,
  │  │                           if buyer never settled/disputed]
  │  │                                          │
  │  │                                          ▼
  │  │                                      SETTLED
  │  │
  │  └─ claimDefault() [SLA missed] ──▶ DEFAULTED
  │                                       (price + collateral → buyer)
```

`expire()` also accepts a position still in `Listed` (never reserved) once
its window has closed — see "Price on expiry" below for why the payout
differs between the two originating states. All transitions are one-way;
`Settled`, `Expired`, `Defaulted`, `Refunded` are terminal.

### Invariants

1. **No double reservation.** `reserve()` requires `Status.Listed`. Test:
   `test_reserve_twice_reverts`.
2. **No double consumption.** Every mutating function requires the exact
   predecessor state. Tests: `test_activate_twice_reverts`,
   `test_settle_twice_reverts`.
3. **Transfer preserves the asset.** `transfer()` mutates only `buyer`.
   Test: `test_transfer_preserves_window_sla_and_collateral`.
4. **Collateral and price are each paid out exactly once per position,**
   by exactly one of `settle`, `finalizeDelivery`, `resolveDisputeByTimeout`,
   `claimDefault`, or `expire` — mutually exclusive by status. `claimDefault`
   pays out **both** `price` and `collateral` to the buyer; an earlier
   version paid `collateral` only, leaving `price` permanently stuck — see
   `docs/SECURITY_AUDIT_2026-10-01.md` finding F1. Test:
   `test_claimDefault_pays_collateral_and_price_to_buyer_after_SLA_miss`.
5. **Reentrancy cannot double-pay.** Status is set to its terminal value
   before the external call in `_payout` (checks-effects-interactions).
6. **Every terminal state has a payout path.** `Settled`, `Expired`,
   `Defaulted`, and `Refunded` are the only terminal states, and each one is
   reached by a function that pays out `price`/`collateral` in the same
   call that sets it — there is no terminal state a position can reach
   that leaves funds with no function able to move them. This invariant
   was violated three times during this project's own construction (see
   "Price on expiry", "Level 3" below, and `docs/SECURITY_AUDIT_2026-10-01.md`
   finding F1) and is now treated as a first-class check, not an implicit
   assumption.
7. **`activationSLA` and `disputeWindow` cannot overflow the checked
   `uint64` arithmetic that consumes them.** `MAX_DURATION` (365 days,
   public, identical in both contracts) bounds both fields at the two
   points they are ever set (`listCapacity`, `contribute`). Before this
   bound existed, either field could be set near `type(uint64).max` to make
   `activate`/`claimDelivery`/`dispute` (and their `CapacityPool`
   equivalents) revert permanently — profitably in `CapacityMarket`
   (finding F2) or destructively in both contracts (finding F3). Tests:
   `test_listCapacity_rejects_activationSLA_above_MAX_DURATION`,
   `test_listCapacity_rejects_disputeWindow_above_MAX_DURATION`,
   `test_contribute_rejects_activationSLA_above_MAX_DURATION`,
   `test_contribute_rejects_disputeWindow_above_MAX_DURATION`.

### Price on expiry — a stated economic rule, not a missing refund

When a **reserved** position expires unused, the provider keeps both
`collateral` and `price` — the same way an unexercised option's premium
stays with the writer, compensating them for having blocked that capacity
for the whole window regardless of whether the buyer used it. The buyer is
not refunded. When a position expires having **never been reserved**, only
`collateral` returns to the provider, because no `price` was ever paid.

This was a real bug in an earlier draft of this contract: `expire()` paid
out `collateral` only, in both cases, which meant a buyer's `price` payment
on a reserved-then-lapsed position had no function that could ever move it
— permanently locked ETH. Caught in a per-level adversarial self-review
before this level was considered done (see `AGENTS.md`'s construction
method), not by a test, because no test had been written to check for a
*missing* payout path. Fixed by generalizing `expire()` to run from either
`Listed` or `Reserved` and compute the payout accordingly. Tests:
`test_expire_unused_reservation_pays_collateral_and_price_to_provider`,
`test_expire_never_reserved_listing_returns_collateral_only`.

### Level 3: delivery claims and disputes

Before Level 3, `settle()` ran directly from `Accepted` and was pure
buyer-honesty: the buyer's address calling it was the only onchain fact
involved, and an unresponsive buyer could leave a provider's `price` and
`collateral` locked in `Accepted` forever, with no timeout of any kind. Level
3 inserts a claim/response step between acceptance and settlement:

- **`claimDelivery(positionId, evidenceHash)`** — provider only, from
  `Accepted`. Commits `evidenceHash` (a hash of whatever offchain evidence
  backs the claim; the contract never interprets it) and opens a
  `disputeWindow`-long clock, moving to `DeliveryClaimed`.
- **`settle(positionId)`** — buyer only, from `DeliveryClaimed`, any time.
  Explicit approval; pays the provider immediately, no need to wait out the
  window. (Its precondition moved from `Accepted` to `DeliveryClaimed` —
  settlement without a delivery claim on record no longer exists.)
- **`dispute(positionId, reasonHash)`** — buyer only, from
  `DeliveryClaimed`, before `disputeDeadline`. Commits `reasonHash` the same
  way; moves to `Disputed`.
- **`finalizeDelivery(positionId)`** — anyone, from `DeliveryClaimed`, after
  `disputeDeadline`. Pays the provider if the buyer never responded at all —
  the liveness fix for the gap `claimDelivery` introduces, mirroring how
  `claimDefault` already protects the buyer against a silent provider on the
  other side of the state machine.
- **`resolveDisputeByTimeout(positionId)`** — anyone, from `Disputed`, after
  a *second* `disputeWindow`-long period (restarted by `dispute()` itself).
  Refunds the **buyer**.

### A second fund-lock bug, same root cause, caught the same way

The first version of this Level shipped `dispute()` as a true terminal
state with no function that could ever pay out `price`/`collateral` from
`Disputed` — the identical defect class as the `expire()` bug above
(invariant 6 above exists specifically because this happened twice),
just reached through a new state instead of an old one. There is no
arbitrator in this contract and this level does not invent one — building
real dispute adjudication (multi-party resolution, evidence review, partial
awards) is explicitly out of scope here, not a gap to paper over with fake
logic. What is in scope, because leaving funds permanently stuck is never
acceptable regardless of whether adjudication exists: `resolveDisputeByTimeout`
closes `Disputed` after a second window, defaulting to a **refund**, not a
payment to the provider — a disputed claim does not get the silent-party
benefit of the doubt an undisputed one gets from `finalizeDelivery`. This is
a declared, conservative default, not a verdict on the merits of any
specific dispute, and is designed to be superseded by a real resolution
mechanism (Level 4) before `resolveDisputeByTimeout`'s window would ever
need to fire in practice. Tests: `test_resolveDisputeByTimeout_before_window_reverts`,
`test_resolveDisputeByTimeout_refunds_buyer_after_window`.

### Level 4/5: arbitration panels (M-of-N, with a single arbitrator as the M=1 case)

A position may define an arbitration panel at `listCapacity` time —
`panelMembers` (an address list) and `panelThreshold` (how many matching
votes execute a verdict) — public fields, visible to a buyer before they
ever reserve, the same as `price` or `activationSLA`. Once a position is
`Disputed`, any panel member may call `voteDispute(positionId,
providerWins)`; once either side's vote count reaches `panelThreshold`,
that verdict executes automatically: `true` pays `price + collateral` to
the provider (same amount `settle`/`finalizeDelivery` would have paid),
`false` refunds the buyer (same amount `resolveDisputeByTimeout` would have
paid). The contract never evaluates the dispute itself — it only tallies
votes and pays out whichever verdict crosses the threshold first.

**A single trusted arbitrator is not a separate feature — it's
`panelMembers.length == 1, panelThreshold == 1`.** This was originally
built as Level 4 with one dedicated `arbitrator` field and a
`resolveDispute` function; Level 5 replaced both with the general panel
mechanism rather than keeping two parallel code paths, because the single-
arbitrator case is exactly what a size-1 panel with threshold 1 already
does — one vote reaches the threshold immediately. Test:
`test_voteDispute_single_member_panel_settles_like_Level4_arbitrator`. The
real M-of-N case — no single vote decides it, a second matching vote does —
is exercised in `test_voteDispute_three_member_panel_needs_two_matching_votes`.

**No priority window for the panel — it's a race, by design.** `voteDispute`
has no deadline of its own; it is only gated by the position still being
`Disputed`. `resolveDisputeByTimeout` is similarly gated, after its own
window. Whichever call lands first wins, enforced by the ordinary
`inStatus` guard — not a special priority rule. This is the same pattern
`acceptActivation` vs. `claimDefault` and `settle` vs. `finalizeDelivery`
already use elsewhere in this contract: a privileged, no-deadline path
racing a permissionless, deadline-gated fallback. Test:
`test_voteDispute_races_resolveDisputeByTimeout_vote_first_wins`.

**Opting out is free and total.** An empty `panelMembers` array (with
`panelThreshold == 0`, enforced at `listCapacity`) makes `voteDispute`
revert `NotArbitrator()` for every possible caller — an empty array has no
member for any address to match — so a position with no panel behaves
exactly as it did at Level 3. Test:
`test_voteDispute_reverts_for_everyone_when_panel_is_empty`.

**Bounded, like every other externally-chosen size that feeds a loop in
this project.** `voteDispute` scans `panel.members` linearly to check
membership; `MAX_PANEL_SIZE = 9` caps it, enforced at `listCapacity`,
following the exact precedent `MAX_DURATION` set for `activationSLA`/
`disputeWindow` after findings F2/F3 — bound any value that feeds an
operation whose cost scales with it, at the point it's set, not after
someone picks a degenerate value. Test:
`test_listCapacity_rejects_oversized_panel`.

**A member votes once; votes don't change.** Tracked per `(positionId,
voter)`; a repeat call reverts `AlreadyVoted()`
(`test_voteDispute_member_cannot_vote_twice`). No vote-revocation or
vote-changing mechanism exists — a deliberate scope limit, not an
oversight; see "Known limitations" below.

**What this does NOT solve, by design, not oversight:** the contract cannot
verify panel members' independence. A provider can name themselves, or M
colluding addresses, as their own position's panel, and nothing in the
contract stops it. No code-level restriction (e.g. `require(member !=
provider)`) was added, deliberately: it would be trivially defeated by
naming a nominally-unrelated address instead, so it would create the
appearance of a safeguard without providing one. A panel is, like
`activationSLA`, `disputeWindow`, and `collateral`, a term the buyer can and
should check before reserving — a stacked or self-dealing panel is visible
on-chain before any commitment is made, the same way a zero-day dispute
window is. See "Discarded (non-exploitable) vectors" in
`docs/SECURITY_AUDIT_2026-10-01.md` for the identical reasoning applied to
`disputeWindow = 0`. Nor is there any stake or slashing behind a vote: a
panel member who votes dishonestly or carelessly faces no onchain
consequence beyond reputational — M trust assumptions instead of one is
real progress over Level 4, but it is still trust, not trust-minimization.

---

## Level 2 — `CapacityPool.sol`: fungible multi-provider pool

### Why a second contract instead of extending `CapacityMarket`

A `CapacityPosition` is owned by one provider from creation. Making
capacity fungible means a buyer reserves *quantity*, not a specific
provider's position — the provider is picked later, at activation, from
whoever contributed to the same terms class. That is a different
reservation object (`Reservation`, holding possibly several `Assignment`s)
built on top of a different commitment object (`Contribution`, many per
class). Bolting that onto `CapacityPosition` would have meant a second,
incompatible meaning for half its fields depending on a mode flag — exactly
the kind of "extend by special-casing" that erodes a state machine's
invariants over time. `CapacityPool` reuses Level 1's *pattern*
(Pending to Accepted to DeliveryClaimed to Settled/Disputed to Refunded, or
Pending to Defaulted, one-way, collateral locked once and paid once) at the
grain of an `Assignment` instead of a whole position, which is what makes it
a coherent next level rather than a rewrite.

### Fungibility: `TermsClass` and `classId`

```solidity
struct TermsClass {
    bytes32 domain;
    uint64 validFrom;
    uint64 validUntil;
    uint64 activationSLA;
    uint64 disputeWindow;
    address[] panelMembers;
    uint256 panelThreshold;
    uint256 pricePerUnit;
    uint256 collateralPerUnit;
}
```

`classId = keccak256(abi.encode(terms))`. Two contributions are fungible
with each other if and only if they hash to the same `classId` — i.e. they
agree on domain, window, SLA, and price down to the wei. This is a
deliberately strict notion of fungibility for Level 2: no partial-match
routing (e.g. "close enough" windows), no price discovery. Loosening that
is a plausible Level 3+ direction, not something this level approximates.

### State machine

```
contribute() ──▶ Contribution{provider, remaining} queued FIFO in the pool

reserve(classId, qty) ──▶ Reservation{Reserved}         [available -= qty]
  │
  ├─ transferReservation()  (Reserved → Reserved, new buyer)
  │
  ├─ expireReservation()  [window closed, never activated]
  │     ──▶ Reservation{Expired}, available += qty, price refunded to buyer
  │
  └─ activate()  [FIFO-consumes `qty` from contributions, possibly split]
        ──▶ Reservation{Activated}, one Assignment{Pending} per provider slice
              │
              ├─ acceptAssignment() [within shared SLA] ──▶ Assignment{Accepted}
              │        │  claimAssignmentDelivery(evidenceHash)
              │        ▼
              │   Assignment{DeliveryClaimed}
              │        │                    │
              │        │ settleAssignment() │ disputeAssignment(reasonHash)
              │        │ [buyer, any time]  │ [within disputeWindow]
              │        ▼                    ▼
              │   Settled              Disputed
              │   (price+collateral      │    │  resolveAssignmentDisputeByTimeout()
              │    → provider)           │    │  [anyone, after a second disputeWindow]
              │                          │    ▼
              │                          │  Refunded (price+collateral → buyer)
              │              voteAssignmentDispute(providerWins)
              │              [any panel member, any time while Disputed —
              │               verdict executes once either side reaches panelThreshold]
              │              ├─ providerWins reaches threshold ──▶ Settled (price+collateral → provider)
              │              └─ buyerWins reaches threshold    ──▶ Refunded (price+collateral → buyer)
              │
              │   finalizeAssignmentDelivery() [anyone, after disputeDeadline,
              │     if buyer never settled/disputed] ──▶ Settled
              │
              └─ claimAssignmentDefault() [SLA missed, from Pending] ──▶ Assignment{Defaulted}
                       (price+collateral → buyer)

withdrawContribution()  [window closed, any time] ──▶ pays collateral for
                          a contribution's unassigned `remaining`, to its provider
```

`voteAssignmentDispute` mirrors `CapacityMarket.voteDispute` exactly — same
no-deadline race against the timeout fallback, same unconditional revert
when the class opted out (empty `panelMembers`), same one-vote-per-member,
same "visible term, not a verifiable-independence guarantee" caveat. See
"Level 4/5: arbitration panels" above; nothing about it differs at the pool
grain except operating on one `Assignment` instead of a whole position, so
votes and verdicts on one disputed slice never touch a sibling's.

Each `Assignment` is independent: one provider's default, or one slice being
disputed, does not affect a sibling assignment from another provider in the
same reservation (partial fulfillment, and partial disagreement, are each a
first-class outcome, not an edge case). Tests:
`test_one_provider_default_does_not_block_other_assignments`,
`test_one_assignment_dispute_does_not_block_sibling_finalization`.

### Invariant: `reserved + assigned ≤ committed capacity`

This is Level 2's version of Level 1's "no double reservation," generalized
to fungible units, and it's the literal invariant named in this project's
own design notes. `reserve()` requires `pool.available >= quantity` and
decrements `available` by exactly `quantity` before minting the
reservation; two buyers can never jointly reserve more than was
contributed. Tests: `test_reserve_more_than_available_reverts`,
`test_two_buyers_cannot_jointly_oversubscribe_the_pool`.

### Why `activate()` cannot run out of capacity mid-loop

`activate()` walks `pool.contributions` from `pool.contribHead` forward,
consuming `remaining` from each until the reservation's `quantity` is
covered. This is safe — it cannot index past the end of the array — because
two accounting identities hold at every point in the contract's execution,
by construction of every function that touches them:

- **(A)** `totalCommitted = available + totalReservedPending + totalAssigned`
  — `contribute()` grows `totalCommitted` and `available` together;
  `reserve()` moves `quantity` from `available` into the (implicit)
  reserved-but-not-yet-activated bucket; `activate()` moves a reservation's
  `quantity` from that bucket into `totalAssigned`; `expireReservation()`
  moves it back to `available`.
- **(B)** `totalCommitted = Σ(contribution.remaining) + totalAssigned` —
  `contribute()` grows `totalCommitted` and a fresh contribution's
  `remaining` together; `activate()` is the only function that decrements
  `remaining`, and it moves exactly that amount into `totalAssigned`
  one-for-one.

Subtracting, `Σ(remaining) = available + totalReservedPending`. Since the
reservation currently being activated is itself part of
`totalReservedPending` (its quantity was reserved but not yet assigned),
`Σ(remaining) ≥ totalReservedPending ≥ quantity` at the moment `activate()`
runs for it. The FIFO walk is therefore guaranteed to find enough
unconsumed contribution capacity before `contribHead` reaches the end of
the array. This argument — not a gas-bounded loop or a try/catch — is what
the `activate()` implementation relies on; if a future change breaks either
identity above, this guarantee breaks with it silently (no revert will
flag it as a regression in the accounting, only an eventual out-of-bounds
panic under the right reservation pattern). Any change to `contribute`,
`reserve`, `activate`, or `expireReservation` must re-derive this argument,
not just pass the existing tests.

### Price on expiry — asymmetric with Level 1, deliberately

`expireReservation()` **refunds the buyer's price in full**, unlike
`CapacityMarket.expire()`'s provider-keeps-the-premium rule. The two are
asymmetric because the thing a reservation *names* differs: a
`CapacityMarket` reservation names a specific provider from `reserve()`
onward, so that provider bore the exclusivity cost of the window even if
never activated. A `CapacityPool` reservation names no provider until
`activate()` routes one — if it never activates, no specific provider was
ever committed, and pro-rating the price across every contributor to the
class is complexity this level does not take on. Refunding the buyer is the
only non-arbitrary recipient. Test:
`test_expireReservation_returns_quantity_and_refunds_buyer`.

This was caught in the same adversarial self-review as Level 1's price-lock
bug, for the identical underlying reason (a payout function that only
returned `collateral` and silently dropped `price`) — see `withdrawContribution`
below for the matching gap on the provider side.

### `withdrawContribution` — the provider-side half of the same gap

Even after fixing `expireReservation`'s buyer refund, a contribution's
`remaining` (capacity nobody ever reserved, or reserved-then-expired without
being assigned) had no function that could ever return its locked
collateral to the provider. `withdrawContribution(classId, index)` closes
this: once the class's window has permanently closed, the provider who owns
`contributions[index]` can reclaim `collateralPerUnit * remaining` and
zero out `remaining`. Tests: `test_withdrawContribution_after_window_close_pays_provider`,
`test_withdrawContribution_twice_reverts`,
`test_withdrawContribution_after_partial_assignment_pays_only_remaining`.

**Known cosmetic limitation:** `withdrawContribution` does not decrement
`pool.available`/`pool.totalCommitted`. This is safe — once
`block.timestamp >= validUntil`, neither `reserve()` nor `activate()` can
execute against this class again, so those counters are already inert for
any future state change — but it means `poolInfo()`'s `available` can
overstate truly-reclaimable capacity after any withdrawal has happened.
Treat `poolInfo()` as accurate only before a class's window closes.

---

## Trust boundary — what is and is not provable onchain

Onchain (provable, tamper-evident), for both contracts:
- Who committed capacity, how much, in what domain, in what window.
- That capacity was reserved by exactly one buyer (L1) or drawn from exactly
  one `available` pool with no overselling (L2) at a time.
- That a transfer or routing happened and who the parties were.
- That activation happened at a specific block timestamp, and whether each
  responsible provider acknowledged inside the SLA.
- Where every payment and every collateral unit actually went.

Not onchain, and not provable by either contract alone:
- That a provider was actually available or did the work.
- That the work met the buyer's quality bar.
- Any identity behind an address.

`acceptActivation`/`acceptAssignment` only prove an address sent a
transaction inside the SLA window — not that a human did anything.
`claimDelivery`/`claimAssignmentDelivery` only prove the provider committed
to a hash — the contract never interprets what the hash points to, and
nothing stops a provider from hashing fabricated evidence. `dispute`/
`disputeAssignment` only prove the buyer objected and when — not that the
objection is correct. **This remains a known, stated limitation, not an
oversight, even after Level 5**: panels let a dispute resolve on its merits
instead of only the conservative timeout, and spreading trust across M
members is real progress over one arbitrator — but the contract still
cannot evaluate `evidenceHash`/`reasonHash` itself, verify a panel's
independence, or impose any consequence on a member who votes in bad faith.
Real trust-minimization (staking, slashing, an oracle reading evidence
independently) is Level 6's explicit target, named below.

## Known limitations and next levels

Per the project's construction discipline (destination-driven, not
MVP-driven — see `AGENTS.md`), named as the next coherent levels toward the
destination, not patches on a throwaway prototype:

- **Trusted panel, not staked/slashed adjudication (Level 6).** Level 5's
  M-of-N panel removes the single point of trust Level 4 had, but a vote
  still carries no economic weight — no bond posted to vote, no slashing
  for a provably bad-faith verdict, no appeals path if the panel itself
  colludes or is captured. An oracle reading `evidenceHash`/`reasonHash`
  independently, or a staked-juror mechanism with slashing, would be the
  next coherent level toward genuinely trust-minimized adjudication.
- **Push-payment griefing.** `_payout` uses `.call` and requires success. A
  recipient whose fallback always reverts can block their *own* payout path
  (a provider blocking their own `expire`, a buyer blocking their own
  `claimAssignmentDefault`) — never a counterparty's. Planned fix: a
  pull-payment (withdrawal-ledger) pattern replacing push payouts
  throughout both contracts.
- **Strict terms-matching fungibility.** L2 only pools contributions whose
  terms hash identically. No partial/fuzzy matching, no price discovery
  between classes. A plausible Level 3+ direction, not attempted here.
- **Contribution-fragmentation gas griefing in `activate()`.** Anyone can
  contribute many small-quantity entries to a class, lengthening the FIFO
  walk a future `activate()` call must perform. The correctness argument
  above guarantees the walk terminates, but not that it terminates cheaply.
  No minimum contribution size or batched-consumption bound is enforced
  yet. Worth revisiting before any real liquidity is expected in a single
  class.
- **`block.timestamp` is used for window and SLA comparisons,** in both
  contracts. A validator can shift it by seconds, not minutes. Accepted,
  documented risk given this project's minutes-to-days SLA range; revisit
  if a future level introduces sub-minute SLAs.

## Build & test

Actual commands run against this repo, Foundry `forge 1.8.4`:

```
forge build
forge test
```

Last run: 91/91 tests passed (`CapacityMarket.t.sol`: 43,
`CapacityPool.t.sol`: 42, `RedTeam.t.sol`: 6). This proves the invariants
stated above hold under the specific scenarios each test encodes,
including the three historical vulnerabilities in
`docs/SECURITY_AUDIT_2026-10-01.md` staying fixed. It does not constitute an
independent security audit beyond this project's own red-team pass, and no
fuzzing or formal verification has been run yet.

Note: `foundry.toml` sets `via_ir = true`. The `CapacityPosition`/`Assignment`
structs grew wide enough after Level 3's delivery-claim fields that the
default codegen hit "stack too deep" compiling the public struct getters;
`via_ir` avoids restructuring either struct or hand-writing their getters
just to dodge that compiler limitation. It slows compilation somewhat and is
worth revisiting only if build time becomes a real problem at this project's
current size.

## License

Not yet decided for this repository — the hackathon's exact licensing
requirement has not been confirmed. Source files currently carry
`SPDX-License-Identifier: UNLICENSED` (no rights granted) as a deliberate
placeholder, not a final choice. Default plan, absent an explicit
requirement: Apache-2.0, matching the rest of this author's open-source
portfolio.
