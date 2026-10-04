// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CapacityPool} from "../src/CapacityPool.sol";

contract CapacityPoolTest is Test {
    CapacityPool pool;

    address providerA = makeAddr("providerA");
    address providerB = makeAddr("providerB");
    address providerC = makeAddr("providerC");
    address buyer = makeAddr("buyer");
    address otherBuyer = makeAddr("otherBuyer");

    uint256 constant PRICE_PER_UNIT = 1 ether;
    uint256 constant COLLATERAL_PER_UNIT = 0.25 ether;
    uint64 constant SLA = 30 minutes;
    uint64 constant DISPUTE_WINDOW = 2 days;
    bytes32 constant EVIDENCE_HASH = keccak256("incident report #1");
    bytes32 constant REASON_HASH = keccak256("work did not match the incident report");

    CapacityPool.TermsClass terms;
    bytes32 classId;
    address[] NO_PANEL;

    function setUp() public {
        terms = CapacityPool.TermsClass({
            domain: keccak256("ZK_SECURITY_L2"),
            validFrom: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + 30 days),
            activationSLA: SLA,
            disputeWindow: DISPUTE_WINDOW,
            panelMembers: NO_PANEL,
            panelThreshold: 0,
            pricePerUnit: PRICE_PER_UNIT,
            collateralPerUnit: COLLATERAL_PER_UNIT
        });

        pool = new CapacityPool();
        classId = pool.classId(terms);

        address[3] memory providers = [providerA, providerB, providerC];
        for (uint256 i = 0; i < providers.length; i++) {
            vm.deal(providers[i], 100 ether);
        }
        vm.deal(buyer, 100 ether);
        vm.deal(otherBuyer, 100 ether);
    }

    function _contribute(address provider, uint256 quantity) internal {
        vm.prank(provider);
        pool.contribute{value: COLLATERAL_PER_UNIT * quantity}(terms, quantity);
    }

    // 8h + 4h + 12h, matching the project's own worked example.
    function _seedThreeProviders() internal {
        _contribute(providerA, 8);
        _contribute(providerB, 4);
        _contribute(providerC, 12);
    }

    function _reserve(address who, uint256 quantity) internal returns (uint256 reservationId) {
        vm.prank(who);
        reservationId = pool.reserve{value: PRICE_PER_UNIT * quantity}(classId, quantity);
    }

    function _assignmentStatus(uint256 reservationId, uint256 index)
        internal
        view
        returns (CapacityPool.AssignmentStatus status)
    {
        (,,,,,, status) = pool.assignmentInfo(reservationId, index);
    }

    function _assignmentProvider(uint256 reservationId, uint256 index) internal view returns (address provider) {
        (provider,,,,,,) = pool.assignmentInfo(reservationId, index);
    }

    function _assignmentQuantity(uint256 reservationId, uint256 index) internal view returns (uint256 quantity) {
        (, quantity,,,,,) = pool.assignmentInfo(reservationId, index);
    }

    function _throughAcceptedAssignment(uint256 quantity, address provider)
        internal
        returns (uint256 reservationId)
    {
        reservationId = _reserve(buyer, quantity);
        vm.prank(buyer);
        pool.activate(reservationId);
        vm.prank(provider);
        pool.acceptAssignment(reservationId, 0);
    }

    function _throughDeliveryClaimedAssignment(uint256 quantity, address provider)
        internal
        returns (uint256 reservationId)
    {
        reservationId = _throughAcceptedAssignment(quantity, provider);
        vm.prank(provider);
        pool.claimAssignmentDelivery(reservationId, 0, EVIDENCE_HASH);
    }

    // --- Fungibility: pooled capacity, no provider chosen at reserve time ---

    function test_pool_aggregates_multiple_providers() public {
        _seedThreeProviders();

        (, uint256 totalCommitted, uint256 available,) = pool.poolInfo(classId);
        assertEq(totalCommitted, 24);
        assertEq(available, 24);
    }

    function test_reserve_does_not_require_naming_a_provider() public {
        _seedThreeProviders();
        uint256 reservationId = _reserve(buyer, 4);

        (, address resBuyer, uint256 quantity,, CapacityPool.ReservationStatus status, uint256 assignmentCount) =
            pool.reservationInfo(reservationId);

        assertEq(resBuyer, buyer);
        assertEq(quantity, 4);
        assertEq(uint8(status), uint8(CapacityPool.ReservationStatus.Reserved));
        assertEq(assignmentCount, 0); // routing happens at activate(), not reserve()
    }

    // --- Invariant: reserved + assigned <= committed capacity --------------

    function test_reserve_more_than_available_reverts() public {
        _seedThreeProviders(); // 24 total

        vm.prank(buyer);
        vm.expectRevert(CapacityPool.InsufficientAvailableCapacity.selector);
        pool.reserve{value: PRICE_PER_UNIT * 25}(classId, 25);
    }

    function test_two_buyers_cannot_jointly_oversubscribe_the_pool() public {
        _seedThreeProviders(); // 24 total

        _reserve(buyer, 20);

        vm.prank(otherBuyer);
        vm.expectRevert(CapacityPool.InsufficientAvailableCapacity.selector);
        pool.reserve{value: PRICE_PER_UNIT * 5}(classId, 5);
    }

    function test_contribute_wrong_collateral_reverts() public {
        vm.prank(providerA);
        vm.expectRevert(CapacityPool.WrongValue.selector);
        pool.contribute{value: 1 wei}(terms, 8);
    }

    // --- Duration bound (SECURITY_AUDIT 2026-10-01 findings F2/F3) ----------

    function test_contribute_rejects_activationSLA_above_MAX_DURATION() public {
        CapacityPool.TermsClass memory poisoned = terms;
        poisoned.activationSLA = pool.MAX_DURATION() + 1;

        vm.prank(providerA);
        vm.expectRevert(CapacityPool.DurationTooLong.selector);
        pool.contribute{value: COLLATERAL_PER_UNIT * 8}(poisoned, 8);
    }

    function test_contribute_rejects_disputeWindow_above_MAX_DURATION() public {
        CapacityPool.TermsClass memory poisoned = terms;
        poisoned.disputeWindow = pool.MAX_DURATION() + 1;

        vm.prank(providerA);
        vm.expectRevert(CapacityPool.DurationTooLong.selector);
        pool.contribute{value: COLLATERAL_PER_UNIT * 8}(poisoned, 8);
    }

    function test_reserve_wrong_price_reverts() public {
        _seedThreeProviders();

        vm.prank(buyer);
        vm.expectRevert(CapacityPool.WrongValue.selector);
        pool.reserve{value: PRICE_PER_UNIT * 4 - 1}(classId, 4);
    }

    // --- Routing: FIFO assignment across providers at activation ------------

    function test_activate_assigns_fifo_from_single_provider_when_it_covers_the_order() public {
        _seedThreeProviders(); // A:8 B:4 C:12
        uint256 reservationId = _reserve(buyer, 4);

        vm.prank(buyer);
        pool.activate(reservationId);

        (,,,,, uint256 assignmentCount) = pool.reservationInfo(reservationId);
        assertEq(assignmentCount, 1);

        assertEq(_assignmentProvider(reservationId, 0), providerA);
        assertEq(_assignmentQuantity(reservationId, 0), 4);
        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Pending));
    }

    function test_activate_splits_across_providers_when_order_exceeds_one() public {
        _seedThreeProviders(); // A:8 B:4 C:12
        uint256 reservationId = _reserve(buyer, 10); // exhausts A(8), then 2 from B(4)

        vm.prank(buyer);
        pool.activate(reservationId);

        (,,,,, uint256 assignmentCount) = pool.reservationInfo(reservationId);
        assertEq(assignmentCount, 2);

        assertEq(_assignmentProvider(reservationId, 0), providerA);
        assertEq(_assignmentQuantity(reservationId, 0), 8);
        assertEq(_assignmentProvider(reservationId, 1), providerB);
        assertEq(_assignmentQuantity(reservationId, 1), 2);
    }

    function test_second_reservation_continues_fifo_from_where_first_left_off() public {
        _seedThreeProviders(); // A:8 B:4 C:12

        uint256 res1 = _reserve(buyer, 8); // consumes all of A
        vm.prank(buyer);
        pool.activate(res1);

        uint256 res2 = _reserve(otherBuyer, 4); // should land entirely on B, not A
        vm.prank(otherBuyer);
        pool.activate(res2);

        assertEq(_assignmentProvider(res2, 0), providerB);
    }

    // --- Per-assignment lifecycle mirrors CapacityMarket's single-position one ---

    function test_accept_claim_and_settle_assignment_pays_provider() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);

        uint256 providerBalanceBefore = providerA.balance;

        vm.prank(buyer);
        pool.settleAssignment(reservationId, 0);

        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Settled));
        assertEq(providerA.balance, providerBalanceBefore + PRICE_PER_UNIT * 4 + COLLATERAL_PER_UNIT * 4);
    }

    function test_settle_before_claimAssignmentDelivery_reverts() public {
        _seedThreeProviders();
        uint256 reservationId = _throughAcceptedAssignment(4, providerA);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityPool.WrongAssignmentStatus.selector,
                CapacityPool.AssignmentStatus.DeliveryClaimed,
                CapacityPool.AssignmentStatus.Accepted
            )
        );
        pool.settleAssignment(reservationId, 0);
    }

    function test_settle_twice_reverts() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);
        vm.prank(buyer);
        pool.settleAssignment(reservationId, 0);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityPool.WrongAssignmentStatus.selector,
                CapacityPool.AssignmentStatus.DeliveryClaimed,
                CapacityPool.AssignmentStatus.Settled
            )
        );
        pool.settleAssignment(reservationId, 0);
    }

    // --- Partial default: one provider's miss does not sink the others ------

    function test_one_provider_default_does_not_block_other_assignments() public {
        _seedThreeProviders(); // A:8 B:4 C:12
        uint256 reservationId = _reserve(buyer, 10); // A:8 (idx 0), B:2 (idx 1)
        vm.prank(buyer);
        pool.activate(reservationId);

        // Provider A accepts, provider B misses the SLA.
        vm.prank(providerA);
        pool.acceptAssignment(reservationId, 0);

        vm.warp(block.timestamp + SLA + 1);

        uint256 buyerBalanceBefore = buyer.balance;
        pool.claimAssignmentDefault(reservationId, 1);

        assertEq(uint8(_assignmentStatus(reservationId, 1)), uint8(CapacityPool.AssignmentStatus.Defaulted));
        // No service rendered for this slice: buyer gets both the penalty
        // (collateral) and a full refund of this slice's price. See
        // SECURITY_AUDIT 2026-10-01 finding F1 — price used to be stuck.
        assertEq(buyer.balance, buyerBalanceBefore + PRICE_PER_UNIT * 2 + COLLATERAL_PER_UNIT * 2);

        // Assignment 0 (provider A, already accepted) is untouched and still settleable.
        vm.prank(providerA);
        pool.claimAssignmentDelivery(reservationId, 0, EVIDENCE_HASH);
        vm.prank(buyer);
        pool.settleAssignment(reservationId, 0);
        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Settled));
    }

    function test_claimAssignmentDefault_before_deadline_reverts() public {
        _seedThreeProviders();
        uint256 reservationId = _reserve(buyer, 4);
        vm.prank(buyer);
        pool.activate(reservationId);

        vm.expectRevert(CapacityPool.DeadlineNotPassed.selector);
        pool.claimAssignmentDefault(reservationId, 0);
    }

    function test_acceptAssignment_by_wrong_provider_reverts() public {
        _seedThreeProviders();
        uint256 reservationId = _reserve(buyer, 4);
        vm.prank(buyer);
        pool.activate(reservationId);

        vm.prank(providerB);
        vm.expectRevert(CapacityPool.NotProvider.selector);
        pool.acceptAssignment(reservationId, 0);
    }

    // --- Level 3: delivery claims and disputes, per assignment --------------

    function test_claimAssignmentDelivery_by_non_provider_reverts() public {
        _seedThreeProviders();
        uint256 reservationId = _throughAcceptedAssignment(4, providerA);

        vm.prank(providerB);
        vm.expectRevert(CapacityPool.NotProvider.selector);
        pool.claimAssignmentDelivery(reservationId, 0, EVIDENCE_HASH);
    }

    function test_disputeAssignment_within_window_blocks_settlement_and_finalization() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);

        vm.prank(buyer);
        pool.disputeAssignment(reservationId, 0, REASON_HASH);

        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Disputed));

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityPool.WrongAssignmentStatus.selector,
                CapacityPool.AssignmentStatus.DeliveryClaimed,
                CapacityPool.AssignmentStatus.Disputed
            )
        );
        pool.settleAssignment(reservationId, 0);

        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityPool.WrongAssignmentStatus.selector,
                CapacityPool.AssignmentStatus.DeliveryClaimed,
                CapacityPool.AssignmentStatus.Disputed
            )
        );
        pool.finalizeAssignmentDelivery(reservationId, 0);
    }

    function test_disputeAssignment_by_non_buyer_reverts() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);

        vm.prank(otherBuyer);
        vm.expectRevert(CapacityPool.NotBuyer.selector);
        pool.disputeAssignment(reservationId, 0, REASON_HASH);
    }

    function test_finalizeAssignmentDelivery_before_window_closes_reverts() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);

        vm.expectRevert(CapacityPool.DisputeWindowOpen.selector);
        pool.finalizeAssignmentDelivery(reservationId, 0);
    }

    function test_finalizeAssignmentDelivery_pays_provider_after_silent_buyer() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        uint256 providerBalanceBefore = providerA.balance;
        pool.finalizeAssignmentDelivery(reservationId, 0); // callable by anyone

        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Settled));
        assertEq(providerA.balance, providerBalanceBefore + PRICE_PER_UNIT * 4 + COLLATERAL_PER_UNIT * 4);
    }

    function test_one_assignment_dispute_does_not_block_sibling_finalization() public {
        _seedThreeProviders(); // A:8 B:4 C:12
        uint256 reservationId = _reserve(buyer, 10); // A:8 (idx 0), B:2 (idx 1)
        vm.prank(buyer);
        pool.activate(reservationId);

        vm.prank(providerA);
        pool.acceptAssignment(reservationId, 0);
        vm.prank(providerB);
        pool.acceptAssignment(reservationId, 1);

        vm.prank(providerA);
        pool.claimAssignmentDelivery(reservationId, 0, EVIDENCE_HASH);
        vm.prank(providerB);
        pool.claimAssignmentDelivery(reservationId, 1, EVIDENCE_HASH);

        vm.prank(buyer);
        pool.disputeAssignment(reservationId, 0, REASON_HASH); // buyer disputes A's slice only

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        // B's slice was never disputed: it finalizes normally.
        pool.finalizeAssignmentDelivery(reservationId, 1);
        assertEq(uint8(_assignmentStatus(reservationId, 1)), uint8(CapacityPool.AssignmentStatus.Settled));
        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Disputed));
    }

    function test_resolveAssignmentDisputeByTimeout_before_window_reverts() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);
        vm.prank(buyer);
        pool.disputeAssignment(reservationId, 0, REASON_HASH);

        vm.expectRevert(CapacityPool.DisputeWindowOpen.selector);
        pool.resolveAssignmentDisputeByTimeout(reservationId, 0);
    }

    function test_resolveAssignmentDisputeByTimeout_refunds_buyer_after_window() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);
        vm.prank(buyer);
        pool.disputeAssignment(reservationId, 0, REASON_HASH);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        uint256 buyerBalanceBefore = buyer.balance;
        pool.resolveAssignmentDisputeByTimeout(reservationId, 0); // callable by anyone

        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Refunded));
        assertEq(buyer.balance, buyerBalanceBefore + PRICE_PER_UNIT * 4 + COLLATERAL_PER_UNIT * 4);
    }

    // --- Level 4/5: arbitration panels (single arbitrator is the M=1,N=1 case) ---

    function _throughDisputedAssignmentWithPanel(address[] memory panelMembers, uint256 threshold)
        internal
        returns (uint256 reservationId)
    {
        CapacityPool.TermsClass memory panelTerms = terms;
        panelTerms.panelMembers = panelMembers;
        panelTerms.panelThreshold = threshold;

        vm.prank(providerA);
        bytes32 id = pool.contribute{value: COLLATERAL_PER_UNIT * 4}(panelTerms, 4);

        vm.prank(buyer);
        reservationId = pool.reserve{value: PRICE_PER_UNIT * 4}(id, 4);
        vm.prank(buyer);
        pool.activate(reservationId);
        vm.prank(providerA);
        pool.acceptAssignment(reservationId, 0);
        vm.prank(providerA);
        pool.claimAssignmentDelivery(reservationId, 0, EVIDENCE_HASH);
        vm.prank(buyer);
        pool.disputeAssignment(reservationId, 0, REASON_HASH);
    }

    function test_contribute_rejects_oversized_panel() public {
        address[] memory tooMany = new address[](pool.MAX_PANEL_SIZE() + 1);
        for (uint256 i = 0; i < tooMany.length; i++) {
            tooMany[i] = makeAddr(string.concat("member", vm.toString(i)));
        }
        CapacityPool.TermsClass memory badTerms = terms;
        badTerms.panelMembers = tooMany;
        badTerms.panelThreshold = 1;

        vm.prank(providerA);
        vm.expectRevert(CapacityPool.InvalidPanel.selector);
        pool.contribute{value: COLLATERAL_PER_UNIT * 4}(badTerms, 4);
    }

    function test_contribute_rejects_threshold_above_panel_size() public {
        address[] memory panel = new address[](2);
        panel[0] = makeAddr("m0");
        panel[1] = makeAddr("m1");
        CapacityPool.TermsClass memory badTerms = terms;
        badTerms.panelMembers = panel;
        badTerms.panelThreshold = 3;

        vm.prank(providerA);
        vm.expectRevert(CapacityPool.InvalidPanel.selector);
        pool.contribute{value: COLLATERAL_PER_UNIT * 4}(badTerms, 4);
    }

    /// @notice A single trusted arbitrator (Level 4) is exactly the
    /// panelMembers.length == 1, panelThreshold == 1 case. One vote settles it.
    function test_voteAssignmentDispute_single_member_panel_settles_like_Level4_arbitrator() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](1);
        panel[0] = arbitrator;
        uint256 reservationId = _throughDisputedAssignmentWithPanel(panel, 1);

        uint256 providerBefore = providerA.balance;
        vm.prank(arbitrator);
        pool.voteAssignmentDispute(reservationId, 0, true);

        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Settled));
        assertEq(providerA.balance, providerBefore + PRICE_PER_UNIT * 4 + COLLATERAL_PER_UNIT * 4);
    }

    function test_voteAssignmentDispute_rules_for_buyer() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](1);
        panel[0] = arbitrator;
        uint256 reservationId = _throughDisputedAssignmentWithPanel(panel, 1);

        uint256 buyerBefore = buyer.balance;
        vm.prank(arbitrator);
        pool.voteAssignmentDispute(reservationId, 0, false);

        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Refunded));
        assertEq(buyer.balance, buyerBefore + PRICE_PER_UNIT * 4 + COLLATERAL_PER_UNIT * 4);
    }

    function test_voteAssignmentDispute_by_non_member_reverts() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](1);
        panel[0] = arbitrator;
        uint256 reservationId = _throughDisputedAssignmentWithPanel(panel, 1);

        vm.prank(buyer); // not a panel member
        vm.expectRevert(CapacityPool.NotArbitrator.selector);
        pool.voteAssignmentDispute(reservationId, 0, true);
    }

    /// @notice A class that opted out of arbitration (empty panel, i.e.
    /// `terms` as seeded by setUp/_seedThreeProviders) must fall back to
    /// exact Level 3 behavior.
    function test_voteAssignmentDispute_reverts_for_everyone_when_panel_is_empty() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);
        vm.prank(buyer);
        pool.disputeAssignment(reservationId, 0, REASON_HASH);

        vm.prank(buyer);
        vm.expectRevert(CapacityPool.NotArbitrator.selector);
        pool.voteAssignmentDispute(reservationId, 0, true);

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
        uint256 buyerBefore = buyer.balance;
        pool.resolveAssignmentDisputeByTimeout(reservationId, 0);
        assertEq(buyer.balance, buyerBefore + PRICE_PER_UNIT * 4 + COLLATERAL_PER_UNIT * 4);
    }

    /// @notice The real M-of-N case: a 3-member panel with threshold 2.
    function test_voteAssignmentDispute_three_member_panel_needs_two_matching_votes() public {
        address a1 = makeAddr("a1");
        address a2 = makeAddr("a2");
        address a3 = makeAddr("a3");
        address[] memory panel = new address[](3);
        panel[0] = a1;
        panel[1] = a2;
        panel[2] = a3;
        uint256 reservationId = _throughDisputedAssignmentWithPanel(panel, 2);

        vm.prank(a1);
        pool.voteAssignmentDispute(reservationId, 0, true); // 1 vote: not enough
        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Disputed));

        vm.prank(a2);
        pool.voteAssignmentDispute(reservationId, 0, false); // split 1-1: still not enough
        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Disputed));

        uint256 buyerBefore = buyer.balance;
        vm.prank(a3);
        pool.voteAssignmentDispute(reservationId, 0, false); // 2 votes for buyer: threshold reached

        assertEq(uint8(_assignmentStatus(reservationId, 0)), uint8(CapacityPool.AssignmentStatus.Refunded));
        assertEq(buyer.balance, buyerBefore + PRICE_PER_UNIT * 4 + COLLATERAL_PER_UNIT * 4);
    }

    function test_voteAssignmentDispute_member_cannot_vote_twice() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](3);
        panel[0] = arbitrator;
        panel[1] = makeAddr("a2");
        panel[2] = makeAddr("a3");
        uint256 reservationId = _throughDisputedAssignmentWithPanel(panel, 2);

        vm.prank(arbitrator);
        pool.voteAssignmentDispute(reservationId, 0, true);

        vm.prank(arbitrator);
        vm.expectRevert(CapacityPool.AlreadyVoted.selector);
        pool.voteAssignmentDispute(reservationId, 0, true);
    }

    // --- Transfer and expiration mirror CapacityMarket's semantics ----------

    function test_transferReservation_changes_buyer_only() public {
        _seedThreeProviders();
        uint256 reservationId = _reserve(buyer, 4);

        vm.prank(buyer);
        pool.transferReservation(reservationId, otherBuyer);

        (, address resBuyer, uint256 quantity,,,) = pool.reservationInfo(reservationId);
        assertEq(resBuyer, otherBuyer);
        assertEq(quantity, 4);
    }

    function test_expireReservation_returns_quantity_and_refunds_buyer() public {
        _seedThreeProviders();
        uint256 reservationId = _reserve(buyer, 4);

        (,, uint256 availableBefore,) = pool.poolInfo(classId);
        assertEq(availableBefore, 20);

        uint256 buyerBalanceBefore = buyer.balance;
        vm.warp(terms.validUntil);
        pool.expireReservation(reservationId);

        (,, uint256 availableAfter,) = pool.poolInfo(classId);
        assertEq(availableAfter, 24);
        // Unlike CapacityMarket.expire(), the pool refunds the buyer: no
        // provider was ever committed to this reservation, so nobody else
        // has a non-arbitrary claim on the price. See expireReservation()'s
        // NatSpec.
        assertEq(buyer.balance, buyerBalanceBefore + PRICE_PER_UNIT * 4);
    }

    // --- Withdrawing collateral behind capacity nobody ever consumed -------

    function test_withdrawContribution_after_window_close_pays_provider() public {
        _contribute(providerA, 8); // never reserved at all

        vm.warp(terms.validUntil);

        uint256 balanceBefore = providerA.balance;
        vm.prank(providerA);
        pool.withdrawContribution(classId, 0);

        assertEq(providerA.balance, balanceBefore + COLLATERAL_PER_UNIT * 8);

        (, uint256 remaining) = pool.contributionInfo(classId, 0);
        assertEq(remaining, 0);
    }

    function test_withdrawContribution_before_window_close_reverts() public {
        _contribute(providerA, 8);

        vm.expectRevert(CapacityPool.WindowNotYetClosed.selector);
        pool.withdrawContribution(classId, 0);
    }

    function test_withdrawContribution_twice_reverts() public {
        _contribute(providerA, 8);
        vm.warp(terms.validUntil);

        vm.prank(providerA);
        pool.withdrawContribution(classId, 0);

        vm.prank(providerA);
        vm.expectRevert(CapacityPool.WrongValue.selector);
        pool.withdrawContribution(classId, 0);
    }

    function test_withdrawContribution_by_non_provider_reverts() public {
        _contribute(providerA, 8);
        vm.warp(terms.validUntil);

        vm.prank(providerB);
        vm.expectRevert(CapacityPool.NotProvider.selector);
        pool.withdrawContribution(classId, 0);
    }

    function test_withdrawContribution_after_partial_assignment_pays_only_remaining() public {
        _seedThreeProviders(); // A:8 B:4 C:12
        uint256 reservationId = _reserve(buyer, 10); // consumes A:8 fully, B:2 of 4
        vm.prank(buyer);
        pool.activate(reservationId);

        vm.warp(terms.validUntil);

        // Provider B contributed 4, 2 were assigned, 2 remain unassigned.
        uint256 balanceBefore = providerB.balance;
        vm.prank(providerB);
        pool.withdrawContribution(classId, 1); // index 1 == providerB's contribution
        assertEq(providerB.balance, balanceBefore + COLLATERAL_PER_UNIT * 2);
    }

    function test_expired_capacity_is_reservable_again() public {
        _seedThreeProviders();
        uint256 reservationId = _reserve(buyer, 24); // takes everything

        vm.warp(terms.validUntil);
        pool.expireReservation(reservationId);

        // A brand-new reservation against the same (now-reopened) window
        // would fail the window check, but the accounting invariant — the
        // capacity itself is uncommitted again — is what this test asserts.
        (,, uint256 available,) = pool.poolInfo(classId);
        assertEq(available, 24);
    }

    function test_activate_twice_reverts() public {
        _seedThreeProviders();
        uint256 reservationId = _reserve(buyer, 4);
        vm.prank(buyer);
        pool.activate(reservationId);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityPool.WrongReservationStatus.selector,
                CapacityPool.ReservationStatus.Reserved,
                CapacityPool.ReservationStatus.Activated
            )
        );
        pool.activate(reservationId);
    }

    // --- Provider reputation tracking (pure aggregation, no routing effect) ---

    function _providerStats(address who)
        internal
        view
        returns (uint256 settledCount, uint256 defaultedCount, uint256 disputesLostCount, uint256 disputesTimedOutCount)
    {
        return pool.providerStats(who);
    }

    function test_settleAssignment_records_settledCount() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);

        vm.prank(buyer);
        pool.settleAssignment(reservationId, 0);

        (uint256 settled, uint256 defaulted, uint256 lost, uint256 timedOut) = _providerStats(providerA);
        assertEq(settled, 1);
        assertEq(defaulted, 0);
        assertEq(lost, 0);
        assertEq(timedOut, 0);
    }

    function test_finalizeAssignmentDelivery_records_settledCount() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        pool.finalizeAssignmentDelivery(reservationId, 0);

        (uint256 settled,,,) = _providerStats(providerA);
        assertEq(settled, 1);
    }

    function test_claimAssignmentDefault_records_defaultedCount_not_settledCount() public {
        _seedThreeProviders();
        uint256 reservationId = _reserve(buyer, 4);
        vm.prank(buyer);
        pool.activate(reservationId);
        vm.warp(block.timestamp + SLA + 1);

        pool.claimAssignmentDefault(reservationId, 0);

        (uint256 settled, uint256 defaulted,,) = _providerStats(providerA);
        assertEq(settled, 0);
        assertEq(defaulted, 1);
    }

    /// @notice A timed-out dispute is a conservative default, never a proven
    /// fault — mirrors `CapacityMarket`'s equivalent test. See
    /// `CapacityPool.ProviderStats`'s NatSpec.
    function test_resolveAssignmentDisputeByTimeout_records_disputesTimedOutCount_not_disputesLostCount() public {
        _seedThreeProviders();
        uint256 reservationId = _throughDeliveryClaimedAssignment(4, providerA);
        vm.prank(buyer);
        pool.disputeAssignment(reservationId, 0, REASON_HASH);
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        pool.resolveAssignmentDisputeByTimeout(reservationId, 0);

        (,, uint256 lost, uint256 timedOut) = _providerStats(providerA);
        assertEq(lost, 0);
        assertEq(timedOut, 1);
    }

    function test_voteAssignmentDispute_providerWins_records_settledCount() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](1);
        panel[0] = arbitrator;
        uint256 reservationId = _throughDisputedAssignmentWithPanel(panel, 1);

        vm.prank(arbitrator);
        pool.voteAssignmentDispute(reservationId, 0, true);

        (uint256 settled,, uint256 lost,) = _providerStats(providerA);
        assertEq(settled, 1);
        assertEq(lost, 0);
    }

    function test_voteAssignmentDispute_buyerWins_records_disputesLostCount_not_timedOut() public {
        address arbitrator = makeAddr("arbitrator");
        address[] memory panel = new address[](1);
        panel[0] = arbitrator;
        uint256 reservationId = _throughDisputedAssignmentWithPanel(panel, 1);

        vm.prank(arbitrator);
        pool.voteAssignmentDispute(reservationId, 0, false);

        (uint256 settled,, uint256 lost, uint256 timedOut) = _providerStats(providerA);
        assertEq(settled, 0);
        assertEq(lost, 1);
        assertEq(timedOut, 0);
    }

    /// @notice `expireReservation` reflects the reservation lapsing unused,
    /// not the provider's performance — it must never move `providerStats`.
    function test_expireReservation_does_not_affect_providerStats() public {
        _seedThreeProviders();
        uint256 reservationId = _reserve(buyer, 4);
        vm.warp(block.timestamp + 30 days);

        pool.expireReservation(reservationId);

        (uint256 settled, uint256 defaulted, uint256 lost, uint256 timedOut) = _providerStats(providerA);
        assertEq(settled, 0);
        assertEq(defaulted, 0);
        assertEq(lost, 0);
        assertEq(timedOut, 0);
    }

    function test_providerStats_accumulate_across_multiple_assignments() public {
        _seedThreeProviders();

        uint256 first = _throughDeliveryClaimedAssignment(4, providerA);
        vm.prank(buyer);
        pool.settleAssignment(first, 0);

        uint256 second = _reserve(buyer, 4);
        vm.prank(buyer);
        pool.activate(second);
        vm.warp(block.timestamp + SLA + 1);
        pool.claimAssignmentDefault(second, 0);

        (uint256 settled, uint256 defaulted,,) = _providerStats(providerA);
        assertEq(settled, 1);
        assertEq(defaulted, 1);
    }
}
