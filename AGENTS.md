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

A future specialist response capacity market: a `CapacityPosition` is an
onchain asset with ownership, a time window, an activation SLA, and
collateral — reservable, transferable, activatable, and settled exactly
once. See [`docs/TECHNICAL_README.md`](docs/TECHNICAL_README.md) for the
full state machine.

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
- **Level 2 (planned):** fungible pooled capacity by domain class
  (`Model B` — "4 hours of anyone satisfying `ZK_SECURITY_L2`"), built as a
  routing/matching layer in front of L1-shaped positions, not a rewrite of
  them.
- **Level 3 (planned):** an attestation/dispute layer in front of
  `settle()`, closing the trust-boundary gap named in the Technical
  README (today, `settle()` is buyer-honesty-based).

Before adding a level, re-read the "Invariants" and "Trust boundary"
sections of the Technical README and confirm the new level preserves every
invariant already listed there — that check is the adversarial review this
project's construction method requires at each step, not a one-time gate.

## Invariants (do not weaken these without updating the Technical README)

These are restated briefly here as a checklist; the Technical README has
the mechanism and the test proving each one. Any change to
`CapacityMarket.sol` that touches a state transition **must** re-verify all
five against the test suite before being considered done:

1. No double reservation (`inStatus` guard on `reserve`).
2. No double consumption (`inStatus` guard on every mutating function).
3. `transfer()` changes `buyer` only — window, SLA, price, and collateral
   are immutable after `listCapacity`.
4. Collateral is paid out exactly once per position, by exactly one of
   `settle`, `claimDefault`, or `expire`.
5. State transitions are one-way; `Settled`/`Expired`/`Defaulted` are
   terminal.

**Known, accepted gap, not an oversight:** `settle()` only proves the
buyer's address called it — it does not prove the work was delivered or
met a bar. This is Level 3's job, not a bug to "fix" in Level 1 by adding
an ad hoc check. Do not add partial/heuristic dispute logic to L1's
`settle()` — that's exactly the kind of approximated-depth shortcut this
project's construction method rejects. Build Level 3 properly or leave the
gap documented.

**Push-payment is a known liveness gap, not a security hole.** `_payout`
uses `.call` and requires success; a recipient whose fallback always
reverts can block their *own* payout path, never a counterparty's. Don't
"fix" this with a try/catch that silently drops a failed payout — that
would turn a liveness gap into a fund-loss bug. The real fix is a
withdrawal-pattern ledger, planned, not yet built.

## Numbers that are decisions, not defaults

- `block.timestamp` is used directly for all window/SLA comparisons
  (`validFrom`, `validUntil`, `activationDeadline`). Accepted because this
  contract's SLAs are sized in minutes-to-days, and validator timestamp
  manipulation is bounded to seconds. **If a future level introduces
  sub-minute SLAs, this assumption no longer holds** and needs revisiting
  before shipping — don't carry it forward silently.
- No per-position quantity decrement (`quantity` is stored, not consumed
  partially). Deliberate: partial consumption is a Level 2/Model-B concern,
  not something to half-build into Level 1's all-or-nothing position.

## Build & test

```
forge build
forge test
```

A green `forge test` run proves the lifecycle and the five invariants hold
under the scenarios in `test/CapacityMarket.t.sol` (15 tests). It is not a
security audit and does not cover fuzzing, formal verification, or
multi-contract interaction once Level 2 exists — say exactly that when
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

- [ ] All five invariants above still hold; `forge test` is green.
- [ ] If a new state or transition was added, the Technical README's state
      machine diagram and invariant list were updated in the same change.
- [ ] No MVP/quick-version scope was introduced for a load-bearing property.
- [ ] No `LICENSE` file or SPDX change was made without explicit
      confirmation from the maintainer.
- [ ] `git status`/`git log` were actually read before claiming committed or
      pushed state (per `CLAUDE.md` §2).
