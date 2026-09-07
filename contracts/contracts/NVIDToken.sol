// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRewardVault} from "./interfaces/IRewardVault.sol";

/// @title NVIDToken
/// @notice NVID — fixed-supply ERC20 with a buy/sell fee routed to a FeeCollector.
/// @dev Fees are taken only on transfers that touch a registered AMM pair:
///      pair -> wallet is a buy, wallet -> pair is a sell. Wallet-to-wallet
///      transfers are free. After every transfer the new balances are reported
///      to the RewardVault, which is how holders accrue NVDA without any loop
///      over holders.
contract NVIDToken is ERC20, Ownable {
    // ───────────────────────────── constants ─────────────────────────────

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 public constant BPS = 10_000;
    /// @notice Hard cap on either fee: 5%.
    uint256 public constant MAX_FEE_BPS = 500;

    // ──────────────────────────────── state ──────────────────────────────

    uint16 public buyFeeBps = 200; // 2%
    uint16 public sellFeeBps = 200; // 2%

    /// @notice Receives every fee (the FeeCollector).
    address public feeReceiver;
    /// @notice Receives balance-change hooks. Zero address disables the hooks.
    IRewardVault public rewardVault;

    mapping(address account => bool) public isExcludedFromFees;
    mapping(address pair => bool) public isAmmPair;

    // ─────────────────────────────── events ──────────────────────────────

    event FeesUpdated(uint16 buyFeeBps, uint16 sellFeeBps);
    event FeeReceiverUpdated(address indexed previousReceiver, address indexed newReceiver);
    event RewardVaultUpdated(address indexed previousVault, address indexed newVault);
    event ExcludedFromFees(address indexed account, bool excluded);
    event AmmPairUpdated(address indexed pair, bool isPair);

    // ─────────────────────────────── errors ──────────────────────────────

    error ZeroAddress();
    error FeeTooHigh(uint256 requested, uint256 max);

    // ───────────────────────────── constructor ───────────────────────────

    /// @param initialOwner Receives the whole supply and owns the contract.
    /// @param feeReceiver_ FeeCollector address. May be zero at deploy time and
    ///        set later with `updateFeeReceiver`; fees are not charged until then.
    constructor(address initialOwner, address feeReceiver_) ERC20("NVID", "NVID") Ownable(initialOwner) {
        isExcludedFromFees[initialOwner] = true;
        isExcludedFromFees[address(this)] = true;
        emit ExcludedFromFees(initialOwner, true);
        emit ExcludedFromFees(address(this), true);

        if (feeReceiver_ != address(0)) {
            feeReceiver = feeReceiver_;
            isExcludedFromFees[feeReceiver_] = true;
            emit FeeReceiverUpdated(address(0), feeReceiver_);
            emit ExcludedFromFees(feeReceiver_, true);
        }

        _mint(initialOwner, TOTAL_SUPPLY);
    }

    // ──────────────────────────────── owner ──────────────────────────────

    /// @notice Set buy and sell fees in basis points. Each capped at MAX_FEE_BPS.
    function setFees(uint16 buyFeeBps_, uint16 sellFeeBps_) external onlyOwner {
        if (buyFeeBps_ > MAX_FEE_BPS) revert FeeTooHigh(buyFeeBps_, MAX_FEE_BPS);
        if (sellFeeBps_ > MAX_FEE_BPS) revert FeeTooHigh(sellFeeBps_, MAX_FEE_BPS);
        buyFeeBps = buyFeeBps_;
        sellFeeBps = sellFeeBps_;
        emit FeesUpdated(buyFeeBps_, sellFeeBps_);
    }

    /// @notice Point fees at a new FeeCollector. The receiver is fee-exempt.
    function updateFeeReceiver(address newReceiver) external onlyOwner {
        if (newReceiver == address(0)) revert ZeroAddress();
        emit FeeReceiverUpdated(feeReceiver, newReceiver);
        feeReceiver = newReceiver;
        if (!isExcludedFromFees[newReceiver]) {
            isExcludedFromFees[newReceiver] = true;
            emit ExcludedFromFees(newReceiver, true);
        }
    }

    /// @notice Wire (or, with the zero address, disconnect) the RewardVault hook.
    /// @dev Disconnecting is the escape hatch if the vault ever reverts.
    function setRewardVault(address newVault) external onlyOwner {
        emit RewardVaultUpdated(address(rewardVault), newVault);
        rewardVault = IRewardVault(newVault);
    }

    function setExcludedFromFees(address account, bool excluded) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        isExcludedFromFees[account] = excluded;
        emit ExcludedFromFees(account, excluded);
    }

    /// @notice Register a DEX pair / pool. Transfers from it are buys, to it are sells.
    function setAmmPair(address pair, bool isPair) external onlyOwner {
        if (pair == address(0)) revert ZeroAddress();
        isAmmPair[pair] = isPair;
        emit AmmPairUpdated(pair, isPair);
    }

    // ────────────────────────────── internals ────────────────────────────

    /// @dev Single override point in OpenZeppelin 5: mint, burn and transfer
    ///      all flow through here.
    function _update(address from, address to, uint256 value) internal override {
        uint256 fee = _feeFor(from, to, value);
        address receiver = feeReceiver;

        if (fee != 0 && receiver != address(0)) {
            super._update(from, receiver, fee);
            unchecked {
                value -= fee; // fee <= value by construction
            }
        } else {
            fee = 0;
        }

        super._update(from, to, value);

        IRewardVault vault = rewardVault;
        if (address(vault) != address(0)) {
            if (from != address(0)) vault.onBalanceChange(from, balanceOf(from));
            if (to != address(0)) vault.onBalanceChange(to, balanceOf(to));
            if (fee != 0) vault.onBalanceChange(receiver, balanceOf(receiver));
        }
    }

    function _feeFor(address from, address to, uint256 value) private view returns (uint256) {
        if (from == address(0) || to == address(0)) return 0; // mint / burn
        if (isExcludedFromFees[from] || isExcludedFromFees[to]) return 0;
        if (isAmmPair[from]) return (value * buyFeeBps) / BPS; // buy
        if (isAmmPair[to]) return (value * sellFeeBps) / BPS; // sell
        return 0; // wallet to wallet
    }
}
