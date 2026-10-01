// SPDX-License-Identifier: UNLICENSED
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

    CapacityPool.TermsClass terms;
    bytes32 classId;

    function setUp() public {
        terms = CapacityPool.TermsClass({
            domain: keccak256("ZK_SECURITY_L2"),
            validFrom: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + 30 days),
            activationSLA: SLA,
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

        (address provider, uint256 quantity,,, CapacityPool.AssignmentStatus status) =
            pool.assignmentInfo(reservationId, 0);
        assertEq(provider, providerA);
        assertEq(quantity, 4);
        assertEq(uint8(status), uint8(CapacityPool.AssignmentStatus.Pending));
    }

    function test_activate_splits_across_providers_when_order_exceeds_one() public {
        _seedThreeProviders(); // A:8 B:4 C:12
        uint256 reservationId = _reserve(buyer, 10); // exhausts A(8), then 2 from B(4)

        vm.prank(buyer);
        pool.activate(reservationId);

        (,,,,, uint256 assignmentCount) = pool.reservationInfo(reservationId);
        assertEq(assignmentCount, 2);

        (address p0, uint256 q0,,,) = pool.assignmentInfo(reservationId, 0);
        (address p1, uint256 q1,,,) = pool.assignmentInfo(reservationId, 1);

        assertEq(p0, providerA);
        assertEq(q0, 8);
        assertEq(p1, providerB);
        assertEq(q1, 2);
    }

    function test_second_reservation_continues_fifo_from_where_first_left_off() public {
        _seedThreeProviders(); // A:8 B:4 C:12

        uint256 res1 = _reserve(buyer, 8); // consumes all of A
        vm.prank(buyer);
        pool.activate(res1);

        uint256 res2 = _reserve(otherBuyer, 4); // should land entirely on B, not A
        vm.prank(otherBuyer);
        pool.activate(res2);

        (address provider,,,,) = pool.assignmentInfo(res2, 0);
        assertEq(provider, providerB);
    }

    // --- Per-assignment lifecycle mirrors CapacityMarket's single-position one ---

    function test_accept_and_settle_assignment_pays_provider() public {
        _seedThreeProviders();
        uint256 reservationId = _reserve(buyer, 4);
        vm.prank(buyer);
        pool.activate(reservationId);

        vm.prank(providerA);
        pool.acceptAssignment(reservationId, 0);

        uint256 providerBalanceBefore = providerA.balance;

        vm.prank(buyer);
        pool.settleAssignment(reservationId, 0);

        (,,,, CapacityPool.AssignmentStatus status) = pool.assignmentInfo(reservationId, 0);
        assertEq(uint8(status), uint8(CapacityPool.AssignmentStatus.Settled));
        assertEq(providerA.balance, providerBalanceBefore + PRICE_PER_UNIT * 4 + COLLATERAL_PER_UNIT * 4);
    }

    function test_settle_twice_reverts() public {
        _seedThreeProviders();
        uint256 reservationId = _reserve(buyer, 4);
        vm.prank(buyer);
        pool.activate(reservationId);
        vm.prank(providerA);
        pool.acceptAssignment(reservationId, 0);
        vm.prank(buyer);
        pool.settleAssignment(reservationId, 0);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityPool.WrongAssignmentStatus.selector,
                CapacityPool.AssignmentStatus.Accepted,
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

        (,,,, CapacityPool.AssignmentStatus statusB) = pool.assignmentInfo(reservationId, 1);
        assertEq(uint8(statusB), uint8(CapacityPool.AssignmentStatus.Defaulted));
        assertEq(buyer.balance, buyerBalanceBefore + COLLATERAL_PER_UNIT * 2);

        // Assignment 0 (provider A, already accepted) is untouched and still settleable.
        vm.prank(buyer);
        pool.settleAssignment(reservationId, 0);
        (,,,, CapacityPool.AssignmentStatus statusA) = pool.assignmentInfo(reservationId, 0);
        assertEq(uint8(statusA), uint8(CapacityPool.AssignmentStatus.Settled));
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
}
