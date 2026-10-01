# AGENTS.md — MUSTER

This file is the project-specific operating manual: MUSTER's own invariants,
trust boundaries, and construction method. The author's global
`~/.claude/CLAUDE.md` is the portable engineering-discipline guide (git
hygiene, the abductive reasoning loop, editing discipline, the
architectural invariants for consequential outputs) — generic, applies to
every repo. **On conflict, `CLAUDE.md` wins** for discipline/process
questions (git, verification, patching method); this file wins for
anything specific to MUSTER's own architecture. In practice they haven't
conflicted yet except on one point, resolved below: `CLAUDE.md`'s
English-only repo content rule overrides the `readme-architecture` skill's
default three-document (EN/ES/Technical) structure — this repo ships
`README.md` + `docs/TECHNICAL_README.md` only, no `README_ES.md`.

Setup and usage are in [`README.md`](README.md); don't duplicate that here.

## What MUSTER is, in one line

A future specialist response capacity market. Level 1 (`CapacityMarket.sol`)
is a `CapacityPosition`: an onchain asset with ownership, a time window, an
activation SLA, and collateral — reservable, transferable, activatable, and
settled exactly once. Level 2 (`CapacityPool.sol`) pools that same shape
across many providers under a shared `TermsClass`, routing FIFO at
activation. Level 3 adds a hash-committed delivery claim and a bounded
dispute window in front of settlement, in both contracts, with a timeout
path on each side so neither a silent buyer nor an unresolved dispute can
lock funds. See [`docs/TECHNICAL_README.md`](docs/TECHNICAL_README.md) for
all three state machines.

## Construction method: destination-driven, not MVP-driven

This project is built level by level toward a named destination — a
fungible, SLA-backed market for future specialist capacity, not a quick
hackathon demo to be thrown away. **Do not suggest MVP-shaped scoping,
"quick version for now," or deferring a load-bearing property (security,
persistence, the invariants below) to a "later" level** — a deadline is a
reason to reach fewer levels, not to build thinner ones. Each level
shipped must be genuinely useful standalone and must not require a later
level to rebuild or bypass it.

- **Level 1 (current):** single-provider (`Model A`) capacity position,
  full lifecycle, collateral-backed SLA. `src/CapacityMarket.sol`.
- **Level 2 (current):** fungible pooled capacity by domain class
  (`Model B` — "4 units of anyone satisfying `ZK_SECURITY_L2`"),
  `src/CapacityPool.sol`. A routing/matching layer (FIFO at `activate()`)
  in front of L1-shaped assignments, not a rewrite of Level 1 — see the
  Technical README's "Why a second contract" for why it's a separate file
  rather than a mode flag on `CapacityMarket`.
- **Level 3 (current):** a hash-committed delivery claim and bounded dispute
  window in front of settlement, in both contracts
  (`claimDelivery`/`claimAssignmentDelivery`, `dispute`/`disputeAssignment`,
  `finalizeDelivery`/`finalizeAssignmentDelivery`,
  `resolveDisputeByTimeout`/`resolveAssignmentDisputeByTimeout`). Narrows,
  but does not close, the trust-boundary gap named in the Technical README:
  it makes delivery an explicit two-sided claim with no fund-lock path
  (invariant 8 below), but a dispute's default resolution (refund the
  buyer) is a declared conservative rule, not adjudication on the merits.
- **Level 4 (planned):** real dispute adjudication — a designated
  arbitrator, staked jurors, or an oracle reading the offchain evidence
  behind `evidenceHash`/`reasonHash` — so a dispute can resolve on its
  merits before `resolveDisputeByTimeout`'s window would ever need to fire.

Before adding a level, re-read the "Invariants" and "Trust boundary"
sections of the Technical README and confirm the new level preserves every
invariant already listed there — that check is the adversarial review this
project's construction method requires at each step, not a one-time gate.

## Invariants (do not weaken these without updating the Technical README)

These are restated briefly here as a checklist; the Technical README has
the mechanism and the test proving each one.

