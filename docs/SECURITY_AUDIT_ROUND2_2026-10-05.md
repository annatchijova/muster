# Security Audit — MUSTER (Level 4/5 arbitration + Chainlink CRE integration)
## Red Team Round 2
**Date:** 2026-10-05
**Method:** Abductive Engineering (A–D–I) + Red-Team Auditing
**Scope:** Level 4/5 arbitration panels in `src/CapacityMarket.sol` /
`src/CapacityPool.sol` (`panelMembers`/`panelThreshold`, `voteDispute`/
`voteAssignmentDispute`, `_executeDisputeVerdict`/
`_executeAssignmentDisputeVerdict`), and the Chainlink CRE integration
(`src/CREDeadlineReceiver.sol`, `src/cre/ReceiverTemplate.sol`,
`muster-cre/deadline-keeper/workflow.ts`). Round 1
(`docs/SECURITY_AUDIT_2026-10-01.md`) predates both — this is their first
dedicated adversarial pass. Out of scope: Levels 1–3 (already covered by
Round 1), the frontend (`web/`, not built by this audit's author), the
Envio indexer.
**Base:** `main` @ commit `ae60499`
**Reproducible evidence:** scratch Foundry probes run against this commit
and discarded (not committed — see "Reproducibility" under F4 for the exact
setup to reconstruct them)

## Threat model

- **Attacker CAN:** be a registered provider or buyer on either contract
  (permissionless); choose any value for every parameter they control,
  including using a smart contract (not just an EOA) as their own
  buyer/provider address, with arbitrary `receive()`/`fallback()` logic; be
  named as an arbitration panel member if a provider/first-contributor
  names them (no identity verification exists or is claimed); observe all
  onchain state and all pending reports; let their own position/assignment
  remain permanently unresolved at zero ongoing cost to themselves.
- **Attacker CANNOT:** modify contract code after deployment; forge the
  Chainlink `KeystoneForwarder`'s signature or compromise the DON; submit a
  report through the production Forwarder without controlling a workflow
  Chainlink's infrastructure actually relays (the receiver's own sender
  check still requires `msg.sender == s_forwarderAddress`, confirmed intact
  — see F3 below for the one related, discarded vector); stop a third party
  from calling any of the six already-permissionless deadline functions
  directly, with their own gas budget, outside the CRE batch.
- **Trust boundary exercised in this round:** (a) the panel mechanism's
  already-declared trust assumption (M members, no independence
  guarantee) under adversarial voting patterns, not just honest ones; (b)
  the boundary between "CREDeadlineReceiver dispatches a function that was
  always publicly callable anyway" (the contract's own stated reason
  batching adds no privilege) and "batching changes the *cost model* of
  calling it" — the gap this round actually found.

## Epistemic legend

CODE FACT · PLAUSIBLE HYPOTHESIS · **CONFIRMED BY INDUCTION** · FALSIFIED

## Executive summary

| ID | Severity | Level | Module | Finding | Status |
|----|----------|-------|--------|---------|--------|
| F4 | **Medium-High** | CONFIRMED BY INDUCTION | `CREDeadlineReceiver` + `deadline-keeper` | A single gas-guzzling due position, batched by the workflow alongside any other due action, exhausts the fixed per-batch gas budget and reverts the *entire* transaction — denying automated settlement to every sibling action, indefinitely, at zero ongoing cost to the attacker | **FIXED, same day** |
| F5 | Low (hygiene) | PLAUSIBLE HYPOTHESIS | `ReceiverTemplate`/`CREDeadlineReceiver` | Optional workflow-identity pinning (`s_expectedAuthor`/`WorkflowId`/`Name`) is never configured — `onReport` accepts any report relayed through the production Forwarder, not only MUSTER's own workflow | **OPEN, discarded as non-exploitable** |

No findings against the Level 4/5 panel mechanism itself beyond what its
own NatSpec already declares and accepts (see "Panel mechanism: what was
tested and why it held" below) — the panel's known gaps (no stake, no
`member != provider` check, no deadline on voting) are design choices
already named in `AGENTS.md`, re-verified rather than re-discovered this
round.

## Findings

### F4 — A gas-guzzling due action DoSes its entire CRE batch

**Severity:** Medium-High **Epistemic level:** CONFIRMED BY INDUCTION
**Bucket:** vulnerability (availability)

