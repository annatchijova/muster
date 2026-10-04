// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CapacityMarket} from "../src/CapacityMarket.sol";

contract CapacityMarketTest is Test {
    CapacityMarket market;

    address provider = makeAddr("provider");
    address buyer = makeAddr("buyer");
    address otherBuyer = makeAddr("otherBuyer");

    bytes32 constant DOMAIN = keccak256("ZK_SECURITY_L2");
    uint256 constant PRICE = 1 ether;
    uint256 constant COLLATERAL = 0.5 ether;
    uint64 constant SLA = 30 minutes;
    uint64 constant DISPUTE_WINDOW = 2 days;
    bytes32 constant EVIDENCE_HASH = keccak256("incident report #1");
    bytes32 constant REASON_HASH = keccak256("work did not match the incident report");

    uint64 validFrom;
    uint64 validUntil;
    address[] NO_PANEL; // empty, set in setUp (storage array, can't be a constant)

    function setUp() public {
        validFrom = uint64(block.timestamp);
        validUntil = uint64(block.timestamp + 30 days);

        vm.deal(provider, 10 ether);
        vm.deal(buyer, 10 ether);
        vm.deal(otherBuyer, 10 ether);

        market = new CapacityMarket();
    }

    function _status(uint256 positionId) internal view returns (CapacityMarket.Status status) {
        (,,,,,,,,,,,,, status) = market.positions(positionId);
    }

    function _list() internal returns (uint256 positionId) {
        vm.prank(provider);
        positionId =
            market.listCapacity{value: COLLATERAL}(DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, NO_PANEL, 0, PRICE);
    }

    function _listWithPanel(address[] memory panelMembers, uint256 threshold) internal returns (uint256 positionId) {
        vm.prank(provider);
        positionId = market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, panelMembers, threshold, PRICE
        );
    }

    function _listAndReserve() internal returns (uint256 positionId) {
        positionId = _list();
        vm.prank(buyer);
        market.reserve{value: PRICE}(positionId);
    }

    function _listReserveActivate() internal returns (uint256 positionId) {
        positionId = _listAndReserve();
        vm.prank(buyer);
        market.activate(positionId);
    }

    function _throughAccepted() internal returns (uint256 positionId) {
        positionId = _listReserveActivate();
        vm.prank(provider);
        market.acceptActivation(positionId);
    }

    function _throughDeliveryClaimed() internal returns (uint256 positionId) {
        positionId = _throughAccepted();
        vm.prank(provider);
        market.claimDelivery(positionId, EVIDENCE_HASH);
    }

    // --- Happy path -------------------------------------------------

    function test_fullLifecycle_settles_and_pays_provider() public {
        uint256 positionId = _throughDeliveryClaimed();

        uint256 providerBalanceBefore = provider.balance;

        vm.prank(buyer);
        market.settle(positionId);

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Settled));
        assertEq(provider.balance, providerBalanceBefore + PRICE + COLLATERAL);
    }

    // --- Invariant: no double reservation ----------------------------

    function test_reserve_twice_reverts() public {
        uint256 positionId = _listAndReserve();

        vm.prank(otherBuyer);
        vm.expectRevert(
            abi.encodeWithSelector(CapacityMarket.WrongStatus.selector, CapacityMarket.Status.Listed, CapacityMarket.Status.Reserved)
        );
        market.reserve{value: PRICE}(positionId);
    }

    // --- Invariant: no double consumption -----------------------------

    function test_settle_twice_reverts() public {
        uint256 positionId = _throughDeliveryClaimed();

        vm.prank(buyer);
        market.settle(positionId);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityMarket.WrongStatus.selector, CapacityMarket.Status.DeliveryClaimed, CapacityMarket.Status.Settled
            )
        );
        market.settle(positionId);
    }

    function test_activate_twice_reverts() public {
        uint256 positionId = _listReserveActivate();

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(CapacityMarket.WrongStatus.selector, CapacityMarket.Status.Reserved, CapacityMarket.Status.Activated)
        );
        market.activate(positionId);
    }

    function test_settle_before_claimDelivery_reverts() public {
        uint256 positionId = _throughAccepted();

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityMarket.WrongStatus.selector, CapacityMarket.Status.DeliveryClaimed, CapacityMarket.Status.Accepted
            )
        );
        market.settle(positionId);
    }

    // --- Invariant: transfer preserves the asset, changes only ownership ---

    function test_transfer_preserves_window_sla_and_collateral() public {
        uint256 positionId = _listAndReserve();

        vm.prank(buyer);
        market.transfer(positionId, otherBuyer);

        (
            ,
            ,
            uint64 vFrom,
            uint64 vUntil,
            uint64 sla,
            ,
            ,
            address currentBuyer,
            ,
            uint256 collateral,
            ,
            ,
            ,
        ) = market.positions(positionId);

        assertEq(currentBuyer, otherBuyer);
        assertEq(vFrom, validFrom);
        assertEq(vUntil, validUntil);
        assertEq(sla, SLA);
        assertEq(collateral, COLLATERAL);
    }

    function test_transfer_by_non_buyer_reverts() public {
        uint256 positionId = _listAndReserve();

        vm.prank(otherBuyer);
        vm.expectRevert(CapacityMarket.NotBuyer.selector);
        market.transfer(positionId, otherBuyer);
    }

    function test_new_owner_after_transfer_can_activate() public {
        uint256 positionId = _listAndReserve();

        vm.prank(buyer);
        market.transfer(positionId, otherBuyer);

        vm.prank(otherBuyer);
        market.activate(positionId);

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Activated));
    }

    // --- Timeout / default path: collateral compensates the buyer -------

    function test_claimDefault_pays_collateral_and_price_to_buyer_after_SLA_miss() public {
        uint256 positionId = _listReserveActivate();

        vm.warp(block.timestamp + SLA + 1);

        uint256 buyerBalanceBefore = buyer.balance;
        market.claimDefault(positionId);

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Defaulted));
        // No service was rendered: the buyer gets both the penalty
        // (collateral) and a full refund of price. See SECURITY_AUDIT
        // 2026-10-01 finding F1 — price used to be left stuck here.
        assertEq(buyer.balance, buyerBalanceBefore + COLLATERAL + PRICE);
    }

    function test_claimDefault_before_deadline_reverts() public {
        uint256 positionId = _listReserveActivate();

        vm.expectRevert(CapacityMarket.DeadlineNotPassed.selector);
        market.claimDefault(positionId);
    }

    function test_acceptActivation_after_deadline_reverts() public {
        uint256 positionId = _listReserveActivate();

        vm.warp(block.timestamp + SLA + 1);

        vm.prank(provider);
        vm.expectRevert(CapacityMarket.DeadlinePassed.selector);
        market.acceptActivation(positionId);
    }

    // --- Expiration path: unused capacity lapses, provider keeps collateral ---

    function test_expire_unused_reservation_pays_collateral_and_price_to_provider() public {
        uint256 positionId = _listAndReserve();

        vm.warp(validUntil);

        uint256 providerBalanceBefore = provider.balance;
        market.expire(positionId);

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Expired));
        // Reserved-then-lapsed: the provider keeps both the collateral and
        // the price, the same way an unexercised option's premium stays
        // with the writer. See CapacityMarket.expire()'s NatSpec.
        assertEq(provider.balance, providerBalanceBefore + COLLATERAL + PRICE);
    }

    function test_expire_never_reserved_listing_returns_collateral_only() public {
        uint256 positionId = _list(); // never reserved: buyer never paid PRICE

        vm.warp(validUntil);

        uint256 providerBalanceBefore = provider.balance;
        market.expire(positionId);

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Expired));
        assertEq(provider.balance, providerBalanceBefore + COLLATERAL);
    }

    function test_expire_before_window_closes_reverts_on_listed_position() public {
        uint256 positionId = _list();

        vm.expectRevert(CapacityMarket.WindowNotYetClosed.selector);
        market.expire(positionId);
    }

    function test_expire_before_window_closes_reverts() public {
        uint256 positionId = _listAndReserve();

        vm.expectRevert(CapacityMarket.WindowNotYetClosed.selector);
        market.expire(positionId);
    }

    function test_activate_after_window_closed_reverts() public {
        uint256 positionId = _listAndReserve();

        vm.warp(validUntil);

        vm.prank(buyer);
        vm.expectRevert(CapacityMarket.WindowNotOpen.selector);
        market.activate(positionId);
    }

    // --- Payment correctness ---

    function test_reserve_wrong_price_reverts() public {
        uint256 positionId = _list();

        vm.prank(buyer);
        vm.expectRevert(CapacityMarket.WrongValue.selector);
        market.reserve{value: PRICE - 1}(positionId);
    }

    function test_invalid_window_reverts() public {
        vm.prank(provider);
        vm.expectRevert(CapacityMarket.InvalidWindow.selector);
        market.listCapacity(DOMAIN, 4, validUntil, validFrom, SLA, DISPUTE_WINDOW, NO_PANEL, 0, PRICE);
    }

    // --- Duration bound (SECURITY_AUDIT 2026-10-01 findings F2/F3) ----------

    function test_listCapacity_rejects_activationSLA_above_MAX_DURATION() public {
        uint64 tooLong = market.MAX_DURATION() + 1;

        vm.prank(provider);
        vm.expectRevert(CapacityMarket.DurationTooLong.selector);
        market.listCapacity(DOMAIN, 4, validFrom, validUntil, tooLong, DISPUTE_WINDOW, NO_PANEL, 0, PRICE);
    }

    function test_listCapacity_rejects_disputeWindow_above_MAX_DURATION() public {
        uint64 tooLong = market.MAX_DURATION() + 1;

        vm.prank(provider);
        vm.expectRevert(CapacityMarket.DurationTooLong.selector);
        market.listCapacity(DOMAIN, 4, validFrom, validUntil, SLA, tooLong, NO_PANEL, 0, PRICE);
    }

    function test_listCapacity_accepts_activationSLA_and_disputeWindow_at_MAX_DURATION() public {
        uint64 maxDuration = market.MAX_DURATION();

        vm.prank(provider);
        uint256 positionId = market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, maxDuration, maxDuration, NO_PANEL, 0, PRICE
        );
        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Listed));
    }

    // --- Level 4/5: arbitration panels (single arbitrator is the M=1,N=1 case) ---

    function _toDisputed(uint256 positionId) internal {
        vm.prank(buyer);
        market.reserve{value: PRICE}(positionId);
        vm.prank(buyer);
        market.activate(positionId);
        vm.prank(provider);
        market.acceptActivation(positionId);
        vm.prank(provider);
        market.claimDelivery(positionId, EVIDENCE_HASH);
        vm.prank(buyer);
        market.dispute(positionId, REASON_HASH);
    }

    function test_listCapacity_rejects_oversized_panel() public {
        address[] memory tooMany = new address[](market.MAX_PANEL_SIZE() + 1);
        for (uint256 i = 0; i < tooMany.length; i++) {
            tooMany[i] = makeAddr(string.concat("member", vm.toString(i)));
        }
        vm.prank(provider);
        vm.expectRevert(CapacityMarket.InvalidPanel.selector);
        market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, tooMany, 1, PRICE
        );
    }

    function test_listCapacity_rejects_threshold_above_panel_size() public {
        address[] memory panel = new address[](2);
        panel[0] = makeAddr("m0");
        panel[1] = makeAddr("m1");

        vm.prank(provider);
        vm.expectRevert(CapacityMarket.InvalidPanel.selector);
        market.listCapacity{value: COLLATERAL}(DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, panel, 3, PRICE);
    }

    function test_listCapacity_rejects_nonzero_threshold_with_empty_panel() public {
        vm.prank(provider);
        vm.expectRevert(CapacityMarket.InvalidPanel.selector);
        market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, NO_PANEL, 1, PRICE
        );
    }

    /// @notice A single trusted arbitrator (Level 4) is exactly the
    /// members.length == 1, threshold == 1 case of a panel. One vote settles it.
    function test_voteDispute_single_member_panel_settles_like_Level4_arbitrator() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](1);
        panel[0] = arbitrator;
        uint256 positionId = _listWithPanel(panel, 1);
        _toDisputed(positionId);

        uint256 providerBefore = provider.balance;
        vm.prank(arbitrator);
        market.voteDispute(positionId, true);

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Settled));
        assertEq(provider.balance, providerBefore + PRICE + COLLATERAL);
    }

    function test_voteDispute_rules_for_buyer() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](1);
        panel[0] = arbitrator;
        uint256 positionId = _listWithPanel(panel, 1);
        _toDisputed(positionId);

        uint256 buyerBefore = buyer.balance;
        vm.prank(arbitrator);
        market.voteDispute(positionId, false);

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Refunded));
        assertEq(buyer.balance, buyerBefore + PRICE + COLLATERAL);
    }

    function test_voteDispute_by_non_member_reverts() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](1);
        panel[0] = arbitrator;
        uint256 positionId = _listWithPanel(panel, 1);
        _toDisputed(positionId);

        vm.prank(buyer); // not a panel member
        vm.expectRevert(CapacityMarket.NotArbitrator.selector);
        market.voteDispute(positionId, true);
    }

    /// @notice A position opted out of arbitration (empty panel) must fall
    /// back to the exact Level 3 behavior: nobody can ever vote, only
    /// resolveDisputeByTimeout applies.
    function test_voteDispute_reverts_for_everyone_when_panel_is_empty() public {
        uint256 positionId = _throughDeliveryClaimed(); // listed via _list(), empty panel
        vm.prank(buyer);
        market.dispute(positionId, REASON_HASH);

        vm.prank(buyer);
        vm.expectRevert(CapacityMarket.NotArbitrator.selector);
        market.voteDispute(positionId, true);

        vm.prank(provider);
        vm.expectRevert(CapacityMarket.NotArbitrator.selector);
        market.voteDispute(positionId, true);

        // The timeout fallback still works exactly as in Level 3.
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
        uint256 buyerBefore = buyer.balance;
        market.resolveDisputeByTimeout(positionId);
        assertEq(buyer.balance, buyerBefore + PRICE + COLLATERAL);
    }

    function test_voteDispute_races_resolveDisputeByTimeout_vote_first_wins() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](1);
        panel[0] = arbitrator;
        uint256 positionId = _listWithPanel(panel, 1);
        _toDisputed(positionId);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1); // timeout window has passed too

        vm.prank(arbitrator);
        market.voteDispute(positionId, true); // arbitrator still gets to rule

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Settled));

        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityMarket.WrongStatus.selector, CapacityMarket.Status.Disputed, CapacityMarket.Status.Settled
            )
        );
        market.resolveDisputeByTimeout(positionId); // already resolved, cannot double-pay
    }

    /// @notice The real M-of-N case: a 3-member panel with threshold 2.
    /// Neither side's vote alone decides it; the second matching vote does.
    function test_voteDispute_three_member_panel_needs_two_matching_votes() public {
        address a1 = makeAddr("a1");
        address a2 = makeAddr("a2");
        address a3 = makeAddr("a3");
        address[] memory panel = new address[](3);
        panel[0] = a1;
        panel[1] = a2;
        panel[2] = a3;
        uint256 positionId = _listWithPanel(panel, 2);
        _toDisputed(positionId);

        vm.prank(a1);
        market.voteDispute(positionId, true); // 1 vote for provider: not enough yet
        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Disputed));

        vm.prank(a2);
        market.voteDispute(positionId, false); // split 1-1: still not enough
        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Disputed));

        uint256 buyerBefore = buyer.balance;
        vm.prank(a3);
        market.voteDispute(positionId, false); // 2 votes for buyer: threshold reached

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Refunded));
        assertEq(buyer.balance, buyerBefore + PRICE + COLLATERAL);
    }

    function test_voteDispute_member_cannot_vote_twice() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](3);
        panel[0] = arbitrator;
        panel[1] = makeAddr("a2");
        panel[2] = makeAddr("a3");
        uint256 positionId = _listWithPanel(panel, 2);
        _toDisputed(positionId);

        vm.prank(arbitrator);
        market.voteDispute(positionId, true);

        vm.prank(arbitrator);
        vm.expectRevert(CapacityMarket.AlreadyVoted.selector);
        market.voteDispute(positionId, true);
    }

    function test_voteDispute_after_verdict_executed_reverts() public {
        address a1 = makeAddr("a1");
        address a2 = makeAddr("a2");
        address a3 = makeAddr("a3");
        address[] memory panel = new address[](3);
        panel[0] = a1;
        panel[1] = a2;
        panel[2] = a3;
        uint256 positionId = _listWithPanel(panel, 2);
        _toDisputed(positionId);

        vm.prank(a1);
        market.voteDispute(positionId, true);
        vm.prank(a2);
        market.voteDispute(positionId, true); // threshold reached, verdict executes

        vm.prank(a3);
        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityMarket.WrongStatus.selector, CapacityMarket.Status.Disputed, CapacityMarket.Status.Settled
            )
        );
        market.voteDispute(positionId, false); // too late, already Settled
    }

    function test_arbitrationPanel_view_returns_members_and_threshold() public {
        address a1 = makeAddr("a1");
        address a2 = makeAddr("a2");
        address[] memory panel = new address[](2);
        panel[0] = a1;
        panel[1] = a2;
        uint256 positionId = _listWithPanel(panel, 2);

        (address[] memory members, uint256 threshold) = market.arbitrationPanel(positionId);
        assertEq(members.length, 2);
        assertEq(members[0], a1);
        assertEq(members[1], a2);
        assertEq(threshold, 2);
    }

    // --- Level 3: delivery claims and disputes -------------------------

    function test_claimDelivery_by_non_provider_reverts() public {
        uint256 positionId = _throughAccepted();

        vm.prank(buyer);
        vm.expectRevert(CapacityMarket.NotProvider.selector);
        market.claimDelivery(positionId, EVIDENCE_HASH);
    }

    function test_dispute_within_window_blocks_settlement_and_finalization() public {
        uint256 positionId = _throughDeliveryClaimed();

        vm.prank(buyer);
        market.dispute(positionId, REASON_HASH);

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Disputed));

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityMarket.WrongStatus.selector, CapacityMarket.Status.DeliveryClaimed, CapacityMarket.Status.Disputed
            )
        );
        market.settle(positionId);

        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityMarket.WrongStatus.selector, CapacityMarket.Status.DeliveryClaimed, CapacityMarket.Status.Disputed
            )
        );
        market.finalizeDelivery(positionId);
    }

    function test_resolveDisputeByTimeout_before_window_reverts() public {
        uint256 positionId = _throughDeliveryClaimed();
        vm.prank(buyer);
        market.dispute(positionId, REASON_HASH);

        vm.expectRevert(CapacityMarket.DisputeWindowOpen.selector);
        market.resolveDisputeByTimeout(positionId);
    }

    function test_resolveDisputeByTimeout_refunds_buyer_after_window() public {
        uint256 positionId = _throughDeliveryClaimed();
        vm.prank(buyer);
        market.dispute(positionId, REASON_HASH);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        uint256 buyerBalanceBefore = buyer.balance;
        market.resolveDisputeByTimeout(positionId); // callable by anyone

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Refunded));
        assertEq(buyer.balance, buyerBalanceBefore + PRICE + COLLATERAL);
    }

    function test_resolveDisputeByTimeout_twice_reverts() public {
        uint256 positionId = _throughDeliveryClaimed();
        vm.prank(buyer);
        market.dispute(positionId, REASON_HASH);
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
        market.resolveDisputeByTimeout(positionId);

        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityMarket.WrongStatus.selector, CapacityMarket.Status.Disputed, CapacityMarket.Status.Refunded
            )
        );
        market.resolveDisputeByTimeout(positionId);
    }

    function test_dispute_by_non_buyer_reverts() public {
        uint256 positionId = _throughDeliveryClaimed();

        vm.prank(otherBuyer);
        vm.expectRevert(CapacityMarket.NotBuyer.selector);
        market.dispute(positionId, REASON_HASH);
    }

    function test_dispute_after_window_closed_reverts() public {
        uint256 positionId = _throughDeliveryClaimed();

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        vm.prank(buyer);
        vm.expectRevert(CapacityMarket.DisputeWindowClosed.selector);
        market.dispute(positionId, REASON_HASH);
    }

    function test_finalizeDelivery_before_window_closes_reverts() public {
        uint256 positionId = _throughDeliveryClaimed();

        vm.expectRevert(CapacityMarket.DisputeWindowOpen.selector);
        market.finalizeDelivery(positionId);
    }

    function test_finalizeDelivery_pays_provider_after_silent_buyer() public {
        uint256 positionId = _throughDeliveryClaimed();

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        uint256 providerBalanceBefore = provider.balance;
        market.finalizeDelivery(positionId); // callable by anyone, including a stranger

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Settled));
        assertEq(provider.balance, providerBalanceBefore + PRICE + COLLATERAL);
    }

    function test_settle_during_window_does_not_require_waiting() public {
        uint256 positionId = _throughDeliveryClaimed();

        uint256 providerBalanceBefore = provider.balance;

        vm.prank(buyer);
        market.settle(positionId); // buyer approves immediately, no need to wait out the window

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Settled));
        assertEq(provider.balance, providerBalanceBefore + PRICE + COLLATERAL);
    }

    // --- Provider reputation tracking (pure aggregation, no routing effect) ---

    function _providerStats(address who)
        internal
        view
        returns (uint256 settledCount, uint256 defaultedCount, uint256 disputesLostCount, uint256 disputesTimedOutCount)
    {
        return market.providerStats(who);
    }

    function test_settle_records_settledCount() public {
        uint256 positionId = _throughDeliveryClaimed();

        vm.prank(buyer);
        market.settle(positionId);

        (uint256 settled, uint256 defaulted, uint256 lost, uint256 timedOut) = _providerStats(provider);
        assertEq(settled, 1);
        assertEq(defaulted, 0);
        assertEq(lost, 0);
        assertEq(timedOut, 0);
    }

    function test_finalizeDelivery_records_settledCount() public {
        uint256 positionId = _throughDeliveryClaimed();
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        market.finalizeDelivery(positionId);

        (uint256 settled,,,) = _providerStats(provider);
        assertEq(settled, 1);
    }

    function test_claimDefault_records_defaultedCount_not_settledCount() public {
        uint256 positionId = _listReserveActivate();
        vm.warp(block.timestamp + SLA + 1);

        market.claimDefault(positionId);

        (uint256 settled, uint256 defaulted,,) = _providerStats(provider);
        assertEq(settled, 0);
        assertEq(defaulted, 1);
    }

    /// @notice A timed-out dispute is a conservative default, never a proven
    /// fault — it must land in `disputesTimedOutCount`, not
    /// `disputesLostCount`. See `ProviderStats`'s NatSpec.
    function test_resolveDisputeByTimeout_records_disputesTimedOutCount_not_disputesLostCount() public {
        uint256 positionId = _throughDeliveryClaimed();
        vm.prank(buyer);
        market.dispute(positionId, REASON_HASH);
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        market.resolveDisputeByTimeout(positionId);

        (,, uint256 lost, uint256 timedOut) = _providerStats(provider);
        assertEq(lost, 0);
        assertEq(timedOut, 1);
    }

    function test_voteDispute_providerWins_records_settledCount() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](1);
        panel[0] = arbitrator;
        uint256 positionId = _listWithPanel(panel, 1);
        _toDisputed(positionId);

        vm.prank(arbitrator);
        market.voteDispute(positionId, true);

        (uint256 settled,, uint256 lost,) = _providerStats(provider);
        assertEq(settled, 1);
        assertEq(lost, 0);
    }

    function test_voteDispute_buyerWins_records_disputesLostCount_not_timedOut() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](1);
        panel[0] = arbitrator;
        uint256 positionId = _listWithPanel(panel, 1);
        _toDisputed(positionId);

        vm.prank(arbitrator);
        market.voteDispute(positionId, false);

        (uint256 settled,, uint256 lost, uint256 timedOut) = _providerStats(provider);
        assertEq(settled, 0);
        assertEq(lost, 1);
        assertEq(timedOut, 0);
    }

    /// @notice `expire()` reflects the buyer never reserving/activating, not
    /// the provider's performance — it must never move `providerStats`.
    function test_expire_does_not_affect_providerStats() public {
        uint256 positionId = _list();
        vm.warp(validUntil);
        market.expire(positionId);

        (uint256 settled, uint256 defaulted, uint256 lost, uint256 timedOut) = _providerStats(provider);
        assertEq(settled, 0);
        assertEq(defaulted, 0);
        assertEq(lost, 0);
        assertEq(timedOut, 0);
    }

    function test_providerStats_accumulate_across_multiple_positions() public {
        uint256 first = _throughDeliveryClaimed();
        vm.prank(buyer);
        market.settle(first);

        uint256 second = _listReserveActivate();
        vm.warp(block.timestamp + SLA + 1);
        market.claimDefault(second);

        (uint256 settled, uint256 defaulted,,) = _providerStats(provider);
        assertEq(settled, 1);
        assertEq(defaulted, 1);
    }
}