**`CapacityMarket.sol` (Level 1 + 3)** — any change touching a state
transition **must** re-verify these against the test suite before being
considered done:

1. No double reservation (`inStatus` guard on `reserve`).
2. No double consumption (`inStatus` guard on every mutating function).
3. `transfer()` changes `buyer` only — window, SLA, price, and collateral
   are immutable after `listCapacity`.
4. Collateral **and price** are each paid out exactly once per position —
   see "Price on expiry" in the Technical README for exactly which
   recipient gets which, depending on whether the position was ever
   reserved.
5. State transitions are one-way; `Settled`/`Expired`/`Defaulted`/`Refunded`
   are terminal.
8. **Every terminal state has a payout path.** No position may reach a
   terminal status that leaves `price`/`collateral` with no function able to
   move them. This invariant exists because it was violated twice during
   this project's own construction — see the fund-lock paragraph below.

**`CapacityPool.sol` (Level 2 + 3)** adds, at the grain of an `Assignment`
rather than a whole position, the same shape-of-invariant guarantees, plus
the fungibility-specific one named in this project's own design notes:

6. `reserved + assigned ≤ committed capacity` — `reserve()` checks
   `pool.available` before decrementing it; see the Technical README's
   "Why `activate()` cannot run out of capacity" for the accounting
   identity that must keep holding across `contribute`/`reserve`/`activate`/
   `expireReservation` if this is ever touched.
7. One assignment's default, or one assignment's dispute, never affects a
   sibling assignment in the same reservation — partial fulfillment and
   partial disagreement are both first-class outcomes.

**Known, accepted gap, not an oversight, even after Level 3:**
`dispute`/`disputeAssignment` only record that the buyer objected, not
whether the objection is correct. `resolveDisputeByTimeout` always refunds
the buyer by default — it is a declared conservative rule, not a verdict.
Real adjudication is Level 4's job, not a bug to "fix" in Level 3 by adding
a heuristic merits-check — that's exactly the kind of approximated-depth
shortcut this project's construction method rejects. Build Level 4 properly
or leave the gap documented.

**Push-payment is a known liveness gap, not a security hole,** in both
contracts. `_payout` uses `.call` and requires success; a recipient whose
fallback always reverts can block their *own* payout path, never a
counterparty's. Don't "fix" this with a try/catch that silently drops a
failed payout — that would turn a liveness gap into a fund-loss bug. The
real fix is a withdrawal-pattern ledger, planned, not yet built.

