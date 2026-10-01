// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {CapacityMarket} from "./CapacityMarket.sol";
import {CapacityPool} from "./CapacityPool.sol";

/// @notice Inlined rather than imported from OpenZeppelin to avoid adding a
/// dependency for a one-function interface; the computed interface ID is
/// identical either way (Solidity interface IDs are derived from function
/// selectors, not from where the interface happens to be declared).
interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @notice Keystone's expected receiver interface — copied verbatim from the
/// chainlink/contracts package (src/v0.8/keystone/interfaces/IReceiver.sol),
/// not reconstructed from a paraphrase: the `KeystoneForwarder` checks a
/// receiver supports exactly this interface (via ERC165) before calling it.
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/// @title CREDeadlineReceiver
/// @notice The onchain half of MUSTER's Chainlink CRE integration: a CRE
/// workflow watches `CapacityMarket`/`CapacityPool` for positions whose
/// `activationDeadline`/`disputeDeadline` has passed, and periodically
/// submits a report naming which of the six already-permissionless deadline
/// functions to call and on which id. The Chainlink DON-operated
/// `KeystoneForwarder` delivers that report here via `onReport`.
///
/// Deliberately a **closed dispatcher, not a generic relayer**: the report
/// cannot carry arbitrary `(target, calldata)` — only one of six named
/// `Action`s against one of two fixed, immutable contract addresses set at
/// deployment. This is a narrower, safer surface than "forward whatever
/// calldata the report contains," and it costs nothing here because the six
/// targets are a closed, known set: every function this contract can ever
/// call is already callable by literally anyone today (that is the entire
/// point of them being permissionless). Spoofing a call to this receiver
/// directly (bypassing the Forwarder) grants an attacker nothing beyond
/// what they could already do by calling `claimDefault` etc. themselves —
/// there is no privilege escalation here, only convenience and reliability.
/// The `forwarder` check below is still enforced, because accepting
/// unauthenticated reports would mean this contract's behavior is not
/// actually gated by DON consensus the way the architecture intends, even
/// if the specific actions it can take are harmless either way.
contract CREDeadlineReceiver is IReceiver {
    enum Action {
        MarketClaimDefault,
        MarketFinalizeDelivery,
        MarketResolveDisputeByTimeout,
        PoolClaimAssignmentDefault,
        PoolFinalizeAssignmentDelivery,
        PoolResolveAssignmentDisputeByTimeout
    }

    /// @param id `positionId` for the three `Market*` actions, `reservationId`
    /// for the three `Pool*` actions.
    /// @param subId `assignmentIndex` for `Pool*` actions; ignored (but still
    /// present, always `0` in practice) for `Market*` actions — kept as a
    /// fixed-shape struct rather than two differently-shaped variants so the
    /// workflow can encode a single `DeadlineAction[]` regardless of which
    /// contract each entry targets.
    struct DeadlineAction {
        Action action;
        uint256 id;
        uint256 subId;
    }

    address public immutable forwarder;
    CapacityMarket public immutable market;
    CapacityPool public immutable pool;

    /// @notice One event per attempted action, win or lose. A `false`
    /// `success` is expected and routine — e.g. someone else already called
    /// the same deadline function first, or the position moved on before
    /// this batch executed — not a sign anything is wrong with this
    /// contract or the workflow.
    event ActionAttempted(
        uint256 indexed batchIndex, Action action, uint256 id, uint256 subId, bool success
    );

    error NotForwarder();

    constructor(address forwarder_, address market_, address pool_) {
        forwarder = forwarder_;
        market = CapacityMarket(market_);
        pool = CapacityPool(pool_);
    }

    /// @notice Called only by the configured `KeystoneForwarder` once DON
    /// consensus on a report has been reached. `metadata` (workflow
    /// id/name/owner) is intentionally unused — this contract accepts any
    /// well-formed report from the one trusted forwarder address rather than
    /// also pinning a specific workflow owner/name, since (per the class
    /// docstring) every action it can take is already permissionless
    /// anyway; narrowing further would add complexity without closing a
    /// real risk here. Revisit if this receiver is ever reused for a less
    /// benign action set.
    function onReport(bytes calldata, bytes calldata report) external {
        if (msg.sender != forwarder) revert NotForwarder();

        DeadlineAction[] memory actions = abi.decode(report, (DeadlineAction[]));
        for (uint256 i = 0; i < actions.length; i++) {
            bool ok = _attempt(actions[i]);
            emit ActionAttempted(i, actions[i].action, actions[i].id, actions[i].subId, ok);
        }
    }

    /// @notice Each action is attempted independently so one stale or
    /// already-resolved entry in a batch never blocks the rest — the same
    /// honest-degradation principle the rest of this project applies to
    /// partial failures (a timed-out assignment's default not blocking a
    /// sibling's settlement, etc.).
    function _attempt(DeadlineAction memory a) private returns (bool ok) {
        if (a.action == Action.MarketClaimDefault) {
            try market.claimDefault(a.id) {
                ok = true;
            } catch {
                ok = false;
            }
        } else if (a.action == Action.MarketFinalizeDelivery) {
            try market.finalizeDelivery(a.id) {
                ok = true;
            } catch {
                ok = false;
            }
        } else if (a.action == Action.MarketResolveDisputeByTimeout) {
            try market.resolveDisputeByTimeout(a.id) {
                ok = true;
            } catch {
                ok = false;
            }
        } else if (a.action == Action.PoolClaimAssignmentDefault) {
            try pool.claimAssignmentDefault(a.id, a.subId) {
                ok = true;
            } catch {
                ok = false;
            }
        } else if (a.action == Action.PoolFinalizeAssignmentDelivery) {
            try pool.finalizeAssignmentDelivery(a.id, a.subId) {
                ok = true;
            } catch {
                ok = false;
            }
        } else if (a.action == Action.PoolResolveAssignmentDisputeByTimeout) {
            try pool.resolveAssignmentDisputeByTimeout(a.id, a.subId) {
                ok = true;
            } catch {
                ok = false;
            }
        }
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
