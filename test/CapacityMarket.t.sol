// SPDX-License-Identifier: UNLICENSED
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

    uint64 validFrom;
    uint64 validUntil;

    function setUp() public {
        validFrom = uint64(block.timestamp);
        validUntil = uint64(block.timestamp + 30 days);

        vm.deal(provider, 10 ether);
        vm.deal(buyer, 10 ether);
        vm.deal(otherBuyer, 10 ether);

        market = new CapacityMarket();
    }

    function _list() internal returns (uint256 positionId) {
        vm.prank(provider);
        positionId = market.listCapacity{value: COLLATERAL}(DOMAIN, 4, validFrom, validUntil, SLA, PRICE);
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

    // --- Happy path -------------------------------------------------

    function test_fullLifecycle_settles_and_pays_provider() public {
        uint256 positionId = _listReserveActivate();

        vm.prank(provider);
        market.acceptActivation(positionId);

        uint256 providerBalanceBefore = provider.balance;

        vm.prank(buyer);
        market.settle(positionId);

        (,,,,,,,,,, CapacityMarket.Status status) = market.positions(positionId);
        assertEq(uint8(status), uint8(CapacityMarket.Status.Settled));
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
        uint256 positionId = _listReserveActivate();

        vm.prank(provider);
        market.acceptActivation(positionId);

        vm.prank(buyer);
        market.settle(positionId);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(CapacityMarket.WrongStatus.selector, CapacityMarket.Status.Accepted, CapacityMarket.Status.Settled)
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
            address currentBuyer,
            ,
            uint256 collateral,
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

        (,,,,,,,,,, CapacityMarket.Status status) = market.positions(positionId);
        assertEq(uint8(status), uint8(CapacityMarket.Status.Activated));
    }

    // --- Timeout / default path: collateral compensates the buyer -------

    function test_claimDefault_pays_collateral_to_buyer_after_SLA_miss() public {
        uint256 positionId = _listReserveActivate();

        vm.warp(block.timestamp + SLA + 1);

        uint256 buyerBalanceBefore = buyer.balance;
        market.claimDefault(positionId);

        (,,,,,,,,,, CapacityMarket.Status status) = market.positions(positionId);
        assertEq(uint8(status), uint8(CapacityMarket.Status.Defaulted));
        assertEq(buyer.balance, buyerBalanceBefore + COLLATERAL);
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

    function test_expire_unused_reservation_returns_collateral_to_provider() public {
        uint256 positionId = _listAndReserve();

        vm.warp(validUntil);

        uint256 providerBalanceBefore = provider.balance;
        market.expire(positionId);

        (,,,,,,,,,, CapacityMarket.Status status) = market.positions(positionId);
        assertEq(uint8(status), uint8(CapacityMarket.Status.Expired));
        assertEq(provider.balance, providerBalanceBefore + COLLATERAL);
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
        market.listCapacity(DOMAIN, 4, validUntil, validFrom, SLA, PRICE);
    }
}
