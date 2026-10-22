// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IEmissionController} from "./interfaces/IEmissionController.sol";

/// @title RewardVault
/// @notice Implements the revised Stake Points Reward mechanism for losing bettors.
///
/// Under the revised design (Brief Revisi STAKE — Reward Poin Untuk Pemain Yang Kalah):
/// 1. Each 1 point represents a $1 USD budget for the treasury to buy STAKE tokens.
/// 2. Points are NOT tokens, NOT tradeable, and NOT a direct claim to withdraw dollars.
/// 3. Points wait in status "pending purchase" until the treasury executes a buy batch.
/// 4. The treasury purchases STAKE on the open market (Pons V2 bonding curve or Uniswap v4 pool)
///    using the allocated USD budget.
/// 5. The actual STAKE tokens received are deposited into this vault via `settleBatch(...)`.
/// 6. The points in that batch are permanently BURNED / consumed (they will never receive
///    rewards from future batches).
/// 7. The conversion ratio (STAKE received / points in batch) locks the exact STAKE allocation
///    for each user in `allocatedStake`.
/// 8. Users call `claim()` to withdraw their locked `allocatedStake`. Claiming does not perform
///    new market buys or recalculate amounts regardless of subsequent market price swings.
contract RewardVault is AccessControl, IEmissionController {
    using SafeERC20 for IERC20;

    bytes32 public constant POINTS_ROLE = keccak256("POINTS_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    uint256 public constant RATIO_PRECISION = 1e18;

    IERC20 public immutable rewardToken;

    /// @notice Total points currently awaiting batch purchase ($1 budget each)
    uint256 public totalPendingPoints;

    /// @notice Total points converted across all completed batches
    uint256 public totalPointsSettled;

    /// @notice Cumulative points ever accrued (for metrics & IEmissionController compatibility)
    uint256 public totalPointsEverAccrued;

    /// @notice Total STAKE currently allocated to users and ready to be claimed
    uint256 public totalAllocatedStake;

    /// @notice Total STAKE deposited by the treasury across all batches
    uint256 public totalStakeDeposited;

    /// @notice Total STAKE claimed and withdrawn by users to date
    uint256 public totalStakeClaimed;

    struct Account {
        uint256 pendingPoints;  // Poin menunggu pembelian ($1 budget per point)
        uint256 allocatedStake; // STAKE siap diklaim (hasil alokasi batch pembelian)
        uint256 claimedStake;   // STAKE sudah diklaim (sudah ditransfer ke wallet)
    }

    mapping(address => Account) public accounts;

    /// @notice Tracks whether a user's net loss from a specific market was already recorded
    mapping(bytes32 => mapping(address => bool)) public marketLossRecorded;

    /// @dev Enumerable list of users with positive pending points awaiting purchase
    address[] private _pendingUsers;
    mapping(address => uint256) private _pendingUserIndex; // 1-indexed

    struct BatchRecord {
        uint256 batchId;
        uint256 totalPointsBurned;    // Budget spent ($1 per point)
        uint256 totalStakePurchased;  // Real STAKE tokens received from DEX/Pons and deposited
        uint256 conversionRatio;      // STAKE tokens per point, scaled by RATIO_PRECISION
        uint256 timestamp;            // Block timestamp of batch settlement
        bytes32 txHash;               // On-chain tx hash or identifier of the treasury buy tx
        uint256 userCount;            // Number of wallets settled in this batch
    }

    BatchRecord[] public batchHistory;

    event PointsAccrued(address indexed user, bytes32 indexed marketId, uint256 pointsAdded, uint256 newPendingPoints);
    event BatchSettled(
        uint256 indexed batchId,
        uint256 totalPointsBurned,
        uint256 totalStakePurchased,
        uint256 conversionRatio,
        uint256 userCount,
        bytes32 txHash
    );
    event StakeAllocated(uint256 indexed batchId, address indexed user, uint256 pointsBurned, uint256 stakeAllocated);
    event RewardClaimed(address indexed user, uint256 amount);

    constructor(address admin, IERC20 rewardToken_) {
        require(admin != address(0), "RewardVault: admin is zero");
        require(address(rewardToken_) != address(0), "RewardVault: rewardToken is zero");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        rewardToken = rewardToken_;
    }

    /// @notice Grant/revoke POINTS_ROLE or DEPOSITOR_ROLE
    function setRole(bytes32 role, address account, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) _grantRole(role, account);
        else _revokeRole(role, account);
    }

    /// @notice Called once per net-loss claim by an authorized market contract.
    function accruePoints(address user, bytes32 marketId, uint256 pointsAdded) external onlyRole(POINTS_ROLE) {
        _recordPoints(user, marketId, pointsAdded);
    }

    /// @notice IEmissionController-compatible entry point, so PaperBetMarket can point
    /// its `emissionController` at this contract with zero changes to PaperBetMarket.sol.
    function claimLossReward(bytes32 marketId, address user, uint256 realizedLoss)
        external
        onlyRole(POINTS_ROLE)
        returns (uint256 pointsAdded)
    {
        _recordPoints(user, marketId, realizedLoss);
        return realizedLoss;
    }

    function _recordPoints(address user, bytes32 marketId, uint256 amount) internal {
        require(user != address(0), "RewardVault: user is zero");
        require(amount > 0, "RewardVault: amount must be > 0");

        if (marketId != bytes32(0)) {
            require(!marketLossRecorded[marketId][user], "RewardVault: market loss already recorded");
            marketLossRecorded[marketId][user] = true;
        }

        if (accounts[user].pendingPoints == 0) {
            _addPendingUser(user);
        }

        accounts[user].pendingPoints += amount;
        totalPendingPoints += amount;
        totalPointsEverAccrued += amount;

        emit PointsAccrued(user, marketId, amount, accounts[user].pendingPoints);
    }

    /// @notice Treasury settles a batch of pending points after purchasing STAKE on the market.
    /// @param users Array of users whose pending points are converted in this batch.
    /// @param pointsToBurn Array of points to consume per user (must be <= pendingPoints[user]).
    /// @param totalStakePurchased Actual STAKE tokens received from the buy transaction.
    /// @param txHash Buy transaction hash or reference on Pons/Uniswap.
    function settleBatch(
        address[] calldata users,
        uint256[] calldata pointsToBurn,
        uint256 totalStakePurchased,
        bytes32 txHash
    ) external onlyRole(DEPOSITOR_ROLE) returns (uint256 batchId) {
        return _settleBatch(users, pointsToBurn, totalStakePurchased, txHash);
    }

    /// @notice Convenience overload: converts all current pending points for the specified users.
    function settleBatch(
        address[] calldata users,
        uint256 totalStakePurchased,
        bytes32 txHash
    ) external onlyRole(DEPOSITOR_ROLE) returns (uint256 batchId) {
        uint256 len = users.length;
        uint256[] memory pointsToBurn = new uint256[](len);
        for (uint256 i = 0; i < len; ++i) {
            pointsToBurn[i] = accounts[users[i]].pendingPoints;
        }
        return _settleBatch(users, pointsToBurn, totalStakePurchased, txHash);
    }

    /// @notice Helper to settle all currently pending users at once.
    function settleAllPending(
        uint256 totalStakePurchased,
        bytes32 txHash
    ) external onlyRole(DEPOSITOR_ROLE) returns (uint256 batchId) {
        uint256 len = _pendingUsers.length;
        require(len > 0, "RewardVault: no pending users");
        address[] memory users = new address[](len);
        uint256[] memory pointsToBurn = new uint256[](len);
        for (uint256 i = 0; i < len; ++i) {
            users[i] = _pendingUsers[i];
            pointsToBurn[i] = accounts[users[i]].pendingPoints;
        }
        return _settleBatch(users, pointsToBurn, totalStakePurchased, txHash);
    }

    function _settleBatch(
        address[] memory users,
        uint256[] memory pointsToBurn,
        uint256 totalStakePurchased,
        bytes32 txHash
    ) internal returns (uint256 batchId) {
        uint256 len = users.length;
        require(len > 0, "RewardVault: empty users");
        require(len == pointsToBurn.length, "RewardVault: array length mismatch");
        require(totalStakePurchased > 0, "RewardVault: stake purchased must be > 0");

        uint256 batchTotalPoints = 0;
        for (uint256 i = 0; i < len; ++i) {
            uint256 pts = pointsToBurn[i];
            require(pts > 0, "RewardVault: pointsToBurn must be > 0");
            require(accounts[users[i]].pendingPoints >= pts, "RewardVault: insufficient pending points");
            batchTotalPoints += pts;
        }

        // Pull the purchased STAKE tokens from treasury (msg.sender)
        rewardToken.safeTransferFrom(msg.sender, address(this), totalStakePurchased);

        uint256 conversionRatio = (totalStakePurchased * RATIO_PRECISION) / batchTotalPoints;
        batchId = batchHistory.length;
        uint256 allocatedSoFar = 0;

        for (uint256 i = 0; i < len; ++i) {
            address user = users[i];
            uint256 pts = pointsToBurn[i];

            accounts[user].pendingPoints -= pts;
            if (accounts[user].pendingPoints == 0) {
                _removePendingUser(user);
            }

            uint256 userStake;
            if (i == len - 1) {
                // Last user receives remainder to prevent rounding loss
                userStake = totalStakePurchased - allocatedSoFar;
            } else {
                userStake = (pts * totalStakePurchased) / batchTotalPoints;
                allocatedSoFar += userStake;
            }

            accounts[user].allocatedStake += userStake;
            emit StakeAllocated(batchId, user, pts, userStake);
        }

        totalPendingPoints -= batchTotalPoints;
        totalPointsSettled += batchTotalPoints;
        totalAllocatedStake += totalStakePurchased;
        totalStakeDeposited += totalStakePurchased;

        batchHistory.push(
            BatchRecord({
                batchId: batchId,
                totalPointsBurned: batchTotalPoints,
                totalStakePurchased: totalStakePurchased,
                conversionRatio: conversionRatio,
                timestamp: block.timestamp,
                txHash: txHash,
                userCount: len
            })
        );

        emit BatchSettled(batchId, batchTotalPoints, totalStakePurchased, conversionRatio, len, txHash);
    }

    /// @notice Claims all allocated STAKE tokens for the caller.
    /// Does NOT perform any new open-market purchase or recalculate ratios.
    function claim() external returns (uint256 amount) {
        Account storage acc = accounts[msg.sender];
        amount = acc.allocatedStake;
        require(amount > 0, "RewardVault: nothing to claim");

        acc.allocatedStake = 0;
        acc.claimedStake += amount;
        totalAllocatedStake -= amount;
        totalStakeClaimed += amount;

        rewardToken.safeTransfer(msg.sender, amount);

        emit RewardClaimed(msg.sender, amount);
    }

    // --- View Functions ---

    /// @notice STAKE ready to be claimed by `user` right now.
    function pendingReward(address user) external view returns (uint256) {
        return accounts[user].allocatedStake;
    }

    /// @notice STAKE allocated and ready to be claimed.
    function allocatedStake(address user) external view returns (uint256) {
        return accounts[user].allocatedStake;
    }

    /// @notice Points waiting for batch purchase for `user`.
    function pendingPoints(address user) external view returns (uint256) {
        return accounts[user].pendingPoints;
    }

    /// @notice STAKE already claimed and withdrawn by `user`.
    function claimedStake(address user) external view returns (uint256) {
        return accounts[user].claimedStake;
    }

    /// @notice Alias for totalPendingPoints for backwards compatibility.
    function totalPoints() external view returns (uint256) {
        return totalPendingPoints;
    }

    /// @notice Alias for totalStakeDeposited for backwards compatibility.
    function totalRewardDeposited() external view returns (uint256) {
        return totalStakeDeposited;
    }

    /// @notice Number of batches settled so far.
    function getBatchHistoryCount() external view returns (uint256) {
        return batchHistory.length;
    }

    /// @notice Returns batch record by ID.
    function getBatch(uint256 batchId) external view returns (BatchRecord memory) {
        require(batchId < batchHistory.length, "RewardVault: invalid batchId");
        return batchHistory[batchId];
    }

    /// @notice Returns all users who currently have positive pending points.
    function getPendingUsers() external view returns (address[] memory) {
        return _pendingUsers;
    }

    /// @notice Count of users who currently have positive pending points.
    function getPendingUsersCount() external view returns (uint256) {
        return _pendingUsers.length;
    }

    // --- IEmissionController Compatibility ---

    function previewEmission(uint256, uint256 realizedLoss) external pure returns (uint256) {
        return realizedLoss;
    }

    function cumulativeRealizedLoss() external view returns (uint256) {
        return totalPointsEverAccrued;
    }

    function cumulativePaperMinted() external view returns (uint256) {
        return totalStakeDeposited;
    }

    // --- Internal User Tracking Set ---

    function _addPendingUser(address user) internal {
        if (_pendingUserIndex[user] == 0) {
            _pendingUsers.push(user);
            _pendingUserIndex[user] = _pendingUsers.length;
        }
    }

    function _removePendingUser(address user) internal {
        uint256 index1 = _pendingUserIndex[user];
        if (index1 > 0) {
            uint256 index0 = index1 - 1;
            uint256 lastIndex0 = _pendingUsers.length - 1;
            if (index0 != lastIndex0) {
                address lastUser = _pendingUsers[lastIndex0];
                _pendingUsers[index0] = lastUser;
                _pendingUserIndex[lastUser] = index1;
            }
            _pendingUsers.pop();
            delete _pendingUserIndex[user];
        }
    }
}
