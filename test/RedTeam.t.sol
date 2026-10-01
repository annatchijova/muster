// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CapacityMarket} from "../src/CapacityMarket.sol";
import {CapacityPool} from "../src/CapacityPool.sol";

/// @notice Regression suite for docs/SECURITY_AUDIT_2026-10-01.md's three
/// confirmed findings (F1, F2, F3). Originally written as PoCs asserting the
/// *vulnerable* behavior during the 2026-10-01 red-team pass; rewritten,
/// same day, to assert the *fixed* behavior once the patch landed — per the
/// audit's own recommendation not to leave a regression suite asserting a
/// bug. Keep these green forever: each one is a specific historical failure
/// this project already made once.
contract RedTeamTest is Test {
    CapacityMarket market;
    CapacityPool pool;

    address provider = makeAddr("provider");
    address buyer = makeAddr("buyer");

    bytes32 constant DOMAIN = keccak256("ZK_SECURITY_L2");
    uint256 constant PRICE = 10 ether;
    uint256 constant COLLATERAL = 1 ether;
    uint64 constant SLA = 30 minutes;
    uint64 constant DISPUTE_WINDOW = 2 days;
    address constant NO_ARBITRATOR = address(0);

    uint64 validFrom;
    uint64 validUntil;

    function setUp() public {
        validFrom = uint64(block.timestamp);
        validUntil = uint64(block.timestamp + 30 days);
        vm.deal(provider, 100 ether);
        vm.deal(buyer, 100 ether);
        market = new CapacityMarket();
        pool = new CapacityPool();
    }

    // === F1: claimDefault() must refund `price`, not just `collateral` =====

    function test_F1_fixed_claimDefault_refunds_price_and_collateral_in_CapacityMarket() public {
        vm.prank(provider);
        uint256 positionId = market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, NO_ARBITRATOR, PRICE
        );
        vm.prank(buyer);
        market.reserve{value: PRICE}(positionId);
        vm.prank(buyer);
        market.activate(positionId);

        vm.warp(block.timestamp + SLA + 1);

        uint256 buyerBefore = buyer.balance;
        market.claimDefault(positionId);

        (,,,,,,,,,,,,,, CapacityMarket.Status status) = market.positions(positionId);
        assertEq(uint8(status), uint8(CapacityMarket.Status.Defaulted));
        assertEq(buyer.balance, buyerBefore + PRICE + COLLATERAL, "buyer must recover both price and collateral");
        assertEq(address(market).balance, 0, "nothing should remain stuck in the contract");
    }

    function test_F1_fixed_claimAssignmentDefault_refunds_price_and_collateral_in_CapacityPool() public {
        CapacityPool.TermsClass memory terms = CapacityPool.TermsClass({
            domain: DOMAIN,
            validFrom: validFrom,
            validUntil: validUntil,
            activationSLA: SLA,
            disputeWindow: DISPUTE_WINDOW,
            arbitrator: NO_ARBITRATOR,
            pricePerUnit: PRICE,
            collateralPerUnit: COLLATERAL
        });
        vm.prank(provider);
        bytes32 id = pool.contribute{value: COLLATERAL * 4}(terms, 4);

        vm.prank(buyer);
        uint256 reservationId = pool.reserve{value: PRICE * 4}(id, 4);
        vm.prank(buyer);
        pool.activate(reservationId);

        vm.warp(block.timestamp + SLA + 1);

        uint256 buyerBefore = buyer.balance;
        pool.claimAssignmentDefault(reservationId, 0);

        (,, uint256 price, uint256 collateral,,, CapacityPool.AssignmentStatus status) =
            pool.assignmentInfo(reservationId, 0);
        assertEq(uint8(status), uint8(CapacityPool.AssignmentStatus.Defaulted));
        assertEq(buyer.balance, buyerBefore + price + collateral, "buyer must recover both price and collateral");
        assertEq(address(pool).balance, 0, "nothing should remain stuck in the contract");
    }

    // === F2/F3: a near-uint64-max duration can no longer even be listed ====

    function test_F2_F3_fixed_listCapacity_rejects_activationSLA_that_would_have_overflowed() public {
        vm.prank(provider);
        vm.expectRevert(CapacityMarket.DurationTooLong.selector);
        market.listCapacity{value: 0}(
            DOMAIN, 4, validFrom, validUntil, type(uint64).max, DISPUTE_WINDOW, NO_ARBITRATOR, PRICE
        );
    }

    function test_F2_F3_fixed_listCapacity_rejects_disputeWindow_that_would_have_overflowed() public {
        vm.prank(provider);
        vm.expectRevert(CapacityMarket.DurationTooLong.selector);
        market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, type(uint64).max, NO_ARBITRATOR, PRICE
        );
    }

    function test_F2_F3_fixed_pool_contribute_rejects_poisoned_durations() public {
        CapacityPool.TermsClass memory poisonedSLA = CapacityPool.TermsClass({
            domain: DOMAIN,
            validFrom: validFrom,
            validUntil: validUntil,
            activationSLA: type(uint64).max,
            disputeWindow: DISPUTE_WINDOW,
            arbitrator: NO_ARBITRATOR,
            pricePerUnit: PRICE,
            collateralPerUnit: COLLATERAL
        });
        vm.prank(provider);
        vm.expectRevert(CapacityPool.DurationTooLong.selector);
        pool.contribute{value: COLLATERAL * 4}(poisonedSLA, 4);

        CapacityPool.TermsClass memory poisonedDisputeWindow = poisonedSLA;
        poisonedDisputeWindow.activationSLA = SLA;
        poisonedDisputeWindow.disputeWindow = type(uint64).max;
        vm.prank(provider);
        vm.expectRevert(CapacityPool.DurationTooLong.selector);
        pool.contribute{value: COLLATERAL * 4}(poisonedDisputeWindow, 4);
    }

    /// @notice With the bound in place, the full F2 attack sequence (list
    /// with 0 collateral + poison activationSLA, reserve, fail to activate,
    /// collect price via expire) cannot even begin — it fails at the first
    /// step. This test documents that the attack's entry point is closed,
    /// not just that the overflow itself no longer happens in isolation.
    function test_F2_fixed_full_attack_sequence_blocked_at_listing() public {
        vm.prank(provider);
        vm.expectRevert(CapacityMarket.DurationTooLong.selector);
        market.listCapacity{value: 0}(
            DOMAIN, 4, validFrom, validUntil, type(uint64).max, DISPUTE_WINDOW, NO_ARBITRATOR, PRICE
        );
        // No position was ever created: nextPositionId did not advance.
        assertEq(market.nextPositionId(), 0);
    }
}
