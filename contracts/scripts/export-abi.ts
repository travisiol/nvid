import hre from "hardhat";
import { exportAbis } from "./lib/exportAbi";

/**
 * Manual ABI export. `hardhat compile` already runs this automatically;
 * use `npm run export-abi` after editing deployments/*.json by hand.
 */
async function main() {
  await exportAbis(hre);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
