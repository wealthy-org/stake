// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IEmissionController} from "./interfaces/IEmissionController.sol";

/// @title RewardVault
/// @notice Distributes a fixed-supply reward token (launched elsewhere —
/// e.g. via Pons — with no mint authority left for this protocol) to
/// bettors who have a net realized loss, proportional to "points" they
/// accrue over time. Replaces the old mint-on-loss design
/// (EmissionController) for any token this protocol does not control the
/// supply of.
///
/// Points are the same net-loss figure the DB-ledger phase already tracks
/// in `positions.realized_loss` (max(0, totalStake - totalPayout) per
/// wallet per market) — PointsAccrued is called once per claim, same
/// call site EmissionController.claimLossReward used to be called from.
///
/// Distribution uses the standard "accumulator" pattern (MasterChef /
/// SushiBar / Synthetix StakingRewards): depositing rewards only ever
/// raises a single global `accRewardPerPoint` ratio, and nothing is ever
/// promised beyond what toeken balance this contract actually holds —
/// there is no fixed exchange rate and no unfunded liability. Points that
/// go unclaimed for a long time are not lost or expired; they simply claim
/// a share of whatever has been deposited by the time they're claimed.
contract RewardVault is AccessControl, IEmissionController {
    using SafeERC20 for IERC20;

    /// @dev Granted to whatever contract computes net-loss and calls
    /// accruePoints — e.g. a PaperBetMarket-equivalent, mirroring how
    /// EmissionController.MARKET_ROLE worked.
    bytes32 public constant POINTS_ROLE = keccak256("POINTS_ROLE");
    /// @dev Granted to the treasury that buys the reward token on the open
    /// market and deposits it here. Kept separate from DEFAULT_ADMIN_ROLE
    /// so the treasury can never touch points accounting.
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    uint256 private constant ACC_PRECISION = 1e18;

    IERC20 public immutable rewardToken;

    uint256 public totalPoints;
    uint256 public totalRewardDeposited;
    /// @dev Reward-per-point accumulator, scaled by ACC_PRECISION.
    uint256 public accRewardPerPoint;

    struct Account {
        uint256 points;
        /// @dev Snapshot of accRewardPerPoint * points at the last time
        /// this account's points changed or it claimed — the standard
        /// "reward debt" that makes the accumulator pattern correct.
        uint256 rewardDebt;
        uint256 claimed;
    }

    mapping(address => Account) public accounts;

    event PointsAccrued(address indexed user, bytes32 indexed marketId, uint256 pointsAdded, uint256 totalPoints);
    event RewardDeposited(address indexed depositor, uint256 amount, uint256 newAccRewardPerPoint);
    event RewardClaimed(address indexed user, uint256 amount);

    constructor(address admin, IERC20 rewardToken_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        rewardToken = rewardToken_;
    }

    /// @notice Grant/revoke POINTS_ROLE or DEPOSITOR_ROLE — thin wrapper so
    /// this reads clearly at call sites; AccessControl's own grantRole
    /// still works too.
    function setRole(bytes32 role, address account, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) _grantRole(role, account);
        else _revokeRole(role, account);
    }

    /// @notice Called once per net-loss claim (same net-loss figure the
    /// brief's §11 anti-farming formula already produces). Settles any
    /// pending reward first so the points increase never retroactively
    /// changes what was already earned at the old accumulator value.
    function accruePoints(address user, bytes32 marketId, uint256 pointsAdded) external onlyRole(POINTS_ROLE) {
        _addPoints(user, marketId, pointsAdded);
    }

    /// @notice IEmissionController-compatible entry point, so a
    /// PaperBetMarket clone can point its `emissionController` at this
    /// contract with zero changes to PaperBetMarket.sol itself — it still
    /// calls `claimLossReward(marketId, user, realizedLoss)` exactly as
    /// before. Points accrue 1:1 with realizedLoss (fine2's "$100 lost =
    /// 100 points" spec) rather than through EmissionController's old
    /// piecewise mint curve, which has no meaning here since this
    /// contract never mints — it only ever redistributes what
    /// depositReward has brought in.
    function claimLossReward(bytes32 marketId, address user, uint256 realizedLoss)
        external
        onlyRole(POINTS_ROLE)
        returns (uint256 pointsAdded)
    {
        _addPoints(user, marketId, realizedLoss);
        return realizedLoss;
    }

    /// @notice Preview is 1:1 here (no emission curve to walk), kept only
    /// so this contract satisfies IEmissionController's shape.
    function previewEmission(uint256, uint256 realizedLoss) external pure returns (uint256) {
        return realizedLoss;
    }

    /// @dev Closest analog to EmissionController's field of the same name:
    /// total points ever accrued, which is denominated 1:1 in realized-loss
    /// dollars by construction.
    function cumulativeRealizedLoss() external view returns (uint256) {
        return totalPoints;
    }

    /// @dev Closest analog to EmissionController's field of the same name:
    /// total reward token ever deposited by the treasury (nothing is
    /// "minted" in this model).
    function cumulativePaperMinted() external view returns (uint256) {
        return totalRewardDeposited;
    }

    /// @notice Treasury calls this after buying rewardToken on the open
    /// market. Raises accRewardPerPoint for every point holder at once —
    /// nobody needs to be iterated over, and this is why the accumulator
    /// pattern scales to any number of holders.
    function depositReward(uint256 amount) external onlyRole(DEPOSITOR_ROLE) {
        require(amount > 0, "RewardVault: amount must be > 0");
        require(totalPoints > 0, "RewardVault: no points to distribute to yet");

        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        accRewardPerPoint += (amount * ACC_PRECISION) / totalPoints;
        totalRewardDeposited += amount;

        emit RewardDeposited(msg.sender, amount, accRewardPerPoint);
    }

    /// @notice What `user` could claim right now, without changing state.
    function pendingReward(address user) public view returns (uint256) {
        Account storage acc = accounts[user];
        uint256 accrued = (acc.points * accRewardPerPoint) / ACC_PRECISION;
        return acc.claimed + accrued - acc.rewardDebt;
    }

    /// @notice Pays out everything currently pending for the caller. Bound
    /// strictly by this contract's own rewardToken balance via the ERC-20
    /// transfer itself — there is no path that can promise more than what
    /// depositReward has actually brought in.
    function claim() external returns (uint256 amount) {
        _settle(msg.sender);

        Account storage acc = accounts[msg.sender];
        amount = acc.claimed; // _settle moves pending into a claimable bucket below
        require(amount > 0, "RewardVault: nothing to claim");

        acc.claimed = 0;
        rewardToken.safeTransfer(msg.sender, amount);

        emit RewardClaimed(msg.sender, amount);
    }

    function _addPoints(address user, bytes32 marketId, uint256 amount) private {
        require(amount > 0, "RewardVault: amount must be > 0");
        _settle(user);

        Account storage acc = accounts[user];
        acc.points += amount;
        acc.rewardDebt = (acc.points * accRewardPerPoint) / ACC_PRECISION;
        totalPoints += amount;

        emit PointsAccrued(user, marketId, amount, totalPoints);
    }

    /// @dev Moves this account's pending reward (at the current
    /// accumulator value) into `claimed` and re-bases rewardDebt, so
    /// points changes and claims never double-count or lose the pending
    /// amount in between.
    function _settle(address user) private {
        Account storage acc = accounts[user];
        if (acc.points > 0) {
            uint256 accrued = (acc.points * accRewardPerPoint) / ACC_PRECISION;
            acc.claimed += accrued - acc.rewardDebt;
            acc.rewardDebt = accrued;
        }
    }
}
