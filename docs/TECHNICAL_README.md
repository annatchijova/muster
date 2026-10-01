# MUSTER — Technical README

Audience: engineers auditing, extending, or integrating with the contracts.
Nothing here is softened for a general reader — see [`README.md`](../README.md)
for that.

## Status

Track: **Onchain Finance & Trading** (Monad hackathon, Sep 1 – Oct 13).
Current level: **L1 — single-provider capacity position**, deployed to a local
Anvil chain only, 15/15 tests passing. Not audited. Not deployed to Monad
testnet or mainnet yet.

## What MUSTER is, precisely

MUSTER turns **future specialist response capacity** into an onchain,
tradable, state-machine-governed asset: a `CapacityPosition`. A provider
commits to deliver `quantity` units of work in a `domain` (e.g.
`ZK_SECURITY_L2`), inside a time window `[validFrom, validUntil]`, with a
bounded acknowledgement time (`activationSLA`) once a buyer activates it.

MUSTER does **not** claim to prove a provider was actually available or that
delivered work met a bar — see "Trust boundary" below. It proves the
narrower, onchain-provable claim: *this capacity was reserved, transferred,
activated, and settled (or defaulted) exactly once, in that order, with its
terms unchanged.*

## State machine

```
LISTED
  │  reserve()
  ▼
RESERVED ──transfer()──▶ RESERVED (new buyer, same terms)
  │  │
  │  └─ expire() [window closed, never activated] ──▶ EXPIRED
  │                                                      (collateral → provider)
  │  activate()
  ▼
ACTIVATED
  │  │
  │  ├─ acceptActivation() [within SLA] ──▶ ACCEPTED ──settle()──▶ SETTLED
  │  │                                                    (price + collateral → provider)
  │  │
  │  └─ claimDefault() [SLA missed] ──▶ DEFAULTED
  │                                       (collateral → buyer)
```

All transitions are one-way. `Settled`, `Expired`, and `Defaulted` are
terminal — no function transitions a position out of them. This is enforced
by the `inStatus` modifier checking the *exact* expected status before every
mutating call, not just "not yet terminal."

## Invariants (the load-bearing claims this contract makes)

1. **No double reservation.** `reserve()` requires `Status.Listed`. Once
   reserved, a second `reserve()` call reverts with `WrongStatus(Listed,
   Reserved)`. Mechanism: `inStatus` modifier. Test:
   `test_reserve_twice_reverts`.
2. **No double consumption.** `activate()`, `acceptActivation()`, `settle()`,
   and `claimDefault()` each require the position to be in the exact
   predecessor state. A position cannot be activated twice, settled twice, or
   defaulted after settlement. Mechanism: `inStatus` modifier on every
   mutating function. Tests: `test_activate_twice_reverts`,
   `test_settle_twice_reverts`.
3. **Transfer preserves the asset; it does not reset it.** `transfer()`
   mutates only `buyer`. `validFrom`, `validUntil`, `activationSLA`, `price`,
   and `collateral` are set once in `listCapacity` and never written again by
   any other function. Test: `test_transfer_preserves_window_sla_and_collateral`.
4. **Collateral is locked once, paid exactly once.** `listCapacity` is
   `payable`; `msg.value` becomes `collateral`, held by the contract. Exactly
   one of `settle` (→ provider, with `price`), `claimDefault` (→ buyer), or
   `expire` (→ provider) can execute per position, because each requires a
   distinct, mutually exclusive terminal-adjacent status. There is no
   function that reads `collateral` without also transitioning to a terminal
   state in the same call.
5. **Reentrancy cannot double-pay.** Every payout function sets `status` to
   its terminal value *before* the external call in `_payout` (checks-
   effects-interactions). A reentrant call into any mutating function for the
   same `positionId` hits the `inStatus` guard and reverts.

## Trust boundary — what is and is not provable onchain

Onchain (provable, tamper-evident):
- Who committed capacity, how much, in what domain, in what window.
- That it was reserved by exactly one buyer at a time.
- That a transfer happened and who the parties were.
- That activation happened at a specific block timestamp, and whether the
  provider acknowledged inside the SLA.
- Where payment and collateral actually went.

Not onchain, and not provable by this contract alone:
- That the provider was actually available or did the work.
- That the work met the buyer's quality bar.
- Any identity behind an address.

`acceptActivation` only proves the provider's address sent a transaction
inside the SLA window — not that a human did anything. `settle` only proves
the buyer's address called it — in L1 this is an honesty assumption the buyer
makes about their own interest (they only settle if satisfied), not a
dispute-resolution mechanism. **This is a known, stated limitation, not an
oversight**: closing it is the explicit target of a later level (an
attestation/oracle layer — see "Known limitations and next levels"), not
something L1 claims to solve.

## Known limitations and next levels

Per the project's construction discipline (destination-driven, not MVP-driven
— see `AGENTS.md`), these are named as the next *coherent levels* toward the
destination, not patches on a throwaway prototype:

- **Personal capacity only (Model A).** A position belongs to one named
  provider. The idea behind MUSTER is partly a *fungible* market — "4 hours of
  anyone satisfying `ZK_SECURITY_L2`" — pooling capacity across providers
  (Model B). L1 deliberately ships Model A first because it is the smaller
  state machine that already carries every invariant Model B will need
  (ownership, transfer, expiration, activation, settlement); Model B is a
  routing/matching layer in front of a pool of L1-shaped positions, not a
  rewrite of them.
- **Push-payment griefing.** `_payout` uses `.call` and requires success.
  If a recipient address is a contract whose receive function always
  reverts, the payout (and the state transition bundled with it) cannot
  complete, and the position is stuck in its pre-terminal state. This harms
  only the reverting party (a provider blocking their own `expire`, a buyer
  blocking their own `claimDefault`) — it is not a griefing vector against a
  counterparty — but it is a liveness gap. Planned fix: a pull-payment
  (withdrawal-pattern) ledger instead of push payouts.
- **No partial consumption.** `quantity` is recorded but not decremented; a
  position is all-or-nothing. Splitting a position into partially-consumable
  units is a Model-B-era concern.
- **No dispute/attestation layer.** `settle` is buyer-honesty-based. A later
  level routes delivery confirmation through an offchain attestation
  (hash-committed evidence, per the `annaconda`-style evidence-freeze
  pattern already used elsewhere in this author's portfolio) before
  `settle` becomes callable, or exposes a dispute window.
- **`block.timestamp` is used for window and SLA comparisons.** A validator
  can shift it by a small amount (seconds, not minutes). Given the SLA
  values this contract is designed for (minutes to days), this is an
  accepted, documented risk, not a gap — it would need revisiting if a
  future level introduces sub-minute SLAs.

## Build & test

Actual commands run against this repo, Foundry `forge 1.8.4`:

```
forge build
forge test
```

Last run: 15/15 tests passed (`test/CapacityMarket.t.sol`). This proves the
five invariants above hold under the specific scenarios each test encodes —
reservation, transfer, activation, acceptance, settlement, timeout/default,
and expiration paths, plus the wrong-value and wrong-window reverts. It does
not constitute a security audit, and no fuzzing or formal verification has
been run yet.

## License

Not yet decided for this repository — the hackathon's exact licensing
requirement has not been confirmed. Source files currently carry
`SPDX-License-Identifier: UNLICENSED` (no rights granted) as a deliberate
placeholder, not a final choice. Default plan, absent an explicit
requirement: Apache-2.0, matching the rest of this author's open-source
portfolio.
