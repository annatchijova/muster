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
/// Addresses below are current as of 2026-10-05 (redeployed to add
/// ProviderStats — see README.md "Live on Monad testnet" history) — re-check
/// both before relying on this script if time has passed:
///   - CapacityMarket/CapacityPool: README.md "Live on Monad testnet",
///     "Current" row.
///   - KeystoneForwarder: docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory-ts,
///     Monad testnet production row. The mock forwarder address used by
///     `cre workflow simulate --broadcast` (0xB9F79d863261869B234c481D1f9A7af84AeAd192)
///     is deliberately NOT what this script deploys against — this deploys
///     the receiver that a *real* deployed workflow talks to.
contract DeployCREReceiver is Script {
    address constant CAPACITY_MARKET = 0xb2bEed70CA03F9ae86276f14aAB79F6F36f681C3;
    address constant CAPACITY_POOL = 0xA5460952b9445C2CC5daf08D4808C09f4458Aa11;
    address constant MONAD_TESTNET_KEYSTONE_FORWARDER = 0xF8344CFd5c43616a4366C34E3EEE75af79a74482;

    function run() external returns (CREDeadlineReceiver receiver) {
        vm.startBroadcast();

        receiver = new CREDeadlineReceiver(MONAD_TESTNET_KEYSTONE_FORWARDER, CAPACITY_MARKET, CAPACITY_POOL);

        vm.stopBroadcast();

        console.log("CREDeadlineReceiver deployed at:", address(receiver));
    }
}
