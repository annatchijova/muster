# Security Audit — MUSTER (CapacityMarket + CapacityPool)
## Red Team Round 1
**Date:** 2026-10-01
**Method:** Abductive Engineering (A–D–I) + Red-Team Auditing
**Scope:** `src/CapacityMarket.sol`, `src/CapacityPool.sol` as deployed to
Monad testnet (chain 10143) at `0xb859aF025b8676A5BFFFab6Ec013aBf131f7581c`
and `0x555C4340DA92b6579E26000b2CcAe9a2Ce5810e3`. Out of scope: `script/`,
build tooling, frontend (none exists yet).
**Base:** `main` @ commit `5f898ab` ("Deploy and verify both contracts on
Monad testnet")
**Reproducible evidence:** `test/RedTeam.t.sol` — `forge test --match-contract RedTeamTest -v`

## Threat model

- **Attacker CAN:** be a registered provider or buyer (permissionless —
  anyone can call `listCapacity`/`contribute`/`reserve`); choose any value
  for every parameter a provider or buyer controls (`activationSLA`,
  `disputeWindow`, `quantity`, `price`, `collateral` via `msg.value`,
  `domain`); call any public/external function at any time its guard
  allows; observe all onchain state (everything is public).
- **Attacker CANNOT:** modify contract code after deployment; forge another
  address's signature/transaction; stop a third party from calling a
  permissionless function (`claimDefault`, `finalizeDelivery`,
  `resolveDisputeByTimeout`, `expire`, etc. are all anyone-callable by
  design); control `block.timestamp` beyond the few seconds of validator
  slack already accepted as a documented risk in the Technical README.
- **Trust boundary exercised in this round:** the boundary between "a
  provider/buyer's self-interested but good-faith parameter choice" and "a
  provider/buyer's adversarially-chosen parameter choice." Prior design
  notes (AGENTS.md, Technical README) treat `activationSLA`/`disputeWindow`
  as economic decisions a rational counterparty would choose sensibly; this
  round tests what happens when one party is not rational but adversarial.

## Epistemic legend

CODE FACT · PLAUSIBLE HYPOTHESIS · **CONFIRMED BY INDUCTION** · FALSIFIED

## Executive summary

| ID | Severity | Level | Module | Finding | Status |
|----|----------|-------|--------|---------|--------|
| F1 | **Critical** | CONFIRMED | Both contracts | `price` is never returned to anyone on the SLA-miss default path — permanently stuck, on the ordinary non-adversarial failure path | **FIXED** |
| F2 | **Critical** | CONFIRMED | `CapacityMarket` | A provider can post **zero collateral**, set `activationSLA` to force `activate()` to revert forever, and collect the buyer's full `price` via `expire()` once the window lapses — a costless rug | **FIXED** |
| F3 | **High** | CONFIRMED | Both contracts | A poisoned `disputeWindow` makes `claimDelivery`/`claimAssignmentDelivery` revert forever once a position reaches `Accepted` — freezing `price` **and** `collateral` with no winner, no recovery path | **FIXED** |

All three fixed the same day, same session, before any fix-verification
re-deploy to Monad testnet (see "Remediation" at the end of this document).

All three are software vulnerabilities (bucket 1), not threat-model
assumptions or hygiene — see the invariant each one actually breaks,
stated per-finding below.

## Findings

### F1 — `price` has no payout path on default

**Severity:** Critical **Epistemic level:** CONFIRMED BY INDUCTION
**Bucket:** vulnerability
**Tests:** `test_F1_claimDefault_leaves_price_permanently_stuck_in_CapacityMarket`,
`test_F1_claimAssignmentDefault_leaves_price_permanently_stuck_in_CapacityPool`

**Surprise / expectation violated:** AGENTS.md states invariant 8, written
after this project's own prior fund-lock bugs: *"every terminal state has a
payout path"* for both `price` and `collateral`. `Defaulted`
(`CapacityMarket`) and `Defaulted` (`CapacityPool.AssignmentStatus`) are
listed as terminal states in both contracts' own NatSpec, yet neither
`claimDefault` nor `claimAssignmentDefault` pays out `price` — only
`collateral`.

**Abduction:** Reading `claimDefault`:
```solidity
function claimDefault(uint256 positionId) external inStatus(positionId, Status.Activated) {
    ...
    p.status = Status.Defaulted;
    _payout(p.buyer, p.collateral);   // price is never read here
}
```
No other function accepts `Status.Defaulted`/`AssignmentStatus.Defaulted` as
a precondition. If `price` (paid by the buyer at `reserve()`) is not
returned here, it has no other function that could ever move it.

**Deduction:** If true, a position that runs the entirely ordinary path —
list → reserve → activate → provider misses the SLA → anyone calls
`claimDefault` — must end with `address(contract).balance` still holding
exactly `price`, and every other state-mutating function on that position
must revert.

**Induction:** Ran the exact sequence with `PRICE = 10 ether`,
`COLLATERAL = 1 ether`. Buyer's balance increased by exactly `COLLATERAL`.
Contract balance after the call: exactly `PRICE` (10 ether). Follow-up calls
to `settle`, `finalizeDelivery`, `expire`, and a second `claimDefault` all
revert. Confirmed in both contracts (L1 per-position, L2 per-assignment).

**Causal chain:**
```
SLA missed (zero attacker skill required — an honestly slow provider triggers this)
    ↓
claimDefault() / claimAssignmentDefault()
    ↓
status → Defaulted/Defaulted (terminal)
    ↓
_payout(buyer, collateral)   ← price excluded
    ↓
price sits in contract.balance, unreachable by any function, forever
```

**Threat-model precondition:** none. This requires no adversary at all —
every honest provider who misses an SLA deadline triggers this against the
buyer who trusted them. This is the most severe finding in the set because
it needs zero attacker sophistication and will happen in ordinary use.

### F2 — costless rug via an overflowing `activationSLA`

**Severity:** Critical **Epistemic level:** CONFIRMED BY INDUCTION
**Bucket:** vulnerability
**Test:** `test_F2_provider_locks_activate_forever_and_collects_price_via_expire`

**Surprise / expectation violated:** `activationSLA` is documented
(AGENTS.md, Technical README) as "sized in minutes-to-days" and treated as
a provider's economic choice a rational buyer would simply evaluate before
reserving. Nothing in the contract bounds it, and the arithmetic that
consumes it (`uint64(block.timestamp) + p.activationSLA` in `activate()`)
is Solidity 0.8 checked arithmetic — it reverts on overflow rather than
wrapping.

**Abduction:** If a provider sets `activationSLA` to a value close to
`type(uint64).max`, every call to `activate()` for that position must
revert with an arithmetic panic, regardless of who calls it or when. Since
`CapacityMarket.expire()` pays the **provider** (not the buyer) for a
reserved-then-lapsed position — the project's own declared "option premium"
economics — a provider who makes `activate()` permanently unreachable
guarantees they collect `price` at window-close with **zero** chance of
ever being asked to actually respond to an incident, and can do this while
posting `0` collateral.

**Deduction:** List with `collateral = 0`, `activationSLA = type(uint64).max`.
Buyer reserves normally (nothing in `reserve()` reads `activationSLA`, so
this looks like an ordinary listing to a buyer not specifically checking for
an overflow boundary). Predict: buyer's `activate()` call reverts with
`Panic(0x11)`. Predict: after `validUntil`, `expire()` pays the provider
`price` in full.

**Induction:** Both predictions held exactly.
`market.activate(positionId)` reverted `panic: arithmetic underflow or
overflow (0x11)` (verified in the trace, not just a generic revert).
`expire()` after warping to `validUntil` paid the provider the full 10
ether `price`, with the provider having risked `0` collateral at any point.

**Causal chain:**
```
provider lists: collateral = 0, activationSLA = type(uint64).max
    ↓
buyer reserves (price paid, nothing here reads activationSLA)
    ↓
buyer calls activate() → uint64(now) + activationSLA overflows → always reverts
    ↓
no incident can ever be responded to, structurally, not by bad luck
    ↓
window closes → anyone calls expire() → price + collateral(0) → provider
    ↓
provider: +price, −0 risk.  buyer: −price, no service possible, ever.
```

**Threat-model precondition:** requires the buyer to reserve without
independently checking whether `activationSLA` is close to the uint64
overflow boundary — a check neither the contract nor (as far as this audit
knows) any tooling currently performs. Does **not** require any realistic
unit-confusion accident: reaching the overflow boundary from a
~1.77×10⁹ current timestamp requires a value near 1.84×10¹⁹ — roughly
5.8×10¹¹ years in seconds. No plausible "entered the wrong unit" mistake
lands anywhere near this magnitude; this is deliberate, crafted input, not
an accident. This is CapacityMarket-specific: the identical mechanism in
`CapacityPool.activate()` does **not** let the first contributor profit the
same way, because `CapacityPool.expireReservation()` refunds the **buyer**
in full — see Discarded Vectors.

### F3 — a poisoned `disputeWindow` freezes funds for both parties

**Severity:** High **Epistemic level:** CONFIRMED BY INDUCTION
**Bucket:** vulnerability
**Tests:** `test_F3_poisoned_disputeWindow_locks_both_price_and_collateral_forever`,
`test_F3_pool_poisoned_disputeWindow_locks_one_assignment_forever`

**Surprise / expectation violated:** Same arithmetic defect as F2, but in
`claimDelivery`/`claimAssignmentDelivery` (`uint64(block.timestamp) +
disputeWindow`), reached from `Accepted` — a state with exactly **one**
function that can move it anywhere (`claimDelivery`). If that one function
reverts unconditionally, `Accepted` becomes a dead end with no default path
and no expiry path (`claimDefault` requires `Activated`; `expire` requires
`Listed`/`Reserved`).

**Abduction:** Set `disputeWindow` near `type(uint64).max` at listing (L1)
or in the first contribution to a class (L2, since `disputeWindow` is part
of `TermsClass` and therefore shared by every reservation drawn from that
class). Predict `claimDelivery`/`claimAssignmentDelivery` reverts
permanently once called from `Accepted`.

**Induction:** Confirmed in both contracts. L1: position reaches `Accepted`
normally (provider did everything right up to this point), then
`claimDelivery` reverts `panic: arithmetic underflow or overflow (0x11)`,
every time, for any caller, forever. `price + collateral` (11 ether in the
test) sit in the contract with no further function reachable. L2: identical
mechanism, and because `disputeWindow` lives on the **shared** `TermsClass`,
one poisoned contribution freezes **every** assignment drawn from that
class, not just one buyer's.

**Causal chain:**
```
provider (L1) or first contributor (L2) sets disputeWindow ≈ type(uint64).max
    ↓
position/assignment reaches Accepted normally — nothing looks wrong yet
    ↓
claimDelivery() / claimAssignmentDelivery() → overflow → always reverts
    ↓
Accepted has no other outbound function
    ↓
price + collateral frozen forever — NEITHER party recovers anything
```

**Threat-model precondition:** same as F2 — requires a deliberately crafted
near-max value, not a plausible accident. Unlike F2, this is **not**
obviously profitable for the attacker: in the L1 reproduction the attacking
provider's own `collateral` is frozen along with the buyer's `price`, so
this is pure value destruction (a griefing/sabotage vector — e.g., a
provider burning their own stake to deny a buyer their funds, or a
malicious first contributor poisoning a whole `TermsClass` other providers
have already committed real collateral to) rather than a theft. Still a
confirmed vulnerability: no rational design intends for an onchain asset to
become permanently unspendable from ordinary, permitted function calls.

## Discarded (non-exploitable) vectors

| Vector | Result | Why it failed |
|---|---|---|
| Reentrancy double-payout (malicious `buyer`/`provider` contract reentering `_payout`'s call site) | Not exploitable | Checks-effects-interactions holds everywhere: status is set to its terminal value *before* every `_payout` call, so a reentrant call into any mutating function for the same position/assignment hits the status guard and reverts. Traced every `_payout` call site in both contracts; no exception found. |
| `disputeWindow = 0` set by a provider | Downgraded to hygiene, not a vulnerability | `disputeWindow` (and `activationSLA`) are public (`positions`/`poolInfo` are public getters) and immutable once listed — a buyer who checks before calling `reserve()` sees the real value, same as any market where a counterparty sets unfavorable but visible terms. No rug-pull: the value a buyer agreed to is the value that governs their position; nothing changes after reservation. Recommend a frontend check, not a contract fix. |
| `CapacityPool.activate()`'s identical overflow mechanism used for profit the way F2 does | **FALSIFIED** as a profit vector (the mechanism itself reproduces; the profit motive does not) | `expireReservation()` refunds the **buyer** in full once the window closes, regardless of whether `activate()` was ever reachable. A first contributor poisoning a class's `activationSLA` denies service (every reservation from that class can never activate) but does not let them collect anyone's `price` — the asymmetry that makes F2 profitable in `CapacityMarket` (expire pays the *provider*) doesn't exist here. Real finding, but it's a service-availability/DoS concern, not a fund-loss one — not written up as a numbered finding because its mechanism and remediation are identical to F3's (bound the duration), and its impact is strictly milder (no funds lost, only availability). |
| Force-feeding ETH via `selfdestruct` to inflate `address(this).balance` | Not exploitable | Every payout reads amounts from struct fields (`p.price`, `p.collateral`, `a.price`, `a.collateral`), never from `address(this).balance`. Extra forced ETH would just be stranded dust, unclaimable by anyone — a nuisance, not a vulnerability. |
| Front-running `reserve()`/`activate()` across two buyers | Not exploitable | Ordinary blockchain semantics: whichever transaction lands first wins, the loser's call reverts cleanly on the status guard. No invariant violated by this. |
| Gas-griefing `activate()`'s FIFO walk via many tiny `contribute()` calls | Not re-tested this round (already documented) | Previously identified and accepted in the Technical README/AGENTS.md as a known DoS surface at the cost of the attacker's own gas; distinct from this round's findings, not re-verified here. |

## Recommendations (record only — not applied in this change)

- **F1:** `claimDefault`/`claimAssignmentDefault` must pay out `price` in
  addition to `collateral`. Decide the recipient deliberately (likely the
  buyer, since no service was rendered — mirroring the economic logic
  already used for `CapacityPool.expireReservation()`) rather than
  defaulting to whichever is easiest to code.
- **F2 / F3:** bound `activationSLA` and `disputeWindow` at the point they
  are set (`listCapacity`, `contribute`) to a sane maximum (e.g., 365 days)
  so the checked-arithmetic additions in `activate()`/`claimDelivery()`/
  `claimAssignmentDelivery()`/`dispute()`/`disputeAssignment()` can never
  overflow `uint64` regardless of `block.timestamp`'s growth over the
  contract's lifetime. A `require(duration <= MAX_DURATION)` at the two
  entry points closes all three overflow-reachable call sites at once,
  since they all consume the same two bounded fields.
- Add this red-team suite's scenarios as permanent regression tests (today
  they assert the *vulnerable* behavior, by design, as proof-of-concept —
  they must be rewritten to assert the *fixed* behavior once a patch
  lands, not left asserting the bug).

## Remediation (applied 2026-10-01, same session)

All three findings fixed in `src/CapacityMarket.sol` and
`src/CapacityPool.sol`:

- **F1:** `claimDefault`/`claimAssignmentDefault` now pay out
  `price + collateral` to the buyer (full refund plus the penalty) instead
  of `collateral` alone. Decision: refund the buyer, not the provider — no
  service was rendered, mirroring the economic logic already used by
  `CapacityPool.expireReservation()`.
- **F2 / F3:** a new `MAX_DURATION` constant (365 days, public, same value
  in both contracts) bounds `activationSLA` and `disputeWindow`, checked at
  the two points those fields are ever set — `CapacityMarket.listCapacity`
  and `CapacityPool.contribute`. 365 days leaves enormous headroom under
  the uint64 overflow horizon (~5.8×10¹¹ years from any realistic
  timestamp), so every `uint64(block.timestamp) + duration` addition in
  `activate`/`claimDelivery`/`claimAssignmentDelivery`/`dispute`/
  `disputeAssignment` is now structurally incapable of overflowing,
  regardless of how long this contract stays deployed. This closes the
  single root cause behind both F2 and F3, plus the milder
  `CapacityPool.activate()` DoS variant noted in Discarded Vectors, in one
  change.

`test/RedTeam.t.sol` was rewritten the same session: the three PoCs that
demonstrated the vulnerable behavior now demonstrate the fixed behavior
(buyer recovers both `price` and `collateral` on default; a poisoned
duration is rejected at the listing/contribution step, before an attack
sequence can even begin). Existing regression tests
(`test_claimDefault_pays_collateral_and_price_to_buyer_after_SLA_miss`,
`test_one_provider_default_does_not_block_other_assignments`) were updated
to assert the corrected payout amounts. Full suite: 71/71 passing
(`CapacityMarket.t.sol`: 31, `CapacityPool.t.sol`: 34, `RedTeam.t.sol`: 6).

## Post-fix redeploy and live verification (2026-10-01, same session)

Redeployed both fixed contracts to Monad testnet and re-verified
(Sourcify `exact_match`): `CapacityMarket` at
`0xD3cfAAaa8159146ed2281EBD87911AF5b683cE8f`, `CapacityPool` at
`0x7d59c7CB9579dF0122a6bbB45b19796a91F2D32F`. The original
(vulnerable-bytecode) addresses from before this audit are left live and
verified as part of the audit trail, not reused.

Then exercised the full lifecycle against the new deployment with real MON
(not Anvil), on both contracts: `listCapacity` → `reserve` → `activate` →
`acceptActivation` → `claimDelivery` → `settle` on `CapacityMarket`; the
`CapacityPool` equivalent through `settleAssignment`. In both runs the
provider's payout was exactly `price + collateral` and the contract's
balance returned to `0` after settlement — the happy path the fix touches
(F1 is specifically the *default* path, not this one, but the same
`_payout` plumbing) behaves correctly on a real chain, not only in Foundry.
See `README.md`'s "Live on Monad testnet" for transaction hashes.

**Not yet done:** the default/dispute/expire paths — the ones F1, F2, and
F3 actually live on — have not themselves been re-exercised against the
live redeployed contracts, only against local Foundry tests
(`test/RedTeam.t.sol`). The happy-path run above confirms the redeploy is
the fixed source and that basic settlement still works live; it does not
independently confirm F1/F2/F3's fixes hold outside Foundry. Running
`claimDefault` and a poisoned-duration `listCapacity` call against the live
contracts would close that gap.
