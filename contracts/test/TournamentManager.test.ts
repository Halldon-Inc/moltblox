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

    it("Should revert when first is zero", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await expect(
        manager.connect(sponsor).setDistribution("tourney-001", 0, 50, 40, 10)
      ).to.be.revertedWith("First must be > 0");
    });

    it("Should revert when second is zero", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await expect(
        manager.connect(sponsor).setDistribution("tourney-001", 50, 0, 40, 10)
      ).to.be.revertedWith("Second must be > 0");
    });

    it("Should revert when third is zero (L-C1)", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await expect(
        manager.connect(sponsor).setDistribution("tourney-001", 50, 40, 0, 10)
      ).to.be.revertedWith("Third must be > 0");
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

      // Do NOT advance time
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
  // Deregistration (L2)
  // ================================================================
  describe("Deregistration", function () {
    it("Should allow deregistration before registration closes", async function () {
      const { manager, player1, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);
      await manager.connect(player1).register("tourney-001");

      await manager.connect(player1).deregister("tourney-001");

      expect(
        await manager.isParticipant("tourney-001", player1.address)
      ).to.equal(false);

      const t = await manager.getTournament("tourney-001");
      expect(t.currentParticipants).to.equal(0);
    });

    it("Should refund entry fee on deregistration", async function () {
      const { token, manager, player1, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);

      const balBefore = await token.balanceOf(player1.address);
      await manager.connect(player1).register("tourney-001");
      await manager.connect(player1).deregister("tourney-001");

      expect(await token.balanceOf(player1.address)).to.equal(balBefore);
    });

    it("Should emit ParticipantDeregistered event", async function () {
      const { manager, player1, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);
      await manager.connect(player1).register("tourney-001");

      await expect(manager.connect(player1).deregister("tourney-001"))
        .to.emit(manager, "ParticipantDeregistered")
        .withArgs("tourney-001", player1.address, ENTRY_FEE);
    });

    it("Should decrease participantEntryFees on deregistration", async function () {
      const { manager, player1, player2, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);
      await manager.connect(player1).register("tourney-001");
      await manager.connect(player2).register("tourney-001");
      await manager.connect(player1).deregister("tourney-001");

      expect(await manager.participantEntryFees("tourney-001")).to.equal(ENTRY_FEE);
    });

    it("Should decrease community prize pool on deregistration", async function () {
      const { manager, sponsor, player1, timestamps } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      const initialPool = ethers.parseEther("500");

      await manager.connect(sponsor).createCommunityTournament(
        "community-dereg",
        "game-001",
        initialPool,
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await time.increaseTo(ts.registrationStart);
      await manager.connect(player1).register("community-dereg");
      await manager.connect(player1).deregister("community-dereg");

      const t = await manager.getTournament("community-dereg");
      expect(t.prizePool).to.equal(initialPool);
    });

    it("Should revert deregistration when not registered", async function () {
      const { manager, player1, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);

      await expect(
        manager.connect(player1).deregister("tourney-001")
      ).to.be.revertedWith("Not registered");
    });

    it("Should revert deregistration after registration closes", async function () {
      const { manager, player1, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);
      await manager.connect(player1).register("tourney-001");

      await time.increaseTo(timestamps.registrationEnd + 1);

      await expect(
        manager.connect(player1).deregister("tourney-001")
      ).to.be.revertedWith("Registration closed");
    });

    it("Should revert deregistration when tournament is not in Registration status", async function () {
      const { manager, player1 } =
        await loadFixture(deployWithActiveTournamentFixture);

      await expect(
        manager.connect(player1).deregister("tourney-001")
      ).to.be.revertedWith("Not in registration");
    });

    it("Should remove participant from array", async function () {
      const { manager, player1, player2, timestamps } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await time.increaseTo(timestamps.registrationStart);
      await manager.connect(player1).register("tourney-001");
      await manager.connect(player2).register("tourney-001");
      await manager.connect(player1).deregister("tourney-001");

      const participants = await manager.getParticipants("tourney-001");
      expect(participants.length).to.equal(1);
      expect(participants).to.include(player2.address);
      expect(participants).not.to.include(player1.address);
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

        // Total pool = PRIZE_POOL + 4 entry fees (creator-sponsored includes fees)
        const totalPool = PRIZE_POOL + ENTRY_FEE * 4n;

        // Default distribution: 50/25/15/10
        const firstPrize = (totalPool * 50n) / 100n;
        const secondPrize = (totalPool * 25n) / 100n;
        const thirdPrize = (totalPool * 15n) / 100n;
        const participationPool = totalPool - firstPrize - secondPrize - thirdPrize;

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

        const totalPool = PRIZE_POOL + ENTRY_FEE * 4n;
        const firstPrize = (totalPool * 50n) / 100n;
        const secondPrize = (totalPool * 25n) / 100n;
        const thirdPrize = (totalPool * 15n) / 100n;

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

        const totalPool = PRIZE_POOL + ENTRY_FEE * 4n;
        const firstPrize = (totalPool * 50n) / 100n;
        const secondPrize = (totalPool * 25n) / 100n;
        const thirdPrize = (totalPool * 15n) / 100n;
        const participationPool =
          totalPool - firstPrize - secondPrize - thirdPrize;
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

    describe("cancelTournament (pull-payment)", function () {
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

      it("Should record refund amounts for pull-payment (not transfer directly)", async function () {
        const { token, manager, sponsor, player1, player2, timestamps } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        const p1BalBefore = await token.balanceOf(player1.address);

        await manager
          .connect(sponsor)
          .cancelTournament("tourney-001", "Cancelled");

        // Balances should NOT change yet (pull-payment)
        expect(await token.balanceOf(player1.address)).to.equal(p1BalBefore);

        // But refund should be recorded
        expect(await manager.cancelRefunds("tourney-001", player1.address)).to.equal(ENTRY_FEE);
        expect(await manager.cancelRefunds("tourney-001", player2.address)).to.equal(ENTRY_FEE);
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

      it("Should return prize pool to sponsor directly (trusted address)", async function () {
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

    describe("claimCancelRefund", function () {
      it("Should allow participant to claim refund after cancellation", async function () {
        const { token, manager, sponsor, player1, timestamps } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        await manager.connect(sponsor).cancelTournament("tourney-001", "Cancelled");

        const balBefore = await token.balanceOf(player1.address);
        await manager.connect(player1).claimCancelRefund("tourney-001");

        expect(await token.balanceOf(player1.address)).to.equal(balBefore + ENTRY_FEE);
        expect(await manager.cancelRefunds("tourney-001", player1.address)).to.equal(0);
      });

      it("Should emit CancelRefundClaimed event", async function () {
        const { manager, sponsor, player1, timestamps } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        await manager.connect(sponsor).cancelTournament("tourney-001", "Cancelled");

        await expect(manager.connect(player1).claimCancelRefund("tourney-001"))
          .to.emit(manager, "CancelRefundClaimed")
          .withArgs("tourney-001", player1.address, ENTRY_FEE);
      });

      it("Should revert when no refund available", async function () {
        const { manager, sponsor, other, timestamps } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        await manager.connect(sponsor).cancelTournament("tourney-001", "Cancelled");

        await expect(
          manager.connect(other).claimCancelRefund("tourney-001")
        ).to.be.revertedWith("No refund available");
      });

      it("Should revert when claiming twice", async function () {
        const { manager, sponsor, player1, timestamps } =
          await loadFixture(deployWithRegisteredPlayersFixture);

        await manager.connect(sponsor).cancelTournament("tourney-001", "Cancelled");
        await manager.connect(player1).claimCancelRefund("tourney-001");

        await expect(
          manager.connect(player1).claimCancelRefund("tourney-001")
        ).to.be.revertedWith("No refund available");
      });
    });

    describe("claimDonationRefund", function () {
      it("Should allow donor to claim refund after cancellation", async function () {
        const { token, manager, sponsor, other } =
          await loadFixture(deployTournamentFixture);

        const ts = await getTimestamps();
        await manager.connect(sponsor).createCommunityTournament(
          "community-refund",
          "game-001",
          ethers.parseEther("500"),
          ENTRY_FEE,
          10,
          ts.registrationStart,
          ts.registrationEnd,
          ts.startTime
        );

        const donationAmount = ethers.parseEther("200");
        await token.transfer(other.address, ethers.parseEther("1000"));
        await token.connect(other).approve(await manager.getAddress(), ethers.MaxUint256);
        await manager.connect(other).addToPrizePool("community-refund", donationAmount);

        await manager.connect(sponsor).cancelTournament("community-refund", "Cancelled");

        const balBefore = await token.balanceOf(other.address);
        await manager.connect(other).claimDonationRefund("community-refund");

        expect(await token.balanceOf(other.address)).to.equal(balBefore + donationAmount);
      });

      it("Should emit DonationRefundClaimed event", async function () {
        const { token, manager, sponsor, other } =
          await loadFixture(deployTournamentFixture);

        const ts = await getTimestamps();
        await manager.connect(sponsor).createCommunityTournament(
          "community-refund",
          "game-001",
          ethers.parseEther("500"),
          ENTRY_FEE,
          10,
          ts.registrationStart,
          ts.registrationEnd,
          ts.startTime
        );

        const donationAmount = ethers.parseEther("200");
        await token.transfer(other.address, ethers.parseEther("1000"));
        await token.connect(other).approve(await manager.getAddress(), ethers.MaxUint256);
        await manager.connect(other).addToPrizePool("community-refund", donationAmount);

        await manager.connect(sponsor).cancelTournament("community-refund", "Cancelled");

        await expect(manager.connect(other).claimDonationRefund("community-refund"))
          .to.emit(manager, "DonationRefundClaimed")
          .withArgs("community-refund", other.address, donationAmount);
      });

      it("Should revert when no donation refund available", async function () {
        const { manager, sponsor, other } =
          await loadFixture(deployWithCreatorTournamentFixture);

        await manager.connect(sponsor).cancelTournament("tourney-001", "Cancelled");

        await expect(
          manager.connect(other).claimDonationRefund("tourney-001")
        ).to.be.revertedWith("No donation refund available");
      });
    });
  });

  // ================================================================
  // Add to Prize Pool (L-C2: Community-only restriction)
  // ================================================================
  describe("addToPrizePool", function () {
    it("Should allow adding to community tournament prize pool", async function () {
      const { token, manager, other, sponsor } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      await manager.connect(sponsor).createCommunityTournament(
        "community-pool",
        "game-001",
        ethers.parseEther("500"),
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await token.transfer(other.address, ethers.parseEther("1000"));
      await token.connect(other).approve(await manager.getAddress(), ethers.parseEther("1000"));

      const addAmount = ethers.parseEther("500");
      await manager.connect(other).addToPrizePool("community-pool", addAmount);

      const t = await manager.getTournament("community-pool");
      expect(t.prizePool).to.equal(ethers.parseEther("500") + addAmount);
    });

    it("Should revert when adding to creator-sponsored tournament (L-C2)", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithCreatorTournamentFixture);

      await expect(
        manager.connect(sponsor).addToPrizePool("tourney-001", ethers.parseEther("100"))
      ).to.be.revertedWith("Only community-sponsored tournaments");
    });

    it("Should revert when adding to non-registration tournament", async function () {
      const { token, manager, sponsor, player1, player2 } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      await manager.connect(sponsor).createCommunityTournament(
        "community-active",
        "game-001",
        ethers.parseEther("500"),
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await time.increaseTo(ts.registrationStart);
      await manager.connect(player1).register("community-active");
      await manager.connect(player2).register("community-active");
      await time.increaseTo(ts.startTime);
      await manager.connect(sponsor).startTournament("community-active");

      await expect(
        manager
          .connect(sponsor)
          .addToPrizePool("community-active", ethers.parseEther("100"))
      ).to.be.revertedWith("Cannot add to pool");
    });

    it("Should revert when adding zero amount", async function () {
      const { manager, sponsor } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      await manager.connect(sponsor).createCommunityTournament(
        "community-zero",
        "game-001",
        ethers.parseEther("500"),
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await expect(
        manager.connect(sponsor).addToPrizePool("community-zero", 0)
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
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      await manager.connect(sponsor).createCommunityTournament(
        "community-paused",
        "game-001",
        ethers.parseEther("500"),
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await manager.pause();

      await expect(
        manager
          .connect(sponsor)
          .addToPrizePool("community-paused", ethers.parseEther("100"))
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
  // Admin Functions (Treasury Timelock)
  // ================================================================
  describe("Admin Functions", function () {
    it("Should propose treasury change via setTreasury", async function () {
      const { manager, other } = await loadFixture(deployTournamentFixture);

      await manager.setTreasury(other.address);
      expect(await manager.pendingTreasury()).to.equal(other.address);
    });

    it("Should not change treasury immediately", async function () {
      const { manager, treasury, other } = await loadFixture(deployTournamentFixture);

      await manager.setTreasury(other.address);
      // Treasury should still be the original
      expect(await manager.treasury()).to.equal(treasury.address);
    });

    it("Should confirm treasury after 24 hours", async function () {
      const { manager, other } = await loadFixture(deployTournamentFixture);

      await manager.proposeTreasury(other.address);
      await time.increase(24 * 60 * 60); // 24 hours
      await manager.confirmTreasury();

      expect(await manager.treasury()).to.equal(other.address);
      expect(await manager.pendingTreasury()).to.equal(ethers.ZeroAddress);
    });

    it("Should emit TreasuryChangeProposed on propose", async function () {
      const { manager, other } = await loadFixture(deployTournamentFixture);

      await expect(manager.proposeTreasury(other.address))
        .to.emit(manager, "TreasuryChangeProposed");
    });

    it("Should emit TreasuryChangeConfirmed on confirm", async function () {
      const { manager, treasury, other } = await loadFixture(deployTournamentFixture);

      await manager.proposeTreasury(other.address);
      await time.increase(24 * 60 * 60);

      await expect(manager.confirmTreasury())
        .to.emit(manager, "TreasuryChangeConfirmed")
        .withArgs(treasury.address, other.address);
    });

    it("Should revert confirmTreasury before 24 hours", async function () {
      const { manager, other } = await loadFixture(deployTournamentFixture);

      await manager.proposeTreasury(other.address);
      await time.increase(23 * 60 * 60); // only 23 hours

      await expect(manager.confirmTreasury())
        .to.be.revertedWith("Timelock not elapsed");
    });

    it("Should revert confirmTreasury with no pending change", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);

      await expect(manager.confirmTreasury())
        .to.be.revertedWith("No pending treasury change");
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

    describe("cancelTreasuryChange", function () {
      it("Should cancel a pending treasury change", async function () {
        const { manager, other } = await loadFixture(deployTournamentFixture);

        await manager.proposeTreasury(other.address);
        await manager.cancelTreasuryChange();

        expect(await manager.pendingTreasury()).to.equal(ethers.ZeroAddress);
        expect(await manager.treasuryChangeTime()).to.equal(0);
      });

      it("Should emit TreasuryChangeCancelled event", async function () {
        const { manager, other } = await loadFixture(deployTournamentFixture);

        await manager.proposeTreasury(other.address);

        await expect(manager.cancelTreasuryChange())
          .to.emit(manager, "TreasuryChangeCancelled");
      });

      it("Should revert when no pending change exists", async function () {
        const { manager } = await loadFixture(deployTournamentFixture);

        await expect(manager.cancelTreasuryChange())
          .to.be.revertedWith("No pending treasury change");
      });

      it("Should revert when non-owner cancels", async function () {
        const { manager, other } = await loadFixture(deployTournamentFixture);

        await manager.proposeTreasury(other.address);

        await expect(
          manager.connect(other).cancelTreasuryChange()
        ).to.be.revertedWithCustomError(manager, "OwnableUnauthorizedAccount");
      });
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

  // ================================================================
  // 2-Player Tournament Completion (L3: configured distribution)
  // ================================================================
  describe("2-Player Tournament Completion", function () {
    async function deployWith2PlayerTournamentFixture() {
      const fixture = await loadFixture(deployTournamentFixture);
      const { manager, sponsor, player1, player2 } = fixture;

      const ts = await getTimestamps();

      await manager.connect(sponsor).createCreatorTournament(
        "tourney-2p",
        "game-001",
        PRIZE_POOL,
        ENTRY_FEE,
        2,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await time.increaseTo(ts.registrationStart);
      await manager.connect(player1).register("tourney-2p");
      await manager.connect(player2).register("tourney-2p");

      await time.increaseTo(ts.startTime);
      await manager.connect(sponsor).startTournament("tourney-2p");

      return { ...fixture, timestamps: ts };
    }

    it("Should complete a 2-player tournament with configured distribution (L3)", async function () {
      const { token, manager, sponsor, player1, player2 } =
        await loadFixture(deployWith2PlayerTournamentFixture);

      const p1BalBefore = await token.balanceOf(player1.address);
      const p2BalBefore = await token.balanceOf(player2.address);

      await manager
        .connect(sponsor)
        .completeTournament(
          "tourney-2p",
          player1.address,
          player2.address,
          ethers.ZeroAddress
        );

      // Total pool = PRIZE_POOL + 2 entry fees for non-community
      const totalPool = PRIZE_POOL + ENTRY_FEE * 2n;
      // Default: first=50, second=25, totalPct=75
      // firstPrize = totalPool * 50 / 75
      // secondPrize = totalPool - firstPrize
      const firstPct = 50n;
      const secondPct = 25n;
      const totalPct = firstPct + secondPct;
      const firstPrize = (totalPool * firstPct) / totalPct;
      const secondPrize = totalPool - firstPrize;

      expect(await token.balanceOf(player1.address)).to.equal(
        p1BalBefore + firstPrize
      );
      expect(await token.balanceOf(player2.address)).to.equal(
        p2BalBefore + secondPrize
      );
    });

    it("Should set tournament status to Completed for 2-player", async function () {
      const { manager, sponsor, player1, player2 } =
        await loadFixture(deployWith2PlayerTournamentFixture);

      await manager
        .connect(sponsor)
        .completeTournament(
          "tourney-2p",
          player1.address,
          player2.address,
          ethers.ZeroAddress
        );

      const t = await manager.getTournament("tourney-2p");
      expect(t.status).to.equal(TournamentStatus.Completed);
    });

    it("Should store 2 winners for 2-player tournament", async function () {
      const { manager, sponsor, player1, player2 } =
        await loadFixture(deployWith2PlayerTournamentFixture);

      await manager
        .connect(sponsor)
        .completeTournament(
          "tourney-2p",
          player1.address,
          player2.address,
          ethers.ZeroAddress
        );

      const winners = await manager.getWinners("tourney-2p");
      expect(winners.length).to.equal(2);
      expect(winners[0]).to.equal(player1.address);
      expect(winners[1]).to.equal(player2.address);
    });

    it("Should revert 2-player tournament if third is not address(0)", async function () {
      const { manager, sponsor, player1, player2 } =
        await loadFixture(deployWith2PlayerTournamentFixture);

      await expect(
        manager
          .connect(sponsor)
          .completeTournament(
            "tourney-2p",
            player1.address,
            player2.address,
            player1.address
          )
      ).to.be.revertedWith("Use address(0) for 3rd in 2-player tournament");
    });

    it("Should revert 2-player tournament with duplicate winners", async function () {
      const { manager, sponsor, player1 } =
        await loadFixture(deployWith2PlayerTournamentFixture);

      await expect(
        manager
          .connect(sponsor)
          .completeTournament(
            "tourney-2p",
            player1.address,
            player1.address,
            ethers.ZeroAddress
          )
      ).to.be.revertedWith("Duplicate winner");
    });

    it("Should emit PrizeDistributed events for 2-player tournament", async function () {
      const { manager, sponsor, player1, player2 } =
        await loadFixture(deployWith2PlayerTournamentFixture);

      const totalPool = PRIZE_POOL + ENTRY_FEE * 2n;
      const firstPct = 50n;
      const secondPct = 25n;
      const totalPct = firstPct + secondPct;
      const firstPrize = (totalPool * firstPct) / totalPct;
      const secondPrize = totalPool - firstPrize;

      const tx = manager
        .connect(sponsor)
        .completeTournament(
          "tourney-2p",
          player1.address,
          player2.address,
          ethers.ZeroAddress
        );

      await expect(tx)
        .to.emit(manager, "PrizeDistributed")
        .withArgs("tourney-2p", player1.address, 1, firstPrize);

      await expect(tx)
        .to.emit(manager, "PrizeDistributed")
        .withArgs("tourney-2p", player2.address, 2, secondPrize);
    });
  });

  // ================================================================
  // 3-Player Tournament Completion (H4: fixed math /100)
  // ================================================================
  describe("3-Player Tournament Completion", function () {
    async function deployWith3PlayerTournamentFixture() {
      const fixture = await loadFixture(deployTournamentFixture);
      const { manager, sponsor, player1, player2, player3 } = fixture;

      const ts = await getTimestamps();

      await manager.connect(sponsor).createCreatorTournament(
        "tourney-3p",
        "game-001",
        PRIZE_POOL,
        ENTRY_FEE,
        3,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await time.increaseTo(ts.registrationStart);
      await manager.connect(player1).register("tourney-3p");
      await manager.connect(player2).register("tourney-3p");
      await manager.connect(player3).register("tourney-3p");

      await time.increaseTo(ts.startTime);
      await manager.connect(sponsor).startTournament("tourney-3p");

      return { ...fixture, timestamps: ts };
    }

    it("Should complete a 3-player tournament with /100 distribution (H4)", async function () {
      const { token, manager, sponsor, player1, player2, player3 } =
        await loadFixture(deployWith3PlayerTournamentFixture);

      const p1BalBefore = await token.balanceOf(player1.address);
      const p2BalBefore = await token.balanceOf(player2.address);
      const p3BalBefore = await token.balanceOf(player3.address);

      await manager
        .connect(sponsor)
        .completeTournament(
          "tourney-3p",
          player1.address,
          player2.address,
          player3.address
        );

      // Total pool includes entry fees for non-community
      const totalPool = PRIZE_POOL + ENTRY_FEE * 3n;
      // H4 fix: 3-player uses /100 (not /(100-participation))
      // Default distribution: 50/25/15/10
      const firstPrize = (totalPool * 50n) / 100n;
      const secondPrize = (totalPool * 25n) / 100n;
      const thirdPrize = totalPool - firstPrize - secondPrize;

      expect(await token.balanceOf(player1.address)).to.equal(
        p1BalBefore + firstPrize
      );
      expect(await token.balanceOf(player2.address)).to.equal(
        p2BalBefore + secondPrize
      );
      expect(await token.balanceOf(player3.address)).to.equal(
        p3BalBefore + thirdPrize
      );
    });

    it("Should set tournament status to Completed for 3-player", async function () {
      const { manager, sponsor, player1, player2, player3 } =
        await loadFixture(deployWith3PlayerTournamentFixture);

      await manager
        .connect(sponsor)
        .completeTournament(
          "tourney-3p",
          player1.address,
          player2.address,
          player3.address
        );

      const t = await manager.getTournament("tourney-3p");
      expect(t.status).to.equal(TournamentStatus.Completed);
    });

    it("Should store 3 winners for 3-player tournament", async function () {
      const { manager, sponsor, player1, player2, player3 } =
        await loadFixture(deployWith3PlayerTournamentFixture);

      await manager
        .connect(sponsor)
        .completeTournament(
          "tourney-3p",
          player1.address,
          player2.address,
          player3.address
        );

      const winners = await manager.getWinners("tourney-3p");
      expect(winners.length).to.equal(3);
    });
  });

  // ================================================================
  // Max Participants Cap
  // ================================================================
  describe("Max Participants Cap", function () {
    it("Should have MAX_PARTICIPANTS_CAP of 256", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);
      expect(await manager.MAX_PARTICIPANTS_CAP()).to.equal(256);
    });

    it("Should revert when maxParticipants exceeds cap", async function () {
      const { manager, sponsor } = await loadFixture(deployTournamentFixture);
      const ts = await getTimestamps();

      await expect(
        manager.connect(sponsor).createCreatorTournament(
          "tourney-big",
          "game-001",
          PRIZE_POOL,
          ENTRY_FEE,
          257,
          ts.registrationStart,
          ts.registrationEnd,
          ts.startTime
        )
      ).to.be.revertedWith("Exceeds max participants cap");
    });

    it("Should allow maxParticipants at exactly 256", async function () {
      const { manager, sponsor } = await loadFixture(deployTournamentFixture);
      const ts = await getTimestamps();

      await manager.connect(sponsor).createCreatorTournament(
        "tourney-256",
        "game-001",
        PRIZE_POOL,
        ENTRY_FEE,
        256,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      const t = await manager.getTournament("tourney-256");
      expect(t.maxParticipants).to.equal(256);
    });
  });

  // ================================================================
  // Entry Fee Distribution for Non-Community Tournaments
  // ================================================================
  describe("Entry Fee Distribution", function () {
    it("Should include entry fees in prize pool for creator-sponsored tournaments", async function () {
      const { token, manager, sponsor, player1, player2, player3, player4 } =
        await loadFixture(deployWithActiveTournamentFixture);

      const p1BalBefore = await token.balanceOf(player1.address);

      await manager
        .connect(sponsor)
        .completeTournament(
          "tourney-001",
          player1.address,
          player2.address,
          player3.address
        );

      // Total pool should include the 4 entry fees
      const totalPool = PRIZE_POOL + ENTRY_FEE * 4n;
      const firstPrize = (totalPool * 50n) / 100n;

      // Player1 gets first prize + possibly dust
      const p1BalAfter = await token.balanceOf(player1.address);
      expect(p1BalAfter).to.be.gte(p1BalBefore + firstPrize);
    });

    it("Should NOT double-count entry fees for community tournaments", async function () {
      const { token, manager, sponsor, player1, player2, player3, player4 } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      const initialPool = ethers.parseEther("500");

      await manager.connect(sponsor).createCommunityTournament(
        "community-fees",
        "game-001",
        initialPool,
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await time.increaseTo(ts.registrationStart);
      await manager.connect(player1).register("community-fees");
      await manager.connect(player2).register("community-fees");
      await manager.connect(player3).register("community-fees");
      await manager.connect(player4).register("community-fees");

      await time.increaseTo(ts.startTime);
      await manager.connect(sponsor).startTournament("community-fees");

      const p1BalBefore = await token.balanceOf(player1.address);
      const p2BalBefore = await token.balanceOf(player2.address);
      const p3BalBefore = await token.balanceOf(player3.address);
      const p4BalBefore = await token.balanceOf(player4.address);

      await manager
        .connect(sponsor)
        .completeTournament(
          "community-fees",
          player1.address,
          player2.address,
          player3.address
        );

      // For community tournaments, entry fees are already added to prizePool during registration
      // So totalPool = initialPool + 4 * ENTRY_FEE (already in prizePool, not doubled)
      const totalPool = initialPool + ENTRY_FEE * 4n;
      const firstPrize = (totalPool * 50n) / 100n;
      const secondPrize = (totalPool * 25n) / 100n;
      const thirdPrize = (totalPool * 15n) / 100n;
      const participationPool = totalPool - firstPrize - secondPrize - thirdPrize;
      const participationReward = participationPool / 1n;

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

    it("Should distribute total pool correctly for platform tournament with entry fees", async function () {
      const { token, manager, owner, treasury, player1, player2, player3, player4 } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();

      await manager.createPlatformTournament(
        "platform-fees",
        "game-001",
        PRIZE_POOL,
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await time.increaseTo(ts.registrationStart);
      await manager.connect(player1).register("platform-fees");
      await manager.connect(player2).register("platform-fees");
      await manager.connect(player3).register("platform-fees");
      await manager.connect(player4).register("platform-fees");

      await time.increaseTo(ts.startTime);
      await manager.startTournament("platform-fees");

      const p1BalBefore = await token.balanceOf(player1.address);

      await manager.completeTournament(
        "platform-fees",
        player1.address,
        player2.address,
        player3.address
      );

      // Total pool = PRIZE_POOL + 4 * ENTRY_FEE
      const totalPool = PRIZE_POOL + ENTRY_FEE * 4n;
      const firstPrize = (totalPool * 50n) / 100n;

      const p1BalAfter = await token.balanceOf(player1.address);
      expect(p1BalAfter).to.be.gte(p1BalBefore + firstPrize);
    });
  });

  // ================================================================
  // Donation Refund on Cancel (pull-payment)
  // ================================================================
  describe("Donation Refund on Cancel", function () {
    it("Should record donation refunds for pull-payment when tournament is cancelled", async function () {
      const { token, manager, sponsor, other } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      await manager.connect(sponsor).createCommunityTournament(
        "community-cancel",
        "game-001",
        ethers.parseEther("500"),
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      const donationAmount = ethers.parseEther("500");
      await token.transfer(other.address, ethers.parseEther("1000"));
      await token.connect(other).approve(await manager.getAddress(), ethers.MaxUint256);

      await manager.connect(other).addToPrizePool("community-cancel", donationAmount);

      const otherBalBefore = await token.balanceOf(other.address);

      await manager.connect(sponsor).cancelTournament("community-cancel", "Cancelled");

      // Balance should NOT change yet (pull-payment)
      expect(await token.balanceOf(other.address)).to.equal(otherBalBefore);

      // But donation refund should be recorded
      expect(await manager.donationRefunds("community-cancel", other.address)).to.equal(donationAmount);
    });

    it("Should emit PrizePoolContribution on addToPrizePool", async function () {
      const { token, manager, sponsor, other } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      await manager.connect(sponsor).createCommunityTournament(
        "community-contrib",
        "game-001",
        ethers.parseEther("500"),
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      const donationAmount = ethers.parseEther("200");
      await token.transfer(other.address, ethers.parseEther("1000"));
      await token.connect(other).approve(await manager.getAddress(), ethers.MaxUint256);

      await expect(manager.connect(other).addToPrizePool("community-contrib", donationAmount))
        .to.emit(manager, "PrizePoolContribution")
        .withArgs("community-contrib", other.address, donationAmount);
    });

    it("Should emit DonationRefunded on cancel", async function () {
      const { token, manager, sponsor, other } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      await manager.connect(sponsor).createCommunityTournament(
        "community-refund-emit",
        "game-001",
        ethers.parseEther("500"),
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      const donationAmount = ethers.parseEther("300");
      await token.transfer(other.address, ethers.parseEther("1000"));
      await token.connect(other).approve(await manager.getAddress(), ethers.MaxUint256);

      await manager.connect(other).addToPrizePool("community-refund-emit", donationAmount);

      await expect(
        manager.connect(sponsor).cancelTournament("community-refund-emit", "Cancelled")
      )
        .to.emit(manager, "DonationRefunded")
        .withArgs("community-refund-emit", other.address, donationAmount);
    });

    it("Should track multiple donations from same donor", async function () {
      const { token, manager, sponsor, other } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      await manager.connect(sponsor).createCommunityTournament(
        "community-multi",
        "game-001",
        ethers.parseEther("500"),
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await token.transfer(other.address, ethers.parseEther("2000"));
      await token.connect(other).approve(await manager.getAddress(), ethers.MaxUint256);

      const donation1 = ethers.parseEther("200");
      const donation2 = ethers.parseEther("300");

      await manager.connect(other).addToPrizePool("community-multi", donation1);
      await manager.connect(other).addToPrizePool("community-multi", donation2);

      expect(await manager.contributions("community-multi", other.address)).to.equal(
        donation1 + donation2
      );
    });

    it("Should record refunds for multiple donors on cancel", async function () {
      const { token, manager, sponsor, player1, other } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      await manager.connect(sponsor).createCommunityTournament(
        "community-multi-donors",
        "game-001",
        ethers.parseEther("500"),
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await token.transfer(other.address, ethers.parseEther("1000"));
      await token.connect(other).approve(await manager.getAddress(), ethers.MaxUint256);

      const d1 = ethers.parseEther("100");
      const d2 = ethers.parseEther("200");

      await manager.connect(player1).addToPrizePool("community-multi-donors", d1);
      await manager.connect(other).addToPrizePool("community-multi-donors", d2);

      await manager.connect(sponsor).cancelTournament("community-multi-donors", "Cancelled");

      // Check recorded refunds
      expect(await manager.donationRefunds("community-multi-donors", player1.address)).to.equal(d1);
      expect(await manager.donationRefunds("community-multi-donors", other.address)).to.equal(d2);

      // Claim refunds
      const p1BalBefore = await token.balanceOf(player1.address);
      const otherBalBefore = await token.balanceOf(other.address);

      await manager.connect(player1).claimDonationRefund("community-multi-donors");
      await manager.connect(other).claimDonationRefund("community-multi-donors");

      expect(await token.balanceOf(player1.address)).to.equal(p1BalBefore + d1);
      expect(await token.balanceOf(other.address)).to.equal(otherBalBefore + d2);
    });
  });

  // ================================================================
  // Emergency MBUCKS Recovery
  // ================================================================
  describe("Emergency MBUCKS Recovery", function () {
    it("Should propose recovery", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);

      const amount = ethers.parseEther("1000");
      await manager.proposeRecovery(amount);

      expect(await manager.recoveryPending()).to.equal(true);
      expect(await manager.pendingRecoveryAmount()).to.equal(amount);
    });

    it("Should emit RecoveryProposed event", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);

      const amount = ethers.parseEther("1000");
      await expect(manager.proposeRecovery(amount))
        .to.emit(manager, "RecoveryProposed");
    });

    it("Should execute recovery after 7 days", async function () {
      const { token, manager, owner } = await loadFixture(deployTournamentFixture);

      // Send some MBUCKS to the contract so it has a balance to recover
      const amount = ethers.parseEther("500");
      await token.transfer(await manager.getAddress(), amount);

      await manager.proposeRecovery(amount);
      await time.increase(7 * 24 * 60 * 60); // 7 days

      const ownerBalBefore = await token.balanceOf(owner.address);
      await manager.executeRecovery();

      expect(await token.balanceOf(owner.address)).to.equal(ownerBalBefore + amount);
      expect(await manager.recoveryPending()).to.equal(false);
    });

    it("Should revert execute before 7 days", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);

      await manager.proposeRecovery(ethers.parseEther("100"));
      await time.increase(6 * 24 * 60 * 60); // only 6 days

      await expect(manager.executeRecovery())
        .to.be.revertedWith("Recovery timelock not elapsed");
    });

    it("Should revert execute with no pending recovery", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);

      await expect(manager.executeRecovery())
        .to.be.revertedWith("No pending recovery");
    });

    it("Should cancel recovery", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);

      await manager.proposeRecovery(ethers.parseEther("100"));
      await manager.cancelRecovery();

      expect(await manager.recoveryPending()).to.equal(false);
    });

    it("Should emit RecoveryCancelled event", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);

      await manager.proposeRecovery(ethers.parseEther("100"));

      await expect(manager.cancelRecovery())
        .to.emit(manager, "RecoveryCancelled");
    });

    it("Should revert cancel with no pending recovery", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);

      await expect(manager.cancelRecovery())
        .to.be.revertedWith("No pending recovery");
    });

    it("Should revert when non-owner proposes recovery", async function () {
      const { manager, other } = await loadFixture(deployTournamentFixture);

      await expect(
        manager.connect(other).proposeRecovery(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(manager, "OwnableUnauthorizedAccount");
    });
  });

  // ================================================================
  // Commit-Reveal for Tournament Completion (H3-TM)
  // ================================================================
  describe("Commit-Reveal", function () {
    it("Should commit results hash", async function () {
      const { manager, sponsor, player1, player2, player3 } =
        await loadFixture(deployWithActiveTournamentFixture);

      const salt = ethers.id("mysalt");
      const resultHash = ethers.keccak256(
        ethers.solidityPacked(
          ["string", "address", "address", "address", "bytes32"],
          ["tourney-001", player1.address, player2.address, player3.address, salt]
        )
      );

      await manager.connect(sponsor).commitResults("tourney-001", resultHash);

      const commit = await manager.resultCommits("tourney-001");
      expect(commit.resultHash).to.equal(resultHash);
      expect(commit.commitBlock).to.be.gt(0);
    });

    it("Should emit ResultsCommitted event", async function () {
      const { manager, sponsor, player1, player2, player3 } =
        await loadFixture(deployWithActiveTournamentFixture);

      const salt = ethers.id("mysalt");
      const resultHash = ethers.keccak256(
        ethers.solidityPacked(
          ["string", "address", "address", "address", "bytes32"],
          ["tourney-001", player1.address, player2.address, player3.address, salt]
        )
      );

      await expect(manager.connect(sponsor).commitResults("tourney-001", resultHash))
        .to.emit(manager, "ResultsCommitted");
    });

    it("Should reveal results and distribute prizes after commit", async function () {
      const { token, manager, sponsor, player1, player2, player3, player4 } =
        await loadFixture(deployWithActiveTournamentFixture);

      const salt = ethers.id("mysecret");
      const resultHash = ethers.keccak256(
        ethers.solidityPacked(
          ["string", "address", "address", "address", "bytes32"],
          ["tourney-001", player1.address, player2.address, player3.address, salt]
        )
      );

      await manager.connect(sponsor).commitResults("tourney-001", resultHash);

      // Mine a block to satisfy the "must wait at least one block" requirement
      await ethers.provider.send("evm_mine", []);

      const p1BalBefore = await token.balanceOf(player1.address);

      await manager.connect(sponsor).revealResults(
        "tourney-001",
        player1.address,
        player2.address,
        player3.address,
        salt
      );

      const t = await manager.getTournament("tourney-001");
      expect(t.status).to.equal(TournamentStatus.Completed);

      const totalPool = PRIZE_POOL + ENTRY_FEE * 4n;
      const firstPrize = (totalPool * 50n) / 100n;

      const p1BalAfter = await token.balanceOf(player1.address);
      expect(p1BalAfter).to.be.gte(p1BalBefore + firstPrize);
    });

    it("Should revert reveal with wrong salt", async function () {
      const { manager, sponsor, player1, player2, player3 } =
        await loadFixture(deployWithActiveTournamentFixture);

      const salt = ethers.id("mysecret");
      const wrongSalt = ethers.id("wrongsalt");
      const resultHash = ethers.keccak256(
        ethers.solidityPacked(
          ["string", "address", "address", "address", "bytes32"],
          ["tourney-001", player1.address, player2.address, player3.address, salt]
        )
      );

      await manager.connect(sponsor).commitResults("tourney-001", resultHash);
      await ethers.provider.send("evm_mine", []);

      await expect(
        manager.connect(sponsor).revealResults(
          "tourney-001",
          player1.address,
          player2.address,
          player3.address,
          wrongSalt
        )
      ).to.be.revertedWith("Hash mismatch");
    });

    it("Should revert reveal without commit", async function () {
      const { manager, sponsor, player1, player2, player3 } =
        await loadFixture(deployWithActiveTournamentFixture);

      await expect(
        manager.connect(sponsor).revealResults(
          "tourney-001",
          player1.address,
          player2.address,
          player3.address,
          ethers.id("salt")
        )
      ).to.be.revertedWith("No committed results");
    });

    it("Should revert commit on non-active tournament", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithCreatorTournamentFixture);

      const resultHash = ethers.id("somehash");

      await expect(
        manager.connect(sponsor).commitResults("tourney-001", resultHash)
      ).to.be.revertedWith("Not active");
    });

    it("Should revert double commit", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithActiveTournamentFixture);

      const resultHash = ethers.id("hash1");
      await manager.connect(sponsor).commitResults("tourney-001", resultHash);

      await expect(
        manager.connect(sponsor).commitResults("tourney-001", ethers.id("hash2"))
      ).to.be.revertedWith("Already committed");
    });

    it("Should revert commit from unauthorized user", async function () {
      const { manager, other } =
        await loadFixture(deployWithActiveTournamentFixture);

      await expect(
        manager.connect(other).commitResults("tourney-001", ethers.id("hash"))
      ).to.be.revertedWith("Not authorized");
    });

    it("Should revert commitResults when paused", async function () {
      const { manager, sponsor } =
        await loadFixture(deployWithActiveTournamentFixture);

      await manager.pause();

      await expect(
        manager.connect(sponsor).commitResults("tourney-001", ethers.id("hash"))
      ).to.be.revertedWithCustomError(manager, "EnforcedPause");
    });

    it("Should revert completeTournament when commit hash exists (H3-TM)", async function () {
      const { manager, sponsor, player1, player2, player3 } =
        await loadFixture(deployWithActiveTournamentFixture);

      const salt = ethers.id("mysalt");
      const resultHash = ethers.keccak256(
        ethers.solidityPacked(
          ["string", "address", "address", "address", "bytes32"],
          ["tourney-001", player1.address, player2.address, player3.address, salt]
        )
      );

      await manager.connect(sponsor).commitResults("tourney-001", resultHash);

      // Try to use completeTournament (direct path) after commit
      await expect(
        manager
          .connect(sponsor)
          .completeTournament(
            "tourney-001",
            player1.address,
            player2.address,
            player3.address
          )
      ).to.be.revertedWith("Must use reveal path");
    });
  });

  // ================================================================
  // MAX_CONTRIBUTORS_CAP
  // ================================================================
  describe("MAX_CONTRIBUTORS_CAP", function () {
    it("Should have MAX_CONTRIBUTORS_CAP of 256", async function () {
      const { manager } = await loadFixture(deployTournamentFixture);
      expect(await manager.MAX_CONTRIBUTORS_CAP()).to.equal(256);
    });

    it("Should allow existing contributor to add more without hitting cap", async function () {
      const { token, manager, sponsor, other } =
        await loadFixture(deployTournamentFixture);

      const ts = await getTimestamps();
      await manager.connect(sponsor).createCommunityTournament(
        "community-cap",
        "game-001",
        ethers.parseEther("500"),
        ENTRY_FEE,
        10,
        ts.registrationStart,
        ts.registrationEnd,
        ts.startTime
      );

      await token.transfer(other.address, ethers.parseEther("2000"));
      await token.connect(other).approve(await manager.getAddress(), ethers.MaxUint256);

      await manager.connect(other).addToPrizePool("community-cap", ethers.parseEther("100"));
      // Same contributor adds again, should not increase contributor count
      await manager.connect(other).addToPrizePool("community-cap", ethers.parseEther("100"));

      expect(await manager.contributions("community-cap", other.address)).to.equal(
        ethers.parseEther("200")
      );
    });
  });
});