**Surprise / expectation violated:** `CREDeadlineReceiver`'s own NatSpec
states "[batching] grants an attacker nothing beyond what they could
already do by calling `claimDefault` etc. themselves — there is no
privilege escalation here, only convenience and reliability." That claim
is about *privilege*. It says nothing about *cost*, and the two turn out
not to be the same thing: calling `claimDefault` directly costs the caller
their own, uncapped gas; being dispatched *inside a CRE batch* shares a
single `gasLimit = 50_000 + 150_000 * actions.length` (`workflow.ts:132`)
across every action in that batch — a budget sized assuming each action
costs a bounded, predictable amount. A gas-consuming `receive()` breaks
that assumption, and the workflow's own comment at that exact line already
flagged unease about it ("Not tuned against a live gas profile yet") —
this finding gives that unease a concrete, reproducible shape.

**Abduction:** `_attempt` (`src/CREDeadlineReceiver.sol:95`) wraps each
dispatched call in `try ... catch { ok = false; }`. Solidity's try/catch
forwards gas to the external call under the same EIP-150 rule as any other
`CALL` (at most 63/64 of what remains). If a payout recipient's
`receive()` is a `while(true)` loop (or any sufficiently gas-hungry but
finite computation), it consumes the full forwarded stipend regardless of
size, and `_payout`'s `require(ok, "payout failed")`
(`src/CapacityMarket.sol:533`) makes that specific action fail cleanly
— *provided enough gas remains afterward* to process the catch block, run
the next loop iteration, and make the next external call. When the total
budget is a fixed, tightly-sized pool (not Foundry's effectively unbounded
test default), that assumption can fail: the 1/64 EIP-150 reserve
cascading back up through `onReport → _processReport`'s loop →
`_attempt`'s try/catch may not leave enough gas to even *attempt* the next
sibling action, let alone complete it — causing an uncaught out-of-gas
that reverts the whole transaction, rolling back any already-applied state
changes from earlier in the same batch too.

**Deduction (stated before running):** With the exact production formula
for a 2-action batch (`50_000 + 2×150_000 = 350,000` gas), predicted: (1) a
batch of two *ordinary* `claimDefault` calls completes successfully within
350,000 gas (control); (2) the same batch with one ordinary call and one
gas-guzzling-`receive()` call, in either order, reverts the entire
`onReport` transaction — not merely recording `ok=false` for the malicious
entry.

**Induction:** Built a throwaway `GasGuzzler` contract
(`receive() external payable { while (true) { x += 1; } }`), deployed
`CapacityMarket`/`CapacityPool`/`CREDeadlineReceiver` against this commit,
created two activated-and-SLA-missed positions (one with `GasGuzzler` as
buyer, one with a normal EOA buyer), batched both `MarketClaimDefault`
actions, and called `receiver.onReport{gas: N}(...)` as the configured
forwarder:

| Gas budget | Result |
|---|---|
| Foundry default (effectively unbounded) | Both predictions **FALSIFIED** at this budget: `onReport` completed; the guzzler's own action failed (`ok=false`, status stayed `Activated` — the already-accepted self-grief), the normal buyer's action succeeded and paid out correctly. |
| `350,000` (exact production formula, N=2) | **CONFIRMED**: `onReport` reverted entirely. The normal buyer's position stayed `Activated`, unpaid — despite being, on its own, a perfectly valid default. |
| `350,000`, **control** — both buyers ordinary EOAs, no guzzler | Both actions succeeded within the same 350,000 gas — ruling out "the formula is just generally too tight" as the cause. The guzzler is what flips the outcome, not an underprovisioned budget in general. |

The table above is the prediction-then-result record; the control isolates
the cause to the malicious `receive()`, not the gas formula's general
sizing.

**Reproducibility:** Not committed to the test suite (scratch probe,
deleted after confirming). To reconstruct: add a `GasGuzzler` contract as
above to a new test file importing `CapacityMarket`/`CapacityPool`/
`CREDeadlineReceiver`; create two positions exactly as
`test_onReport_batch_one_failure_does_not_block_others` in
`test/CREDeadlineReceiver.t.sol` does, but make one buyer the `GasGuzzler`
instance; batch both `MarketClaimDefault` actions; call
`receiver.onReport{gas: 350000}("", abi.encode(actions))` as `forwarder`;
assert it reverts. Run against `main` @ `ae60499`; Foundry `forge` 1.8.4,
Solc 0.8.37.

**Causal chain:**
```
malicious buyer deploys a gas-hungry receive()
    ↓ lists/reserves/activates a position, never resolves it (free, permanent)
deadline-keeper's cron scan finds it "due" every tick, forever
    ↓ batched with any other due action into one actions[] array
onReport called with gasLimit = 50_000 + 150_000*N  (fixed, assumes bounded per-action cost)
    ↓ _attempt's external call to the malicious position's claimDefault
receive() consumes ~63/64 of whatever gas remains at that point
    ↓ (if the surviving 1/64 reserve is too small for what's left to do)
next sibling action cannot even be attempted / loop bookkeeping starves
    ↓
entire onReport transaction reverts — ALL actions in the batch roll back,
including ones that would have succeeded alone
```

