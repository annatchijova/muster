// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CREDeadlineReceiver} from "../src/CREDeadlineReceiver.sol";

/// @notice Deploys CREDeadlineReceiver wired to the current Level 5
/// CapacityMarket/CapacityPool deployment and the Monad testnet
/// KeystoneForwarder. Run with `forge script script/DeployCREReceiver.s.sol
/// --rpc-url monad_testnet --broadcast --verify ...` — see README "Chainlink
/// CRE: automated deadline enforcement".
///
/// Addresses below are current as of 2026-10-01 — re-check both before
/// relying on this script if time has passed:
///   - CapacityMarket/CapacityPool: README.md "Live on Monad testnet",
///     "Current" row.
///   - KeystoneForwarder: docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory-ts,
///     Monad testnet production row. The mock forwarder address used by
///     `cre workflow simulate --broadcast` (0xB9F79d863261869B234c481D1f9A7af84AeAd192)
///     is deliberately NOT what this script deploys against — this deploys
///     the receiver that a *real* deployed workflow talks to.
contract DeployCREReceiver is Script {
    address constant CAPACITY_MARKET = 0x6fDA6975D7d585a772Dc763Ab44Bc206c94a0364;
    address constant CAPACITY_POOL = 0x44f305fbCF56acECe8f79Cd9773351E68634B0D5;
    address constant MONAD_TESTNET_KEYSTONE_FORWARDER = 0xF8344CFd5c43616a4366C34E3EEE75af79a74482;

    function run() external returns (CREDeadlineReceiver receiver) {
        vm.startBroadcast();

        receiver = new CREDeadlineReceiver(MONAD_TESTNET_KEYSTONE_FORWARDER, CAPACITY_MARKET, CAPACITY_POOL);

        vm.stopBroadcast();

        console.log("CREDeadlineReceiver deployed at:", address(receiver));
    }
}
