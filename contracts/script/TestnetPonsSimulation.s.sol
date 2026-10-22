// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";

import {FixedSupplyToken} from "../src/mocks/FixedSupplyToken.sol";
import {MockCollateral} from "../src/mocks/MockCollateral.sol";
import {RewardVault} from "../src/RewardVault.sol";

/// @notice Simulates, end to end and for real on Robinhood Chain Testnet,
/// what happens once the leader's coin is actually live on Pons: a
/// fixed-supply token sitting in a real Uniswap v4 pool (the same
/// PoolManager singleton Pons V2 graduates into on mainnet, deployed at
/// the identical address on this testnet), a treasury that genuinely
/// swaps for it instead of minting a placeholder, and that swapped amount
/// landing in RewardVault for net-loss points to claim against.
///
/// This script is the testnet stand-in for Pons itself. Swapping the pool
/// address for the real Pons-graduated pool later requires no change to
/// RewardVault or the betting contracts — only to which pool the treasury
/// step below swaps against.
contract TestnetPonsSimulation is Script {
    // Real Uniswap v4 PoolManager singleton, confirmed deployed at this
    // exact address on Robinhood Chain Testnet via eth_getCode.
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;

    uint24 constant FEE = 3000; // 0.3%, standard tier
    int24 constant TICK_SPACING = 60;
    int24 constant TICK_LOWER = -887220; // nearest multiple of 60 to TickMath.MIN_TICK
    int24 constant TICK_UPPER = 887220; // nearest multiple of 60 to TickMath.MAX_TICK
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // 1:1, ignoring the 18 vs 6 decimals mismatch — fine for a testnet demo

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address treasuryBuyer = deployer; // same wallet plays "treasury" for this demo

        vm.startBroadcast(deployerKey);

        // 1. Stand in for "the leader launches on Pons": a fixed-supply
        // token, full supply to the deployer, no mint function left.
        FixedSupplyToken stakeToken = new FixedSupplyToken("Stake (testnet pilot)", "STAKE", 1_000_000_000e18);
        MockCollateral collateral = new MockCollateral();
        collateral.mint(deployer, 1_000_002_000e6);

        // 2. Stand in for "graduation seeds the Uniswap v4 pool" — create
        // the pool directly against the real PoolManager.
        IPoolManager manager = IPoolManager(POOL_MANAGER);
        PoolModifyLiquidityTest liquidityRouter = new PoolModifyLiquidityTest(manager);
        PoolSwapTest swapRouter = new PoolSwapTest(manager);

        (Currency currency0, Currency currency1) = address(stakeToken) < address(collateral)
            ? (Currency.wrap(address(stakeToken)), Currency.wrap(address(collateral)))
            : (Currency.wrap(address(collateral)), Currency.wrap(address(stakeToken)));

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        manager.initialize(key, SQRT_PRICE_1_1);

        stakeToken.approve(address(liquidityRouter), type(uint256).max);
        collateral.approve(address(liquidityRouter), type(uint256).max);

        liquidityRouter.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                liquidityDelta: 1_000_000_000e6,
                salt: bytes32(0)
            }),
            hex""
        );

        console.log("Pool seeded. StakeToken:", address(stakeToken));
        console.log("Collateral (mUSDG):", address(collateral));

        // 3. Deploy the reward vault for this pilot, same as the Foundry
        // integration test — the treasury-buys-then-deposits path this
        // script is here to prove is real.
        RewardVault vault = new RewardVault(deployer, stakeToken);
        vault.setRole(vault.DEPOSITOR_ROLE(), treasuryBuyer, true);

        // 4. The actual point of this script: treasury genuinely SWAPS
        // collateral for stakeToken against the real pool, instead of
        // minting a placeholder like the forge-test version did.
        bool collateralIsZero = Currency.unwrap(currency0) == address(collateral);
        collateral.approve(address(swapRouter), type(uint256).max);

        uint256 stakeBalanceBefore = stakeToken.balanceOf(treasuryBuyer);

        swapRouter.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: collateralIsZero,
                amountSpecified: -int256(1_000e6), // exact input: spend 1,000 mUSDG
                sqrtPriceLimitX96: collateralIsZero ? 4295128740 : 1461446703485210103287273052203988822378723970341
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            hex""
        );

        uint256 stakeBought = stakeToken.balanceOf(treasuryBuyer) - stakeBalanceBefore;
        console.log("Treasury bought this many stakeToken base units from the real pool:", stakeBought);

        // 5. Deposit what was actually bought into the vault — the exact
        // same depositReward() call the DB-ledger/EmissionController
        // migration already wired claims up to.
        stakeToken.approve(address(vault), stakeBought);

        // depositReward requires totalPoints > 0, so give the deployer a
        // token amount of points here purely so this script can show the
        // deposit succeeding end to end; real points come from
        // claimLossReward() on an actual resolved market, as already
        // proven in test/RewardVaultIntegration.t.sol.
        vault.setRole(vault.POINTS_ROLE(), deployer, true);
        vault.accruePoints(deployer, bytes32("testnet-pons-sim"), 1e18);

        vault.depositReward(stakeBought);

        console.log("RewardVault address:", address(vault));
        console.log("Deposited into vault from a real on-chain swap:", stakeBought);
        console.log("Pending reward for deployer (sanity check):", vault.pendingReward(deployer));

        vm.stopBroadcast();
    }
}