**Threat-model precondition:** Attacker needs only the ability to deploy a
contract and use it as a buyer (or provider, via `finalizeDelivery`/
`settle`-path assignments) on a position/assignment that will eventually
become "due" — a fully ordinary, permissionless capability every user
already has. No special access, no compromise of Chainlink's
infrastructure, no cost beyond the position's own (typically minimal)
collateral/price, which the attacker never gets back but also never
risked beyond that.

**Impact, stated precisely:** Not fund loss, and not permanent — every
function `CREDeadlineReceiver` dispatches remains independently,
permissionlessly callable by anyone directly, with their own gas budget,
bypassing the batch entirely (the project's own "honest degradation"
principle: automation failing still leaves the underlying guarantee
reachable by hand). The actual harm is to the *automated-enforcement*
claim specifically: `docs/BUSINESS_CASE.md`'s "Enforcement is the part
that doesn't scale in the competing approach — and here it does" is
weakened for any tick where a poisoned position shares a batch with a
legitimate one — which, given the cron runs every 5 minutes
(`config.production.json`) and the malicious position never resolves,
means *every* tick from the moment it's created onward, for as long as it
remains unresolved. A judge or a real counterparty checking "does the
automation actually work" during exactly the wrong 5-minute window would
see it silently fail for reasons that look unrelated to their own
position.

### F5 — Workflow-identity pinning left unconfigured (discarded as non-exploitable)

**Severity:** Low (hygiene) **Epistemic level:** PLAUSIBLE HYPOTHESIS (not executed — no access to submit an arbitrary CRE report to test this live)
**Bucket:** hygiene, explicitly not a vulnerability — see reasoning below

