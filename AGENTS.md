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
- **Level 4/5 (current):** an arbitration panel (`panelMembers` +
  `panelThreshold`, set per-position in `CapacityMarket`, per-class in
  `CapacityPool.TermsClass`) can rule on a `Disputed` claim via
  `voteDispute`/`voteAssignmentDispute`; once either side's votes reach
  `panelThreshold`, the verdict executes. No deadline of its own, racing
  `resolveDisputeByTimeout`'s permissionless fallback (whichever lands
  first wins — same pattern as `acceptActivation` vs. `claimDefault`). An
  empty panel opts a position/class out entirely, reproducing exact Level 3
  behavior. A single trusted arbitrator (what was originally shipped as
  "Level 4") is not a separate code path — it's the `panelMembers.length ==
  1, panelThreshold == 1` case of this mechanism; Level 5 replaced the
  dedicated `arbitrator` field and `resolveDispute` function with the
  general panel rather than keeping both. Still a trust assumption, not
  decentralized adjudication: the contract cannot verify panel members'
  independence, and does not try to — see the Technical README's "Level
  4/5" section for why a `require(member != provider)` check was
  deliberately not added (trivially bypassed, false safety), and why
  `MAX_PANEL_SIZE = 9` bounds the membership-check loop in `voteDispute`.
- **Level 6 (planned):** staked jurors with slashing, an appeals path, or
  an oracle reading the offchain evidence behind `evidenceHash`/
  `reasonHash` independently — genuinely trust-minimized adjudication, as
  opposed to Level 5's M trusted addresses with no economic weight behind
  a vote.
- **Reputation tracking (current, read-only) / reputation-weighted routing
  (planned, Level 6-adjacent).** Decided 2026-10-04, from a mentor framing
  that generalized the product beyond security specialists to any
  on-call trade (electrician, notary, etc.) and asked for a Cabify-style
  pool with reputation. The pool/no-sunk-cost mechanic the framing asked
  for already existed (`CapacityPool`'s `TermsClass` pooling +
  `reserve`/`transfer`/`expireReservation` — see
  `docs/BUSINESS_CASE.md`); reputation did not. Split deliberately into two
  pieces of very different risk, not built together:
  - **Shipped**: `ProviderStats` (`settledCount`, `defaultedCount`,
    `disputesLostCount`, `disputesTimedOutCount`) in both contracts,
    updated at every terminal transition that reflects on a provider's
    track record (`settle`/`finalizeDelivery`, `claimDefault`,
    `resolveDisputeByTimeout`, `_executeDisputeVerdict`, and their
    `CapacityPool` assignment-level mirrors), emitting `ProviderStatsUpdated`.
    Pure aggregation of outcomes already visible one at a time in existing
    events — no new trust assumption, no offchain oracle, does not feed
    `activate()`'s routing. `disputesTimedOutCount` is tracked separately
    from `disputesLostCount` on purpose: `resolveDisputeByTimeout` is a
    declared conservative default (see that function's own NatSpec), never
    an adjudicated verdict, and counting it as a proven fault would
    misrepresent the provider. Never updated by `expire()`/
    `expireReservation()`/`withdrawContribution()` — those reflect the
    buyer's or provider's own housekeeping, not a performance outcome.
  - **Not shipped, and not a small addition**: reputation-weighted or
    tiered routing in `CapacityPool.activate()`. Today's FIFO walk over
    `contributions` has a proof in `docs/TECHNICAL_README.md` ("Why
    `activate()` cannot run out of capacity") tied to that exact walk
    structure; reordering by score needs a bucketed structure (not a
    dynamic sort — the FIFO walk already has a documented, accepted
    gas-griefing surface from unbounded contributions-per-class, and
    sorting would worsen it) and the same adversarial-review rigor Levels
    3-5 got before touching a proven invariant. Do not build this
    reactively off one suggestion — scope and review it as its own level
    first.

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

**Known, accepted gap, not an oversight, even after Level 5:**
`voteDispute`/`voteAssignmentDispute` let a panel rule, but the contract has
no way to verify that panel's members are independent, honest, or even
paying attention — a provider can name themselves or M colluding addresses,
and nothing stops it (see the Technical README's "Level 4/5" for why no
code-level check was added for this). `resolveDisputeByTimeout` is still the
only resolution path when no panel is named, and still just a conservative
default, not a verdict. A vote also carries no economic weight — no stake,
no slashing for a provably bad-faith ruling. Real trust-minimization
(staking, slashing, an appeals path, an independent oracle) is Level 6's
job, not a bug to "fix" in Level 5 by adding a `member != provider` check
that would only create the appearance of safety — that's exactly the kind
of approximated-depth shortcut this project's construction method rejects.
Build Level 6 properly or leave the gap documented.

**Push-payment is a known liveness gap, not a security hole,** in both
contracts. `_payout` uses `.call` and requires success; a recipient whose
fallback always reverts can block their *own* payout path, never a
counterparty's. Don't "fix" this with a try/catch that silently drops a
failed payout — that would turn a liveness gap into a fund-loss bug. The
real fix is a withdrawal-pattern ledger, planned, not yet built.

**A fund-lock bug was caught and fixed on this payout path THREE separate
times in this project — twice by the author's own adversarial self-review,
once by an external-style red-team pass (`docs/SECURITY_AUDIT_2026-10-01.md`,
finding F1) that caught what the first two passes missed. Read this before
touching any payout path or adding any new terminal status.** First: the
original `CapacityMarket.expire()` paid out `collateral` only, dropping
`price` for a reserved-then-lapsed position. The equivalent gap existed in
`CapacityPool.expireReservation()` and in the total absence of a way to
reclaim a contribution's locked collateral after its window closed
(`withdrawContribution` didn't exist yet). Second, while building Level 3:
the first version of `dispute()`/`disputeAssignment()` made `Disputed` a
true terminal state with **no function at all** that could pay out
`price`/`collateral` from it. Fixed by
`resolveDisputeByTimeout`/`resolveAssignmentDisputeByTimeout`. **Third**
(2026-10-01, red team): `claimDefault`/`claimAssignmentDefault` — present
since Level 1, never touched by either of the first two fixes — paid
`collateral` only on the SLA-miss default path, on the *ordinary,
non-adversarial* failure path (an honestly slow provider), not even
requiring an attacker. Fixed by paying `price + collateral` to the buyer.
**The same invariant (8, below) was violated by three different functions
at three different times; writing the rule down after the first two
instances did not, by itself, catch the third.** Checked against git
history, not just recalled: the Level 2 commit's diff of
`CapacityMarket.sol` touches only `expire()`. The Level 3 commit cites
`claimDefault` **four separate times** — as the reference pattern being
mirrored for `finalizeDelivery`'s liveness fix — while the general rule
("trace every value the function received... for every status the position
can reach") was already written in `AGENTS.md` from the `expire()` fix,
not scoped to that one function. The rule was general, the exact text of
`claimDefault` was being read and quoted at that moment, and it still
didn't get re-checked against invariant 8 — because it was being read
through a different lens entirely: "is this a good permissionless-liveness
pattern to copy," not "does this fully account for custody." **The
mechanism: citing an existing function as a good example of one property
does not trigger re-verification of that function against an unrelated
property, even when the general rule covering that property already
exists in writing and the code is being read at that exact moment.**
Re-reading old code under a new task's framing is not the same as auditing
it. What actually caught the third instance was a pass structured
specifically as "trace every ETH in and out, for every function," run
independent of whatever feature was being built — that structure, not
memory of the rule, is what has to be repeated, including periodically
against code nobody is currently touching, not only against new code. **It
held on the
fourth attempt:** adding Level 4's `resolveDispute`/
`resolveAssignmentDispute` (since generalized into `voteDispute`/
`voteAssignmentDispute` at Level 5 — the function names changed, the point
doesn't) reused the exact `Settled`/`Refunded` terminal states and
`price + collateral` amounts Level 3 already paid out correctly, rather
than inventing a new terminal state or a new payout amount — the checklist
item was applied deliberately before considering the level done, and
nothing new to check against invariant 8 was introduced. Evidence a rule
written down after a mistake can actually prevent the next one, if the
checklist is run, not just remembered. **It held on the fifth attempt too:**
Level 5's `voteDispute`/`voteAssignmentDispute` pay out through the exact
same `_executeDisputeVerdict`/`_executeAssignmentDisputeVerdict` internal
functions Level 4 used, generalized to run once a vote tally crosses
`panelThreshold` instead of on a single arbitrator's call — no new terminal
state, no new payout amount, same checklist applied before calling the
level done.

Same red-team pass also found and fixed an unrelated root cause: neither
`activationSLA` nor `disputeWindow` had an upper bound, and both feed a
checked `uint64` addition (`block.timestamp + duration`) in
`activate`/`claimDelivery`/`dispute` and their `CapacityPool` equivalents.
A value near `type(uint64).max` made that addition revert *permanently* —
profitably for a zero-collateral provider in `CapacityMarket` (the
counterparty gets to collect `price` via `expire()` once the window lapses,
having made `activate()` permanently unreachable — findings F2), or with no
winner in either contract (`Accepted`/`DeliveryClaimed`'s only outbound
function reverts forever, freezing both `price` and `collateral` — finding
F3). Fixed by a `MAX_DURATION` constant (365 days) checked at both points
these fields are ever set. **Any future field that gets added to `uint64(
block.timestamp) + X` arithmetic needs the same bound, checked at the point
`X` is set — this is now a standing requirement, not a one-off patch.**

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
- `MAX_DURATION = 365 days` (both contracts, public constant) bounds
  `activationSLA` and `disputeWindow`. Not an arbitrary "sounds reasonable"
  number — it exists purely to keep `block.timestamp + duration` inside
  `uint64` for any realistic future timestamp (see
  `docs/SECURITY_AUDIT_2026-10-01.md` findings F2/F3). 365 days was chosen
  because it comfortably covers this project's own stated SLA range
  (minutes to days) with headroom to spare, not because it is load-bearing
  at exactly that value — raising it is safe as long as the new value still
  leaves enormous headroom under the uint64 overflow horizon; do not remove
  the check entirely.
- An arbitration panel (Level 5) defaults to empty (no arbitration) unless
  a provider/first-contributor sets `panelMembers`/`panelThreshold`
  otherwise — opt-in, not opt-out. Deliberately no `require(member !=
  provider)` or similar: trivially bypassed with a second address, so it
  would be a fake safeguard. Do not add one under the theory that it "can't
  hurt" — it can, by implying a guarantee the contract doesn't provide.
- `MAX_PANEL_SIZE = 9` (both contracts, public constant) bounds a panel's
  member count, enforced at `listCapacity`/`contribute`. Exists because
  `voteDispute`/`voteAssignmentDispute` scan the panel linearly for
  membership — same reasoning as `MAX_DURATION`, applied to a loop bound
  instead of an arithmetic overflow bound. Not load-bearing at exactly 9;
  raising it is safe as long as the membership-check loop stays cheap.

## Build & test

```
forge build
forge test
```

A green `forge test` run proves the invariants listed above hold under the
scenarios in `test/CapacityMarket.t.sol` (51 tests, including 9 for
`ProviderStats`), `test/CapacityPool.t.sol` (50 tests, including 7 for
`ProviderStats`), `test/RedTeam.t.sol` (6 tests — the regression suite for
`docs/SECURITY_AUDIT_2026-10-01.md`'s three fixed findings), and
`test/CREDeadlineReceiver.t.sol` (9 tests) — 116 total. The CRE workflow has
its own separate suite: `cd muster-cre/deadline-keeper && bun test` (5
tests) and `bun run typecheck`. Solidity tests are not an independent
security audit beyond this project's own red-team pass, and do not cover
fuzzing, formal verification, or interaction between the two contracts
(they don't currently call each other, but a future level that connects
them needs its own test coverage, not an
assumption that either suite already implies it). Say exactly what a green
run covers when reporting results, not "tests pass" unscoped.

## Sponsor bounty scope (decided 2026-10-01, re-check before reopening)

Researched against actual sponsor docs, not the hackathon idea doc's
speculation — don't re-litigate these without new information:

- **Envio ($1k) — pursue; DONE, exercised live.** Monad testnet has native,
  documented HyperIndex/HyperSync support. Indexing MUSTER's own events is
  not decorative: it's the only way to browse available capacity today
  besides raw `cast call`. Zero contract changes, as expected. `envio/` —
  `config.yaml`, `schema.graphql`,
  `src/handlers/{CapacityMarket,CapacityPool,effects}.ts` indexing both
  contracts' full lifecycle plus `ProviderStatsUpdated`. Two fields
  (`PoolClass`'s terms, `Assignment`'s provider/quantity/price/collateral)
  needed a supplementary `poolInfo`/`assignmentInfo` contract read because
  the relevant event genuinely doesn't carry them — verified against the
  live Solidity source, not assumed; see `envio/README.md` and
  `envio/config.yaml`'s own notes for exactly which fields and why.

  **Exercised live, not just typed and reasoned about:** `envio codegen`
  and `tsc --noEmit` both pass clean against the real generated types; a
  plain-RPC fallback (no API token) was tried and empirically rejected —
  Monad testnet's public RPC caps `eth_getLogs` at 100 blocks, making an
  ~840k-block historical sync impractical — confirming HyperSync (and a
  free API token) is the only practical path on this chain, not assumed.
  With a real `ENVIO_API_TOKEN`, `npm run dev` synced from `start_block` to
  chain head in under 5 seconds; querying Postgres directly (a local
  Hasura/port-8080 collision with an unrelated service on this machine
  blocked the GraphQL route specifically, not the indexer) confirmed **2
  real `Position` rows**, status `Defaulted`, matching the live-exercised
  position from `README.md`'s "Live on Monad testnet" exactly.

  **One real, structural finding, surfaced rather than hidden:**
  `ProviderStat` has 0 rows, and will have 0 rows against the *currently
  deployed* contracts regardless of how long the indexer runs — the
  deployed `CapacityMarket`/`CapacityPool` (2026-10-01) predate
  `ProviderStatsUpdated` (added 2026-10-04, this repo's own later commit),
  so the live bytecode doesn't contain that event. Not a bug in the
  indexer; will populate the moment a contract with `_recordOutcome` is
  (re)deployed and `config.yaml` is updated to match. `PoolClass`/
  `Reservation`/`Assignment` are also 0, correctly: no live `Contributed`/
  `activate` activity exists on the deployed Level 5 `CapacityPool` yet.
  See `envio/README.md` "What's actually verified" for the full trace.
- **Chainlink CRE ($3k) — pursue; DONE, exercised live.** Real,
  currently-unsolved gap: `claimDefault`/`finalizeDelivery`/
  `resolveDisputeByTimeout` (and the `CapacityPool` equivalents) are
  deliberately permissionless, but nothing calls them automatically once
  their deadlines pass. **Onchain half:** `src/CREDeadlineReceiver.sol` —
  a closed dispatcher (six named `Action`s against two immutable contract
  addresses, no arbitrary-calldata forwarding) extending Keystone's real
  `ReceiverTemplate` (vendored in `src/cre/`, generated by `cre init`
  against an authenticated account, not guessed), gated by the template's
  own forwarder check. 9/9 tests, including a batch where one stale action
  fails without blocking a sibling's success, and that the owner can rotate
  the trusted forwarder. **Offchain half:** `muster-cre/deadline-keeper` —
  a cron-triggered TypeScript workflow (scaffolded via real `cre init`,
  bindings via real `cre generate-bindings evm`) that reads every
  position's/assignment's status and deadline over the live RPC, batches
  what's due, and submits a report. 5/5 workflow tests
  (`bun test` in `muster-cre/deadline-keeper`).

  **Exercised live, not just typed and reasoned about:** a real position
  with a 45-second `activationSLA` was listed/reserved/activated on the
  deployed `CapacityMarket`; once it lapsed, `cre workflow simulate
  --broadcast` found it, encoded it, and submitted a real transaction —
  `CapacityMarket` emitted `Defaulted`, confirmed by reading the position's
  status back onchain afterward.

  **One real finding, diagnosed and resolved, not hidden:** the first live
  attempt submitted successfully (tx status success) but nothing changed
  onchain. Root cause, confirmed by decoding the actual event rather than
  guessed: local `cre workflow simulate --broadcast` on Monad testnet
  routes through the **mock** `KeystoneForwarder`
  (`0xB9F79d863261869B234c481D1f9A7af84AeAd192`), not the **production**
  one (`0xF8344CFd5c43616a4366C34E3EEE75af79a74482`) the deployed receiver
  trusts — the mock Forwarder's own `ReportProcessed` event recorded
  `result: false`, i.e. `ReceiverTemplate`'s forwarder check correctly
  rejected it. This is the template working as designed, not a bug in it —
  the fix was deploying a **second** `CREDeadlineReceiver` instance wired
  to the mock forwarder specifically for local testing
  (`config.staging.json` points at it; `config.production.json` keeps the
  real one). Re-ran the identical scenario against it and it worked:
  `ReportProcessed(result: true)`, `Defaulted` emitted, status confirmed.
  **Do not "fix" this by relaxing the forwarder check or hardcoding the
  mock address into the production receiver** — two separate deployed
  instances for two separate purposes is the correct shape, not a
  workaround to collapse away.

  **Still not demonstrated:** a report delivered by the real DON through
  the real production Forwarder — needs Deploy Access on the CRE account
  (`cre account access`, not yet granted as of this writing). The
  production-forwarder receiver is deployed, verified, and uses the exact
  same `ReceiverTemplate` logic already proven against the mock-forwarder
  instance; only the trusted address differs.

  CRE CLI installed locally at `~/.cre/bin/cre` (v1.36.0). Monad
  testnet/mainnet supported since CRE CLI v1.30.0; chain selector
  `2183018362218727504`, `chainSelectorName: "monad-testnet"` (confirmed
  against the installed `@chainlink/cre-sdk`'s own network registry, not
  assumed).
- **Mera ($2.5k) — blocked on frontend, not architecture.** Mera derives a
  plain EOA private key client-side from a passkey (WebAuthn PRF) — no
  smart-contract account, no bundler, no changes needed to our contracts at
  all (any EOA-compatible contract already works with a Mera-derived key).
  The bounty requires a deployed app using Mera as the signer; MUSTER has
  no frontend yet. Revisit this as the natural wallet-connection choice
  once frontend work actually starts — not before.
- **Kuru ($5k) — rejected, do not pursue.** Kuru's `deploy-market` needs a
  plain ERC-20 base/quote pair for its spot order book. MUSTER's positions
  carry live lifecycle state (activation deadline, dispute status, panel
  votes) that a CLOB trade cannot carry across — selling a "capacity share"
  mid-dispute or mid-SLA-countdown divorced from that state isn't the same
  asset anymore. Listing would require minting a separate ERC-20 wrapper
  per `TermsClass` plus a new vault adapter: a new subsystem built to chase
  the bounty, not a natural extension of the product. Don't reconsider this
  without a materially different asset shape than what Levels 1-5 built.
- Privy and Alchemy were already screened out earlier (no non-decorative
  integration identified / credits-only, not worth architecture changes).

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
