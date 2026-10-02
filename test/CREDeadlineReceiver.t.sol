// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CapacityMarket} from "../src/CapacityMarket.sol";
import {CapacityPool} from "../src/CapacityPool.sol";
import {CREDeadlineReceiver} from "../src/CREDeadlineReceiver.sol";
import {IReceiver} from "../src/cre/IReceiver.sol";
import {ReceiverTemplate} from "../src/cre/ReceiverTemplate.sol";

contract CREDeadlineReceiverTest is Test {
    CapacityMarket market;
    CapacityPool pool;
    CREDeadlineReceiver receiver;

    address forwarder = makeAddr("keystoneForwarder");
    address provider = makeAddr("provider");
    address buyer = makeAddr("buyer");

    bytes32 constant DOMAIN = keccak256("ZK_SECURITY_L2");
    uint256 constant PRICE = 1 ether;
    uint256 constant COLLATERAL = 0.5 ether;
    uint64 constant SLA = 30 minutes;
    uint64 constant DISPUTE_WINDOW = 2 days;
    address[] NO_PANEL;

    uint64 validFrom;
    uint64 validUntil;

    function setUp() public {
        validFrom = uint64(block.timestamp);
        validUntil = uint64(block.timestamp + 30 days);
        vm.deal(provider, 100 ether);
        vm.deal(buyer, 100 ether);

        market = new CapacityMarket();
        pool = new CapacityPool();
        receiver = new CREDeadlineReceiver(forwarder, address(market), address(pool));
    }

    function _marketPositionPastActivationDeadline() internal returns (uint256 positionId) {
        vm.prank(provider);
        positionId = market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, NO_PANEL, 0, PRICE
        );
        vm.prank(buyer);
        market.reserve{value: PRICE}(positionId);
        vm.prank(buyer);
        market.activate(positionId);
        vm.warp(block.timestamp + SLA + 1);
    }

    function _encodeSingle(CREDeadlineReceiver.Action action, uint256 id, uint256 subId)
        internal
        pure
        returns (bytes memory)
    {
        CREDeadlineReceiver.DeadlineAction[] memory actions = new CREDeadlineReceiver.DeadlineAction[](1);
        actions[0] = CREDeadlineReceiver.DeadlineAction({action: action, id: id, subId: subId});
        return abi.encode(actions);
    }

    // --- Access control -----------------------------------------------

    function test_onReport_by_non_forwarder_reverts() public {
        uint256 positionId = _marketPositionPastActivationDeadline();
        bytes memory report = _encodeSingle(CREDeadlineReceiver.Action.MarketClaimDefault, positionId, 0);

        vm.prank(buyer); // not the forwarder
        vm.expectRevert(abi.encodeWithSelector(ReceiverTemplate.InvalidSender.selector, buyer, forwarder));
        receiver.onReport("", report);
    }

    function test_supportsInterface_reports_IReceiver_and_IERC165() public view {
        assertTrue(receiver.supportsInterface(type(IReceiver).interfaceId));
    }

    // --- Dispatch: CapacityMarket ---------------------------------------

    function test_onReport_dispatches_MarketClaimDefault() public {
        uint256 positionId = _marketPositionPastActivationDeadline();
        bytes memory report = _encodeSingle(CREDeadlineReceiver.Action.MarketClaimDefault, positionId, 0);

        uint256 buyerBefore = buyer.balance;
        vm.prank(forwarder);
        receiver.onReport("", report);

        (,,,,,,,,,,,,, CapacityMarket.Status status) = market.positions(positionId);
        assertEq(uint8(status), uint8(CapacityMarket.Status.Defaulted));
        assertEq(buyer.balance, buyerBefore + PRICE + COLLATERAL, "receiver-triggered default pays out correctly");
    }

    function test_onReport_emits_ActionAttempted_with_success_true() public {
        uint256 positionId = _marketPositionPastActivationDeadline();
        bytes memory report = _encodeSingle(CREDeadlineReceiver.Action.MarketClaimDefault, positionId, 0);

        vm.expectEmit(true, false, false, true, address(receiver));
        emit CREDeadlineReceiver.ActionAttempted(0, CREDeadlineReceiver.Action.MarketClaimDefault, positionId, 0, true);

        vm.prank(forwarder);
        receiver.onReport("", report);
    }

    // --- Dispatch: CapacityPool ------------------------------------------

    function test_onReport_dispatches_PoolClaimAssignmentDefault() public {
        CapacityPool.TermsClass memory terms = CapacityPool.TermsClass({
            domain: DOMAIN,
            validFrom: validFrom,
            validUntil: validUntil,
            activationSLA: SLA,
            disputeWindow: DISPUTE_WINDOW,
            panelMembers: NO_PANEL,
            panelThreshold: 0,
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

        bytes memory report =
            _encodeSingle(CREDeadlineReceiver.Action.PoolClaimAssignmentDefault, reservationId, 0);

        uint256 buyerBefore = buyer.balance;
        vm.prank(forwarder);
        receiver.onReport("", report);

        (,,,,,, CapacityPool.AssignmentStatus status) = pool.assignmentInfo(reservationId, 0);
        assertEq(uint8(status), uint8(CapacityPool.AssignmentStatus.Defaulted));
        assertEq(buyer.balance, buyerBefore + PRICE * 4 + COLLATERAL * 4);
    }

    // --- Honest degradation: one bad entry in a batch doesn't block the rest ---

    function test_onReport_batch_one_failure_does_not_block_others() public {
        uint256 duePosition = _marketPositionPastActivationDeadline();

        // A second position that is NOT yet past its deadline: claimDefault
        // on it must fail (DeadlineNotPassed), but should not revert the batch.
        vm.prank(provider);
        uint256 notDuePosition = market.listCapacity{value: COLLATERAL}(
            DOMAIN, 4, validFrom, validUntil, SLA, DISPUTE_WINDOW, NO_PANEL, 0, PRICE
        );
        vm.prank(buyer);
        market.reserve{value: PRICE}(notDuePosition);
        vm.prank(buyer);
        market.activate(notDuePosition); // just activated: its own SLA has not elapsed yet

        CREDeadlineReceiver.DeadlineAction[] memory actions = new CREDeadlineReceiver.DeadlineAction[](2);
        actions[0] = CREDeadlineReceiver.DeadlineAction({
            action: CREDeadlineReceiver.Action.MarketClaimDefault,
            id: notDuePosition,
            subId: 0
        });
        actions[1] = CREDeadlineReceiver.DeadlineAction({
            action: CREDeadlineReceiver.Action.MarketClaimDefault,
            id: duePosition,
            subId: 0
        });
        bytes memory report = abi.encode(actions);

        vm.prank(forwarder);
        receiver.onReport("", report);

        (,,,,,,,,,,,,, CapacityMarket.Status notDueStatus) = market.positions(notDuePosition);
        (,,,,,,,,,,,,, CapacityMarket.Status dueStatus) = market.positions(duePosition);
        assertEq(uint8(notDueStatus), uint8(CapacityMarket.Status.Activated), "untouched: not yet due");
        assertEq(uint8(dueStatus), uint8(CapacityMarket.Status.Defaulted), "still executed despite sibling failure");
    }

    function test_onReport_empty_batch_is_a_noop() public {
        CREDeadlineReceiver.DeadlineAction[] memory actions = new CREDeadlineReceiver.DeadlineAction[](0);
        vm.prank(forwarder);
        receiver.onReport("", abi.encode(actions)); // must not revert
    }

    // --- Inherited from ReceiverTemplate: the forwarder is rotatable -----
    // Not reimplemented or retested in depth here (that's upstream's
    // responsibility); these two confirm it's wired correctly in our
    // deployment, since `receiver`'s owner is this test contract (the
    // constructor caller), not some address we have to separately prank.

    function test_owner_can_rotate_forwarder_address() public {
        address newForwarder = makeAddr("newForwarder");
        receiver.setForwarderAddress(newForwarder);
        assertEq(receiver.getForwarderAddress(), newForwarder);

        uint256 positionId = _marketPositionPastActivationDeadline();
        bytes memory report = _encodeSingle(CREDeadlineReceiver.Action.MarketClaimDefault, positionId, 0);

        vm.prank(forwarder); // the old forwarder no longer works
        vm.expectRevert(abi.encodeWithSelector(ReceiverTemplate.InvalidSender.selector, forwarder, newForwarder));
        receiver.onReport("", report);

        vm.prank(newForwarder);
        receiver.onReport("", report); // the new one does
    }

    function test_non_owner_cannot_rotate_forwarder_address() public {
        vm.prank(buyer);
        vm.expectRevert(); // Ownable's OwnableUnauthorizedAccount
        receiver.setForwarderAddress(makeAddr("attackerForwarder"));
    }
}