`ReceiverTemplate`'s optional `s_expectedAuthor`/`s_expectedWorkflowId`/
`s_expectedWorkflowName` checks (`src/cre/ReceiverTemplate.sol:89-107`)
are never set by any script in this repo (`grep` over `script/` confirms
zero calls to `setExpectedAuthor`/`setExpectedWorkflowId`/
`setExpectedWorkflowName`). Only `s_forwarderAddress` is checked, which
*is* correctly set (confirmed against `README.md`'s deployed addresses).
This means `onReport` will dispatch a report from *any* workflow whose
report the production `KeystoneForwarder` relays to this receiver's
address — not provably only `muster-cre/deadline-keeper`'s own.

**Why this is discarded, not reported as a vulnerability:** `_attempt`
only ever calls six functions that are already fully permissionless and
callable by literally anyone, directly, for free, right now. An
unaffiliated workflow dispatching through this receiver gains nothing a
stranger couldn't already do by calling `claimDefault` themselves — the
contract's own NatSpec makes exactly this argument, and nothing in this
round's testing found a way around it (F4's cost-model gap is orthogonal:
it doesn't require an unaffiliated third-party workflow at all, only an
ordinary user's position). Recorded per this audit's own discipline that
discarded vectors belong in the deliverable, and because pinning the
author/workflow ID is a one-line hardening ticket worth taking regardless
of exploitability — being deliberate about who can trigger dispatch, even
when it's provably harmless today, is cheaper than re-deriving this
argument from scratch the next time this contract's trust boundary is
reviewed.

## Panel mechanism: what was tested and why it held

Explicitly re-verified against adversarial voting patterns, not just
read — one experiment run, one result recorded:

- **Unanimous panel (`threshold == members.length`) exhausted without a
  verdict** (e.g. 3 members, votes split 2-1, no fourth voter exists):
  **CONFIRMED BY INDUCTION**, not just reasoned about — a throwaway Foundry
  test (`test_AUDIT_PROBE_exhausted_unanimous_panel_falls_through_to_timeout`,
  built, run, and discarded this session) listed a position with a
  3-member/threshold-3 panel, disputed it, cast 2 provider-votes and 1
  buyer-vote (all three members exhausted, no verdict), then warped past
  `disputeDeadline` and called `resolveDisputeByTimeout` — it succeeded,
  refunding the buyer correctly. The panel mechanism cannot deadlock a
  position: `resolveDisputeByTimeout`/`resolveAssignmentDisputeByTimeout`
  remain reachable regardless of whether the panel ever reaches consensus,
  exactly as the Technical README claims ("arbitration is additive, never
  a new way for funds to get stuck").

## Discarded (non-exploitable) vectors

| Vector | Result | Why it failed |
|---|---|---|
| Reentrancy into `onReport`/`voteDispute`/etc. via a malicious payout recipient's fallback, during `_payout`'s `.call` inside a dispatched action | Not exploitable | Status is set to its terminal value *before* `_payout`'s external call in every path (checks-effects-interactions, already the established pattern from Round 1's remediation); a reentrant call hits an `inStatus`/`WrongAssignmentStatus` guard and reverts. `onReport` itself additionally requires `msg.sender == forwarder`, which a reentrant call from a payout recipient's fallback is never going to satisfy. |
| Out-of-range `Action` enum value in a batched `DeadlineAction`, submitted via the production Forwarder, to DoS a batch cheaply (no gas-guzzling contract needed) | Not independently exploitable | `abi.decode`'s built-in enum-range validation would revert the *entire* batch on an invalid action code — a real DoS vector in isolation, but it requires the same precondition as F5 (ability to get an arbitrary report relayed through the trusted Forwarder to this specific receiver), which is a much higher bar than F4's "just be an ordinary user." Noted as a secondary instance of F5's category, not a separate finding. |
| Panel member double-counted across sibling assignments from the same `TermsClass`/reservation | Not exploitable | `disputeVotes`/`providerVoteCount`/`buyerVoteCount` in `CapacityPool` are keyed by `(reservationId, assignmentIndex)`, not just `reservationId` or `classId` — confirmed by reading every mapping declaration and every call site; a member must vote separately on each disputed assignment. |
| Provider-as-panel-member self-dealing on their own disputed assignment | Already an accepted, documented trust gap (`AGENTS.md`: "no `require(member != provider)`... trivially bypassed"), not a new finding this round | Re-verified the NatSpec's own reasoning holds (a second colluding address bypasses any such check trivially) rather than re-discovering it as new. |

## Remediation

**F4 — fixed same day, same session, before any re-deploy to Monad testnet.**

`CREDeadlineReceiver` now declares `uint256 public constant
ACTION_GAS_STIPEND = 200_000` and every one of the six dispatched calls in
`_attempt` is capped via `{gas: ACTION_GAS_STIPEND}` on the call
expression itself — Solidity's `try X.f{gas: N}(...)` forwards *at most*
`N`, not "all remaining minus the EIP-150 reserve," so a malicious
`receive()` can never again draw more than its own fixed stipend, no
matter how it's written or how many other actions share the batch. 200,000
was chosen from measured data, not guessed: the six dispatched functions
cost 82,814–106,399 gas in their normal path against this commit (measured
2026-10-05 via isolated `gasleft()` deltas, not whole-test gas which
includes setup overhead), leaving roughly 2x headroom over the worst
observed case (`claimAssignmentDefault`, 106,399 gas).

`muster-cre/deadline-keeper/workflow.ts`'s `gasLimit` formula moved from
`50_000 + 150_000 × N` to `50_000 + 220_000 × N` — the per-action share
must stay above `ACTION_GAS_STIPEND` plus loop/dispatch overhead
(array-slot decode, the `try/catch` wrapper itself, the `ActionAttempted`
emit) for the arithmetic to hold under *any* mix of actions, not just the
single-guzzler case originally found. The two numbers (`ACTION_GAS_STIPEND`
in Solidity, the per-action multiplier in TypeScript) must be kept in sync
by hand — flagged explicitly in both files' comments, the same convention
this codebase already uses for mirroring the `Action` enum between them.

**Verified by induction, not just by re-reading the fix:**

| Test | Scenario | Result |
|---|---|---|
| `test_onReport_gas_guzzling_sibling_does_not_starve_batch_under_tight_gas` | 1 guzzler + 1 legit action, exact production formula (`50_000 + 2×220_000`) | **PASS** — guzzler's own action still fails cleanly (unchanged, self-griefing only); sibling succeeds and is paid |
| `test_onReport_multiple_gas_guzzlers_still_do_not_starve_the_legit_action` | 2 guzzlers + 1 legit action, exact production formula for N=3 | **PASS** — legit action survives two simultaneous attackers in the same batch, not just one |

Both committed to `test/CREDeadlineReceiver.t.sol` as permanent regression
tests (11/11 in that file, 118/118 total Solidity tests). The
`deadline-keeper` workflow's own suite (5/5, `bun test`) and `tsc --noEmit`
both still pass unchanged against the new formula.

**F5 — left open, as hygiene, not re-opened as part of this fix.** Calling
`setExpectedWorkflowId` (and optionally `setExpectedAuthor`) once after
deployment, pinned to the actual `deadline-keeper` workflow's real ID,
remains a cheap, worthwhile hardening step — tracked in `TODO.md`, not
done in this pass since it requires a live deployment action (calling an
`onlyOwner` setter against the production receiver), not a code change.