**A fund-lock bug was already caught and fixed TWICE in this project, by
adversarial self-review rather than by a test — read this before touching
any payout path or adding any new terminal status.** First: the original
`CapacityMarket.expire()` paid out `collateral` only, dropping `price` for a
reserved-then-lapsed position — ETH the buyer had already paid had no
function left that could ever move it. The equivalent gap existed in
`CapacityPool.expireReservation()` and in the total absence of a way to
reclaim a contribution's locked collateral after its window closed
(`withdrawContribution` didn't exist yet). Second, while building Level 3:
the first version of `dispute()`/`disputeAssignment()` made `Disputed` a
true terminal state with **no function at all** that could pay out
`price`/`collateral` from it — the identical defect class, reached through a
brand-new state this time instead of an existing one. Fixed by
`resolveDisputeByTimeout`/`resolveAssignmentDisputeByTimeout` (see the
Technical README's "Level 3" section for why the default is a refund, not a
payment to the provider).

**The lesson, stated as a rule now (invariant 8 above): when adding any new
status — not just when changing an existing payout function — explicitly
name the function that pays out `price`/`collateral` from it, in the same
change that adds the status.** A test suite only catches a wrong payout; it
does not catch a payout path that was never written, because there's
nothing for the missing function to fail. "This status is terminal because
resolving it further is out of scope" is a legitimate design choice
(Level 4's adjudication, for instance) — "this status is terminal and funds
just stay here" is never one, regardless of how well-justified the state
itself is.

## Numbers that are decisions, not defaults

- `block.timestamp` is used directly for all window/SLA comparisons
  (`validFrom`, `validUntil`, `activationDeadline`). Accepted because this
  contract's SLAs are sized in minutes-to-days, and validator timestamp
  manipulation is bounded to seconds. **If a future level introduces
  sub-minute SLAs, this assumption no longer holds** and needs revisiting
  before shipping — don't carry it forward silently.
- No per-position quantity decrement in Level 1 (`quantity` is stored, not
  consumed partially) — deliberate; Level 2's `Contribution.remaining` is
  where partial consumption actually lives.
- `CapacityPool` fungibility is exact-match only: two contributions are
  fungible iff their `TermsClass` hashes identically (same domain, window,
  SLA, and price to the wei). No fuzzy/partial matching. Deliberate scope
  limit for this level, not an oversight — see the Technical README's
  "Fungibility" section.
- No minimum `contribute()` quantity and no cap on contributions-per-class
  in Level 2. A known, accepted gas-griefing surface on `activate()`'s FIFO
  walk (see Technical README) — not yet worth the complexity of a floor or
  a batched-consumption bound at this level's expected liquidity.
- `disputeWindow` (Level 3) is reused, unmodified, as the length of both the
  buyer's initial response window (after `claimDelivery`) and the
  arbitration-timeout window (after `dispute`). Deliberate simplification —
  one configured duration instead of two — not a sign the two windows must
  always be equal; revisit if a level ever needs them to differ.

## Build & test

```
forge build
forge test
```

A green `forge test` run proves the invariants listed above hold under the
scenarios in `test/CapacityMarket.t.sol` (28 tests) and
`test/CapacityPool.t.sol` (32 tests) — 60 total. It is not a security audit
and does not cover fuzzing, formal verification, or interaction between the
two contracts (they don't currently call each other, but a future level
that connects them needs its own test coverage, not an assumption that
either suite already implies it). Say exactly what a green run covers when
reporting results, not "tests pass" unscoped.

## License

**Do not add a `LICENSE` file or an SPDX identifier other than
`UNLICENSED` until the hackathon's exact licensing requirement is
confirmed.** Default plan once confirmed, if no explicit license is
required: Apache-2.0, matching this author's other open-source projects.
This is a standing instruction from the session that created this
repository, not a technical default — don't "clean up" the `UNLICENSED`
SPDX tags as if they were placeholders left by mistake.

## Git: who may commit, and what write access does and doesn't include

- **This repo's explicit maintainer instruction (2026-10-01): work directly
  on `main`, and the agent has standing authorization to `commit` and
  `push` there.** This is a deliberate exception to the generic default (no
  direct-to-trunk commits, per-action commit authorization) stated once by
  Anna for this specific solo-authored hackathon repo — it does not
  generalize to other repos, and it does not relax anything else in this
  file (invariants, license, construction method). If the project grows a
  second contributor or moves past the hackathon window, re-confirm this
  is still the intended workflow before continuing to push straight to
  `main`.
- Forbidden regardless, per `CLAUDE.md`: `git rebase`, interactive
  rebase/squash, `git push --force` (including `--force-with-lease`).
  Forward-only: `commit`, `merge`, `revert`.
- Any throwaway fixture, scratch config, or sample `.env` created for local
  testing goes into `.gitignore` in the same action that creates it, not as
  a cleanup step remembered before commit.

## Definition of done for a change to this repo

- [ ] All invariants above still hold; `forge test` is green.
- [ ] Every value a changed/new function receives (`price`, `collateral`)
      is traceable to a payout function for every status the asset can
      reach — including states nobody explicitly asked about.
- [ ] Any new status added is either non-terminal, or terminal with a named
      function that pays out `price`/`collateral` from it in the same
      change that adds it (invariant 8).
- [ ] If a new state or transition was added, the Technical README's state
      machine diagram and invariant list were updated in the same change.
- [ ] No MVP/quick-version scope was introduced for a load-bearing property.
- [ ] No `LICENSE` file or SPDX change was made without explicit
      confirmation from the maintainer.
- [ ] `git status`/`git log` were actually read before claiming committed or
      pushed state (per `CLAUDE.md` §2).
