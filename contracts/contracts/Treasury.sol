// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Treasury
/// @notice Owner-controlled vault for the treasury share of fees.
/// @dev Holds any ERC20 (NVID from the FeeCollector by default) and native
///      ETH. `emergencyPause` freezes every withdrawal until `unpause`.
contract Treasury is Ownable, Pausable {
    using SafeERC20 for IERC20;

    event Withdrawn(address indexed token, address indexed to, uint256 amount);
    event WithdrawnETH(address indexed to, uint256 amount);
    event Received(address indexed from, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error ETHTransferFailed();

    constructor(address initialOwner) Ownable(initialOwner) {}

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /// @notice Withdraw `amount` of `token` to `to`.
    function withdraw(address token, address to, uint256 amount) external onlyOwner whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount);
    }

    /// @notice Withdraw native ETH.
    function withdrawETH(address to, uint256 amount) external onlyOwner whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert ETHTransferFailed();
        emit WithdrawnETH(to, amount);
    }

    /// @notice Freeze all withdrawals.
    function emergencyPause() external onlyOwner {
        _pause();
    }

    /// @notice Lift the freeze.
    function unpause() external onlyOwner {
        _unpause();
    }
}
