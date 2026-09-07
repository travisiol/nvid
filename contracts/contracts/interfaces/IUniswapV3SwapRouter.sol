// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.28;

/// @title IUniswapV3SwapRouter
/// @notice Minimal subset of Uniswap V3's `ISwapRouter` used by FeeCollector.
/// @dev Any router exposing this shape — Uniswap V3 itself or one of its
///      forks — can be plugged in with `FeeCollector.setSwapRouter()`.
///      The struct layout matches the original SwapRouter (with `deadline`).
///      If your target chain only ships SwapRouter02 (no deadline field),
///      deploy a thin adapter that implements this interface in front of it.
interface IUniswapV3SwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    /// @notice Swap `amountIn` of one token for as much as possible of another.
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    /// @notice Swap `amountIn` along an encoded multi-hop `path`.
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}
