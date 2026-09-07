// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IRewardVault} from "./interfaces/IRewardVault.sol";

/// @title RewardVault
/// @notice Holds NVDA Stock Tokens and pays them to NVID holders pro rata.
/// @dev Reward-per-token accounting (Synthetix StakingRewards lineage) driven
///      by the token's transfer hook instead of explicit staking. Every
///      distribution is O(1): there is never a loop over holders.
///
///      `rewardPerTokenStored` grows by `amount * PRECISION / totalTracked` on
///      each distribution. Each account remembers the value it was last settled
///      at (`paidPerToken`) plus an `owed` balance, so pending rewards are
///
///          owed + tracked * (rewardPerTokenStored - paidPerToken) / PRECISION
///
///      Accounts flagged `excluded` (deployer, AMM pair, fee collector,
///      treasury, burn address…) can hold NVID but earn nothing; their balance
///      is not part of `totalTracked`.
///
///      Storage is packed so the hot path (`onBalanceChange`) touches two
///      slots per account: {tracked, owed, excluded} and {paidPerToken}.
contract RewardVault is IRewardVault, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    // ───────────────────────────── constants ─────────────────────────────

    uint256 private constant PRECISION = 1e18;

    // ──────────────────────────────── types ──────────────────────────────

    struct Account {
        uint128 tracked; // NVID balance counted for rewards
        uint120 owed; // settled but unclaimed rewards
        bool excluded; // earns nothing while true
        uint256 paidPerToken; // rewardPerTokenStored at last settlement
    }

    // ──────────────────────────────── state ──────────────────────────────

    /// @notice The reward asset: NVDA Stock Token.
    IERC20 public immutable rewardToken;
    /// @notice The NVID token, sole caller of `onBalanceChange`.
    IERC20 public immutable nvid;

    uint256 public totalTracked;
    uint256 public rewardPerTokenStored;
    /// @notice Lifetime rewards distributed to holders (claimed or not).
    uint256 public totalDistributed;
    /// @notice Lifetime rewards actually transferred out by `claim()`.
    uint256 public totalClaimed;

    mapping(address account => Account) private _accounts;
    mapping(address account => uint256) public claimedBy;

    // ─────────────────────────────── events ──────────────────────────────

    event RewardsNotified(address indexed from, uint256 amount, uint256 rewardPerToken);
    event Claimed(address indexed account, uint256 amount);
    event ExclusionUpdated(address indexed account, bool excluded);

    // ─────────────────────────────── errors ──────────────────────────────

    error OnlyToken();
    error ZeroAddress();
    error ZeroAmount();
    error NoEligibleHolders();
    error NothingToClaim();
    error AmountExceedsUnaccounted(uint256 requested, uint256 available);

    // ───────────────────────────── modifiers ─────────────────────────────

    modifier onlyToken() {
        if (msg.sender != address(nvid)) revert OnlyToken();
        _;
    }

    // ───────────────────────────── constructor ───────────────────────────

    constructor(address initialOwner, address rewardToken_, address nvid_) Ownable(initialOwner) {
        if (rewardToken_ == address(0) || nvid_ == address(0)) revert ZeroAddress();
        rewardToken = IERC20(rewardToken_);
        nvid = IERC20(nvid_);

        // Neither the vault nor the token contract can ever be a holder.
        _accounts[address(this)].excluded = true;
        _accounts[nvid_].excluded = true;
        emit ExclusionUpdated(address(this), true);
        emit ExclusionUpdated(nvid_, true);
    }

    // ──────────────────────────────── hooks ──────────────────────────────

    /// @inheritdoc IRewardVault
    function onBalanceChange(address account, uint256 newBalance) external onlyToken {
        _track(account, newBalance);
    }

    /// @notice Re-read `account`'s NVID balance into the vault.
    /// @dev Permissionless. Useful for a holder who received NVID before the
    ///      vault was wired to the token, or after a re-inclusion.
    function sync(address account) external {
        _track(account, nvid.balanceOf(account));
    }

    // ───────────────────────────── rewards in ────────────────────────────

    /// @inheritdoc IRewardVault
    function depositRewards(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        _distribute(amount);
    }

    /// @inheritdoc IRewardVault
    /// @dev Permissionless, but bounded by `unaccountedRewards()` so nobody can
    ///      promise holders tokens the vault does not hold.
    function notifyRewardAmount(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 available = unaccountedRewards();
        if (amount > available) revert AmountExceedsUnaccounted(amount, available);
        _distribute(amount);
    }

    // ───────────────────────────── rewards out ───────────────────────────

    /// @inheritdoc IRewardVault
    function claim() external nonReentrant returns (uint256 amount) {
        Account storage a = _accounts[msg.sender];
        uint256 rpt = rewardPerTokenStored;

        amount = a.owed + _accrued(a.tracked, rpt, a.paidPerToken);
        if (amount == 0) revert NothingToClaim();

        a.owed = 0;
        a.paidPerToken = rpt;
        totalClaimed += amount;
        claimedBy[msg.sender] += amount;

        rewardToken.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    // ──────────────────────────────── admin ──────────────────────────────

    /// @notice Exclude (or re-include) an account from rewards.
    /// @dev Excluding settles what the account already earned — it stays
    ///      claimable — then removes its balance from `totalTracked`.
    function setExcluded(address account, bool excluded) external onlyOwner {
        Account storage a = _accounts[account];
        if (a.excluded == excluded) return;

        if (excluded) {
            _track(account, 0);
            a.excluded = true;
        } else {
            a.excluded = false;
            _track(account, nvid.balanceOf(account));
        }
        emit ExclusionUpdated(account, excluded);
    }

    // ──────────────────────────────── views ──────────────────────────────

    /// @inheritdoc IRewardVault
    function pendingRewards(address account) external view returns (uint256) {
        Account storage a = _accounts[account];
        return a.owed + _accrued(a.tracked, rewardPerTokenStored, a.paidPerToken);
    }

    function trackedBalanceOf(address account) external view returns (uint256) {
        return _accounts[account].tracked;
    }

    function isExcluded(address account) external view returns (bool) {
        return _accounts[account].excluded;
    }

    /// @notice Reward tokens held by the vault that are not yet promised to holders.
    function unaccountedRewards() public view returns (uint256) {
        uint256 balance = rewardToken.balanceOf(address(this));
        uint256 reserved = totalDistributed - totalClaimed;
        return balance > reserved ? balance - reserved : 0;
    }

    // ────────────────────────────── internals ────────────────────────────

    function _track(address account, uint256 newBalance) private {
        Account storage a = _accounts[account];
        if (a.excluded) return;

        uint256 rpt = rewardPerTokenStored;
        uint256 tracked = a.tracked;

        uint256 accrued = _accrued(tracked, rpt, a.paidPerToken);
        if (accrued != 0) a.owed = (uint256(a.owed) + accrued).toUint120();
        a.paidPerToken = rpt;

        if (newBalance != tracked) {
            a.tracked = newBalance.toUint128();
            totalTracked = totalTracked + newBalance - tracked;
        }
    }

    function _distribute(uint256 amount) private {
        uint256 supply = totalTracked;
        if (supply == 0) revert NoEligibleHolders();

        uint256 rpt = rewardPerTokenStored + (amount * PRECISION) / supply;
        rewardPerTokenStored = rpt;
        totalDistributed += amount;
        emit RewardsNotified(msg.sender, amount, rpt);
    }

    function _accrued(uint256 tracked, uint256 rpt, uint256 paid) private pure returns (uint256) {
        return (tracked * (rpt - paid)) / PRECISION;
    }
}
