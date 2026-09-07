// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRewardVault} from "./interfaces/IRewardVault.sol";
import {IUniswapV3SwapRouter} from "./interfaces/IUniswapV3SwapRouter.sol";

/// @title FeeCollector
/// @notice Receives every NVID trade fee and turns it into NVDA rewards.
/// @dev Pipeline, each step callable on its own or all at once via `process()`:
///
///        collect()     split fresh NVID 50 / 25 / 25 between the rewards bucket,
///                      the liquidity receiver and the treasury (on a 2% trade
///                      fee that is 1% / 0.5% / 0.5% of volume).
///        swapToNVDA()  swap the rewards bucket for NVDA through a Uniswap V3
///                      compatible router. Router and path are replaceable.
///        sendToVault() push the NVDA to the RewardVault and notify it.
///
///      The swap is isolated in `_swap`, behind `IUniswapV3SwapRouter`, so
///      pointing at a different router (or overriding `_swap`) never touches
///      the accounting.
contract FeeCollector is Ownable {
    using SafeERC20 for IERC20;

    // ───────────────────────────── constants ─────────────────────────────

    uint256 public constant BPS = 10_000;

    // ──────────────────────────────── state ──────────────────────────────

    IERC20 public immutable nvid;
    IERC20 public immutable nvda;

    IRewardVault public rewardVault;
    address public treasury;
    address public liquidityReceiver;

    IUniswapV3SwapRouter public swapRouter;
    /// @notice Uniswap V3 encoded path NVID -> ... -> NVDA.
    bytes public swapPath;

    uint16 public rewardsShareBps = 5_000; // 50% of the fee = 1% of volume
    uint16 public liquidityShareBps = 2_500; // 25% of the fee = 0.5% of volume
    uint16 public treasuryShareBps = 2_500; // 25% of the fee = 0.5% of volume

    /// @notice NVID collected for rewards and not yet swapped.
    uint256 public rewardsBucket;

    uint256 public totalCollected;
    uint256 public totalNvidSwapped;
    uint256 public totalNvdaBought;
    uint256 public totalSentToVault;

    mapping(address account => bool) public isKeeper;

    // ─────────────────────────────── events ──────────────────────────────

    event Collected(uint256 total, uint256 toRewards, uint256 toLiquidity, uint256 toTreasury);
    event Swapped(uint256 nvidIn, uint256 nvdaOut);
    event SentToVault(uint256 amount);
    event KeeperUpdated(address indexed keeper, bool allowed);
    event SharesUpdated(uint16 rewardsBps, uint16 liquidityBps, uint16 treasuryBps);
    event SwapRouterUpdated(address indexed previousRouter, address indexed newRouter);
    event SwapPathUpdated(bytes path);
    event RewardVaultUpdated(address indexed previousVault, address indexed newVault);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event LiquidityReceiverUpdated(address indexed previousReceiver, address indexed newReceiver);
    event Rescued(address indexed token, address indexed to, uint256 amount);

    // ─────────────────────────────── errors ──────────────────────────────

    error NotKeeper();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidShares();
    error SwapRouterNotSet();
    error SwapPathNotSet();
    error InsufficientBucket(uint256 requested, uint256 available);
    error NothingToSend();
    error CannotRescueManagedToken();

    // ───────────────────────────── modifiers ─────────────────────────────

    modifier onlyKeeper() {
        if (msg.sender != owner() && !isKeeper[msg.sender]) revert NotKeeper();
        _;
    }

    // ───────────────────────────── constructor ───────────────────────────

    /// @param swapRouter_ May be zero and set later with `setSwapRouter`.
    /// @param swapPath_ May be empty and set later with `setSwapPath`.
    constructor(
        address initialOwner,
        address nvid_,
        address nvda_,
        address rewardVault_,
        address treasury_,
        address liquidityReceiver_,
        address swapRouter_,
        bytes memory swapPath_
    ) Ownable(initialOwner) {
        if (
            nvid_ == address(0) || nvda_ == address(0) || rewardVault_ == address(0) || treasury_ == address(0)
                || liquidityReceiver_ == address(0)
        ) revert ZeroAddress();

        nvid = IERC20(nvid_);
        nvda = IERC20(nvda_);
        rewardVault = IRewardVault(rewardVault_);
        treasury = treasury_;
        liquidityReceiver = liquidityReceiver_;
        swapRouter = IUniswapV3SwapRouter(swapRouter_);
        swapPath = swapPath_;

        emit RewardVaultUpdated(address(0), rewardVault_);
        emit TreasuryUpdated(address(0), treasury_);
        emit LiquidityReceiverUpdated(address(0), liquidityReceiver_);
        emit SwapRouterUpdated(address(0), swapRouter_);
        emit SwapPathUpdated(swapPath_);
    }

    // ─────────────────────────────── pipeline ────────────────────────────

    /// @notice Allocate every NVID received since the last call.
    /// @dev Permissionless: the split is fixed, nothing to front-run.
    function collect() public returns (uint256 collected) {
        uint256 balance = nvid.balanceOf(address(this));
        collected = balance - rewardsBucket; // everything not already earmarked
        if (collected == 0) return 0;

        uint256 toLiquidity = (collected * liquidityShareBps) / BPS;
        uint256 toTreasury = (collected * treasuryShareBps) / BPS;
        uint256 toRewards = collected - toLiquidity - toTreasury; // remainder absorbs rounding

        rewardsBucket += toRewards;
        totalCollected += collected;

        if (toLiquidity != 0) nvid.safeTransfer(liquidityReceiver, toLiquidity);
        if (toTreasury != 0) nvid.safeTransfer(treasury, toTreasury);

        emit Collected(collected, toRewards, toLiquidity, toTreasury);
    }

    /// @notice Swap `amountIn` NVID from the rewards bucket into NVDA.
    /// @param amountOutMinimum Slippage floor; keepers compute it off-chain.
    function swapToNVDA(uint256 amountIn, uint256 amountOutMinimum) public onlyKeeper returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (amountIn > rewardsBucket) revert InsufficientBucket(amountIn, rewardsBucket);
        if (address(swapRouter) == address(0)) revert SwapRouterNotSet();
        if (swapPath.length == 0) revert SwapPathNotSet();

        rewardsBucket -= amountIn;
        totalNvidSwapped += amountIn;

        nvid.forceApprove(address(swapRouter), amountIn);
        amountOut = _swap(amountIn, amountOutMinimum);
        totalNvdaBought += amountOut;

        emit Swapped(amountIn, amountOut);
    }

    /// @notice Move every NVDA held here into the RewardVault and distribute it.
    /// @dev Permissionless: the vault only accepts what it actually received.
    function sendToVault() public returns (uint256 amount) {
        amount = nvda.balanceOf(address(this));
        if (amount == 0) revert NothingToSend();

        totalSentToVault += amount;
        nvda.safeTransfer(address(rewardVault), amount);
        rewardVault.notifyRewardAmount(amount);

        emit SentToVault(amount);
    }

    /// @notice collect → swap the whole bucket → send to vault, in one transaction.
    function process(uint256 amountOutMinimum) external onlyKeeper {
        collect();
        uint256 bucket = rewardsBucket;
        if (bucket != 0) swapToNVDA(bucket, amountOutMinimum);
        if (nvda.balanceOf(address(this)) != 0) sendToVault();
    }

    // ──────────────────────────────── admin ──────────────────────────────

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        if (keeper == address(0)) revert ZeroAddress();
        isKeeper[keeper] = allowed;
        emit KeeperUpdated(keeper, allowed);
    }

    /// @notice Update the fee split. Must sum to 100%.
    function setShares(uint16 rewardsBps, uint16 liquidityBps, uint16 treasuryBps) external onlyOwner {
        if (uint256(rewardsBps) + liquidityBps + treasuryBps != BPS) revert InvalidShares();
        rewardsShareBps = rewardsBps;
        liquidityShareBps = liquidityBps;
        treasuryShareBps = treasuryBps;
        emit SharesUpdated(rewardsBps, liquidityBps, treasuryBps);
    }

    /// @notice Replace the DEX router. Any `IUniswapV3SwapRouter` works.
    function setSwapRouter(address newRouter) external onlyOwner {
        emit SwapRouterUpdated(address(swapRouter), newRouter);
        swapRouter = IUniswapV3SwapRouter(newRouter);
    }

    /// @notice Replace the encoded swap path (NVID -> ... -> NVDA).
    function setSwapPath(bytes calldata newPath) external onlyOwner {
        swapPath = newPath;
        emit SwapPathUpdated(newPath);
    }

    function setRewardVault(address newVault) external onlyOwner {
        if (newVault == address(0)) revert ZeroAddress();
        emit RewardVaultUpdated(address(rewardVault), newVault);
        rewardVault = IRewardVault(newVault);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setLiquidityReceiver(address newReceiver) external onlyOwner {
        if (newReceiver == address(0)) revert ZeroAddress();
        emit LiquidityReceiverUpdated(liquidityReceiver, newReceiver);
        liquidityReceiver = newReceiver;
    }

    /// @notice Recover a token sent here by mistake. NVID and NVDA are managed
    ///         by the pipeline and cannot be rescued.
    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (token == address(nvid) || token == address(nvda)) revert CannotRescueManagedToken();
        IERC20(token).safeTransfer(to, amount);
        emit Rescued(token, to, amount);
    }

    // ────────────────────────────── internals ────────────────────────────

    /// @dev The only place that knows about the DEX. Override to target
    ///      another venue without touching the accounting above.
    function _swap(uint256 amountIn, uint256 amountOutMinimum) internal virtual returns (uint256 amountOut) {
        amountOut = swapRouter.exactInput(
            IUniswapV3SwapRouter.ExactInputParams({
                path: swapPath,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum
            })
        );
    }
}
