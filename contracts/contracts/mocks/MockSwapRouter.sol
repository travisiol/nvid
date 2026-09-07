// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IUniswapV3SwapRouter} from "../interfaces/IUniswapV3SwapRouter.sol";

/// @title MockSwapRouter
/// @notice Fixed-rate stand-in for a Uniswap V3 router. Test only.
/// @dev Pulls `tokenIn` from the caller and pays `tokenOut` from its own
///      balance at `amountIn * rateNumerator / rateDenominator`.
contract MockSwapRouter is IUniswapV3SwapRouter {
    using SafeERC20 for IERC20;

    uint256 public immutable rateNumerator;
    uint256 public immutable rateDenominator;

    error TooLittleReceived(uint256 amountOut, uint256 minimum);
    error Expired();

    constructor(uint256 rateNumerator_, uint256 rateDenominator_) {
        rateNumerator = rateNumerator_;
        rateDenominator = rateDenominator_;
    }

    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256 amountOut) {
        if (p.deadline < block.timestamp) revert Expired();
        amountOut = _swap(p.tokenIn, p.tokenOut, p.recipient, p.amountIn, p.amountOutMinimum);
    }

    function exactInput(ExactInputParams calldata p) external payable returns (uint256 amountOut) {
        if (p.deadline < block.timestamp) revert Expired();
        (address tokenIn, address tokenOut) = _endpoints(p.path);
        amountOut = _swap(tokenIn, tokenOut, p.recipient, p.amountIn, p.amountOutMinimum);
    }

    function _swap(address tokenIn, address tokenOut, address recipient, uint256 amountIn, uint256 minOut)
        private
        returns (uint256 amountOut)
    {
        amountOut = (amountIn * rateNumerator) / rateDenominator;
        if (amountOut < minOut) revert TooLittleReceived(amountOut, minOut);
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }

    /// @dev Uniswap V3 path: token(20) | fee(3) | token(20) [| fee(3) | token(20) ...]
    function _endpoints(bytes calldata path) private pure returns (address tokenIn, address tokenOut) {
        require(path.length >= 43, "bad path");
        tokenIn = address(bytes20(path[0:20]));
        tokenOut = address(bytes20(path[path.length - 20:]));
    }
}
