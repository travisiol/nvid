import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";
import { ethers, network } from "hardhat";
import { deploymentsDir, exportAbis, type DeploymentRecord } from "./lib/exportAbi";

const DEAD = "0x000000000000000000000000000000000000dEaD";

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
}

function isLocal(): boolean {
  return network.name === "hardhat" || network.name === "localhost";
}

/**
 * Deploys and wires the four contracts:
 *
 *   Treasury ─┐
 *   NVIDToken ─┼─▶ FeeCollector ─▶ RewardVault
 *              └────────────────▶ RewardVault (balance hooks)
 *
 * The deployer keeps ownership while wiring, then hands everything to
 * OWNER_ADDRESS (a multisig in production) if one is set.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = env("OWNER_ADDRESS") ?? deployer.address;
  const liquidityReceiver = env("LIQUIDITY_RECEIVER") ?? owner;
  const swapRouter = env("SWAP_ROUTER_ADDRESS") ?? ethers.ZeroAddress;
  const swapPath = env("SWAP_PATH") ?? "0x";
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  console.log(`Network   : ${network.name} (chainId ${chainId})`);
  console.log(`Deployer  : ${deployer.address}`);
  console.log(`Owner     : ${owner}`);

  // ── NVDA Stock Token ──────────────────────────────────────────────────────
  let nvdaAddress = env("NVDA_TOKEN_ADDRESS");
  if (!nvdaAddress) {
    if (!isLocal()) {
      throw new Error("NVDA_TOKEN_ADDRESS is required outside the hardhat/localhost networks.");
    }
    const mock = await (await ethers.getContractFactory("MockERC20")).deploy("NVIDIA Stock Token", "NVDA", 18);
    await mock.waitForDeployment();
    nvdaAddress = await mock.getAddress();
    console.log(`MockERC20 (NVDA stand-in) : ${nvdaAddress}`);
  }

  // ── Treasury ─────────────────────────────────────────────────────────────
  const treasury = await (await ethers.getContractFactory("Treasury")).deploy(owner);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log(`Treasury     : ${treasuryAddress}`);

  // ── NVIDToken (fee receiver wired below once the collector exists) ───────
  const token = await (await ethers.getContractFactory("NVIDToken")).deploy(deployer.address, ethers.ZeroAddress);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`NVIDToken    : ${tokenAddress}`);

  // ── RewardVault ──────────────────────────────────────────────────────────
  const vault = await (await ethers.getContractFactory("RewardVault")).deploy(deployer.address, nvdaAddress, tokenAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`RewardVault  : ${vaultAddress}`);

  // ── FeeCollector ─────────────────────────────────────────────────────────
  const collector = await (
    await ethers.getContractFactory("FeeCollector")
  ).deploy(deployer.address, tokenAddress, nvdaAddress, vaultAddress, treasuryAddress, liquidityReceiver, swapRouter, swapPath);
  await collector.waitForDeployment();
  const collectorAddress = await collector.getAddress();
  console.log(`FeeCollector : ${collectorAddress}`);

  // ── Wiring ───────────────────────────────────────────────────────────────
  console.log("Wiring…");
  await (await token.setRewardVault(vaultAddress)).wait();
  await (await token.updateFeeReceiver(collectorAddress)).wait();
  await (await token.setExcludedFromFees(treasuryAddress, true)).wait();
  await (await token.setExcludedFromFees(vaultAddress, true)).wait();
  if (owner !== deployer.address) {
    await (await token.setExcludedFromFees(owner, true)).wait();
  }

  // Accounts that hold NVID without earning NVDA.
  const excludedFromRewards = new Set<string>([deployer.address, owner, collectorAddress, treasuryAddress, DEAD]);
  if (liquidityReceiver !== owner) excludedFromRewards.add(liquidityReceiver);
  if (swapRouter !== ethers.ZeroAddress) excludedFromRewards.add(swapRouter);
  for (const account of excludedFromRewards) {
    await (await vault.setExcluded(account, true)).wait();
  }

  // ── Hand over ────────────────────────────────────────────────────────────
  if (owner !== deployer.address) {
    console.log(`Transferring ownership to ${owner}…`);
    await (await token.transferOwnership(owner)).wait();
    await (await vault.transferOwnership(owner)).wait();
    await (await collector.transferOwnership(owner)).wait();
  }

  // ── Record + export ──────────────────────────────────────────────────────
  const record: DeploymentRecord = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    owner,
    nvdaToken: nvdaAddress,
    timestamp: new Date().toISOString(),
    contracts: {
      NVIDToken: tokenAddress,
      FeeCollector: collectorAddress,
      RewardVault: vaultAddress,
      Treasury: treasuryAddress,
    },
  };

  const dir = deploymentsDir(hre);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`Deployment written to ${path.relative(process.cwd(), file)}`);

  await exportAbis(hre);

  console.log("\nNext steps:");
  console.log("  1. Create the NVID liquidity pool, then token.setAmmPair(<pool>, true)");
  console.log("     and vault.setExcluded(<pool>, true).");
  console.log("  2. If not set at deploy: collector.setSwapRouter(<router>) and collector.setSwapPath(<path>).");
  console.log("  3. Run collector.process(minOut) from a keeper to push the first NVDA into the vault.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
