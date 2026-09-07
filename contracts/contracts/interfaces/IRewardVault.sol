// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IRewardVault
/// @notice Interface of the vault that pays NVDA Stock Token to NVID holders.
interface IRewardVault {
    /// @notice Hook called by the NVID token after every balance change.
    function onBalanceChange(address account, uint256 newBalance) external;

    /// @notice Pull `amount` reward tokens from the caller and distribute them.
    function depositRewards(uint256 amount) external;

    /// @notice Distribute `amount` reward tokens that were already transferred to the vault.
    function notifyRewardAmount(uint256 amount) external;

    /// @notice Rewards claimable right now by `account`.
    function pendingRewards(address account) external view returns (uint256);

    /// @notice Transfer all pending rewards to the caller.
    function claim() external returns (uint256);
}
