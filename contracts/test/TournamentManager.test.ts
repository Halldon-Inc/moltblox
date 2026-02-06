import { expect } from "chai";
import { ethers } from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("TournamentManager", function () {
  const INITIAL_SUPPLY = ethers.parseEther("10000000"); // 10 million
  const PRIZE_POOL = ethers.parseEther("10000");
  const ENTRY_FEE = ethers.parseEther("100");

  // TournamentType enum
  const TournamentType = {
    PlatformSponsored: 0,
    CreatorSponsored: 1,
    CommunitySponsored: 2,
  };

  // TournamentStatus enum
  const TournamentStatus = {
    Registration: 0,
    Active: 1,
    Completed: 2,
    Cancelled: 3,
  };

  // Helper to get timestamps for tournament scheduling
  async function getTimestamps() {
    const now = await time.latest();
    return {
      registrationStart: now + 10, // starts 10 seconds from now
      registrationEnd: now + 3600, // ends in 1 hour
      startTime: now + 3600, // starts at registration end
    };
  }

  async function deployTournamentFixture() {
    const [owner, treasury, sponsor, player1, player2, player3, player4, other] =
      await ethers.getSigners();

    // Deploy Moltbucks
    const Moltbucks = await ethers.getContractFactory("Moltbucks");
    const token = await Moltbucks.deploy(INITIAL_SUPPLY);

    // Deploy TournamentManager
    const TournamentManager =
      await ethers.getContractFactory("TournamentManager");
    const manager = await TournamentManager.deploy(
      await token.getAddress(),
      treasury.address
    );

    const managerAddr = await manager.getAddress();

    // Distribute tokens to participants and sponsor
    await token.transfer(sponsor.address, ethers.parseEther("100000"));
    await token.transfer(player1.address, ethers.parseEther("10000"));
    await token.transfer(player2.address, ethers.parseEther("10000"));
    await token.transfer(player3.address, ethers.parseEther("10000"));
    await token.transfer(player4.address, ethers.parseEther("10000"));
    await token.transfer(treasury.address, ethers.parseEther("100000"));

    // Approve manager for all participants
    await token.connect(sponsor).approve(managerAddr, ethers.MaxUint256);
    await token.connect(player1).approve(managerAddr, ethers.MaxUint256);
    await token.connect(player2).approve(managerAddr, ethers.MaxUint256);
    await token.connect(player3).approve(managerAddr, ethers.MaxUint256);
    await token.connect(player4).approve(managerAddr, ethers.MaxUint256);
    await token.connect(treasury).approve(managerAddr, ethers.MaxUint256);

    return {
      token,
      manager,
      owner,
      treasury,
      sponsor,
      player1,
      player2,
      player3,
      player4,
      other,
    };
  }

  async function deployWithCreatorTournamentFixture() {
    const fixture = await loadFixture(deployTournamentFixture);
    const { manager, sponsor } = fixture;

    const ts = await getTimestamps();

    await manager.connect(sponsor).createCreatorTournament(
      "tourney-001",
      "game-001",
      PRIZE_POOL,
      ENTRY_FEE,
      10, // maxParticipants
      ts.registrationStart,
      ts.registrationEnd,
      ts.startTime
    );

    return { ...fixture, timestamps: ts };
  }

  async function deployWithRegisteredPlayersFixture() {
    const fixture = await loadFixture(deployWithCreatorTournamentFixture);
    const { manager, player1, player2, player3, player4, timestamps } = fixture;

    // Advance time to registration start
    await time.increaseTo(timestamps.registrationStart);

    // Register 4 players
    await manager.connect(player1).register("tourney-001");
    await manager.connect(player2).register("tourney-001");
    await manager.connect(player3).register("tourney-001");
    await manager.connect(player4).register("tourney-001");

    return fixture;
  }

  async function deployWithActiveTournamentFixture() {
    const fixture = await loadFixture(deployWithRegisteredPlayersFixture);
    const { manager, sponsor, timestamps } = fixture;

    // Advance time to start time
    await time.increaseTo(timestamps.startTime);

    await manager.connect(sponsor).startTournament("tourney-001");

    return fixture;
  }

  // ================================================================
  // Deployment
  // ================================================================
  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { manager, owner } = await loadFixture(deployTournamentFixture);
      expect(await manager.owner()).to.equal(owner.address);
    });

    it("Should set the correct token address", async function () {
      const { manager, token } = await loadFixture(deployTournamentFixture);
      expect(await manager.moltbucks()).to.equal(await token.getAddress());
    });

    it("Should set the correct treasury address", async function () {
      const { manager, treasury } = await loadFixture(deployTournamentFixture);
      expect(await manager.treasury()).to.equal(treasury.address);
    });

    it("Should revert with zero token address", async function () {
      const [, treasury] = await ethers.getSigners();
      const TournamentManager =
        await ethers.getContractFactory("TournamentManager");
      await expect(
        TournamentManager.deploy(ethers.ZeroAddress, treasury.address)
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should revert with zero treasury address", async function () {
      const { token } = await loadFixture(deployTournamentFixture);
      const TournamentManager =
        await ethers.getContractFactory("TournamentManager");
      await expect(
        TournamentManager.deploy(await token.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury address");
    });
  });

  // ================================================================
  // Tournament Creation
  // ================================================================
  describe("Tournament Creation", function () {
    describe("createCreatorTournament", function () {
      it("Should create a creator-sponsored tournament", async function () {
        const { manager, sponsor } = await loadFixture(deployTournamentFixture);
        const ts = await getTimestamps();

        await manager.connect(sponsor).createCreatorTournament(
          "tourney-001",
          "game-001",
          PRIZE_POOL,
          ENTRY_FEE,
          10,
          ts.registrationStart,
          ts.registrationEnd,
          ts.startTime
        );

        const t = await manager.getTournament("tourney-001");
        expect(t.gameId).to.equal("game-001");
        expect(t.sponsor).to.equal(sponsor.address);
        expect(t.tournamentType).to.equal(TournamentType.CreatorSponsored);
        expect(t.status).to.equal(TournamentStatus.Registration);
        expect(t.prizePool).to.equal(PRIZE_POOL);
        expect(t.entryFee).to.equal(ENTRY_FEE);
        expect(t.maxParticipants).to.equal(10);
        expect(t.currentParticipants).to.equal(0);
      });

      it("Should emit TournamentCreated event", async function () {
        const { manager, sponsor } = await loadFixture(deployTournamentFixture);
        const ts = await getTimestamps();

        await expect(
          manager.connect(sponsor).createCreatorTournament(
            "tourney-001",
            "game-001",
            PRIZE_POOL,
            ENTRY_FEE,
            10,
            ts.registrationStart,
            ts.registrationEnd,
            ts.startTime
          )
        )
          .to.emit(manager, "TournamentCreated")
          .withArgs(
            "tourney-001",
            "game-001",
            sponsor.address,
            TournamentType.CreatorSponsored,
            PRIZE_POOL,
            ENTRY_FEE,
            10
          );
      });

      it("Should transfer prize pool from sponsor", async function () {
        const { token, manager, sponsor } =
          await loadFixture(deployTournamentFixture);
        const ts = await getTimestamps();

        const balBefore = await token.balanceOf(sponsor.address);

        await manager.connect(sponsor).createCreatorTournament(
          "tourney-001",
          "game-001",
          PRIZE_POOL,
          ENTRY_FEE,
          10,
          ts.registrationStart,
          ts.registrationEnd,
          ts.startTime
        );

        expect(await token.balanceOf(sponsor.address)).to.equal(
          balBefore - PRIZE_POOL
        );
      });

      it("Should set default prize distribution 50/25/15/10", async function () {
        const { manager } =
          await loadFixture(deployWithCreatorTournamentFixture);

        const dist = await manager.getDistribution("tourney-001");
        expect(dist.first).to.equal(50);
        expect(dist.second).to.equal(25);
        expect(dist.third).to.equal(15);
        expect(dist.participation).to.equal(10);
      });
    });

    describe("createPlatformTournament", function () {
      it("Should create a platform-sponsored tournament (admin only)", async function () {
        const { manager, owner, treasury } =
          await loadFixture(deployTournamentFixture);
        const ts = await getTimestamps();

        await manager.createPlatformTournament(
          "platform-001",
          "game-001",
          PRIZE_POOL,
          0, // free entry
          20,
          ts.registrationStart,
          ts.registrationEnd,
          ts.startTime
        );

        const t = await manager.getTournament("platform-001");
        expect(t.sponsor).to.equal(treasury.address);
        expect(t.tournamentType).to.equal(TournamentType.PlatformSponsored);
        expect(t.entryFee).to.equal(0);
      });

      it("Should revert when non-owner creates platform tournament", async function () {
        const { manager, sponsor } = await loadFixture(deployTournamentFixture);
        const ts = await getTimestamps();

        await expect(
          manager.connect(sponsor).createPlatformTournament(
            "platform-001",
            "game-001",
            PRIZE_POOL,
            0,
            20,
            ts.registrationStart,
            ts.registrationEnd,
            ts.startTime
          )
        ).to.be.revertedWithCustomError(manager, "OwnableUnauthorizedAccount");
      });
    });

    describe("createCommunityTournament", function () {
      it("Should create a community tournament", async function () {
        const { manager, sponsor } = await loadFixture(deployTournamentFixture);
        const ts = await getTimestamps();

        await manager.connect(sponsor).createCommunityTournament(
          "community-001",
          "game-001",
          ethers.parseEther("500"),
          ENTRY_FEE,
          8,
          ts.registrationStart,
          ts.registrationEnd,
          ts.startTime
        );

        const t = await manager.getTournament("community-001");
        expect(t.tournamentType).to.equal(TournamentType.CommunitySponsored);
        expect(t.prizePool).to.equal(ethers.parseEther("500"));
      });

      it("Should allow zero initial prize pool for community tournament", async function () {
        const { manager, sponsor } = await loadFixture(deployTournamentFixture);
        const ts = await getTimestamps();

        await manager.connect(sponsor).createCommunityTournament(
          "community-002",
          "game-001",
          0, // zero initial
          ENTRY_FEE,
          4,
          ts.registrationStart,
          ts.registrationEnd,
          ts.startTime
        );

        const t = await manager.getTournament("community-002");
        expect(t.prizePool).to.equal(0);
      });
    });

    describe("Validation", function () {
      it("Should revert with empty tournament ID", async function () {
        const { manager, sponsor } = await loadFixture(deployTournamentFixture);
        const ts = await getTimestamps();

        await expect(
          manager.connect(sponsor).createCreatorTournament(
            "",
            "game-001",
            PRIZE_POOL,
            ENTRY_FEE,
            10,
            ts.registrationStart,
            ts.registrationEnd,
            ts.startTime
          )
        ).to.be.revertedWith("Invalid tournament ID");
      });

      it("Should revert with duplicate tournament ID", async function () {
        const { manager, sponsor } =
          await loadFixture(deployWithCreatorTournamentFixture);
        const ts = await getTimestamps();

        await expect(
          manager.connect(sponsor).createCreatorTournament(
            "tourney-001",
            "game-002",
            PRIZE_POOL,
            ENTRY_FEE,
            10,
            ts.registrationStart,
            ts.registrationEnd,
            ts.startTime
          )
        ).to.be.revertedWith("Tournament exists");
      });

      it("Should revert with maxParticipants < 2", async function () {
        const { manager, sponsor } = await loadFixture(deployTournamentFixture);
        const ts = await getTimestamps();

        await expect(
          manager.connect(sponsor).createCreatorTournament(
            "tourney-001",
            "game-001",
            PRIZE_POOL,
            ENTRY_FEE,
            1, // less than 2
            ts.registrationStart,
            ts.registrationEnd,
            ts.startTime
          )
        ).to.be.revertedWith("Need at least 2 participants");
      });

      it("Should revert with invalid registration period", async function () {
        const { manager, sponsor } = await loadFixture(deployTournamentFixture);
        const now = await time.latest();

        await expect(
          manager.connect(sponsor).createCreatorTournament(
            "tourney-001",
            "game-001",
            PRIZE_POOL,
            ENTRY_FEE,
            10,
            now + 3600, // start after end
            now + 1800,
            now + 7200
          )
        ).to.be.revertedWith("Invalid registration period");
      });

      it("Should revert when registration ends after start time", async function () {
        const { manager, sponsor } = await loadFixture(deployTournamentFixture);
        const now = await time.latest();

        await expect(
          manager.connect(sponsor).createCreatorTournament(
            "tourney-001",
            "game-001",
            PRIZE_POOL,
            ENTRY_FEE,
            10,
            now + 10,
            now + 7200, // registration ends after start
            now + 3600
          )
        ).to.be.revertedWith("Registration must end before start");
      });
    });
  });

  // ================================================================
  // Custom Prize Distribution
  // ================================================================
  describe("Custom Prize Distribution", function () {
    it("Should allow sponsor to set custom distribution", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await manager.connect(sponsor).setDistribution(
        "tourney-001",
        60, // 60% first
        20, // 20% second
        15, // 15% third
        5 // 5% participation
      );

      const dist = await manager.getDistribution("tourney-001");
      expect(dist.first).to.equal(60);
      expect(dist.second).to.equal(20);
      expect(dist.third).to.equal(15);
      expect(dist.participation).to.equal(5);
    });

    it("Should allow owner to set distribution", async function () {
      const { manager, owner } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await manager.setDistribution("tourney-001", 40, 30, 20, 10);

      const dist = await manager.getDistribution("tourney-001");
      expect(dist.first).to.equal(40);
    });

    it("Should revert when percentages do not total 100", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await expect(
        manager.connect(sponsor).setDistribution("tourney-001", 50, 30, 15, 10)
      ).to.be.revertedWith("Must total 100%");
    });

    it("Should revert when unauthorized user sets distribution", async function () {
      const { manager, other } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await expect(
        manager.connect(other).setDistribution("tourney-001", 50, 25, 15, 10)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should revert when modifying non-registration tournament", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithActiveTournamentFixture);

      await expect(
        manager.connect(sponsor).setDistribution("tourney-001", 50, 25, 15, 10)
      ).to.be.revertedWith("Cannot modify");
    });
  });

  // ================================================================
  // Registration
  // ================================================================
  describe("Registration", function () {
    it("Should register a player", async function () {
      const { manager, player1, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);
      await manager.connect(player1).register("tourney-001");

      expect(
        await manager.isParticipant("tourney-001", player1.address)
      ).to.equal(true);

      const t = await manager.getTournament("tourney-001");
      expect(t.currentParticipants).to.equal(1);
    });

    it("Should collect entry fee from player", async function () {
      const { token, manager, player1, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);

      const balBefore = await token.balanceOf(player1.address);
      await manager.connect(player1).register("tourney-001");

      expect(await token.balanceOf(player1.address)).to.equal(
        balBefore - ENTRY_FEE
      );
    });

    it("Should emit ParticipantRegistered event", async function () {
      const { manager, player1, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);

      await expect(manager.connect(player1).register("tourney-001"))
        .to.emit(manager, "ParticipantRegistered")
        .withArgs("tourney-001", player1.address, ENTRY_FEE);
    });

    it("Should track total entry fees collected", async function () {
      const { manager, player1, player2, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);
      await manager.connect(player1).register("tourney-001");
      await manager.connect(player2).register("tourney-001");

      expect(await manager.participantEntryFees("tourney-001")).to.equal(
        ENTRY_FEE * 2n
      );
    });

    it("Should add entry fees to prize pool for community tournaments", async function () {
      const { manager, sponsor, player1, player2 } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      const initialPool = ethers.parseEther("500");

      await manager.connect(sponsor).createCommunityTournament(
        "community-001",
        "game-001",
        initialPool,
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await time.increaseTo(ts.registrationStart);
      await manager.connect(player1).register("community-001");
      await manager.connect(player2).register("community-001");

      const t = await manager.getTournament("community-001");
      expect(t.prizePool).to.equal(initialPool + ENTRY_FEE * 2n);
    });

    it("Should revert when registering twice", async function () {
      const { manager, player1, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);
      await manager.connect(player1).register("tourney-001");

      await expect(
        manager.connect(player1).register("tourney-001")
      ).to.be.revertedWith("Already registered");
    });

    it("Should revert when registration has not started", async function () {
      const { manager, player1 } =
        await loadFixture(deployWithCreatorTournamentFixture);

      // Do NOT advance time -- registration hasn't started
      await expect(
        manager.connect(player1).register("tourney-001")
      ).to.be.revertedWith("Registration not open");
    });

    it("Should revert when registration has closed", async function () {
      const { manager, player1, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      // Advance past registration end
      await time.increaseTo(timestamps.registrationEnd + 1);

      await expect(
        manager.connect(player1).register("tourney-001")
      ).to.be.revertedWith("Registration closed");
    });

    it("Should revert when tournament is full", async function () {
      const { manager, sponsor, player1, player2, player3, other } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();

      // Create tournament with max 2 participants
      await manager.connect(sponsor).createCreatorTournament(
        "small-tourney",
        "game-001",
        PRIZE_POOL,
        ENTRY_FEE,
        2,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await time.increaseTo(ts.registrationStart);
      await manager.connect(player1).register("small-tourney");
      await manager.connect(player2).register("small-tourney");

      await expect(
        manager.connect(player3).register("small-tourney")
      ).to.be.revertedWith("Tournament full");
    });

    it("Should revert when tournament status is not Registration", async function () {
      const { manager, other } =
        await loadFixture(deployWithActiveTournamentFixture);

      await expect(
        manager.connect(other).register("tourney-001")
      ).to.be.revertedWith("Not in registration");
    });

    it("Should return participants list", async function () {
      const { manager, player1, player2, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);
      await manager.connect(player1).register("tourney-001");
      await manager.connect(player2).register("tourney-001");

      const participants = await manager.getParticipants("tourney-001");
      expect(participants.length).to.equal(2);
      expect(participants).to.include(player1.address);
      expect(participants).to.include(player2.address);
    });
  });

  // ================================================================
  // Tournament Lifecycle
  // ================================================================
  describe("Tournament Lifecycle", function () {
    describe("startTournament", function () {
      it("Should start a tournament", async function () {
        const { manager, sponsor, timestamps } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        await time.increaseTo(timestamps.startTime);
        await manager.connect(sponsor).startTournament("tourney-001");

        const t = await manager.getTournament("tourney-001");
        expect(t.status).to.equal(TournamentStatus.Active);
      });

      it("Should emit TournamentStarted event", async function () {
        const { manager, sponsor, timestamps } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        await time.increaseTo(timestamps.startTime);

        await expect(manager.connect(sponsor).startTournament("tourney-001"))
          .to.emit(manager, "TournamentStarted")
          .withArgs("tourney-001", 4);
      });

      it("Should allow owner to start tournament", async function () {
        const { manager, owner, timestamps } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        await time.increaseTo(timestamps.startTime);
        await manager.startTournament("tourney-001");

        const t = await manager.getTournament("tourney-001");
        expect(t.status).to.equal(TournamentStatus.Active);
      });

      it("Should revert when unauthorized user starts tournament", async function () {
        const { manager, other, timestamps } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        await time.increaseTo(timestamps.startTime);

        await expect(
          manager.connect(other).startTournament("tourney-001")
        ).to.be.revertedWith("Not authorized");
      });

      it("Should revert when starting before start time", async function () {
        const { manager, sponsor } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        // Do NOT advance to start time
        await expect(
          manager.connect(sponsor).startTournament("tourney-001")
        ).to.be.revertedWith("Not start time yet");
      });

      it("Should revert with fewer than 2 participants", async function () {
        const { manager, sponsor, player1 } =
          await loadFixture(deployTournamentFixture);

        const ts = await getTimestamps();

        await manager.connect(sponsor).createCreatorTournament(
          "small-tourney",
          "game-001",
          PRIZE_POOL,
          ENTRY_FEE,
          10,
          ts.registrationStart,
          ts.registrationEnd,
          ts.startTime
        );

        await time.increaseTo(ts.registrationStart);
        await manager.connect(player1).register("small-tourney");

        await time.increaseTo(ts.startTime);

        await expect(
          manager.connect(sponsor).startTournament("small-tourney")
        ).to.be.revertedWith("Not enough participants");
      });

      it("Should revert when tournament is not in Registration status", async function () {
        const { manager, sponsor } =
          await loadFixture(deployWithActiveTournamentFixture);

        await expect(
          manager.connect(sponsor).startTournament("tourney-001")
        ).to.be.revertedWith("Invalid status");
      });
    });

    describe("completeTournament", function () {
      it("Should complete the tournament and distribute prizes", async function () {
        const { token, manager, sponsor, player1, player2, player3, player4 } =
          await loadFixture(deployWithActiveTournamentFixture);

        const p1BalBefore = await token.balanceOf(player1.address);
        const p2BalBefore = await token.balanceOf(player2.address);
        const p3BalBefore = await token.balanceOf(player3.address);
        const p4BalBefore = await token.balanceOf(player4.address);

        await manager
          .connect(sponsor)
          .completeTournament(
            "tourney-001",
            player1.address,
            player2.address,
            player3.address
          );

        // Default distribution: 50/25/15/10
        const firstPrize = (PRIZE_POOL * 50n) / 100n;
        const secondPrize = (PRIZE_POOL * 25n) / 100n;
        const thirdPrize = (PRIZE_POOL * 15n) / 100n;
        const participationPool = PRIZE_POOL - firstPrize - secondPrize - thirdPrize;

        // Only player4 is a non-winner (1 non-winner)
        const participationReward = participationPool / 1n;

        // Player1 gets first prize (might also get dust)
        const p1BalAfter = await token.balanceOf(player1.address);
        expect(p1BalAfter).to.be.gte(p1BalBefore + firstPrize);

        expect(await token.balanceOf(player2.address)).to.equal(
          p2BalBefore + secondPrize
        );
        expect(await token.balanceOf(player3.address)).to.equal(
          p3BalBefore + thirdPrize
        );
        expect(await token.balanceOf(player4.address)).to.equal(
          p4BalBefore + participationReward
        );
      });

      it("Should set tournament status to Completed", async function () {
        const { manager, sponsor, player1, player2, player3 } =
          await loadFixture(deployWithActiveTournamentFixture);

        await manager
          .connect(sponsor)
          .completeTournament(
            "tourney-001",
            player1.address,
            player2.address,
            player3.address
          );

        const t = await manager.getTournament("tourney-001");
        expect(t.status).to.equal(TournamentStatus.Completed);
      });

      it("Should set winners correctly", async function () {
        const { manager, sponsor, player1, player2, player3 } =
          await loadFixture(deployWithActiveTournamentFixture);

        await manager
          .connect(sponsor)
          .completeTournament(
            "tourney-001",
            player1.address,
            player2.address,
            player3.address
          );

        const winners = await manager.getWinners("tourney-001");
        expect(winners[0]).to.equal(player1.address);
        expect(winners[1]).to.equal(player2.address);
        expect(winners[2]).to.equal(player3.address);
      });

      it("Should emit PrizeDistributed events", async function () {
        const { manager, sponsor, player1, player2, player3 } =
          await loadFixture(deployWithActiveTournamentFixture);

        const firstPrize = (PRIZE_POOL * 50n) / 100n;
        const secondPrize = (PRIZE_POOL * 25n) / 100n;
        const thirdPrize = (PRIZE_POOL * 15n) / 100n;

        const tx = manager
          .connect(sponsor)
          .completeTournament(
            "tourney-001",
            player1.address,
            player2.address,
            player3.address
          );

        await expect(tx)
          .to.emit(manager, "PrizeDistributed")
          .withArgs("tourney-001", player1.address, 1, firstPrize);

        await expect(tx)
          .to.emit(manager, "PrizeDistributed")
          .withArgs("tourney-001", player2.address, 2, secondPrize);

        await expect(tx)
          .to.emit(manager, "PrizeDistributed")
          .withArgs("tourney-001", player3.address, 3, thirdPrize);
      });

      it("Should emit TournamentCompleted event", async function () {
        const { manager, sponsor, player1, player2, player3 } =
          await loadFixture(deployWithActiveTournamentFixture);

        await expect(
          manager
            .connect(sponsor)
            .completeTournament(
              "tourney-001",
              player1.address,
              player2.address,
              player3.address
            )
        )
          .to.emit(manager, "TournamentCompleted")
          .withArgs(
            "tourney-001",
            player1.address,
            player2.address,
            player3.address
          );
      });

      it("Should emit ParticipationRewardDistributed event", async function () {
        const { manager, sponsor, player1, player2, player3, player4 } =
          await loadFixture(deployWithActiveTournamentFixture);

        const firstPrize = (PRIZE_POOL * 50n) / 100n;
        const secondPrize = (PRIZE_POOL * 25n) / 100n;
        const thirdPrize = (PRIZE_POOL * 15n) / 100n;
        const participationPool =
          PRIZE_POOL - firstPrize - secondPrize - thirdPrize;
        const participationReward = participationPool / 1n; // 1 non-winner

        await expect(
          manager
            .connect(sponsor)
            .completeTournament(
              "tourney-001",
              player1.address,
              player2.address,
              player3.address
            )
        )
          .to.emit(manager, "ParticipationRewardDistributed")
          .withArgs("tourney-001", player4.address, participationReward);
      });

      it("Should revert when tournament is not active", async function () {
        const { manager, sponsor, player1, player2, player3 } =
          await loadFixture(deployWithCreatorTournamentFixture);

        await expect(
          manager
            .connect(sponsor)
            .completeTournament(
              "tourney-001",
              player1.address,
              player2.address,
              player3.address
            )
        ).to.be.revertedWith("Not active");
      });

      it("Should revert when unauthorized user completes", async function () {
        const { manager, other, player1, player2, player3 } =
          await loadFixture(deployWithActiveTournamentFixture);

        await expect(
          manager
            .connect(other)
            .completeTournament(
              "tourney-001",
              player1.address,
              player2.address,
              player3.address
            )
        ).to.be.revertedWith("Not authorized");
      });

      it("Should revert when winner is not a participant", async function () {
        const { manager, sponsor, player1, player2, other } =
          await loadFixture(deployWithActiveTournamentFixture);

        await expect(
          manager
            .connect(sponsor)
            .completeTournament(
              "tourney-001",
              player1.address,
              player2.address,
              other.address // not a participant
            )
        ).to.be.revertedWith("3rd not participant");
      });

      it("Should revert when duplicate winner addresses (1st == 2nd)", async function () {
        const { manager, sponsor, player1, player3 } =
          await loadFixture(deployWithActiveTournamentFixture);

        await expect(
          manager
            .connect(sponsor)
            .completeTournament(
              "tourney-001",
              player1.address,
              player1.address,
              player3.address
            )
        ).to.be.revertedWith("Duplicate winner");
      });

      it("Should revert when duplicate winner addresses (1st == 3rd)", async function () {
        const { manager, sponsor, player1, player2 } =
          await loadFixture(deployWithActiveTournamentFixture);

        await expect(
          manager
            .connect(sponsor)
            .completeTournament(
              "tourney-001",
              player1.address,
              player2.address,
              player1.address
            )
        ).to.be.revertedWith("Duplicate winner");
      });

      it("Should revert when duplicate winner addresses (2nd == 3rd)", async function () {
        const { manager, sponsor, player1, player2 } =
          await loadFixture(deployWithActiveTournamentFixture);

        await expect(
          manager
            .connect(sponsor)
            .completeTournament(
              "tourney-001",
              player1.address,
              player2.address,
              player2.address
            )
        ).to.be.revertedWith("Duplicate winner");
      });

      it("Should revert when completing already distributed tournament", async function () {
        const { manager, sponsor, player1, player2, player3 } =
          await loadFixture(deployWithActiveTournamentFixture);

        await manager
          .connect(sponsor)
          .completeTournament(
            "tourney-001",
            player1.address,
            player2.address,
            player3.address
          );

        await expect(
          manager
            .connect(sponsor)
            .completeTournament(
              "tourney-001",
              player1.address,
              player2.address,
              player3.address
            )
        ).to.be.revertedWith("Not active");
      });
    });

    describe("cancelTournament", function () {
      it("Should cancel a tournament in Registration status", async function () {
        const { manager, sponsor } =
          await loadFixture(deployWithCreatorTournamentFixture);

        await manager
          .connect(sponsor)
          .cancelTournament("tourney-001", "Not enough interest");

        const t = await manager.getTournament("tourney-001");
        expect(t.status).to.equal(TournamentStatus.Cancelled);
      });

      it("Should cancel an active tournament", async function () {
        const { manager, sponsor } =
          await loadFixture(deployWithActiveTournamentFixture);

        await manager
          .connect(sponsor)
          .cancelTournament("tourney-001", "Technical issues");

        const t = await manager.getTournament("tourney-001");
        expect(t.status).to.equal(TournamentStatus.Cancelled);
      });

      it("Should refund entry fees to all participants", async function () {
        const { token, manager, sponsor, player1, player2, player3, player4, timestamps } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        const p1BalBefore = await token.balanceOf(player1.address);
        const p2BalBefore = await token.balanceOf(player2.address);

        await manager
          .connect(sponsor)
          .cancelTournament("tourney-001", "Cancelled");

        expect(await token.balanceOf(player1.address)).to.equal(
          p1BalBefore + ENTRY_FEE
        );
        expect(await token.balanceOf(player2.address)).to.equal(
          p2BalBefore + ENTRY_FEE
        );
      });

      it("Should emit RefundIssued events", async function () {
        const { manager, sponsor, player1, timestamps } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        await expect(
          manager
            .connect(sponsor)
            .cancelTournament("tourney-001", "Cancelled")
        )
          .to.emit(manager, "RefundIssued")
          .withArgs("tourney-001", player1.address, ENTRY_FEE);
      });

      it("Should emit TournamentCancelled event", async function () {
        const { manager, sponsor } =
          await loadFixture(deployWithCreatorTournamentFixture);

        await expect(
          manager
            .connect(sponsor)
            .cancelTournament("tourney-001", "Not enough interest")
        )
          .to.emit(manager, "TournamentCancelled")
          .withArgs("tourney-001", "Not enough interest");
      });

      it("Should return prize pool to sponsor for non-community tournaments", async function () {
        const { token, manager, sponsor } =
          await loadFixture(deployWithCreatorTournamentFixture);

        const sponsorBalBefore = await token.balanceOf(sponsor.address);

        await manager
          .connect(sponsor)
          .cancelTournament("tourney-001", "Cancelled");

        expect(await token.balanceOf(sponsor.address)).to.equal(
          sponsorBalBefore + PRIZE_POOL
        );
      });

      it("Should revert when unauthorized user cancels", async function () {
        const { manager, other } =
          await loadFixture(deployWithCreatorTournamentFixture);

        await expect(
          manager.connect(other).cancelTournament("tourney-001", "Reason")
        ).to.be.revertedWith("Not authorized");
      });

      it("Should revert when cancelling a completed tournament", async function () {
        const { manager, sponsor, player1, player2, player3 } =
          await loadFixture(deployWithActiveTournamentFixture);

        await manager
          .connect(sponsor)
          .completeTournament(
            "tourney-001",
            player1.address,
            player2.address,
            player3.address
          );

        await expect(
          manager.connect(sponsor).cancelTournament("tourney-001", "Reason")
        ).to.be.revertedWith("Cannot cancel");
      });
    });
  });

  // ================================================================
  // Add to Prize Pool
  // ================================================================
  describe("addToPrizePool", function () {
    it("Should allow anyone to add to prize pool during registration", async function () {
      const { token, manager, other, sponsor } =
        await loadFixture(deployWithCreatorTournamentFixture);

      // Give other some tokens
      await token.transfer(other.address, ethers.parseEther("1000"));
      await token
        .connect(other)
        .approve(await manager.getAddress(), ethers.parseEther("1000"));

      const addAmount = ethers.parseEther("500");

      await manager.connect(other).addToPrizePool("tourney-001", addAmount);

      const t = await manager.getTournament("tourney-001");
      expect(t.prizePool).to.equal(PRIZE_POOL + addAmount);
    });

    it("Should revert when adding to non-registration tournament", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithActiveTournamentFixture);

      await expect(
        manager
          .connect(sponsor)
          .addToPrizePool("tourney-001", ethers.parseEther("100"))
      ).to.be.revertedWith("Cannot add to pool");
    });

    it("Should revert when adding zero amount", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await expect(
        manager.connect(sponsor).addToPrizePool("tourney-001", 0)
      ).to.be.revertedWith("Amount must be positive");
    });
  });

  // ================================================================
  // Pausable
  // ================================================================
  describe("Pausable", function () {
    it("Should allow owner to pause", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);
      await manager.pause();
      expect(await manager.paused()).to.equal(true);
    });

    it("Should allow owner to unpause", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);
      await manager.pause();
      await manager.unpause();
      expect(await manager.paused()).to.equal(false);
    });

    it("Should revert registration when paused", async function () {
      const { manager, player1, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);
      await manager.pause();

      await expect(
        manager.connect(player1).register("tourney-001")
      ).to.be.revertedWithCustomError(manager, "EnforcedPause");
    });

    it("Should revert starting tournament when paused", async function () {
      const { manager, sponsor, timestamps } =
        await loadFixture(deployWithRegisteredPlayersFixture);

      await time.increaseTo(timestamps.startTime);
      await manager.pause();

      await expect(
        manager.connect(sponsor).startTournament("tourney-001")
      ).to.be.revertedWithCustomError(manager, "EnforcedPause");
    });

    it("Should revert completing tournament when paused", async function () {
      const { manager, sponsor, player1, player2, player3 } =
        await loadFixture(deployWithActiveTournamentFixture);

      await manager.pause();

      await expect(
        manager
          .connect(sponsor)
          .completeTournament(
            "tourney-001",
            player1.address,
            player2.address,
            player3.address
          )
      ).to.be.revertedWithCustomError(manager, "EnforcedPause");
    });

    it("Should revert addToPrizePool when paused", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await manager.pause();

      await expect(
        manager
          .connect(sponsor)
          .addToPrizePool("tourney-001", ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(manager, "EnforcedPause");
    });

    it("Should revert when non-owner tries to pause", async function () {
      const { manager, other } = await loadFixture(deployTournamentFixture);

      await expect(
        manager.connect(other).pause()
      ).to.be.revertedWithCustomError(manager, "OwnableUnauthorizedAccount");
    });

    it("Should revert when non-owner tries to unpause", async function () {
      const { manager, other } = await loadFixture(deployTournamentFixture);
      await manager.pause();

      await expect(
        manager.connect(other).unpause()
      ).to.be.revertedWithCustomError(manager, "OwnableUnauthorizedAccount");
    });
  });

  // ================================================================
  // Admin Functions
  // ================================================================
  describe("Admin Functions", function () {
    it("Should allow owner to set treasury", async function () {
      const { manager, other } = await loadFixture(deployTournamentFixture);

      await manager.setTreasury(other.address);
      expect(await manager.treasury()).to.equal(other.address);
    });

    it("Should revert setting treasury to zero address", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);

      await expect(
        manager.setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury address");
    });

    it("Should revert when non-owner sets treasury", async function () {
      const { manager, other } = await loadFixture(deployTournamentFixture);

      await expect(
        manager.connect(other).setTreasury(other.address)
      ).to.be.revertedWithCustomError(manager, "OwnableUnauthorizedAccount");
    });
  });

  // ================================================================
  // View Functions
  // ================================================================
  describe("View Functions", function () {
    it("Should return tournament details via getTournament", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithCreatorTournamentFixture);

      const t = await manager.getTournament("tourney-001");
      expect(t.gameId).to.equal("game-001");
      expect(t.sponsor).to.equal(sponsor.address);
    });

    it("Should return participants via getParticipants", async function () {
      const { manager, player1, player2, player3, player4 } =
        await loadFixture(deployWithRegisteredPlayersFixture);

      const participants = await manager.getParticipants("tourney-001");
      expect(participants.length).to.equal(4);
    });

    it("Should return winners via getWinners after completion", async function () {
      const { manager, sponsor, player1, player2, player3 } =
        await loadFixture(deployWithActiveTournamentFixture);

      await manager
        .connect(sponsor)
        .completeTournament(
          "tourney-001",
          player1.address,
          player2.address,
          player3.address
        );

      const winners = await manager.getWinners("tourney-001");
      expect(winners.length).to.equal(3);
      expect(winners[0]).to.equal(player1.address);
    });

    it("Should return empty winners before completion", async function () {
      const { manager } =
        await loadFixture(deployWithActiveTournamentFixture);

      const winners = await manager.getWinners("tourney-001");
      expect(winners.length).to.equal(0);
    });

    it("Should return distribution via getDistribution", async function () {
      const { manager } =
        await loadFixture(deployWithCreatorTournamentFixture);

      const dist = await manager.getDistribution("tourney-001");
      expect(dist.first).to.equal(50);
      expect(dist.second).to.equal(25);
      expect(dist.third).to.equal(15);
      expect(dist.participation).to.equal(10);
    });
  });
});
