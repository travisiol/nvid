import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const E18 = 10n ** 18n;
/** Whole-token helper: units(1000) = 1000 * 1e18. Works for NVID and NVDA (both 18 decimals). */
const units = (n: number | string) => ethers.parseUnits(String(n), 18);

const DEAD = "0x000000000000000000000000000000000000dEaD";

/**
 * Full stack: mock NVDA, Treasury, NVIDToken, RewardVault, MockSwapRouter,
 * FeeCollector — wired exactly like scripts/deploy.ts.
 *
 *   deployer  holds the 1B supply, excluded from rewards
 *   pair      an EOA registered as the AMM pair (buys come from it, sells go to it)
 *   router    pays 1 NVDA per 1,000 NVID
 */
async function deployFixture() {
  const [deployer, alice, bob, carol, pair, lpReceiver, keeper, stranger] = await ethers.getSigners();

  const nvda = await (await ethers.getContractFactory("MockERC20")).deploy("NVIDIA Stock Token", "NVDA", 18);
  const treasury = await (await ethers.getContractFactory("Treasury")).deploy(deployer.address);
  const token = await (await ethers.getContractFactory("NVIDToken")).deploy(deployer.address, ethers.ZeroAddress);

  const [nvdaAddress, treasuryAddress, tokenAddress] = await Promise.all([
    nvda.getAddress(),
    treasury.getAddress(),
    token.getAddress(),
  ]);

  const vault = await (await ethers.getContractFactory("RewardVault")).deploy(deployer.address, nvdaAddress, tokenAddress);
  const vaultAddress = await vault.getAddress();

  const router = await (await ethers.getContractFactory("MockSwapRouter")).deploy(1, 1000);
  const routerAddress = await router.getAddress();
  const swapPath = ethers.solidityPacked(["address", "uint24", "address"], [tokenAddress, 3000, nvdaAddress]);

  const collector = await (
    await ethers.getContractFactory("FeeCollector")
  ).deploy(deployer.address, tokenAddress, nvdaAddress, vaultAddress, treasuryAddress, lpReceiver.address, routerAddress, swapPath);
  const collectorAddress = await collector.getAddress();

  // Wiring
  await token.setRewardVault(vaultAddress);
  await token.updateFeeReceiver(collectorAddress);
  await token.setExcludedFromFees(treasuryAddress, true);
  await token.setExcludedFromFees(vaultAddress, true);
  await token.setAmmPair(pair.address, true);

  // Everything that holds NVID without being a holder: deployer, the AMM pair,
  // the pipeline contracts, the LP manager, the router (a pool in production)
  // and the burn address.
  for (const account of [
    deployer.address,
    pair.address,
    collectorAddress,
    treasuryAddress,
    lpReceiver.address,
    routerAddress,
    DEAD,
  ]) {
    await vault.setExcluded(account, true);
  }
  await collector.setKeeper(keeper.address, true);

  // Router inventory so swaps can pay out
  await nvda.mint(routerAddress, units(1_000_000));

  return {
    deployer,
    alice,
    bob,
    carol,
    pair,
    lpReceiver,
    keeper,
    stranger,
    nvda,
    treasury,
    token,
    vault,
    router,
    collector,
    swapPath,
    nvdaAddress,
    treasuryAddress,
    tokenAddress,
    vaultAddress,
    routerAddress,
    collectorAddress,
  };
}

/** Fund a holder from the fixed supply and drop some NVDA into the deployer's hands for deposits. */
async function fundHolders(f: Awaited<ReturnType<typeof deployFixture>>, amounts: Record<string, bigint>) {
  for (const [who, amount] of Object.entries(amounts)) {
    const signer = (f as never as Record<string, { address: string }>)[who];
    await f.token.transfer(signer.address, amount);
  }
}

