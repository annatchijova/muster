// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CapacityMarket} from "../src/CapacityMarket.sol";
import {CapacityPool} from "../src/CapacityPool.sol";

/// @notice Deploys both MUSTER contracts with no constructor arguments.
/// Run with `forge script script/Deploy.s.sol --rpc-url monad_testnet
/// --broadcast --verify` — see README "Deploying to Monad testnet" for the
/// full command and what environment variables it reads.
contract Deploy is Script {
    function run() external returns (CapacityMarket market, CapacityPool pool) {
        vm.startBroadcast();

        market = new CapacityMarket();
        pool = new CapacityPool();

        vm.stopBroadcast();

        console.log("CapacityMarket deployed at:", address(market));
        console.log("CapacityPool   deployed at:", address(pool));
    }
}
