import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("GameMarketplace", function () {
  const INITIAL_SUPPLY = ethers.parseEther("10000000"); // 10 million
  const ITEM_PRICE = ethers.parseEther("100");

  // ItemCategory enum values
  const ItemCategory = {
    Cosmetic: 0,
    Consumable: 1,
    PowerUp: 2,
    Access: 3,
    Subscription: 4,
  };

  async function deployMarketplaceFixture() {
    const [owner, treasury, creator, buyer, buyer2, other] =
      await ethers.getSigners();

    // Deploy Moltbucks
    const Moltbucks = await ethers.getContractFactory("Moltbucks");
    const token = await Moltbucks.deploy(INITIAL_SUPPLY);

    // Deploy GameMarketplace
    const GameMarketplace = await ethers.getContractFactory("GameMarketplace");
    const marketplace = await GameMarketplace.deploy(
      await token.getAddress(),
      treasury.address
    );

    // Give buyer some tokens for purchases
    await token.transfer(buyer.address, ethers.parseEther("10000"));
    await token.transfer(buyer2.address, ethers.parseEther("10000"));

    return { token, marketplace, owner, treasury, creator, buyer, buyer2, other };
  }

  async function deployWithGameFixture() {
    const fixture = await loadFixture(deployMarketplaceFixture);
    const { marketplace, creator } = fixture;

    // Authorize creator and publish a game
    await marketplace.authorizePublisher(creator.address);
    await marketplace.connect(creator).publishGame("game-001");

    return fixture;
  }

  async function deployWithItemFixture() {
    const fixture = await loadFixture(deployWithGameFixture);
    const { marketplace, creator } = fixture;

    // Create an item
    await marketplace
      .connect(creator)
      .createItem("item-001", "game-001", ITEM_PRICE, 100, ItemCategory.Cosmetic);

    return fixture;
  }

  async function deployReadyToPurchaseFixture() {
    const fixture = await loadFixture(deployWithItemFixture);
    const { token, marketplace, buyer, buyer2 } = fixture;

    // Approve marketplace to spend buyer's tokens
    const marketplaceAddr = await marketplace.getAddress();
    await token.connect(buyer).approve(marketplaceAddr, ethers.parseEther("10000"));
    await token.connect(buyer2).approve(marketplaceAddr, ethers.parseEther("10000"));

    return fixture;
  }

  // ================================================================
  // Deployment
  // ================================================================
  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { marketplace, owner } = await loadFixture(deployMarketplaceFixture);
      expect(await marketplace.owner()).to.equal(owner.address);
    });

    it("Should set the correct token address", async function () {
      const { marketplace, token } = await loadFixture(deployMarketplaceFixture);
      expect(await marketplace.moltbucks()).to.equal(await token.getAddress());
    });

    it("Should set the correct treasury address", async function () {
      const { marketplace, treasury } =
        await loadFixture(deployMarketplaceFixture);
      expect(await marketplace.treasury()).to.equal(treasury.address);
    });

    it("Should have correct revenue share constants", async function () {
      const { marketplace } = await loadFixture(deployMarketplaceFixture);
      expect(await marketplace.CREATOR_SHARE()).to.equal(85);
      expect(await marketplace.PLATFORM_SHARE()).to.equal(15);
      expect(await marketplace.SHARE_DENOMINATOR()).to.equal(100);
    });

    it("Should revert with zero token address", async function () {
      const [, treasury] = await ethers.getSigners();
      const GameMarketplace = await ethers.getContractFactory("GameMarketplace");
      await expect(
        GameMarketplace.deploy(ethers.ZeroAddress, treasury.address)
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should revert with zero treasury address", async function () {
      const { token } = await loadFixture(deployMarketplaceFixture);
      const GameMarketplace = await ethers.getContractFactory("GameMarketplace");
      await expect(
        GameMarketplace.deploy(await token.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury address");
    });
  });

  // ================================================================
  // Game Management
  // ================================================================
  describe("Game Management", function () {
    describe("publishGame", function () {
      it("Should publish a new game when authorized", async function () {
        const { marketplace, creator } =
          await loadFixture(deployMarketplaceFixture);

        await marketplace.authorizePublisher(creator.address);
        await marketplace.connect(creator).publishGame("game-001");
        const game = await marketplace.getGame("game-001");

        expect(game.gameId).to.equal("game-001");
        expect(game.creator).to.equal(creator.address);
        expect(game.active).to.equal(true);
        expect(game.totalRevenue).to.equal(0);
        expect(game.creatorEarnings).to.equal(0);
      });

      it("Should emit GamePublished event", async function () {
        const { marketplace, creator } =
          await loadFixture(deployMarketplaceFixture);

        await marketplace.authorizePublisher(creator.address);
        await expect(marketplace.connect(creator).publishGame("game-001"))
          .to.emit(marketplace, "GamePublished")
          .withArgs("game-001", creator.address, anyValue);
      });

      it("Should revert when unauthorized user publishes", async function () {
        const { marketplace, other } =
          await loadFixture(deployMarketplaceFixture);

        await expect(
          marketplace.connect(other).publishGame("game-001")
        ).to.be.revertedWith("Not an authorized publisher");
      });

      it("Should allow owner to publish without explicit authorization", async function () {
        const { marketplace, owner } =
          await loadFixture(deployMarketplaceFixture);

        await marketplace.publishGame("game-owner");
        const game = await marketplace.getGame("game-owner");
        expect(game.creator).to.equal(owner.address);
      });

      it("Should revert when publishing with empty game ID", async function () {
        const { marketplace, creator } =
          await loadFixture(deployMarketplaceFixture);
        await marketplace.authorizePublisher(creator.address);
        await expect(
          marketplace.connect(creator).publishGame("")
        ).to.be.revertedWith("Invalid game ID");
      });

      it("Should revert when publishing a duplicate game ID", async function () {
        const { marketplace, creator } =
          await loadFixture(deployMarketplaceFixture);

        await marketplace.authorizePublisher(creator.address);
        await marketplace.connect(creator).publishGame("game-001");
        await expect(
          marketplace.connect(creator).publishGame("game-001")
        ).to.be.revertedWith("Game already exists");
      });

      it("Should allow different authorized creators to publish different games", async function () {
        const { marketplace, creator, buyer } =
          await loadFixture(deployMarketplaceFixture);

        await marketplace.authorizePublisher(creator.address);
        await marketplace.authorizePublisher(buyer.address);
        await marketplace.connect(creator).publishGame("game-001");
        await marketplace.connect(buyer).publishGame("game-002");

        const game1 = await marketplace.getGame("game-001");
        const game2 = await marketplace.getGame("game-002");

        expect(game1.creator).to.equal(creator.address);
        expect(game2.creator).to.equal(buyer.address);
      });
    });

    describe("deactivateGame", function () {
      it("Should deactivate a game", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithGameFixture);

        await marketplace.connect(creator).deactivateGame("game-001");
        const game = await marketplace.getGame("game-001");
        expect(game.active).to.equal(false);
      });

      it("Should emit GameDeactivated event", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithGameFixture);

        await expect(marketplace.connect(creator).deactivateGame("game-001"))
          .to.emit(marketplace, "GameDeactivated")
          .withArgs("game-001", creator.address);
      });

      it("Should revert when non-creator deactivates a game", async function () {
        const { marketplace, other } =
          await loadFixture(deployWithGameFixture);

        await expect(
          marketplace.connect(other).deactivateGame("game-001")
        ).to.be.revertedWith("Not game creator");
      });
    });
  });

  // ================================================================
  // Item Management
  // ================================================================
  describe("Item Management", function () {
    describe("createItem", function () {
      it("Should create an item for a game", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithGameFixture);

        await marketplace
          .connect(creator)
          .createItem("item-001", "game-001", ITEM_PRICE, 50, ItemCategory.Cosmetic);

        const item = await marketplace.getItem("item-001");
        expect(item.itemId).to.equal("item-001");
        expect(item.gameId).to.equal("game-001");
        expect(item.creator).to.equal(creator.address);
        expect(item.price).to.equal(ITEM_PRICE);
        expect(item.maxSupply).to.equal(50);
        expect(item.currentSupply).to.equal(0);
        expect(item.active).to.equal(true);
        expect(item.category).to.equal(ItemCategory.Cosmetic);
      });

      it("Should emit ItemCreated event", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithGameFixture);

        await expect(
          marketplace
            .connect(creator)
            .createItem("item-001", "game-001", ITEM_PRICE, 50, ItemCategory.PowerUp)
        )
          .to.emit(marketplace, "ItemCreated")
          .withArgs(
            "item-001",
            "game-001",
            creator.address,
            ITEM_PRICE,
            ItemCategory.PowerUp
          );
      });

      it("Should add item to game items list", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithGameFixture);

        await marketplace
          .connect(creator)
          .createItem("item-001", "game-001", ITEM_PRICE, 0, ItemCategory.Access);

        const gameItems = await marketplace.getGameItems("game-001");
        expect(gameItems).to.include("item-001");
      });

      it("Should allow unlimited supply with maxSupply = 0", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithGameFixture);

        await marketplace
          .connect(creator)
          .createItem("item-001", "game-001", ITEM_PRICE, 0, ItemCategory.Cosmetic);

        const item = await marketplace.getItem("item-001");
        expect(item.maxSupply).to.equal(0);
      });

      it("Should revert when non-creator tries to create item", async function () {
        const { marketplace, other } =
          await loadFixture(deployWithGameFixture);

        await expect(
          marketplace
            .connect(other)
            .createItem("item-001", "game-001", ITEM_PRICE, 50, ItemCategory.Cosmetic)
        ).to.be.revertedWith("Not game creator");
      });

      it("Should revert when creating item for inactive game", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithGameFixture);

        await marketplace.connect(creator).deactivateGame("game-001");

        await expect(
          marketplace
            .connect(creator)
            .createItem("item-001", "game-001", ITEM_PRICE, 50, ItemCategory.Cosmetic)
        ).to.be.revertedWith("Game not active");
      });

      it("Should revert with empty item ID", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithGameFixture);

        await expect(
          marketplace
            .connect(creator)
            .createItem("", "game-001", ITEM_PRICE, 50, ItemCategory.Cosmetic)
        ).to.be.revertedWith("Invalid item ID");
      });

      it("Should revert with duplicate item ID", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithGameFixture);

        await marketplace
          .connect(creator)
          .createItem("item-001", "game-001", ITEM_PRICE, 50, ItemCategory.Cosmetic);

        await expect(
          marketplace
            .connect(creator)
            .createItem("item-001", "game-001", ITEM_PRICE, 50, ItemCategory.Cosmetic)
        ).to.be.revertedWith("Item already exists");
      });

      it("Should revert with zero price", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithGameFixture);

        await expect(
          marketplace
            .connect(creator)
            .createItem("item-001", "game-001", 0, 50, ItemCategory.Cosmetic)
        ).to.be.revertedWith("Price must be positive");
      });
    });

    describe("updateItemPrice", function () {
      it("Should update item price", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithItemFixture);
        const newPrice = ethers.parseEther("200");

        await marketplace
          .connect(creator)
          .updateItemPrice("item-001", newPrice);

        const item = await marketplace.getItem("item-001");
        expect(item.price).to.equal(newPrice);
      });

      it("Should emit ItemUpdated event", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithItemFixture);
        const newPrice = ethers.parseEther("250");

        await expect(
          marketplace.connect(creator).updateItemPrice("item-001", newPrice)
        )
          .to.emit(marketplace, "ItemUpdated")
          .withArgs("item-001", newPrice);
      });

      it("Should revert when non-creator updates price", async function () {
        const { marketplace, other } =
          await loadFixture(deployWithItemFixture);

        await expect(
          marketplace
            .connect(other)
            .updateItemPrice("item-001", ethers.parseEther("200"))
        ).to.be.revertedWith("Not item creator");
      });

      it("Should revert with zero price", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithItemFixture);

        await expect(
          marketplace.connect(creator).updateItemPrice("item-001", 0)
        ).to.be.revertedWith("Price must be positive");
      });
    });

    describe("deactivateItem", function () {
      it("Should deactivate an item", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithItemFixture);

        await marketplace.connect(creator).deactivateItem("item-001");
        const item = await marketplace.getItem("item-001");
        expect(item.active).to.equal(false);
      });

      it("Should emit ItemDeactivated event", async function () {
        const { marketplace, creator } =
          await loadFixture(deployWithItemFixture);

        await expect(
          marketplace.connect(creator).deactivateItem("item-001")
        )
          .to.emit(marketplace, "ItemDeactivated")
          .withArgs("item-001");
      });

      it("Should revert when non-creator deactivates item", async function () {
        const { marketplace, other } =
          await loadFixture(deployWithItemFixture);

        await expect(
          marketplace.connect(other).deactivateItem("item-001")
        ).to.be.revertedWith("Not item creator");
      });
    });
  });

  // ================================================================
  // Purchases
  // ================================================================
  describe("Purchases", function () {
    describe("purchaseItem", function () {
      it("Should purchase an item and split revenue 85/15", async function () {
        const { token, marketplace, creator, buyer, treasury } =
          await loadFixture(deployReadyToPurchaseFixture);

        const creatorBalBefore = await token.balanceOf(creator.address);
        const treasuryBalBefore = await token.balanceOf(treasury.address);

        await marketplace.connect(buyer).purchaseItem("item-001");

        const expectedCreatorAmount =
          (ITEM_PRICE * 85n) / 100n;
        const expectedPlatformAmount = ITEM_PRICE - expectedCreatorAmount;

        expect(await token.balanceOf(creator.address)).to.equal(
          creatorBalBefore + expectedCreatorAmount
        );
        expect(await token.balanceOf(treasury.address)).to.equal(
          treasuryBalBefore + expectedPlatformAmount
        );
      });

      it("Should deduct the full price from buyer", async function () {
        const { token, marketplace, buyer } =
          await loadFixture(deployReadyToPurchaseFixture);

        const buyerBalBefore = await token.balanceOf(buyer.address);
        await marketplace.connect(buyer).purchaseItem("item-001");

        expect(await token.balanceOf(buyer.address)).to.equal(
          buyerBalBefore - ITEM_PRICE
        );
      });

      it("Should increment currentSupply", async function () {
        const { marketplace, buyer } =
          await loadFixture(deployReadyToPurchaseFixture);

        await marketplace.connect(buyer).purchaseItem("item-001");
        const item = await marketplace.getItem("item-001");
        expect(item.currentSupply).to.equal(1);
      });

      it("Should update game total revenue", async function () {
        const { marketplace, buyer } =
          await loadFixture(deployReadyToPurchaseFixture);

        await marketplace.connect(buyer).purchaseItem("item-001");
        const game = await marketplace.getGame("game-001");
        expect(game.totalRevenue).to.equal(ITEM_PRICE);
      });

      it("Should update game creator earnings", async function () {
        const { marketplace, buyer } =
          await loadFixture(deployReadyToPurchaseFixture);

        await marketplace.connect(buyer).purchaseItem("item-001");
        const game = await marketplace.getGame("game-001");
        const expectedCreatorAmount = (ITEM_PRICE * 85n) / 100n;
        expect(game.creatorEarnings).to.equal(expectedCreatorAmount);
      });

      it("Should mark non-consumable item as owned", async function () {
        const { marketplace, buyer } =
          await loadFixture(deployReadyToPurchaseFixture);

        await marketplace.connect(buyer).purchaseItem("item-001");
        expect(await marketplace.ownsItem(buyer.address, "item-001")).to.equal(
          true
        );
      });

      it("Should emit ItemPurchased event", async function () {
        const { marketplace, buyer, creator } =
          await loadFixture(deployReadyToPurchaseFixture);

        const creatorAmount = (ITEM_PRICE * 85n) / 100n;
        const platformAmount = ITEM_PRICE - creatorAmount;

        await expect(marketplace.connect(buyer).purchaseItem("item-001"))
          .to.emit(marketplace, "ItemPurchased")
          .withArgs(
            "item-001",
            "game-001",
            buyer.address,
            ITEM_PRICE,
            creatorAmount,
            platformAmount
          );
      });

      it("Should emit CreatorPaid event", async function () {
        const { marketplace, buyer, creator } =
          await loadFixture(deployReadyToPurchaseFixture);

        const creatorAmount = (ITEM_PRICE * 85n) / 100n;

        await expect(marketplace.connect(buyer).purchaseItem("item-001"))
          .to.emit(marketplace, "CreatorPaid")
          .withArgs(creator.address, "game-001", creatorAmount);
      });

      it("Should emit TreasuryFunded event", async function () {
        const { marketplace, buyer } =
          await loadFixture(deployReadyToPurchaseFixture);

        const creatorAmount = (ITEM_PRICE * 85n) / 100n;
        const platformAmount = ITEM_PRICE - creatorAmount;

        await expect(marketplace.connect(buyer).purchaseItem("item-001"))
          .to.emit(marketplace, "TreasuryFunded")
          .withArgs(platformAmount, "item_sale");
      });

      it("Should revert when buying inactive item", async function () {
        const { marketplace, creator, buyer } =
          await loadFixture(deployReadyToPurchaseFixture);

        await marketplace.connect(creator).deactivateItem("item-001");

        await expect(
          marketplace.connect(buyer).purchaseItem("item-001")
        ).to.be.revertedWith("Item not active");
      });

      it("Should revert when item is sold out", async function () {
        const { token, marketplace, creator, buyer, buyer2, owner } =
          await loadFixture(deployReadyToPurchaseFixture);

        // Create item with maxSupply = 1
        await marketplace
          .connect(creator)
          .createItem("item-limited", "game-001", ITEM_PRICE, 1, ItemCategory.Cosmetic);

        await marketplace.connect(buyer).purchaseItem("item-limited");

        await expect(
          marketplace.connect(buyer2).purchaseItem("item-limited")
        ).to.be.revertedWith("Sold out");
      });

      it("Should revert when game is inactive", async function () {
        const { marketplace, creator, buyer } =
          await loadFixture(deployReadyToPurchaseFixture);

        await marketplace.connect(creator).deactivateGame("game-001");

        await expect(
          marketplace.connect(buyer).purchaseItem("item-001")
        ).to.be.revertedWith("Game not active");
      });

      it("Should revert when creator tries to buy own item", async function () {
        const { token, marketplace, creator } =
          await loadFixture(deployReadyToPurchaseFixture);

        // Give creator tokens and approve
        await token.transfer(creator.address, ethers.parseEther("1000"));
        await token
          .connect(creator)
          .approve(await marketplace.getAddress(), ethers.parseEther("1000"));

        await expect(
          marketplace.connect(creator).purchaseItem("item-001")
        ).to.be.revertedWith("Cannot purchase own item");
      });

      it("Should revert when buying already owned non-consumable", async function () {
        const { marketplace, buyer } =
          await loadFixture(deployReadyToPurchaseFixture);

        await marketplace.connect(buyer).purchaseItem("item-001");

        await expect(
          marketplace.connect(buyer).purchaseItem("item-001")
        ).to.be.revertedWith("Already owned");
      });

      it("Should revert with insufficient token balance/allowance", async function () {
        const { token, marketplace, other } =
          await loadFixture(deployReadyToPurchaseFixture);

        // Other has no tokens and no approval
        await expect(
          marketplace.connect(other).purchaseItem("item-001")
        ).to.be.reverted;
      });
    });

    describe("Consumable items", function () {
      async function deployWithConsumableFixture() {
        const fixture = await loadFixture(deployReadyToPurchaseFixture);
        const { marketplace, creator } = fixture;

        await marketplace
          .connect(creator)
          .createItem(
            "consumable-001",
            "game-001",
            ethers.parseEther("10"),
            0,
            ItemCategory.Consumable
          );

        return fixture;
      }

      it("Should allow buying consumable multiple times", async function () {
        const { marketplace, buyer } =
          await loadFixture(deployWithConsumableFixture);

        await marketplace.connect(buyer).purchaseItem("consumable-001");
        await marketplace.connect(buyer).purchaseItem("consumable-001");

        expect(
          await marketplace.getConsumableBalance(buyer.address, "consumable-001")
        ).to.equal(2);
      });

      it("Should track consumable quantity", async function () {
        const { marketplace, buyer } =
          await loadFixture(deployWithConsumableFixture);

        await marketplace.connect(buyer).purchaseItem("consumable-001");

        expect(
          await marketplace.getConsumableBalance(buyer.address, "consumable-001")
        ).to.equal(1);
      });
    });

    describe("useConsumable", function () {
      async function deployWithOwnedConsumableFixture() {
        const fixture = await loadFixture(deployReadyToPurchaseFixture);
        const { marketplace, creator, buyer } = fixture;

        await marketplace
          .connect(creator)
          .createItem(
            "consumable-001",
            "game-001",
            ethers.parseEther("10"),
            0,
            ItemCategory.Consumable
          );

        await marketplace.connect(buyer).purchaseItem("consumable-001");
        await marketplace.connect(buyer).purchaseItem("consumable-001");

        return fixture;
      }

      it("Should allow game creator to use a player's consumable", async function () {
        const { marketplace, creator, buyer } =
          await loadFixture(deployWithOwnedConsumableFixture);

        await marketplace
          .connect(creator)
          .useConsumable(buyer.address, "consumable-001");

        expect(
          await marketplace.getConsumableBalance(buyer.address, "consumable-001")
        ).to.equal(1);
      });

      it("Should revert when non-game-creator calls useConsumable", async function () {
        const { marketplace, buyer, other } =
          await loadFixture(deployWithOwnedConsumableFixture);

        await expect(
          marketplace
            .connect(other)
            .useConsumable(buyer.address, "consumable-001")
        ).to.be.revertedWith("Not game creator");
      });

      it("Should revert when player has no consumables left", async function () {
        const { marketplace, creator, buyer } =
          await loadFixture(deployWithOwnedConsumableFixture);

        // Use both consumables
        await marketplace
          .connect(creator)
          .useConsumable(buyer.address, "consumable-001");
        await marketplace
          .connect(creator)
          .useConsumable(buyer.address, "consumable-001");

        await expect(
          marketplace
            .connect(creator)
            .useConsumable(buyer.address, "consumable-001")
        ).to.be.revertedWith("No consumables owned");
      });

      it("Should revert when trying to use non-consumable item", async function () {
        const { marketplace, creator, buyer } =
          await loadFixture(deployReadyToPurchaseFixture);

        // item-001 is Cosmetic, not Consumable
        await marketplace.connect(buyer).purchaseItem("item-001");

        await expect(
          marketplace
            .connect(creator)
            .useConsumable(buyer.address, "item-001")
        ).to.be.revertedWith("Not a consumable");
      });
    });

    describe("purchaseItems (batch)", function () {
      it("Should purchase multiple items in one transaction", async function () {
        const { token, marketplace, creator, buyer, treasury } =
          await loadFixture(deployReadyToPurchaseFixture);

        // Create a second item
        await marketplace
          .connect(creator)
          .createItem(
            "item-002",
            "game-001",
            ethers.parseEther("50"),
            0,
            ItemCategory.PowerUp
          );

        const buyerBalBefore = await token.balanceOf(buyer.address);
        const totalPrice = ITEM_PRICE + ethers.parseEther("50");

        await marketplace
          .connect(buyer)
          .purchaseItems(["item-001", "item-002"]);

        expect(await token.balanceOf(buyer.address)).to.equal(
          buyerBalBefore - totalPrice
        );
        expect(await marketplace.ownsItem(buyer.address, "item-001")).to.equal(
          true
        );
        expect(await marketplace.ownsItem(buyer.address, "item-002")).to.equal(
          true
        );
      });
    });
  });

  // ================================================================
  // Pausable
  // ================================================================
  describe("Pausable", function () {
    it("Should allow owner to pause", async function () {
      const { marketplace, owner } =
        await loadFixture(deployMarketplaceFixture);

      await marketplace.pause();
      expect(await marketplace.paused()).to.equal(true);
    });

    it("Should allow owner to unpause", async function () {
      const { marketplace, owner } =
        await loadFixture(deployMarketplaceFixture);

      await marketplace.pause();
      await marketplace.unpause();
      expect(await marketplace.paused()).to.equal(false);
    });

    it("Should revert purchases when paused", async function () {
      const { marketplace, buyer } =
        await loadFixture(deployReadyToPurchaseFixture);

      await marketplace.pause();

      await expect(
        marketplace.connect(buyer).purchaseItem("item-001")
      ).to.be.revertedWithCustomError(marketplace, "EnforcedPause");
    });

    it("Should revert batch purchases when paused", async function () {
      const { marketplace, buyer } =
        await loadFixture(deployReadyToPurchaseFixture);

      await marketplace.pause();

      await expect(
        marketplace.connect(buyer).purchaseItems(["item-001"])
      ).to.be.revertedWithCustomError(marketplace, "EnforcedPause");
    });

    it("Should revert when non-owner tries to pause", async function () {
      const { marketplace, other } =
        await loadFixture(deployMarketplaceFixture);

      await expect(
        marketplace.connect(other).pause()
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });

    it("Should revert when non-owner tries to unpause", async function () {
      const { marketplace, other } =
        await loadFixture(deployMarketplaceFixture);

      await marketplace.pause();

      await expect(
        marketplace.connect(other).unpause()
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });
  });

  // ================================================================
  // Admin Functions
  // ================================================================
  describe("Admin Functions", function () {
    it("Should allow owner to set treasury", async function () {
      const { marketplace, other } =
        await loadFixture(deployMarketplaceFixture);

      await marketplace.setTreasury(other.address);
      expect(await marketplace.treasury()).to.equal(other.address);
    });

    it("Should revert setting treasury to zero address", async function () {
      const { marketplace } = await loadFixture(deployMarketplaceFixture);

      await expect(
        marketplace.setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury address");
    });

    it("Should revert when non-owner sets treasury", async function () {
      const { marketplace, other } =
        await loadFixture(deployMarketplaceFixture);

      await expect(
        marketplace.connect(other).setTreasury(other.address)
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });

    describe("Publisher Management", function () {
      it("Should authorize a publisher", async function () {
        const { marketplace, creator } =
          await loadFixture(deployMarketplaceFixture);

        await marketplace.authorizePublisher(creator.address);
        expect(await marketplace.authorizedPublishers(creator.address)).to.equal(true);
      });

      it("Should emit PublisherAuthorized event", async function () {
        const { marketplace, creator } =
          await loadFixture(deployMarketplaceFixture);

        await expect(marketplace.authorizePublisher(creator.address))
          .to.emit(marketplace, "PublisherAuthorized")
          .withArgs(creator.address);
      });

      it("Should revoke a publisher", async function () {
        const { marketplace, creator } =
          await loadFixture(deployMarketplaceFixture);

        await marketplace.authorizePublisher(creator.address);
        await marketplace.revokePublisher(creator.address);
        expect(await marketplace.authorizedPublishers(creator.address)).to.equal(false);
      });

      it("Should emit PublisherRevoked event", async function () {
        const { marketplace, creator } =
          await loadFixture(deployMarketplaceFixture);

        await marketplace.authorizePublisher(creator.address);
        await expect(marketplace.revokePublisher(creator.address))
          .to.emit(marketplace, "PublisherRevoked")
          .withArgs(creator.address);
      });

      it("Should revert when non-owner authorizes publisher", async function () {
        const { marketplace, other, creator } =
          await loadFixture(deployMarketplaceFixture);

        await expect(
          marketplace.connect(other).authorizePublisher(creator.address)
        ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
      });

      it("Should revert when authorizing zero address", async function () {
        const { marketplace } = await loadFixture(deployMarketplaceFixture);

        await expect(
          marketplace.authorizePublisher(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid address");
      });

      it("Should revert when revoked publisher tries to publish", async function () {
        const { marketplace, creator } =
          await loadFixture(deployMarketplaceFixture);

        await marketplace.authorizePublisher(creator.address);
        await marketplace.revokePublisher(creator.address);

        await expect(
          marketplace.connect(creator).publishGame("game-001")
        ).to.be.revertedWith("Not an authorized publisher");
      });
    });
  });

  // ================================================================
  // View Functions
  // ================================================================
  describe("View Functions", function () {
    it("Should return game details via getGame", async function () {
      const { marketplace, creator } =
        await loadFixture(deployWithGameFixture);

      const game = await marketplace.getGame("game-001");
      expect(game.creator).to.equal(creator.address);
      expect(game.active).to.equal(true);
    });

    it("Should return item details via getItem", async function () {
      const { marketplace, creator } =
        await loadFixture(deployWithItemFixture);

      const item = await marketplace.getItem("item-001");
      expect(item.creator).to.equal(creator.address);
      expect(item.price).to.equal(ITEM_PRICE);
    });

    it("Should return game items via getGameItems", async function () {
      const { marketplace } = await loadFixture(deployWithItemFixture);

      const items = await marketplace.getGameItems("game-001");
      expect(items.length).to.equal(1);
      expect(items[0]).to.equal("item-001");
    });

    it("Should return ownership status via ownsItem", async function () {
      const { marketplace, buyer } =
        await loadFixture(deployReadyToPurchaseFixture);

      expect(await marketplace.ownsItem(buyer.address, "item-001")).to.equal(
        false
      );

      await marketplace.connect(buyer).purchaseItem("item-001");

      expect(await marketplace.ownsItem(buyer.address, "item-001")).to.equal(
        true
      );
    });

    it("Should return consumable balance via getConsumableBalance", async function () {
      const { marketplace, buyer } =
        await loadFixture(deployReadyToPurchaseFixture);

      expect(
        await marketplace.getConsumableBalance(buyer.address, "item-001")
      ).to.equal(0);
    });
  });
});