describe("NVID", function () {
  // ─────────────────────────────────────────────────────────────────────────
  describe("Reward distribution scenario", function () {
    it("Alice (1,000 NVID) earns 100 NVDA and Bob (500 NVID) earns 50 NVDA from a 150 NVDA deposit, and both can claim", async function () {
      const f = await loadFixture(deployFixture);
      const { deployer, alice, bob, token, vault, nvda, vaultAddress } = f;

      // NVID has a fixed supply minted to the deployer at construction, so
      // "minting" to Alice and Bob is a transfer out of that supply.
      await token.transfer(alice.address, units(1000));
      await token.transfer(bob.address, units(500));

      expect(await token.balanceOf(alice.address)).to.equal(units(1000));
      expect(await token.balanceOf(bob.address)).to.equal(units(500));
      expect(await vault.totalTracked()).to.equal(units(1500));

      // Deposit 150 NVDA into the vault
      await nvda.mint(deployer.address, units(150));
      await nvda.approve(vaultAddress, units(150));
      await expect(vault.depositRewards(units(150)))
        .to.emit(vault, "RewardsNotified")
        .withArgs(deployer.address, units(150), (units(150) * E18) / units(1500));

      // 1000 / 1500 * 150 = 100 ; 500 / 1500 * 150 = 50
      expect(await vault.pendingRewards(alice.address)).to.equal(units(100));
      expect(await vault.pendingRewards(bob.address)).to.equal(units(50));

      // Claim
      await expect(vault.connect(alice).claim()).to.emit(vault, "Claimed").withArgs(alice.address, units(100));
      await expect(vault.connect(bob).claim()).to.emit(vault, "Claimed").withArgs(bob.address, units(50));

      expect(await nvda.balanceOf(alice.address)).to.equal(units(100));
      expect(await nvda.balanceOf(bob.address)).to.equal(units(50));
      expect(await nvda.balanceOf(vaultAddress)).to.equal(0n);

      expect(await vault.pendingRewards(alice.address)).to.equal(0n);
      expect(await vault.pendingRewards(bob.address)).to.equal(0n);
      expect(await vault.claimedBy(alice.address)).to.equal(units(100));
      expect(await vault.claimedBy(bob.address)).to.equal(units(50));
      expect(await vault.totalDistributed()).to.equal(units(150));
      expect(await vault.totalClaimed()).to.equal(units(150));

      // Nothing left to claim
      await expect(vault.connect(alice).claim()).to.be.revertedWithCustomError(vault, "NothingToClaim");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("NVIDToken", function () {
    it("mints the whole 1,000,000,000 supply to the owner", async function () {
      const { token, deployer } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal("NVID");
      expect(await token.symbol()).to.equal("NVID");
      expect(await token.decimals()).to.equal(18);
      expect(await token.totalSupply()).to.equal(units(1_000_000_000));
      expect(await token.balanceOf(deployer.address)).to.equal(units(1_000_000_000));
    });

    it("charges 2% on buys (pair -> wallet) and routes it to the FeeCollector", async function () {
      const { token, pair, alice, collectorAddress } = await loadFixture(deployFixture);
      await token.transfer(pair.address, units(10_000)); // seeding the pair: deployer is fee-exempt

      await token.connect(pair).transfer(alice.address, units(1000));

      expect(await token.balanceOf(alice.address)).to.equal(units(980));
      expect(await token.balanceOf(collectorAddress)).to.equal(units(20));
    });

    it("charges 2% on sells (wallet -> pair)", async function () {
      const { token, pair, alice, collectorAddress } = await loadFixture(deployFixture);
      await token.transfer(alice.address, units(1000));

      await token.connect(alice).transfer(pair.address, units(500));

      expect(await token.balanceOf(pair.address)).to.equal(units(490));
      expect(await token.balanceOf(collectorAddress)).to.equal(units(10));
      expect(await token.balanceOf(alice.address)).to.equal(units(500));
    });

    it("does not charge wallet-to-wallet transfers", async function () {
      const { token, alice, bob, collectorAddress } = await loadFixture(deployFixture);
      await token.transfer(alice.address, units(1000));

      await token.connect(alice).transfer(bob.address, units(400));

      expect(await token.balanceOf(bob.address)).to.equal(units(400));
      expect(await token.balanceOf(collectorAddress)).to.equal(0n);
    });

    it("skips the fee when either side is excluded", async function () {
      const { token, pair, alice, collectorAddress } = await loadFixture(deployFixture);
      await token.transfer(pair.address, units(10_000));
      await token.setExcludedFromFees(alice.address, true);

      await token.connect(pair).transfer(alice.address, units(1000));

      expect(await token.balanceOf(alice.address)).to.equal(units(1000));
      expect(await token.balanceOf(collectorAddress)).to.equal(0n);
    });

    it("lets the owner change fees within the 5% cap", async function () {
      const { token, pair, alice, collectorAddress } = await loadFixture(deployFixture);
      await token.transfer(pair.address, units(10_000));

      await expect(token.setFees(300, 100)).to.emit(token, "FeesUpdated").withArgs(300, 100);
      await token.connect(pair).transfer(alice.address, units(1000));
      expect(await token.balanceOf(collectorAddress)).to.equal(units(30));

      await expect(token.setFees(501, 0)).to.be.revertedWithCustomError(token, "FeeTooHigh").withArgs(501, 500);
      await expect(token.setFees(0, 501)).to.be.revertedWithCustomError(token, "FeeTooHigh").withArgs(501, 500);
    });

    it("updateFeeReceiver redirects fees and is owner-only", async function () {
      const { token, pair, alice, carol, stranger, collectorAddress } = await loadFixture(deployFixture);
      await token.transfer(pair.address, units(10_000));

      await expect(token.connect(stranger).updateFeeReceiver(carol.address)).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount",
      );
      await expect(token.updateFeeReceiver(ethers.ZeroAddress)).to.be.revertedWithCustomError(token, "ZeroAddress");

      await expect(token.updateFeeReceiver(carol.address))
        .to.emit(token, "FeeReceiverUpdated")
        .withArgs(collectorAddress, carol.address);
      expect(await token.isExcludedFromFees(carol.address)).to.equal(true);

      await token.connect(pair).transfer(alice.address, units(1000));
      expect(await token.balanceOf(carol.address)).to.equal(units(20));
      expect(await token.balanceOf(collectorAddress)).to.equal(0n);
    });

    it("keeps the vault in sync on every transfer, and can be disconnected", async function () {
      const { token, alice, bob, vault } = await loadFixture(deployFixture);
      await token.transfer(alice.address, units(1000));
      expect(await vault.trackedBalanceOf(alice.address)).to.equal(units(1000));

      await token.connect(alice).transfer(bob.address, units(300));
      expect(await vault.trackedBalanceOf(alice.address)).to.equal(units(700));
      expect(await vault.trackedBalanceOf(bob.address)).to.equal(units(300));
      expect(await vault.totalTracked()).to.equal(units(1000));

      await token.setRewardVault(ethers.ZeroAddress);
      await token.connect(alice).transfer(bob.address, units(100));
      // vault no longer hears about it
      expect(await vault.trackedBalanceOf(alice.address)).to.equal(units(700));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("RewardVault", function () {
    it("only the token can call onBalanceChange", async function () {
      const { vault, stranger } = await loadFixture(deployFixture);
      await expect(vault.connect(stranger).onBalanceChange(stranger.address, 1n)).to.be.revertedWithCustomError(
        vault,
        "OnlyToken",
      );
    });

    it("refuses to distribute when nobody is eligible", async function () {
      const { vault, nvda, deployer, vaultAddress } = await loadFixture(deployFixture);
      await nvda.mint(deployer.address, units(10));
      await nvda.approve(vaultAddress, units(10));
      await expect(vault.depositRewards(units(10))).to.be.revertedWithCustomError(vault, "NoEligibleHolders");
    });

    it("notifyRewardAmount only accepts tokens the vault actually holds", async function () {
      const f = await loadFixture(deployFixture);
      const { vault, nvda, alice, vaultAddress } = f;
      await fundHolders(f, { alice: units(1000) });

      await expect(vault.notifyRewardAmount(units(1)))
        .to.be.revertedWithCustomError(vault, "AmountExceedsUnaccounted")
        .withArgs(units(1), 0n);

      await nvda.mint(vaultAddress, units(30));
      expect(await vault.unaccountedRewards()).to.equal(units(30));

      await vault.notifyRewardAmount(units(30));
      expect(await vault.unaccountedRewards()).to.equal(0n);
      expect(await vault.pendingRewards(alice.address)).to.equal(units(30));

      await expect(vault.notifyRewardAmount(0n)).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("settles earned rewards before a balance changes hands", async function () {
      const f = await loadFixture(deployFixture);
      const { vault, nvda, token, alice, bob, carol, deployer, vaultAddress } = f;
      await fundHolders(f, { alice: units(1000), bob: units(500) });

      await nvda.mint(deployer.address, units(300));
      await nvda.approve(vaultAddress, units(300));
      await vault.depositRewards(units(150));

      // Alice moves everything to Carol after the first distribution
      await token.connect(alice).transfer(carol.address, units(1000));

      expect(await vault.pendingRewards(alice.address)).to.equal(units(100)); // kept
      expect(await vault.pendingRewards(carol.address)).to.equal(0n); // came in after

      await vault.depositRewards(units(150));

      expect(await vault.pendingRewards(alice.address)).to.equal(units(100)); // unchanged: 0 tracked
      expect(await vault.pendingRewards(carol.address)).to.equal(units(100)); // 1000/1500 of the 2nd
      expect(await vault.pendingRewards(bob.address)).to.equal(units(100)); // 50 + 50

      await vault.connect(alice).claim();
      expect(await nvda.balanceOf(alice.address)).to.equal(units(100));
    });

    it("excluded accounts keep what they earned but stop accruing", async function () {
      const f = await loadFixture(deployFixture);
      const { vault, nvda, alice, bob, deployer, vaultAddress } = f;
      await fundHolders(f, { alice: units(1000), bob: units(500) });

      await nvda.mint(deployer.address, units(250));
      await nvda.approve(vaultAddress, units(250));
      await vault.depositRewards(units(150));

      await expect(vault.setExcluded(bob.address, true)).to.emit(vault, "ExclusionUpdated").withArgs(bob.address, true);
      expect(await vault.totalTracked()).to.equal(units(1000));
      expect(await vault.isExcluded(bob.address)).to.equal(true);

      await vault.depositRewards(units(100));

      expect(await vault.pendingRewards(alice.address)).to.equal(units(200)); // 100 + all of the 2nd
      expect(await vault.pendingRewards(bob.address)).to.equal(units(50)); // frozen

      await vault.connect(bob).claim();
      expect(await nvda.balanceOf(bob.address)).to.equal(units(50));

      // Re-including re-reads the live balance
      await vault.setExcluded(bob.address, false);
      expect(await vault.trackedBalanceOf(bob.address)).to.equal(units(500));
      expect(await vault.totalTracked()).to.equal(units(1500));
    });

    it("sync() picks up balances the vault never heard about", async function () {
      const { deployer, alice, nvda } = await loadFixture(deployFixture);

      // Fresh token with no vault wired, so Alice's balance goes unreported
      const token = await (await ethers.getContractFactory("NVIDToken")).deploy(deployer.address, ethers.ZeroAddress);
      await token.transfer(alice.address, units(1000));
      const vault = await (
        await ethers.getContractFactory("RewardVault")
      ).deploy(deployer.address, await nvda.getAddress(), await token.getAddress());
      await token.setRewardVault(await vault.getAddress());

      expect(await vault.trackedBalanceOf(alice.address)).to.equal(0n);
      await vault.sync(alice.address);
      expect(await vault.trackedBalanceOf(alice.address)).to.equal(units(1000));
      expect(await vault.totalTracked()).to.equal(units(1000));
    });

    it("never over-promises: the sum of claims cannot exceed the deposit", async function () {
      const f = await loadFixture(deployFixture);
      const { vault, nvda, alice, bob, carol, deployer, vaultAddress } = f;
      // Odd amounts to force rounding
      await fundHolders(f, { alice: 333n, bob: 333n, carol: 334n });

      await nvda.mint(deployer.address, 1000n);
      await nvda.approve(vaultAddress, 1000n);
      await vault.depositRewards(1000n);

      const total =
        (await vault.pendingRewards(alice.address)) +
        (await vault.pendingRewards(bob.address)) +
        (await vault.pendingRewards(carol.address));
      expect(total).to.be.lte(1000n);
      expect(total).to.be.gte(997n);

      await vault.connect(alice).claim();
      await vault.connect(bob).claim();
      await vault.connect(carol).claim();
      expect(await nvda.balanceOf(vaultAddress)).to.equal(1000n - total);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("FeeCollector", function () {
    /** Route 1,500 NVID of trades through the pair → 30 NVID of fees in the collector. */
    async function withFees() {
      const f = await loadFixture(deployFixture);
      const { token, pair, alice } = f;
      await token.transfer(pair.address, units(10_000));
      await token.connect(pair).transfer(alice.address, units(1000)); // buy: fee 20
      await token.connect(alice).transfer(pair.address, units(500)); // sell: fee 10
      return f;
    }

    it("collect() splits fees 50% rewards / 25% liquidity / 25% treasury", async function () {
      const { collector, token, lpReceiver, treasuryAddress, collectorAddress } = await withFees();
      expect(await token.balanceOf(collectorAddress)).to.equal(units(30));

      await expect(collector.collect()).to.emit(collector, "Collected").withArgs(units(30), units(15), units("7.5"), units("7.5"));

      expect(await collector.rewardsBucket()).to.equal(units(15));
      expect(await token.balanceOf(lpReceiver.address)).to.equal(units("7.5"));
      expect(await token.balanceOf(treasuryAddress)).to.equal(units("7.5"));
      expect(await token.balanceOf(collectorAddress)).to.equal(units(15));
      expect(await collector.totalCollected()).to.equal(units(30));

      // Nothing new: no-op
      expect(await collector.collect.staticCall()).to.equal(0n);
    });

    it("swapToNVDA() swaps the bucket through the router and is keeper-only", async function () {
      const { collector, nvda, keeper, stranger, collectorAddress } = await withFees();
      await collector.collect();

      await expect(collector.connect(stranger).swapToNVDA(units(15), 0)).to.be.revertedWithCustomError(collector, "NotKeeper");
      await expect(collector.connect(keeper).swapToNVDA(units(16), 0))
        .to.be.revertedWithCustomError(collector, "InsufficientBucket")
        .withArgs(units(16), units(15));

      // 15 NVID at 1 NVDA / 1000 NVID = 0.015 NVDA
      await expect(collector.connect(keeper).swapToNVDA(units(15), units("0.015")))
        .to.emit(collector, "Swapped")
        .withArgs(units(15), units("0.015"));

      expect(await collector.rewardsBucket()).to.equal(0n);
      expect(await nvda.balanceOf(collectorAddress)).to.equal(units("0.015"));
      expect(await collector.totalNvidSwapped()).to.equal(units(15));
      expect(await collector.totalNvdaBought()).to.equal(units("0.015"));
    });

    it("swapToNVDA() respects the slippage floor", async function () {
      const { collector, keeper, router } = await withFees();
      await collector.collect();
      await expect(collector.connect(keeper).swapToNVDA(units(15), units("0.016"))).to.be.revertedWithCustomError(
        router,
        "TooLittleReceived",
      );
    });

    it("sendToVault() pushes NVDA to the vault and distributes it to holders", async function () {
      const { collector, vault, nvda, alice, keeper, vaultAddress } = await withFees();
      await collector.collect();
      await collector.connect(keeper).swapToNVDA(units(15), 0);

      // Alice is the only eligible holder (pair and deployer are excluded)
      await expect(collector.sendToVault()).to.emit(collector, "SentToVault").withArgs(units("0.015"));

      expect(await nvda.balanceOf(vaultAddress)).to.equal(units("0.015"));
      expect(await vault.totalDistributed()).to.equal(units("0.015"));
      expect(await vault.pendingRewards(alice.address)).to.equal(units("0.015"));
      expect(await collector.totalSentToVault()).to.equal(units("0.015"));

      await expect(collector.sendToVault()).to.be.revertedWithCustomError(collector, "NothingToSend");
    });

    it("process() runs the whole pipeline in one transaction", async function () {
      const { collector, vault, alice, keeper, token, lpReceiver } = await withFees();

      await collector.connect(keeper).process(0);

      expect(await collector.rewardsBucket()).to.equal(0n);
      expect(await token.balanceOf(lpReceiver.address)).to.equal(units("7.5"));
      expect(await vault.pendingRewards(alice.address)).to.equal(units("0.015"));
    });

    it("refuses to swap without a router or a path", async function () {
      const { collector, keeper, routerAddress } = await withFees();
      await collector.collect();

      await collector.setSwapRouter(ethers.ZeroAddress);
      await expect(collector.connect(keeper).swapToNVDA(units(1), 0)).to.be.revertedWithCustomError(collector, "SwapRouterNotSet");

      await collector.setSwapRouter(routerAddress);
      await collector.setSwapPath("0x");
      await expect(collector.connect(keeper).swapToNVDA(units(1), 0)).to.be.revertedWithCustomError(collector, "SwapPathNotSet");
    });

    it("validates share updates and protects managed tokens from rescue", async function () {
      const { collector, tokenAddress, nvdaAddress, deployer } = await loadFixture(deployFixture);

      await expect(collector.setShares(5000, 3000, 3000)).to.be.revertedWithCustomError(collector, "InvalidShares");
      await expect(collector.setShares(6000, 2000, 2000)).to.emit(collector, "SharesUpdated").withArgs(6000, 2000, 2000);

      await expect(collector.rescueToken(tokenAddress, deployer.address, 1n)).to.be.revertedWithCustomError(
        collector,
        "CannotRescueManagedToken",
      );
      await expect(collector.rescueToken(nvdaAddress, deployer.address, 1n)).to.be.revertedWithCustomError(
        collector,
        "CannotRescueManagedToken",
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Treasury", function () {
    it("lets the owner withdraw tokens and ETH", async function () {
      const { treasury, token, deployer, carol, treasuryAddress } = await loadFixture(deployFixture);
      await token.transfer(treasuryAddress, units(100));

      await expect(treasury.withdraw(await token.getAddress(), carol.address, units(40)))
        .to.emit(treasury, "Withdrawn")
        .withArgs(await token.getAddress(), carol.address, units(40));
      expect(await token.balanceOf(carol.address)).to.equal(units(40));

      await deployer.sendTransaction({ to: treasuryAddress, value: ethers.parseEther("1") });
      await expect(treasury.withdrawETH(carol.address, ethers.parseEther("0.4"))).to.changeEtherBalances(
        [treasury, carol],
        [-ethers.parseEther("0.4"), ethers.parseEther("0.4")],
      );
    });

    it("is owner-only", async function () {
      const { treasury, token, stranger } = await loadFixture(deployFixture);
      await expect(
        treasury.connect(stranger).withdraw(await token.getAddress(), stranger.address, 1n),
      ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
      await expect(treasury.connect(stranger).emergencyPause()).to.be.revertedWithCustomError(
        treasury,
        "OwnableUnauthorizedAccount",
      );
    });

    it("emergencyPause() freezes withdrawals until unpause()", async function () {
      const { treasury, token, carol, treasuryAddress } = await loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      await token.transfer(treasuryAddress, units(100));

      await expect(treasury.emergencyPause()).to.emit(treasury, "Paused");
      expect(await treasury.paused()).to.equal(true);
      await expect(treasury.withdraw(tokenAddress, carol.address, units(1))).to.be.revertedWithCustomError(
        treasury,
        "EnforcedPause",
      );
      await expect(treasury.withdrawETH(carol.address, 1n)).to.be.revertedWithCustomError(treasury, "EnforcedPause");

      await expect(treasury.unpause()).to.emit(treasury, "Unpaused");
      await treasury.withdraw(tokenAddress, carol.address, units(1));
      expect(await token.balanceOf(carol.address)).to.equal(units(1));
    });
  });
});
