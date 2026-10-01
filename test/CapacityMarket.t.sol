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
    uint64 constant DISPUTE_WINDOW = 2 days;
    bytes32 constant EVIDENCE_HASH = keccak256("incident report #1");
    bytes32 constant REASON_HASH = keccak256("work did not match the incident report");
    address constant NO_ARBITRATOR = address(0);

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

    function _status(uint256 positionId) internal view returns (CapacityMarket.Status status) {
        (,,,,,,,,,,,,,, status) = market.positions(positionId);
    }

    function _list() internal returns (uint256 positionId) {
        vm.prank(provider);
        positionId = market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, NO_ARBITRATOR, PRICE
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
        market.listCapacity(DOMAIN, 4, validUntil, validFrom, SLA, DISPUTE_WINDOW, NO_ARBITRATOR, PRICE);
    }

    // --- Duration bound (SECURITY_AUDIT 2026-10-01 findings F2/F3) ----------

    function test_listCapacity_rejects_activationSLA_above_MAX_DURATION() public {
        uint64 tooLong = market.MAX_DURATION() + 1;

        vm.prank(provider);
        vm.expectRevert(CapacityMarket.DurationTooLong.selector);
        market.listCapacity(DOMAIN, 4, validFrom, validUntil, tooLong, DISPUTE_WINDOW, NO_ARBITRATOR, PRICE);
    }

    function test_listCapacity_rejects_disputeWindow_above_MAX_DURATION() public {
        uint64 tooLong = market.MAX_DURATION() + 1;

        vm.prank(provider);
        vm.expectRevert(CapacityMarket.DurationTooLong.selector);
        market.listCapacity(DOMAIN, 4, validFrom, validUntil, SLA, tooLong, NO_ARBITRATOR, PRICE);
    }

    function test_listCapacity_accepts_activationSLA_and_disputeWindow_at_MAX_DURATION() public {
        uint64 maxDuration = market.MAX_DURATION();

        vm.prank(provider);
        uint256 positionId = market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, maxDuration, maxDuration, NO_ARBITRATOR, PRICE
        );
        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Listed));
    }

    // --- Level 4: designated-arbitrator dispute resolution ------------------

    function test_resolveDispute_arbitrator_rules_for_provider() public {
        address arbitrator = makeAddr("arbitrator");
        vm.prank(provider);
        uint256 positionId = market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, arbitrator, PRICE
        );
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

        uint256 providerBefore = provider.balance;
        vm.prank(arbitrator);
        market.resolveDispute(positionId, true);

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Settled));
        assertEq(provider.balance, providerBefore + PRICE + COLLATERAL);
    }

    function test_resolveDispute_arbitrator_rules_for_buyer() public {
        address arbitrator = makeAddr("arbitrator");
        vm.prank(provider);
        uint256 positionId = market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, arbitrator, PRICE
        );
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

        uint256 buyerBefore = buyer.balance;
        vm.prank(arbitrator);
        market.resolveDispute(positionId, false);

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Refunded));
        assertEq(buyer.balance, buyerBefore + PRICE + COLLATERAL);
    }

    function test_resolveDispute_by_non_arbitrator_reverts() public {
        address arbitrator = makeAddr("arbitrator");
        vm.prank(provider);
        uint256 positionId = market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, arbitrator, PRICE
        );
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

        vm.prank(buyer); // not the named arbitrator
        vm.expectRevert(CapacityMarket.NotArbitrator.selector);
        market.resolveDispute(positionId, true);
    }

    /// @notice A position opted out of arbitration (arbitrator == address(0))
    /// must fall back to the exact Level 3 behavior: nobody can ever call
    /// resolveDispute successfully, only resolveDisputeByTimeout applies.
    function test_resolveDispute_reverts_for_everyone_when_no_arbitrator_named() public {
        uint256 positionId = _throughDeliveryClaimed(); // listed via _list(), NO_ARBITRATOR
        vm.prank(buyer);
        market.dispute(positionId, REASON_HASH);

        vm.prank(buyer);
        vm.expectRevert(CapacityMarket.NotArbitrator.selector);
        market.resolveDispute(positionId, true);

        vm.prank(provider);
        vm.expectRevert(CapacityMarket.NotArbitrator.selector);
        market.resolveDispute(positionId, true);

        // The timeout fallback still works exactly as in Level 3.
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
        uint256 buyerBefore = buyer.balance;
        market.resolveDisputeByTimeout(positionId);
        assertEq(buyer.balance, buyerBefore + PRICE + COLLATERAL);
    }

    function test_resolveDispute_races_resolveDisputeByTimeout_arbitrator_first_wins() public {
        address arbitrator = makeAddr("arbitrator");
        vm.prank(provider);
        uint256 positionId = market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, arbitrator, PRICE
        );
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

        vm.warp(block.timestamp + DISPUTE_WINDOW + 1); // timeout window has passed too

        vm.prank(arbitrator);
        market.resolveDispute(positionId, true); // arbitrator still gets to rule

        assertEq(uint8(_status(positionId)), uint8(CapacityMarket.Status.Settled));

        vm.expectRevert(
            abi.encodeWithSelector(
                CapacityMarket.WrongStatus.selector, CapacityMarket.Status.Disputed, CapacityMarket.Status.Settled
            )
        );
        market.resolveDisputeByTimeout(positionId); // already resolved, cannot double-pay
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
}
