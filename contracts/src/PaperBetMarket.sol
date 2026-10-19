// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPaperBetMarket} from "./interfaces/IPaperBetMarket.sol";
import {IOracleResolver} from "./oracle/IOracleResolver.sol";
import {IEmissionController} from "./interfaces/IEmissionController.sol";
import {PayoutMath} from "./libraries/PayoutMath.sol";
import {ProtocolPause} from "./ProtocolPause.sol";

/// @title PaperBetMarket
/// @notice One binary YES/NO pool per market (brief §7-§11, §19-§35).
/// Deployed once as an implementation and cloned via EIP-1167 by
/// PaperBetFactory (brief §19) — state lives per-clone via `initialize`,
/// never a constructor, so every clone starts from identical bytecode.
contract PaperBetMarket is IPaperBetMarket, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 yesStake;
        uint256 noStake;
        bool payoutClaimed;
        bool lossRewardClaimed;
    }

    bool private _initialized;

    bytes32 public marketId;
    IERC20 public collateral;
    IOracleResolver public oracleResolver;
    IEmissionController public emissionController;
    address public feeTreasury;
    ProtocolPause public protocolPause;

    bytes32 public oracleFeedId;
    uint256 public strikePrice; // 1e8 scale, matches the oracle resolver's price scale
    Comparison public comparison;

    uint64 public bettingOpensAt;
    uint64 public bettingClosesAt;
    uint64 public resolutionTimestamp;
    uint64 public resolutionWindow;
    uint16 public protocolFeeBps;
    uint256 public minBet;
    uint256 public maxBet;

    MarketStatus public status;

    uint256 public yesPool;
    uint256 public noPool;

    uint256 public resolvedPrice;
    uint64 public reportTimestamp;
    bool public yesWon;

    uint256 public protocolFee;
    uint256 public netLosingPool;
    uint256 public rewardPerWinningShare;
    bytes32 public cancelReason;

    mapping(address => Position) public positions;

    event BetPlaced(bytes32 indexed marketId_, address indexed user, Side side, uint256 amount);
    event MarketLocked(bytes32 indexed marketId_, uint256 yesPool_, uint256 noPool_);
    event MarketResolved(
        bytes32 indexed marketId_, bool yesWon_, uint256 resolvedPrice_, uint256 winningPool, uint256 losingPool, uint256 protocolFee_
    );
    event MarketCancelled(bytes32 indexed marketId_, bytes32 reason);
    event PayoutClaimed(bytes32 indexed marketId_, address indexed user, uint256 amount);
    event RefundClaimed(bytes32 indexed marketId_, address indexed user, uint256 amount);

    modifier onlyInitialized() {
        require(_initialized, "Market: not initialized");
        _;
    }

    /// @dev Factory-only in practice (it's the only caller that ever deploys
    /// a clone), but not role-gated here — a clone that nobody calls
    /// initialize() on is simply unusable, so there's no griefing vector in
    /// letting anyone call it once; the `_initialized` guard makes it one-shot.
    function initialize(
        bytes32 marketId_,
        address collateralToken,
        address oracleResolver_,
        address emissionController_,
        address feeTreasury_,
        bytes32 oracleFeedId_,
        uint256 strikePrice_,
        Comparison comparison_,
        uint64 bettingOpensAt_,
        uint64 bettingClosesAt_,
        uint64 resolutionTimestamp_,
        uint64 resolutionWindow_,
        uint16 protocolFeeBps_,
        uint256 minBet_,
        uint256 maxBet_
    ) external {
        require(!_initialized, "Market: already initialized");
        require(collateralToken != address(0), "Market: collateral is zero");
        require(oracleResolver_ != address(0), "Market: oracleResolver is zero");
        require(emissionController_ != address(0), "Market: emissionController is zero");
        require(feeTreasury_ != address(0), "Market: feeTreasury is zero");
        _initialized = true;

        marketId = marketId_;
        collateral = IERC20(collateralToken);
        oracleResolver = IOracleResolver(oracleResolver_);
        emissionController = IEmissionController(emissionController_);
        feeTreasury = feeTreasury_;
        oracleFeedId = oracleFeedId_;
        strikePrice = strikePrice_;
        comparison = comparison_;
        bettingOpensAt = bettingOpensAt_;
        bettingClosesAt = bettingClosesAt_;
        resolutionTimestamp = resolutionTimestamp_;
        resolutionWindow = resolutionWindow_;
        protocolFeeBps = protocolFeeBps_;
        minBet = minBet_;
        maxBet = maxBet_;
        status = MarketStatus.DRAFT;
    }

    /// @dev Set once by the factory right after initialize(); separate from
    /// initialize() purely so the factory's deploy order doesn't need the
    /// pause registry's address available before the market's own params are.
    function setProtocolPause(address pauseRegistry) external onlyInitialized {
        require(address(protocolPause) == address(0), "Market: pause registry already set");
        protocolPause = ProtocolPause(pauseRegistry);
    }

    function _effectiveStatus() internal view returns (MarketStatus) {
        if (status == MarketStatus.RESOLVED || status == MarketStatus.CANCELLED) return status;
        if (block.timestamp < bettingOpensAt) return MarketStatus.DRAFT;
        if (block.timestamp < bettingClosesAt) return MarketStatus.OPEN;
        return MarketStatus.LOCKED;
    }

    /// @notice Brief §22/§23 — betting both sides is allowed; PAPER emission
    /// still uses net realized loss (PayoutMath.calcNetLoss), not gross stake.
    function bet(Side side, uint256 amount) external nonReentrant onlyInitialized {
        require(address(protocolPause) == address(0) || !protocolPause.paused(), "Market: protocol paused");
        require(_effectiveStatus() == MarketStatus.OPEN, "Market: not open for betting");
        require(amount >= minBet && amount <= maxBet, "Market: amount out of bounds");

        if (status == MarketStatus.DRAFT) status = MarketStatus.OPEN;

        collateral.safeTransferFrom(msg.sender, address(this), amount);

        Position storage pos = positions[msg.sender];
        if (side == Side.YES) {
            pos.yesStake += amount;
            yesPool += amount;
        } else {
            pos.noStake += amount;
            noPool += amount;
        }

        if (block.timestamp >= bettingClosesAt) {
            status = MarketStatus.LOCKED;
        }

        emit BetPlaced(marketId, msg.sender, side, amount);
    }

    /// @notice Permissionless (brief §28) — anyone with a valid report can
    /// resolve; the authority is the verified data, not a trusted keeper.
    function resolve(bytes calldata report, bytes calldata extraData) external nonReentrant onlyInitialized {
        require(status != MarketStatus.RESOLVED, "Market: already resolved");
        require(status != MarketStatus.CANCELLED, "Market: cancelled");
        require(block.timestamp >= resolutionTimestamp, "Market: too early");

        if (status == MarketStatus.OPEN && block.timestamp >= bettingClosesAt) {
            status = MarketStatus.LOCKED;
            emit MarketLocked(marketId, yesPool, noPool);
        }

        if (yesPool == 0 || noPool == 0) {
            _cancel("empty_side_pool");
            return;
        }

        (uint256 price, uint64 observedAt) = oracleResolver.verifyAndResolve(report, extraData);

        require(price > 0, "Market: invalid price");
        require(
            observedAt >= resolutionTimestamp && observedAt <= resolutionTimestamp + resolutionWindow,
            "Market: report outside resolution window"
        );

        bool yesWon_ = _evaluateComparison(price);

        PayoutMath.Settlement memory s;
        try this._settle(yesWon_) returns (PayoutMath.Settlement memory settled) {
            s = settled;
        } catch {
            _cancel("zero_pool_at_settlement");
            return;
        }

        status = MarketStatus.RESOLVED;
        yesWon = s.yesWon;
        resolvedPrice = price;
        reportTimestamp = observedAt;
        protocolFee = s.protocolFee;
        netLosingPool = s.netLosingPool;
        rewardPerWinningShare = s.rewardPerWinningShare;

        if (s.protocolFee > 0) {
            collateral.safeTransfer(feeTreasury, s.protocolFee);
        }

        emit MarketResolved(marketId, s.yesWon, price, s.winningPool, s.losingPool, s.protocolFee);
    }

    /// @dev External-to-self wrapper so `resolve` can `try/catch` the
    /// empty-pool revert from PayoutMath.settlePools (brief §34/§35) and
    /// cancel instead of reverting the whole resolution.
    function _settle(bool yesWon_) external view returns (PayoutMath.Settlement memory) {
        require(msg.sender == address(this), "Market: internal only");
        return PayoutMath.settlePools(yesPool, noPool, yesWon_, protocolFeeBps);
    }

    function _evaluateComparison(uint256 price) internal view returns (bool) {
        if (comparison == Comparison.GREATER_THAN) return price > strikePrice;
        if (comparison == Comparison.GREATER_THAN_OR_EQUAL) return price >= strikePrice;
        if (comparison == Comparison.LESS_THAN) return price < strikePrice;
        return price <= strikePrice; // LESS_THAN_OR_EQUAL
    }

    /// @notice Brief §29 — admin-gated in the factory's deployment (whoever
    /// calls this must already be trusted to act as an emergency guardian);
    /// can never touch a resolved market's finalized outcome.
    function cancel(bytes32 reason) external onlyInitialized {
        require(status != MarketStatus.RESOLVED, "Market: cannot cancel a resolved market");
        _cancel(reason);
    }

    function _cancel(bytes32 reason) internal {
        if (status == MarketStatus.CANCELLED) return;
        status = MarketStatus.CANCELLED;
        cancelReason = reason;
        emit MarketCancelled(marketId, reason);
    }

    /// @notice Winner claim (brief §30/§31) or refund if cancelled — pull-based,
    /// one-time (brief §52 Invariant 3), never loops over other bettors.
    function claimPayout() external nonReentrant onlyInitialized returns (uint256 amount) {
        Position storage pos = positions[msg.sender];
        require(!pos.payoutClaimed, "Market: already claimed");

        if (status == MarketStatus.CANCELLED) {
            amount = pos.yesStake + pos.noStake;
            require(amount > 0, "Market: nothing to refund");
            pos.payoutClaimed = true;
            collateral.safeTransfer(msg.sender, amount);
            emit RefundClaimed(marketId, msg.sender, amount);
            return amount;
        }

        require(status == MarketStatus.RESOLVED, "Market: not resolved");
        uint256 winnerStake = yesWon ? pos.yesStake : pos.noStake;
        (, amount) = PayoutMath.winnerPayout(winnerStake, rewardPerWinningShare);

        pos.payoutClaimed = true;
        if (amount > 0) {
            collateral.safeTransfer(msg.sender, amount);
        }
        emit PayoutClaimed(marketId, msg.sender, amount);
    }

    /// @notice PAPER claim (brief §11/§12/§15/§32) — net realized loss only,
    /// one-time (brief §52 Invariant 4). Zero on a cancelled market (brief §53).
    function claimLossReward() external nonReentrant onlyInitialized returns (uint256 realizedLoss, uint256 paperMinted) {
        require(status == MarketStatus.RESOLVED, "Market: not resolved");
        Position storage pos = positions[msg.sender];
        require(!pos.lossRewardClaimed, "Market: already claimed");
        pos.lossRewardClaimed = true;

        (,, int256 netPnL, uint256 loss) =
            PayoutMath.calcNetLoss(pos.yesStake, pos.noStake, yesWon, rewardPerWinningShare);
        netPnL; // silence unused-var warning; kept for readability of the tuple
        realizedLoss = loss;

        if (realizedLoss > 0) {
            paperMinted = emissionController.claimLossReward(marketId, msg.sender, realizedLoss);
        }
    }
}
