# NVID contracts

Solidity 0.8.28 · Hardhat 2 · OpenZeppelin 5. Full documentation lives in the [root README](../README.md).

```bash
npm install
npx hardhat test              # 26 tests
npm run deploy:local          # in-process Hardhat network, MockERC20 stands in for NVDA
npm run deploy:robinhood      # needs .env — see .env.example
```

| Contract           | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `NVIDToken.sol`    | ERC20 with buy/sell fee, exclusions, AMM pair registry, vault hooks |
| `FeeCollector.sol` | collect → swapToNVDA (Uniswap V3 router, replaceable) → sendToVault |
| `RewardVault.sol`  | reward-per-token vault paying NVDA Stock Token, O(1) per action |
| `Treasury.sol`     | Ownable + Pausable vault with withdraw / emergencyPause         |

`hardhat compile` writes the ABIs to `../frontend/lib/abi/` (typed `as const`) and rebuilds
`deployments.ts` from `deployments/*.json`. Disable with `SKIP_ABI_EXPORT=true`.
