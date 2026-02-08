import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Moltbucks", function () {
  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1 million tokens

  async function deployTokenFixture() {
    const [owner, minter, user1, user2, user3] = await ethers.getSigners();

    const Moltbucks = await ethers.getContractFactory("Moltbucks");
    const token = await Moltbucks.deploy(INITIAL_SUPPLY);

    return { token, owner, minter, user1, user2, user3 };
  }

  async function deployWithMinterFixture() {
    const { token, owner, minter, user1, user2, user3 } =
      await loadFixture(deployTokenFixture);

    await token.addMinter(minter.address);

    return { token, owner, minter, user1, user2, user3 };
  }

  // ================================================================
  // Deployment
  // ================================================================
  describe("Deployment", function () {
    it("Should set the correct name", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.name()).to.equal("Moltbucks");
    });

    it("Should set the correct symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.symbol()).to.equal("MBUCKS");
    });

    it("Should have 18 decimals", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.decimals()).to.equal(18);
    });

    it("Should mint initial supply to the owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should set total supply equal to initial supply", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("Should set the deployer as owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should deploy with zero initial supply", async function () {
      const Moltbucks = await ethers.getContractFactory("Moltbucks");
      const token = await Moltbucks.deploy(0);
      expect(await token.totalSupply()).to.equal(0);
    });
  });

  // ================================================================
  // Mint Cap
  // ================================================================
  describe("Mint Cap", function () {
    it("Should have MAX_SUPPLY of 1 billion tokens", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.MAX_SUPPLY()).to.equal(ethers.parseEther("1000000000"));
    });

    it("Should revert deployment if initial supply exceeds cap", async function () {
      const Moltbucks = await ethers.getContractFactory("Moltbucks");
      const overCap = ethers.parseEther("1000000001");
      await expect(Moltbucks.deploy(overCap)).to.be.revertedWith("Moltbucks: cap exceeded");
    });

    it("Should revert mint when exceeding cap", async function () {
      const { token, user1 } = await loadFixture(deployTokenFixture);
      const remaining = ethers.parseEther("1000000000") - INITIAL_SUPPLY;
      // Mint up to the cap should work
      await token.mint(user1.address, remaining);
      // Minting 1 more wei should fail
      await expect(
        token.mint(user1.address, 1n)
      ).to.be.revertedWith("Moltbucks: cap exceeded");
    });

    it("Should revert mintBatch when total exceeds cap", async function () {
      const { token, user1, user2 } = await loadFixture(deployTokenFixture);
      const remaining = ethers.parseEther("1000000000") - INITIAL_SUPPLY;
      // Try to batch mint more than remaining capacity
      await expect(
        token.mintBatch(
          [user1.address, user2.address],
          [remaining, 1n]
        )
      ).to.be.revertedWith("Moltbucks: cap exceeded");
    });
  });

  // ================================================================
  // Minter Management
  // ================================================================
  describe("Minter Management", function () {
    describe("addMinter", function () {
      it("Should allow owner to add a minter", async function () {
        const { token, minter } = await loadFixture(deployTokenFixture);
        await token.addMinter(minter.address);
        expect(await token.minters(minter.address)).to.equal(true);
      });

      it("Should emit MinterAdded event", async function () {
        const { token, minter } = await loadFixture(deployTokenFixture);
        await expect(token.addMinter(minter.address))
          .to.emit(token, "MinterAdded")
          .withArgs(minter.address);
      });

      it("Should revert when non-owner tries to add a minter", async function () {
        const { token, user1, user2 } = await loadFixture(deployTokenFixture);
        await expect(
          token.connect(user1).addMinter(user2.address)
        ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
      });

      it("Should revert when adding zero address as minter", async function () {
        const { token } = await loadFixture(deployTokenFixture);
        await expect(
          token.addMinter(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid address");
      });
    });

    describe("removeMinter", function () {
      it("Should allow owner to remove a minter", async function () {
        const { token, minter } = await loadFixture(deployWithMinterFixture);
        await token.removeMinter(minter.address);
        expect(await token.minters(minter.address)).to.equal(false);
      });

      it("Should emit MinterRemoved event", async function () {
        const { token, minter } = await loadFixture(deployWithMinterFixture);
        await expect(token.removeMinter(minter.address))
          .to.emit(token, "MinterRemoved")
          .withArgs(minter.address);
      });

      it("Should revert when non-owner tries to remove a minter", async function () {
        const { token, minter, user1 } =
          await loadFixture(deployWithMinterFixture);
        await expect(
          token.connect(user1).removeMinter(minter.address)
        ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
      });
    });
  });

  // ================================================================
  // Minting
  // ================================================================
  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const { token, owner, user1 } = await loadFixture(deployTokenFixture);
      const mintAmount = ethers.parseEther("500");

      await token.mint(user1.address, mintAmount);
      expect(await token.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should allow minter to mint tokens", async function () {
      const { token, minter, user1 } =
        await loadFixture(deployWithMinterFixture);
      const mintAmount = ethers.parseEther("1000");

      await token.connect(minter).mint(user1.address, mintAmount);
      expect(await token.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should increase total supply after minting", async function () {
      const { token, user1 } = await loadFixture(deployTokenFixture);
      const mintAmount = ethers.parseEther("500");

      await token.mint(user1.address, mintAmount);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY + mintAmount);
    });

    it("Should revert when non-minter tries to mint", async function () {
      const { token, user1, user2 } = await loadFixture(deployTokenFixture);
      await expect(
        token.connect(user1).mint(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Not a minter");
    });

    it("Should revert when minting to zero address", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      await expect(
        token.mint(ethers.ZeroAddress, ethers.parseEther("100"))
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("Should revert when removed minter tries to mint", async function () {
      const { token, minter, user1 } =
        await loadFixture(deployWithMinterFixture);
      await token.removeMinter(minter.address);

      await expect(
        token.connect(minter).mint(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Not a minter");
    });
  });

  // ================================================================
  // Batch Minting
  // ================================================================
  describe("Batch Minting", function () {
    it("Should mint to multiple recipients", async function () {
      const { token, user1, user2, user3 } =
        await loadFixture(deployTokenFixture);
      const amounts = [
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("300"),
      ];

      await token.mintBatch(
        [user1.address, user2.address, user3.address],
        amounts
      );

      expect(await token.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(user2.address)).to.equal(amounts[1]);
      expect(await token.balanceOf(user3.address)).to.equal(amounts[2]);
    });

    it("Should revert if batch size exceeds 50", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      const recipients = Array(51).fill(
        "0x0000000000000000000000000000000000000001"
      );
      const amounts = Array(51).fill(ethers.parseEther("1"));

      await expect(
        token.mintBatch(recipients, amounts)
      ).to.be.revertedWith("Batch too large");
    });

    it("Should revert if recipients and amounts length mismatch", async function () {
      const { token, user1, user2 } = await loadFixture(deployTokenFixture);
      await expect(
        token.mintBatch(
          [user1.address, user2.address],
          [ethers.parseEther("100")]
        )
      ).to.be.revertedWith("Length mismatch");
    });

    it("Should revert if any recipient is zero address", async function () {
      const { token, user1 } = await loadFixture(deployTokenFixture);
      await expect(
        token.mintBatch(
          [user1.address, ethers.ZeroAddress],
          [ethers.parseEther("100"), ethers.parseEther("200")]
        )
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("Should revert when non-minter calls mintBatch", async function () {
      const { token, user1, user2 } = await loadFixture(deployTokenFixture);
      await expect(
        token
          .connect(user1)
          .mintBatch([user2.address], [ethers.parseEther("100")])
      ).to.be.revertedWith("Not a minter");
    });

    it("Should allow minter role to call mintBatch", async function () {
      const { token, minter, user1, user2 } =
        await loadFixture(deployWithMinterFixture);

      await token
        .connect(minter)
        .mintBatch(
          [user1.address, user2.address],
          [ethers.parseEther("50"), ethers.parseEther("75")]
        );

      expect(await token.balanceOf(user1.address)).to.equal(
        ethers.parseEther("50")
      );
      expect(await token.balanceOf(user2.address)).to.equal(
        ethers.parseEther("75")
      );
    });
  });

  // ================================================================
  // Burning
  // ================================================================
  describe("Burning", function () {
    it("Should allow holders to burn their tokens", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseEther("1000");

      await token.burn(burnAmount);
      expect(await token.balanceOf(owner.address)).to.equal(
        INITIAL_SUPPLY - burnAmount
      );
    });

    it("Should decrease total supply after burning", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseEther("500");

      await token.burn(burnAmount);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY - burnAmount);
    });

    it("Should revert when burning more than balance", async function () {
      const { token, user1 } = await loadFixture(deployTokenFixture);
      await expect(
        token.connect(user1).burn(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("Should allow burnFrom with approval", async function () {
      const { token, owner, user1 } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseEther("100");

      await token.approve(user1.address, burnAmount);
      await token.connect(user1).burnFrom(owner.address, burnAmount);

      expect(await token.balanceOf(owner.address)).to.equal(
        INITIAL_SUPPLY - burnAmount
      );
    });

    it("Should revert burnFrom without sufficient allowance", async function () {
      const { token, owner, user1 } = await loadFixture(deployTokenFixture);
      await expect(
        token
          .connect(user1)
          .burnFrom(owner.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });

  // ================================================================
  // Transfers
  // ================================================================
  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const { token, owner, user1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("500");

      await token.transfer(user1.address, amount);
      expect(await token.balanceOf(user1.address)).to.equal(amount);
      expect(await token.balanceOf(owner.address)).to.equal(
        INITIAL_SUPPLY - amount
      );
    });

    it("Should emit Transfer event", async function () {
      const { token, owner, user1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("100");

      await expect(token.transfer(user1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, user1.address, amount);
    });

    it("Should revert when sender has insufficient balance", async function () {
      const { token, user1, user2 } = await loadFixture(deployTokenFixture);
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("Should handle transferFrom with approval", async function () {
      const { token, owner, user1, user2 } =
        await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("200");

      await token.approve(user1.address, amount);
      await token
        .connect(user1)
        .transferFrom(owner.address, user2.address, amount);

      expect(await token.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should revert transferFrom without sufficient allowance", async function () {
      const { token, owner, user1, user2 } =
        await loadFixture(deployTokenFixture);
      await expect(
        token
          .connect(user1)
          .transferFrom(owner.address, user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("Should update allowance after transferFrom", async function () {
      const { token, owner, user1, user2 } =
        await loadFixture(deployTokenFixture);
      const approveAmount = ethers.parseEther("500");
      const transferAmount = ethers.parseEther("200");

      await token.approve(user1.address, approveAmount);
      await token
        .connect(user1)
        .transferFrom(owner.address, user2.address, transferAmount);

      expect(await token.allowance(owner.address, user1.address)).to.equal(
        approveAmount - transferAmount
      );
    });
  });

  // ================================================================
  // Ownership
  // ================================================================
  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      const { token, owner, user1 } = await loadFixture(deployTokenFixture);
      await token.transferOwnership(user1.address);
      expect(await token.owner()).to.equal(user1.address);
    });

    it("Should allow owner to renounce ownership", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      await token.renounceOwnership();
      expect(await token.owner()).to.equal(ethers.ZeroAddress);
    });

    it("Should revert when non-owner transfers ownership", async function () {
      const { token, user1, user2 } = await loadFixture(deployTokenFixture);
      await expect(
        token.connect(user1).transferOwnership(user2.address)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });
});
