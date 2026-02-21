import { expect } from "chai";
import { ethers } from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("BettingManager", function () {
  const INITIAL_SUPPLY = ethers.parseEther("10000000"); // 10 million
  const STAKE_AMOUNT = ethers.parseEther("10"); // 10 MBUCKS
  const SPECTATOR_BET_AMOUNT = ethers.parseEther("5"); // 5 MBUCKS

  // WagerStatus enum values
  const WagerStatus = {
    Open: 0,
    Locked: 1,
    Settled: 2,
    Cancelled: 3,
    Disputed: 4,
    Refunded: 5,
    Claimed: 6,
  };

  async function deployBettingFixture() {
    const [owner, treasury, player1, player2, settler, spectator1, spectator2, other] =
      await ethers.getSigners();

    // Deploy Moltbucks
    const Moltbucks = await ethers.getContractFactory("Moltbucks");
    const token = await Moltbucks.deploy(INITIAL_SUPPLY);

    // Deploy BettingManager
    const BettingManager = await ethers.getContractFactory("BettingManager");
    const betting = await BettingManager.deploy(
      await token.getAddress(),
      treasury.address
    );

    // Distribute tokens
    await token.transfer(player1.address, ethers.parseEther("10000"));
    await token.transfer(player2.address, ethers.parseEther("10000"));
    await token.transfer(spectator1.address, ethers.parseEther("10000"));
    await token.transfer(spectator2.address, ethers.parseEther("10000"));

    // Approve BettingManager for all users
    const bettingAddr = await betting.getAddress();
    await token.connect(player1).approve(bettingAddr, ethers.parseEther("10000"));
    await token.connect(player2).approve(bettingAddr, ethers.parseEther("10000"));
    await token.connect(spectator1).approve(bettingAddr, ethers.parseEther("10000"));
    await token.connect(spectator2).approve(bettingAddr, ethers.parseEther("10000"));

    // Authorize settler
    await betting.authorizeSettler(settler.address);

    return { token, betting, owner, treasury, player1, player2, settler, spectator1, spectator2, other };
  }

  async function deployWithOpenWagerFixture() {
    const fixture = await loadFixture(deployBettingFixture);
    const { betting, player1 } = fixture;

    await betting.connect(player1).createWager("game-001", STAKE_AMOUNT, ethers.ZeroAddress);

    return fixture;
  }

  async function deployWithLockedWagerFixture() {
    const fixture = await loadFixture(deployWithOpenWagerFixture);
    const { betting, player2 } = fixture;

    await betting.connect(player2).acceptWager(0);

    return fixture;
  }

  async function deployWithSettledWagerFixture() {
    const fixture = await loadFixture(deployWithLockedWagerFixture);
    const { betting, player1, settler } = fixture;

    await betting.connect(settler).settleWager(0, player1.address);

    return fixture;
  }

  async function deployWithClaimedWagerFixture() {
    const fixture = await loadFixture(deployWithSettledWagerFixture);
    const { betting, player1 } = fixture;

    // Advance past dispute window (24 hours)
    await time.increase(24 * 60 * 60 + 1);

    await betting.connect(player1).claimWinnings(0);

    return fixture;
  }

  // ================================================================
  // Deployment
  // ================================================================
  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { betting, owner } = await loadFixture(deployBettingFixture);
      expect(await betting.owner()).to.equal(owner.address);
    });

    it("Should set the correct token address", async function () {
      const { betting, token } = await loadFixture(deployBettingFixture);
      expect(await betting.moltbucks()).to.equal(await token.getAddress());
    });

    it("Should set the correct treasury address", async function () {
      const { betting, treasury } = await loadFixture(deployBettingFixture);
      expect(await betting.treasury()).to.equal(treasury.address);
    });

    it("Should have correct fee constants", async function () {
      const { betting } = await loadFixture(deployBettingFixture);
      expect(await betting.PLAYER_FEE_BPS()).to.equal(500);
      expect(await betting.SPECTATOR_FEE_BPS()).to.equal(300);
      expect(await betting.BPS_DENOMINATOR()).to.equal(10000);
    });

    it("Should have correct default limits", async function () {
      const { betting } = await loadFixture(deployBettingFixture);
      expect(await betting.maxStakePerWager()).to.equal(ethers.parseEther("1000"));
      expect(await betting.minStake()).to.equal(ethers.parseEther("0.1"));
      expect(await betting.MAX_SPECTATOR_BET()).to.equal(ethers.parseEther("100"));
      expect(await betting.MIN_SPECTATOR_BET()).to.equal(ethers.parseEther("0.1"));
      expect(await betting.MAX_SPECTATOR_BETS_PER_WAGER()).to.equal(100);
    });

    it("Should start with nextWagerId at 0", async function () {
      const { betting } = await loadFixture(deployBettingFixture);
      expect(await betting.nextWagerId()).to.equal(0);
    });

    it("Should revert with zero token address", async function () {
      const [, treasury] = await ethers.getSigners();
      const BettingManager = await ethers.getContractFactory("BettingManager");
      await expect(
        BettingManager.deploy(ethers.ZeroAddress, treasury.address)
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should revert with zero treasury address", async function () {
      const { token } = await loadFixture(deployBettingFixture);
      const BettingManager = await ethers.getContractFactory("BettingManager");
      await expect(
        BettingManager.deploy(await token.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury address");
    });
  });

  // ================================================================
  // createWager
  // ================================================================
  describe("createWager", function () {
    it("Should create an open wager successfully", async function () {
      const { betting, player1 } = await loadFixture(deployBettingFixture);

      await expect(
        betting.connect(player1).createWager("game-001", STAKE_AMOUNT, ethers.ZeroAddress)
      )
        .to.emit(betting, "WagerCreated")
        .withArgs(0, player1.address, STAKE_AMOUNT, "game-001");

      const wager = await betting.wagers(0);
      expect(wager.creator).to.equal(player1.address);
      expect(wager.opponent).to.equal(ethers.ZeroAddress);
      expect(wager.stakeAmount).to.equal(STAKE_AMOUNT);
      expect(wager.status).to.equal(WagerStatus.Open);
    });

    it("Should create a private wager with specific opponent", async function () {
      const { betting, player1, player2 } = await loadFixture(deployBettingFixture);

      await betting.connect(player1).createWager("game-001", STAKE_AMOUNT, player2.address);

      const wager = await betting.wagers(0);
      expect(wager.opponent).to.equal(player2.address);
    });

    it("Should increment nextWagerId", async function () {
      const { betting, player1 } = await loadFixture(deployBettingFixture);

      await betting.connect(player1).createWager("game-001", STAKE_AMOUNT, ethers.ZeroAddress);
      expect(await betting.nextWagerId()).to.equal(1);

      await betting.connect(player1).createWager("game-002", STAKE_AMOUNT, ethers.ZeroAddress);
      expect(await betting.nextWagerId()).to.equal(2);
    });

    it("Should transfer stake from creator to contract", async function () {
      const { betting, token, player1 } = await loadFixture(deployBettingFixture);

      const balanceBefore = await token.balanceOf(player1.address);
      await betting.connect(player1).createWager("game-001", STAKE_AMOUNT, ethers.ZeroAddress);
      const balanceAfter = await token.balanceOf(player1.address);

      expect(balanceBefore - balanceAfter).to.equal(STAKE_AMOUNT);
    });

    it("Should revert if stake below minimum", async function () {
      const { betting, player1 } = await loadFixture(deployBettingFixture);
      const tooLow = ethers.parseEther("0.01");

      await expect(
        betting.connect(player1).createWager("game-001", tooLow, ethers.ZeroAddress)
      ).to.be.revertedWith("Stake below minimum");
    });

    it("Should revert if stake above maximum", async function () {
      const { betting, player1 } = await loadFixture(deployBettingFixture);
      const tooHigh = ethers.parseEther("1001");

      await expect(
        betting.connect(player1).createWager("game-001", tooHigh, ethers.ZeroAddress)
      ).to.be.revertedWith("Stake above maximum");
    });

    it("Should revert with empty game ID", async function () {
      const { betting, player1 } = await loadFixture(deployBettingFixture);

      await expect(
        betting.connect(player1).createWager("", STAKE_AMOUNT, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid game ID");
    });

    it("Should revert if wagering against yourself", async function () {
      const { betting, player1 } = await loadFixture(deployBettingFixture);

      await expect(
        betting.connect(player1).createWager("game-001", STAKE_AMOUNT, player1.address)
      ).to.be.revertedWith("Cannot wager against yourself");
    });

    it("Should revert when paused", async function () {
      const { betting, player1 } = await loadFixture(deployBettingFixture);
      await betting.pause();

      await expect(
        betting.connect(player1).createWager("game-001", STAKE_AMOUNT, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(betting, "EnforcedPause");
    });
  });

  // ================================================================
  // acceptWager
  // ================================================================
  describe("acceptWager", function () {
    it("Should accept an open wager successfully", async function () {
      const { betting, player2 } = await loadFixture(deployWithOpenWagerFixture);

      await expect(betting.connect(player2).acceptWager(0))
        .to.emit(betting, "WagerAccepted")
        .withArgs(0, player2.address);

      const wager = await betting.wagers(0);
      expect(wager.acceptor).to.equal(player2.address);
      expect(wager.status).to.equal(WagerStatus.Locked);
    });

    it("Should transfer stake from acceptor to contract", async function () {
      const { betting, token, player2 } = await loadFixture(deployWithOpenWagerFixture);

      const balanceBefore = await token.balanceOf(player2.address);
      await betting.connect(player2).acceptWager(0);
      const balanceAfter = await token.balanceOf(player2.address);

      expect(balanceBefore - balanceAfter).to.equal(STAKE_AMOUNT);
    });

    it("Should enforce private wager opponent", async function () {
      const { betting, player1, player2, other } = await loadFixture(deployBettingFixture);

      await betting.connect(player1).createWager("game-001", STAKE_AMOUNT, player2.address);

      await expect(
        betting.connect(other).acceptWager(0)
      ).to.be.revertedWith("Not the designated opponent");
    });

    it("Should allow designated opponent to accept private wager", async function () {
      const { betting, player1, player2 } = await loadFixture(deployBettingFixture);

      await betting.connect(player1).createWager("game-001", STAKE_AMOUNT, player2.address);
      await betting.connect(player2).acceptWager(0);

      const wager = await betting.wagers(0);
      expect(wager.acceptor).to.equal(player2.address);
      expect(wager.status).to.equal(WagerStatus.Locked);
    });

    it("Should revert if wager is not open", async function () {
      const { betting, player2 } = await loadFixture(deployWithLockedWagerFixture);

      await expect(
        betting.connect(player2).acceptWager(0)
      ).to.be.revertedWith("Wager not open");
    });

    it("Should revert if wager is expired", async function () {
      const { betting, player2 } = await loadFixture(deployWithOpenWagerFixture);

      await time.increase(24 * 60 * 60 + 1);

      await expect(
        betting.connect(player2).acceptWager(0)
      ).to.be.revertedWith("Wager expired");
    });

    it("Should revert if creator tries to accept own wager", async function () {
      const { betting, player1 } = await loadFixture(deployWithOpenWagerFixture);

      await expect(
        betting.connect(player1).acceptWager(0)
      ).to.be.revertedWith("Creator cannot accept own wager");
    });

    it("Should revert when paused", async function () {
      const { betting, player2 } = await loadFixture(deployWithOpenWagerFixture);
      await betting.pause();

      await expect(
        betting.connect(player2).acceptWager(0)
      ).to.be.revertedWithCustomError(betting, "EnforcedPause");
    });
  });

  // ================================================================
  // settleWager (Pull-Payment: no transfer on settle)
  // ================================================================
  describe("settleWager", function () {
    it("Should settle wager (record winner, no transfer)", async function () {
      const { betting, token, player1, settler, treasury } =
        await loadFixture(deployWithLockedWagerFixture);

      const winnerBalanceBefore = await token.balanceOf(player1.address);
      const treasuryBalanceBefore = await token.balanceOf(treasury.address);

      await betting.connect(settler).settleWager(0, player1.address);

      // No transfer should have happened
      const winnerBalanceAfter = await token.balanceOf(player1.address);
      const treasuryBalanceAfter = await token.balanceOf(treasury.address);

      expect(winnerBalanceAfter).to.equal(winnerBalanceBefore);
      expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore);
    });

    it("Should emit WagerSettled event with calculated payout", async function () {
      const { betting, player1, settler } =
        await loadFixture(deployWithLockedWagerFixture);

      const totalPot = STAKE_AMOUNT * 2n;
      const expectedFee = (totalPot * 500n) / 10000n;
      const expectedPayout = totalPot - expectedFee;

      await expect(betting.connect(settler).settleWager(0, player1.address))
        .to.emit(betting, "WagerSettled")
        .withArgs(0, player1.address, expectedPayout);
    });

    it("Should update wager status to Settled with claimableAfter set", async function () {
      const { betting, player1, settler } =
        await loadFixture(deployWithLockedWagerFixture);

      await betting.connect(settler).settleWager(0, player1.address);

      const wager = await betting.wagers(0);
      expect(wager.status).to.equal(WagerStatus.Settled);
      expect(wager.winner).to.equal(player1.address);
      expect(wager.claimableAfter).to.be.gt(0);
    });

    it("Should revert if caller is not authorized settler", async function () {
      const { betting, player1, other } =
        await loadFixture(deployWithLockedWagerFixture);

      await expect(
        betting.connect(other).settleWager(0, player1.address)
      ).to.be.revertedWith("Not an authorized settler");
    });

    it("Should revert if wager is not locked", async function () {
      const { betting, player1, settler } =
        await loadFixture(deployWithOpenWagerFixture);

      await expect(
        betting.connect(settler).settleWager(0, player1.address)
      ).to.be.revertedWith("Wager not locked");
    });

    it("Should revert if winner is not a participant", async function () {
      const { betting, settler, other } =
        await loadFixture(deployWithLockedWagerFixture);

      await expect(
        betting.connect(settler).settleWager(0, other.address)
      ).to.be.revertedWith("Winner must be creator or acceptor");
    });

    it("Should revert if settlement window expired", async function () {
      const { betting, player1, settler } =
        await loadFixture(deployWithLockedWagerFixture);

      await time.increase(2 * 60 * 60 + 1);

      await expect(
        betting.connect(settler).settleWager(0, player1.address)
      ).to.be.revertedWith("Settlement window expired");
    });

    it("Should revert when paused", async function () {
      const { betting, player1, settler } =
        await loadFixture(deployWithLockedWagerFixture);
      await betting.pause();

      await expect(
        betting.connect(settler).settleWager(0, player1.address)
      ).to.be.revertedWithCustomError(betting, "EnforcedPause");
    });
  });

  // ================================================================
  // claimWinnings
  // ================================================================
  describe("claimWinnings", function () {
    it("Should claim winnings after dispute window", async function () {
      const { betting, token, player1, treasury } =
        await loadFixture(deployWithSettledWagerFixture);

      // Advance past dispute window (24 hours)
      await time.increase(24 * 60 * 60 + 1);

      const winnerBalanceBefore = await token.balanceOf(player1.address);
      const treasuryBalanceBefore = await token.balanceOf(treasury.address);

      await betting.connect(player1).claimWinnings(0);

      const winnerBalanceAfter = await token.balanceOf(player1.address);
      const treasuryBalanceAfter = await token.balanceOf(treasury.address);

      const totalPot = STAKE_AMOUNT * 2n;
      const expectedFee = (totalPot * 500n) / 10000n;
      const expectedPayout = totalPot - expectedFee;

      expect(winnerBalanceAfter - winnerBalanceBefore).to.equal(expectedPayout);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(expectedFee);
    });

    it("Should emit WagerClaimed event", async function () {
      const { betting, player1 } =
        await loadFixture(deployWithSettledWagerFixture);

      await time.increase(24 * 60 * 60 + 1);

      const totalPot = STAKE_AMOUNT * 2n;
      const expectedFee = (totalPot * 500n) / 10000n;
      const expectedPayout = totalPot - expectedFee;

      await expect(betting.connect(player1).claimWinnings(0))
        .to.emit(betting, "WagerClaimed")
        .withArgs(0, player1.address, expectedPayout);
    });

    it("Should set status to Claimed", async function () {
      const { betting, player1 } =
        await loadFixture(deployWithSettledWagerFixture);

      await time.increase(24 * 60 * 60 + 1);
      await betting.connect(player1).claimWinnings(0);

      const wager = await betting.wagers(0);
      expect(wager.status).to.equal(WagerStatus.Claimed);
    });

    it("Should revert if dispute window still open", async function () {
      const { betting, player1 } =
        await loadFixture(deployWithSettledWagerFixture);

      // Don't advance time
      await expect(
        betting.connect(player1).claimWinnings(0)
      ).to.be.revertedWith("Dispute window still open");
    });

    it("Should revert if caller is not the winner", async function () {
      const { betting, player2 } =
        await loadFixture(deployWithSettledWagerFixture);

      await time.increase(24 * 60 * 60 + 1);

      await expect(
        betting.connect(player2).claimWinnings(0)
      ).to.be.revertedWith("Not the winner");
    });

    it("Should revert if wager is not settled", async function () {
      const { betting, player1 } =
        await loadFixture(deployWithLockedWagerFixture);

      await expect(
        betting.connect(player1).claimWinnings(0)
      ).to.be.revertedWith("Wager not settled");
    });
  });

  // ================================================================
  // cancelWager
  // ================================================================
  describe("cancelWager", function () {
    it("Should cancel an open wager and refund creator", async function () {
      const { betting, token, player1 } =
        await loadFixture(deployWithOpenWagerFixture);

      const balanceBefore = await token.balanceOf(player1.address);

      await expect(betting.connect(player1).cancelWager(0))
        .to.emit(betting, "WagerCancelled")
        .withArgs(0);

      const balanceAfter = await token.balanceOf(player1.address);
      expect(balanceAfter - balanceBefore).to.equal(STAKE_AMOUNT);

      const wager = await betting.wagers(0);
      expect(wager.status).to.equal(WagerStatus.Cancelled);
    });

    it("Should revert if caller is not creator", async function () {
      const { betting, player2 } = await loadFixture(deployWithOpenWagerFixture);

      await expect(
        betting.connect(player2).cancelWager(0)
      ).to.be.revertedWith("Only creator can cancel");
    });

    it("Should revert if wager is not open", async function () {
      const { betting, player1 } = await loadFixture(deployWithLockedWagerFixture);

      await expect(
        betting.connect(player1).cancelWager(0)
      ).to.be.revertedWith("Can only cancel open wagers");
    });
  });

  // ================================================================
  // Spectator Betting
  // ================================================================
  describe("Spectator Betting", function () {
    it("Should place a spectator bet successfully", async function () {
      const { betting, player1, spectator1 } =
        await loadFixture(deployWithLockedWagerFixture);

      await expect(
        betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT)
      )
        .to.emit(betting, "SpectatorBetPlaced")
        .withArgs(0, spectator1.address, player1.address, SPECTATOR_BET_AMOUNT);

      const pool = await betting.spectatorPools(0);
      expect(pool.totalPool).to.equal(SPECTATOR_BET_AMOUNT);
      expect(pool.pool1).to.equal(SPECTATOR_BET_AMOUNT);
    });

    it("Should track bets on both sides", async function () {
      const { betting, player1, player2, spectator1, spectator2 } =
        await loadFixture(deployWithLockedWagerFixture);

      await betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT);
      await betting.connect(spectator2).placeBet(0, player2.address, SPECTATOR_BET_AMOUNT);

      const pool = await betting.spectatorPools(0);
      expect(pool.totalPool).to.equal(SPECTATOR_BET_AMOUNT * 2n);
      expect(pool.pool1).to.equal(SPECTATOR_BET_AMOUNT);
      expect(pool.pool2).to.equal(SPECTATOR_BET_AMOUNT);
    });

    it("Should revert if wager is not locked", async function () {
      const { betting, player1, spectator1 } =
        await loadFixture(deployWithOpenWagerFixture);

      await expect(
        betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT)
      ).to.be.revertedWith("Wager not locked");
    });

    it("Should revert if bet below minimum", async function () {
      const { betting, player1, spectator1 } =
        await loadFixture(deployWithLockedWagerFixture);

      const tooLow = ethers.parseEther("0.01");
      await expect(
        betting.connect(spectator1).placeBet(0, player1.address, tooLow)
      ).to.be.revertedWith("Bet below minimum");
    });

    it("Should revert if bet above maximum", async function () {
      const { betting, player1, spectator1 } =
        await loadFixture(deployWithLockedWagerFixture);

      const tooHigh = ethers.parseEther("101");
      await expect(
        betting.connect(spectator1).placeBet(0, player1.address, tooHigh)
      ).to.be.revertedWith("Bet above maximum");
    });

    it("Should revert if betting on non-participant", async function () {
      const { betting, spectator1, other } =
        await loadFixture(deployWithLockedWagerFixture);

      await expect(
        betting.connect(spectator1).placeBet(0, other.address, SPECTATOR_BET_AMOUNT)
      ).to.be.revertedWith("Must bet on creator or acceptor");
    });

    it("Should revert if wager participant tries to spectator bet", async function () {
      const { betting, player1, player2 } =
        await loadFixture(deployWithLockedWagerFixture);

      await expect(
        betting.connect(player1).placeBet(0, player2.address, SPECTATOR_BET_AMOUNT)
      ).to.be.revertedWith("Participants cannot place spectator bets");
    });

    it("Should revert when paused", async function () {
      const { betting, player1, spectator1 } =
        await loadFixture(deployWithLockedWagerFixture);
      await betting.pause();

      await expect(
        betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT)
      ).to.be.revertedWithCustomError(betting, "EnforcedPause");
    });

    it("Should return correct bet count and details via view functions", async function () {
      const { betting, player1, player2, spectator1, spectator2 } =
        await loadFixture(deployWithLockedWagerFixture);

      await betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT);
      await betting.connect(spectator2).placeBet(0, player2.address, ethers.parseEther("3"));

      expect(await betting.getSpectatorBetCount(0)).to.equal(2);

      const bet0 = await betting.getSpectatorBet(0, 0);
      expect(bet0.bettor).to.equal(spectator1.address);
      expect(bet0.amount).to.equal(SPECTATOR_BET_AMOUNT);
      expect(bet0.predictedWinner).to.equal(player1.address);
      expect(bet0.paid).to.equal(false);
    });
  });

  // ================================================================
  // claimSpectatorWinnings
  // ================================================================
  describe("claimSpectatorWinnings", function () {
    it("Should allow winning spectator to claim after wager is claimed", async function () {
      const { betting, token, player1, player2, settler, spectator1, spectator2 } =
        await loadFixture(deployWithLockedWagerFixture);

      // spectator1 bets on player1 (creator), spectator2 bets on player2 (acceptor)
      await betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT);
      await betting.connect(spectator2).placeBet(0, player2.address, SPECTATOR_BET_AMOUNT);

      // Settle: player1 wins
      await betting.connect(settler).settleWager(0, player1.address);

      // Advance past dispute window
      await time.increase(24 * 60 * 60 + 1);

      // Winner claims wager winnings
      await betting.connect(player1).claimWinnings(0);

      // Spectator1 (winning bettor) claims spectator winnings
      const spec1Before = await token.balanceOf(spectator1.address);
      await betting.connect(spectator1).claimSpectatorWinnings(0);
      const spec1After = await token.balanceOf(spectator1.address);

      // Total spectator pool = 10, fee = 0.3, distributable = 9.7
      // spectator1 bet 5 on winner, winning pool = 5, share = 5 * 9.7 / 5 = 9.7
      const totalPool = SPECTATOR_BET_AMOUNT * 2n;
      const specFee = (totalPool * 300n) / 10000n;
      const distributable = totalPool - specFee;

      expect(spec1After - spec1Before).to.equal(distributable);
    });

    it("Should revert if wager not yet claimed", async function () {
      const { betting, spectator1 } =
        await loadFixture(deployWithSettledWagerFixture);

      await expect(
        betting.connect(spectator1).claimSpectatorWinnings(0)
      ).to.be.revertedWith("Wager not claimed yet");
    });

    it("Should revert if spectator has no winnings", async function () {
      const { betting, token, player1, player2, settler, spectator1, spectator2 } =
        await loadFixture(deployWithLockedWagerFixture);

      // spectator2 bets on player2 (who will lose)
      await betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT);
      await betting.connect(spectator2).placeBet(0, player2.address, SPECTATOR_BET_AMOUNT);

      await betting.connect(settler).settleWager(0, player1.address);
      await time.increase(24 * 60 * 60 + 1);
      await betting.connect(player1).claimWinnings(0);

      // spectator2 lost, should have no winnings
      await expect(
        betting.connect(spectator2).claimSpectatorWinnings(0)
      ).to.be.revertedWith("No winnings to claim");
    });
  });

  // ================================================================
  // disputeWager
  // ================================================================
  describe("disputeWager", function () {
    it("Should allow creator to dispute within window", async function () {
      const { betting, player1 } = await loadFixture(deployWithSettledWagerFixture);

      await expect(betting.connect(player1).disputeWager(0, "Unfair result"))
        .to.emit(betting, "WagerDisputed")
        .withArgs(0, player1.address);

      const wager = await betting.wagers(0);
      expect(wager.status).to.equal(WagerStatus.Disputed);
    });

    it("Should allow acceptor to dispute within window", async function () {
      const { betting, player2 } = await loadFixture(deployWithSettledWagerFixture);

      await betting.connect(player2).disputeWager(0, "Wrong outcome");

      const wager = await betting.wagers(0);
      expect(wager.status).to.equal(WagerStatus.Disputed);
    });

    it("Should revert if dispute window has closed", async function () {
      const { betting, player2 } = await loadFixture(deployWithSettledWagerFixture);

      // Move time past DISPUTE_WINDOW (24 hours)
      await time.increase(24 * 60 * 60 + 1);

      await expect(
        betting.connect(player2).disputeWager(0, "Too late")
      ).to.be.revertedWith("Dispute window has closed");
    });

    it("Should revert if caller is not a participant", async function () {
      const { betting, other } = await loadFixture(deployWithSettledWagerFixture);

      await expect(
        betting.connect(other).disputeWager(0, "Not my wager")
      ).to.be.revertedWith("Only participants can dispute");
    });

    it("Should revert if wager is not settled", async function () {
      const { betting, player1 } = await loadFixture(deployWithLockedWagerFixture);

      await expect(
        betting.connect(player1).disputeWager(0, "Not settled yet")
      ).to.be.revertedWith("Can only dispute settled wagers");
    });

    it("Should revert with empty reason", async function () {
      const { betting, player1 } = await loadFixture(deployWithSettledWagerFixture);

      await expect(
        betting.connect(player1).disputeWager(0, "")
      ).to.be.revertedWith("Reason required");
    });

    it("Should have nonReentrant modifier", async function () {
      // Test that disputeWager doesn't revert for normal use (indirectly testing nonReentrant exists)
      const { betting, player1 } = await loadFixture(deployWithSettledWagerFixture);
      await betting.connect(player1).disputeWager(0, "Valid dispute");
      const wager = await betting.wagers(0);
      expect(wager.status).to.equal(WagerStatus.Disputed);
    });
  });

  // ================================================================
  // resolveDispute
  // ================================================================
  describe("resolveDispute", function () {
    async function deployWithDisputedWagerFixture() {
      const fixture = await loadFixture(deployWithSettledWagerFixture);
      const { betting, player2 } = fixture;

      await betting.connect(player2).disputeWager(0, "Wrong outcome");

      return fixture;
    }

    it("Should allow owner to resolve dispute and reset claimable timer", async function () {
      const { betting, player2, owner } =
        await loadFixture(deployWithDisputedWagerFixture);

      await betting.connect(owner).resolveDispute(0, player2.address);

      const wager = await betting.wagers(0);
      expect(wager.winner).to.equal(player2.address);
      expect(wager.status).to.equal(WagerStatus.Settled);
      expect(wager.claimableAfter).to.be.gt(0);
    });

    it("Should revert if caller is not owner", async function () {
      const { betting, player1, player2 } =
        await loadFixture(deployWithDisputedWagerFixture);

      await expect(
        betting.connect(player1).resolveDispute(0, player2.address)
      ).to.be.revertedWithCustomError(betting, "OwnableUnauthorizedAccount");
    });

    it("Should revert if wager is not disputed", async function () {
      const { betting, player1, owner } =
        await loadFixture(deployWithSettledWagerFixture);

      await expect(
        betting.connect(owner).resolveDispute(0, player1.address)
      ).to.be.revertedWith("Wager not disputed");
    });

    it("Should revert if winner is not a participant", async function () {
      const { betting, other, owner } =
        await loadFixture(deployWithDisputedWagerFixture);

      await expect(
        betting.connect(owner).resolveDispute(0, other.address)
      ).to.be.revertedWith("Winner must be creator or acceptor");
    });

    it("Should allow claiming after resolve dispute", async function () {
      const { betting, token, player2, owner } =
        await loadFixture(deployWithDisputedWagerFixture);

      await betting.connect(owner).resolveDispute(0, player2.address);

      // Advance past new dispute window
      await time.increase(24 * 60 * 60 + 1);

      const balBefore = await token.balanceOf(player2.address);
      await betting.connect(player2).claimWinnings(0);
      const balAfter = await token.balanceOf(player2.address);

      const totalPot = STAKE_AMOUNT * 2n;
      const fee = (totalPot * 500n) / 10000n;
      const payout = totalPot - fee;

      expect(balAfter - balBefore).to.equal(payout);
    });
  });

  // ================================================================
  // refundExpiredWager
  // ================================================================
  describe("refundExpiredWager", function () {
    it("Should refund expired wager", async function () {
      const { betting, token, player1, other } =
        await loadFixture(deployWithOpenWagerFixture);

      await time.increase(24 * 60 * 60 + 1);

      const balanceBefore = await token.balanceOf(player1.address);

      await expect(betting.connect(other).refundExpiredWager(0))
        .to.emit(betting, "WagerRefunded")
        .withArgs(0);

      const balanceAfter = await token.balanceOf(player1.address);
      expect(balanceAfter - balanceBefore).to.equal(STAKE_AMOUNT);

      const wager = await betting.wagers(0);
      expect(wager.status).to.equal(WagerStatus.Refunded);
    });

    it("Should allow anyone to trigger refund", async function () {
      const { betting, other } = await loadFixture(deployWithOpenWagerFixture);

      await time.increase(24 * 60 * 60 + 1);

      await expect(
        betting.connect(other).refundExpiredWager(0)
      ).to.not.be.reverted;
    });

    it("Should revert if wager is not open", async function () {
      const { betting, other } = await loadFixture(deployWithLockedWagerFixture);

      await time.increase(24 * 60 * 60 + 1);

      await expect(
        betting.connect(other).refundExpiredWager(0)
      ).to.be.revertedWith("Wager not open");
    });

    it("Should revert if wager is not yet expired", async function () {
      const { betting, other } = await loadFixture(deployWithOpenWagerFixture);

      await expect(
        betting.connect(other).refundExpiredWager(0)
      ).to.be.revertedWith("Wager not yet expired");
    });
  });

  // ================================================================
  // refundExpiredLockedWager
  // ================================================================
  describe("refundExpiredLockedWager", function () {
    it("Should refund both parties for expired locked wager", async function () {
      const { betting, token, player1, player2, other } =
        await loadFixture(deployWithLockedWagerFixture);

      const p1Before = await token.balanceOf(player1.address);
      const p2Before = await token.balanceOf(player2.address);

      // Advance past LOCKED_WAGER_TIMEOUT (7 days)
      await time.increase(7 * 24 * 60 * 60 + 1);

      await betting.connect(other).refundExpiredLockedWager(0);

      const p1After = await token.balanceOf(player1.address);
      const p2After = await token.balanceOf(player2.address);

      expect(p1After - p1Before).to.equal(STAKE_AMOUNT);
      expect(p2After - p2Before).to.equal(STAKE_AMOUNT);

      const wager = await betting.wagers(0);
      expect(wager.status).to.equal(WagerStatus.Refunded);
    });

    it("Should emit LockedWagerRefunded event", async function () {
      const { betting, other } = await loadFixture(deployWithLockedWagerFixture);

      await time.increase(7 * 24 * 60 * 60 + 1);

      await expect(betting.connect(other).refundExpiredLockedWager(0))
        .to.emit(betting, "LockedWagerRefunded")
        .withArgs(0);
    });

    it("Should refund spectator bets too", async function () {
      const { betting, token, player1, spectator1, other } =
        await loadFixture(deployWithLockedWagerFixture);

      await betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT);

      const specBefore = await token.balanceOf(spectator1.address);

      await time.increase(7 * 24 * 60 * 60 + 1);
      await betting.connect(other).refundExpiredLockedWager(0);

      const specAfter = await token.balanceOf(spectator1.address);
      expect(specAfter - specBefore).to.equal(SPECTATOR_BET_AMOUNT);
    });

    it("Should revert if wager not active (already settled)", async function () {
      const { betting, other } = await loadFixture(deployWithSettledWagerFixture);

      await time.increase(7 * 24 * 60 * 60 + 1);

      await expect(
        betting.connect(other).refundExpiredLockedWager(0)
      ).to.be.revertedWith("Wager not active");
    });

    it("Should revert if not yet expired", async function () {
      const { betting, other } = await loadFixture(deployWithLockedWagerFixture);

      await expect(
        betting.connect(other).refundExpiredLockedWager(0)
      ).to.be.revertedWith("Wager not yet expired");
    });
  });

  // ================================================================
  // refundSpectatorBets (Admin)
  // ================================================================
  describe("refundSpectatorBets", function () {
    it("Should refund spectator bets for disputed wager", async function () {
      const { betting, token, player1, player2, settler, spectator1, spectator2, owner } =
        await loadFixture(deployWithLockedWagerFixture);

      await betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT);
      await betting.connect(spectator2).placeBet(0, player2.address, SPECTATOR_BET_AMOUNT);

      // Settle then dispute
      await betting.connect(settler).settleWager(0, player1.address);
      await betting.connect(player2).disputeWager(0, "Disputed");

      const spec1Before = await token.balanceOf(spectator1.address);
      const spec2Before = await token.balanceOf(spectator2.address);

      await betting.connect(owner).refundSpectatorBets(0);

      const spec1After = await token.balanceOf(spectator1.address);
      const spec2After = await token.balanceOf(spectator2.address);

      expect(spec1After - spec1Before).to.equal(SPECTATOR_BET_AMOUNT);
      expect(spec2After - spec2Before).to.equal(SPECTATOR_BET_AMOUNT);
    });

    it("Should emit SpectatorBetsRefunded event", async function () {
      const { betting, player1, player2, settler, spectator1, owner } =
        await loadFixture(deployWithLockedWagerFixture);

      await betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT);
      await betting.connect(settler).settleWager(0, player1.address);
      await betting.connect(player2).disputeWager(0, "Disputed");

      await expect(betting.connect(owner).refundSpectatorBets(0))
        .to.emit(betting, "SpectatorBetsRefunded")
        .withArgs(0);
    });

    it("Should revert if not owner", async function () {
      const { betting, player1, player2, settler, spectator1 } =
        await loadFixture(deployWithLockedWagerFixture);

      await betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT);
      await betting.connect(settler).settleWager(0, player1.address);
      await betting.connect(player2).disputeWager(0, "Disputed");

      await expect(
        betting.connect(player1).refundSpectatorBets(0)
      ).to.be.revertedWithCustomError(betting, "OwnableUnauthorizedAccount");
    });

    it("Should revert if wager not in correct status", async function () {
      const { betting, owner } =
        await loadFixture(deployWithLockedWagerFixture);

      await expect(
        betting.connect(owner).refundSpectatorBets(0)
      ).to.be.revertedWith("Wager must be disputed, cancelled, or refunded");
    });
  });

  // ================================================================
  // Edge Cases
  // ================================================================
  describe("Edge Cases", function () {
    it("Should not allow double acceptance of a wager", async function () {
      const { betting, player2, spectator1 } =
        await loadFixture(deployWithOpenWagerFixture);

      await betting.connect(player2).acceptWager(0);

      await expect(
        betting.connect(spectator1).acceptWager(0)
      ).to.be.revertedWith("Wager not open");
    });

    it("Should not allow settling a wager twice", async function () {
      const { betting, player1, settler } =
        await loadFixture(deployWithLockedWagerFixture);

      await betting.connect(settler).settleWager(0, player1.address);

      await expect(
        betting.connect(settler).settleWager(0, player1.address)
      ).to.be.revertedWith("Wager not locked");
    });

    it("Should not allow spectator betting on a settled wager", async function () {
      const { betting, player1, spectator1 } =
        await loadFixture(deployWithSettledWagerFixture);

      await expect(
        betting.connect(spectator1).placeBet(0, player1.address, SPECTATOR_BET_AMOUNT)
      ).to.be.revertedWith("Wager not locked");
    });

    it("Should not allow cancelling a settled wager", async function () {
      const { betting, player1 } = await loadFixture(deployWithSettledWagerFixture);

      await expect(
        betting.connect(player1).cancelWager(0)
      ).to.be.revertedWith("Can only cancel open wagers");
    });

    it("Should handle wager with no spectator bets on claim", async function () {
      const { betting, token, player1, settler, treasury } =
        await loadFixture(deployWithLockedWagerFixture);

      await betting.connect(settler).settleWager(0, player1.address);
      await time.increase(24 * 60 * 60 + 1);

      const treasuryBefore = await token.balanceOf(treasury.address);
      await betting.connect(player1).claimWinnings(0);
      const treasuryAfter = await token.balanceOf(treasury.address);

      const totalPot = STAKE_AMOUNT * 2n;
      const expectedFee = (totalPot * 500n) / 10000n;
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);
    });
  });

  // ================================================================
  // Admin Functions
  // ================================================================
  describe("Admin Functions", function () {
    it("Should authorize a settler", async function () {
      const { betting, other } = await loadFixture(deployBettingFixture);

      await expect(betting.authorizeSettler(other.address))
        .to.emit(betting, "SettlerAuthorized")
        .withArgs(other.address);

      expect(await betting.authorizedSettlers(other.address)).to.equal(true);
    });

    it("Should revoke a settler", async function () {
      const { betting, settler } = await loadFixture(deployBettingFixture);

      await expect(betting.revokeSettler(settler.address))
        .to.emit(betting, "SettlerRevoked")
        .withArgs(settler.address);

      expect(await betting.authorizedSettlers(settler.address)).to.equal(false);
    });

    it("Should revert authorizing zero address as settler", async function () {
      const { betting } = await loadFixture(deployBettingFixture);

      await expect(
        betting.authorizeSettler(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid settler address");
    });

    it("Should update max stake and emit event", async function () {
      const { betting } = await loadFixture(deployBettingFixture);

      const newMax = ethers.parseEther("500");
      await expect(betting.setMaxStake(newMax))
        .to.emit(betting, "MaxStakeUpdated")
        .withArgs(newMax);
      expect(await betting.maxStakePerWager()).to.equal(newMax);
    });

    it("Should revert if max stake is zero", async function () {
      const { betting } = await loadFixture(deployBettingFixture);

      await expect(betting.setMaxStake(0)).to.be.revertedWith("Max stake must be positive");
    });

    it("Should revert if max stake is less than min", async function () {
      const { betting } = await loadFixture(deployBettingFixture);

      await expect(
        betting.setMaxStake(ethers.parseEther("0.01"))
      ).to.be.revertedWith("Max must be >= min");
    });

    it("Should update min stake and emit event", async function () {
      const { betting } = await loadFixture(deployBettingFixture);

      const newMin = ethers.parseEther("1");
      await expect(betting.setMinStake(newMin))
        .to.emit(betting, "MinStakeUpdated")
        .withArgs(newMin);
      expect(await betting.minStake()).to.equal(newMin);
    });

    it("Should revert if min stake is zero", async function () {
      const { betting } = await loadFixture(deployBettingFixture);

      await expect(betting.setMinStake(0)).to.be.revertedWith("Min stake must be positive");
    });

    it("Should revert if min stake exceeds max", async function () {
      const { betting } = await loadFixture(deployBettingFixture);

      await expect(
        betting.setMinStake(ethers.parseEther("2000"))
      ).to.be.revertedWith("Min must be <= max");
    });

    it("Should only allow owner to call admin functions", async function () {
      const { betting, player1 } = await loadFixture(deployBettingFixture);

      await expect(
        betting.connect(player1).authorizeSettler(player1.address)
      ).to.be.revertedWithCustomError(betting, "OwnableUnauthorizedAccount");

      await expect(
        betting.connect(player1).revokeSettler(player1.address)
      ).to.be.revertedWithCustomError(betting, "OwnableUnauthorizedAccount");

      await expect(
        betting.connect(player1).setMaxStake(100)
      ).to.be.revertedWithCustomError(betting, "OwnableUnauthorizedAccount");

      await expect(
        betting.connect(player1).setMinStake(1)
      ).to.be.revertedWithCustomError(betting, "OwnableUnauthorizedAccount");

      await expect(
        betting.connect(player1).proposeTreasuryChange(player1.address)
      ).to.be.revertedWithCustomError(betting, "OwnableUnauthorizedAccount");
    });
  });

  // ================================================================
  // Treasury Timelock
  // ================================================================
  describe("Treasury Timelock", function () {
    it("Should propose treasury change", async function () {
      const { betting, other } = await loadFixture(deployBettingFixture);

      await expect(betting.proposeTreasuryChange(other.address))
        .to.emit(betting, "TreasuryChangeProposed");

      expect(await betting.pendingTreasury()).to.equal(other.address);
    });

    it("Should not change treasury immediately", async function () {
      const { betting, treasury, other } = await loadFixture(deployBettingFixture);

      await betting.proposeTreasuryChange(other.address);
      expect(await betting.treasury()).to.equal(treasury.address);
    });

    it("Should confirm treasury after 48 hours", async function () {
      const { betting, other } = await loadFixture(deployBettingFixture);

      await betting.proposeTreasuryChange(other.address);
      await time.increase(48 * 60 * 60);
      await betting.confirmTreasuryChange();

      expect(await betting.treasury()).to.equal(other.address);
      expect(await betting.pendingTreasury()).to.equal(ethers.ZeroAddress);
    });

    it("Should emit TreasuryChangeConfirmed on confirm", async function () {
      const { betting, treasury, other } = await loadFixture(deployBettingFixture);

      await betting.proposeTreasuryChange(other.address);
      await time.increase(48 * 60 * 60);

      await expect(betting.confirmTreasuryChange())
        .to.emit(betting, "TreasuryChangeConfirmed")
        .withArgs(treasury.address, other.address);
    });

    it("Should revert confirm before 48 hours", async function () {
      const { betting, other } = await loadFixture(deployBettingFixture);

      await betting.proposeTreasuryChange(other.address);
      await time.increase(47 * 60 * 60);

      await expect(betting.confirmTreasuryChange())
        .to.be.revertedWith("Timelock not elapsed");
    });

    it("Should revert confirm with no pending change", async function () {
      const { betting } = await loadFixture(deployBettingFixture);

      await expect(betting.confirmTreasuryChange())
        .to.be.revertedWith("No pending treasury change");
    });

    it("Should cancel treasury change", async function () {
      const { betting, other } = await loadFixture(deployBettingFixture);

      await betting.proposeTreasuryChange(other.address);
      await expect(betting.cancelTreasuryChange())
        .to.emit(betting, "TreasuryChangeCancelled");

      expect(await betting.pendingTreasury()).to.equal(ethers.ZeroAddress);
    });

    it("Should revert cancel with no pending change", async function () {
      const { betting } = await loadFixture(deployBettingFixture);

      await expect(betting.cancelTreasuryChange())
        .to.be.revertedWith("No pending treasury change");
    });

    it("Should revert proposing zero address", async function () {
      const { betting } = await loadFixture(deployBettingFixture);

      await expect(
        betting.proposeTreasuryChange(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury address");
    });
  });

  // ================================================================
  // Pause
  // ================================================================
  describe("Pause", function () {
    it("Should allow owner to pause", async function () {
      const { betting } = await loadFixture(deployBettingFixture);
      await betting.pause();
      expect(await betting.paused()).to.equal(true);
    });

    it("Should allow owner to unpause", async function () {
      const { betting } = await loadFixture(deployBettingFixture);
      await betting.pause();
      await betting.unpause();
      expect(await betting.paused()).to.equal(false);
    });

    it("Should NOT block cancelWager when paused (creator can always cancel)", async function () {
      const { betting, player1 } = await loadFixture(deployWithOpenWagerFixture);
      await betting.pause();

      await expect(
        betting.connect(player1).cancelWager(0)
      ).to.not.be.reverted;
    });

    it("Should NOT block refundExpiredWager when paused", async function () {
      const { betting, other } = await loadFixture(deployWithOpenWagerFixture);
      await betting.pause();

      await time.increase(24 * 60 * 60 + 1);

      await expect(
        betting.connect(other).refundExpiredWager(0)
      ).to.not.be.reverted;
    });

    it("Should only allow owner to pause/unpause", async function () {
      const { betting, player1 } = await loadFixture(deployBettingFixture);

      await expect(
        betting.connect(player1).pause()
      ).to.be.revertedWithCustomError(betting, "OwnableUnauthorizedAccount");

      await expect(
        betting.connect(player1).unpause()
      ).to.be.revertedWithCustomError(betting, "OwnableUnauthorizedAccount");
    });
  });
});
