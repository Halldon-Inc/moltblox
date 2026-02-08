// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title GameMarketplace
 * @notice Marketplace for Moltblox games with 85/15 revenue split
 * @dev 85% to creator, 15% to platform (funds tournaments, infrastructure)
 */
contract GameMarketplace is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Revenue split constants
    uint256 public constant CREATOR_SHARE = 85;
    uint256 public constant PLATFORM_SHARE = 15;
    uint256 public constant SHARE_DENOMINATOR = 100;

    // MBUCKS token
    IERC20 public immutable moltbucks;

    // Platform treasury (receives 15% for tournaments, infrastructure)
    address public treasury;

    // Game struct
    struct Game {
        string gameId;
        address creator;
        bool active;
        uint256 totalRevenue;
        uint256 creatorEarnings;
        uint256 createdAt;
    }

    // Item struct
    struct Item {
        string itemId;
        string gameId;
        address creator;
        uint256 price;
        uint256 maxSupply;      // 0 = unlimited
        uint256 currentSupply;
        bool active;
        ItemCategory category;
    }

    enum ItemCategory {
        Cosmetic,
        Consumable,
        PowerUp,
        Access,
        Subscription
    }

    // Authorized publishers (bot-only, set by admin)
    mapping(address => bool) public authorizedPublishers;

    // Storage
    mapping(string => Game) public games;
    mapping(string => Item) public items;
    mapping(string => string[]) public gameItems; // gameId => itemIds
    mapping(address => mapping(string => bool)) public playerOwnsItem; // player => itemId => owns
    mapping(address => mapping(string => uint256)) public playerItemQuantity; // for consumables

    // Events
    event PublisherAuthorized(address indexed publisher);
    event PublisherRevoked(address indexed publisher);
    event GamePublished(string indexed gameId, address indexed creator, uint256 timestamp);
    event GameUpdated(string indexed gameId, address indexed creator);
    event GameDeactivated(string indexed gameId, address indexed creator);

    event ItemCreated(
        string indexed itemId,
        string indexed gameId,
        address indexed creator,
        uint256 price,
        ItemCategory category
    );
    event ItemPurchased(
        string indexed itemId,
        string indexed gameId,
        address indexed buyer,
        uint256 price,
        uint256 creatorAmount,
        uint256 platformAmount
    );
    event ItemUpdated(string indexed itemId, uint256 newPrice);
    event ItemDeactivated(string indexed itemId);

    event CreatorPaid(address indexed creator, string indexed gameId, uint256 amount);
    event TreasuryFunded(uint256 amount, string reason);

    constructor(address _moltbucks, address _treasury) Ownable(msg.sender) {
        require(_moltbucks != address(0), "Invalid token address");
        require(_treasury != address(0), "Invalid treasury address");
        moltbucks = IERC20(_moltbucks);
        treasury = _treasury;
    }

    // ============ Game Management ============

    /**
     * @notice Publish a new game (authorized publishers only)
     * @param gameId Unique identifier for the game
     */
    function publishGame(string calldata gameId) external {
        require(
            authorizedPublishers[msg.sender] || owner() == msg.sender,
            "Not an authorized publisher"
        );
        require(bytes(gameId).length > 0, "Invalid game ID");
        require(games[gameId].creator == address(0), "Game already exists");

        games[gameId] = Game({
            gameId: gameId,
            creator: msg.sender,
            active: true,
            totalRevenue: 0,
            creatorEarnings: 0,
            createdAt: block.timestamp
        });

        emit GamePublished(gameId, msg.sender, block.timestamp);
    }

    /**
     * @notice Deactivate a game (creator only)
     * @param gameId The game to deactivate
     */
    function deactivateGame(string calldata gameId) external {
        require(games[gameId].creator == msg.sender, "Not game creator");
        games[gameId].active = false;
        emit GameDeactivated(gameId, msg.sender);
    }

    // ============ Item Management ============

    /**
     * @notice Create a new item for a game
     * @param itemId Unique identifier for the item
     * @param gameId The game this item belongs to
     * @param price Price in MBUCKS (wei)
     * @param maxSupply Maximum supply (0 = unlimited)
     * @param category Item category
     */
    function createItem(
        string calldata itemId,
        string calldata gameId,
        uint256 price,
        uint256 maxSupply,
        ItemCategory category
    ) external {
        require(games[gameId].creator == msg.sender, "Not game creator");
        require(games[gameId].active, "Game not active");
        require(bytes(itemId).length > 0, "Invalid item ID");
        require(items[itemId].creator == address(0), "Item already exists");
        require(price > 0, "Price must be positive");

        items[itemId] = Item({
            itemId: itemId,
            gameId: gameId,
            creator: msg.sender,
            price: price,
            maxSupply: maxSupply,
            currentSupply: 0,
            active: true,
            category: category
        });

        gameItems[gameId].push(itemId);

        emit ItemCreated(itemId, gameId, msg.sender, price, category);
    }

    /**
     * @notice Update item price (creator only)
     * @param itemId The item to update
     * @param newPrice New price in MBUCKS (wei)
     */
    function updateItemPrice(string calldata itemId, uint256 newPrice) external {
        require(items[itemId].creator == msg.sender, "Not item creator");
        require(newPrice > 0, "Price must be positive");
        items[itemId].price = newPrice;
        emit ItemUpdated(itemId, newPrice);
    }

    /**
     * @notice Deactivate an item (creator only)
     * @param itemId The item to deactivate
     */
    function deactivateItem(string calldata itemId) external {
        require(items[itemId].creator == msg.sender, "Not item creator");
        items[itemId].active = false;
        emit ItemDeactivated(itemId);
    }

    // ============ Purchases ============

    /**
     * @notice Purchase an item
     * @dev 85% goes to creator, 15% goes to platform treasury
     * @param itemId The item to purchase
     */
    function purchaseItem(string calldata itemId) external nonReentrant whenNotPaused {
        Item storage item = items[itemId];
        require(item.active, "Item not active");
        require(item.maxSupply == 0 || item.currentSupply < item.maxSupply, "Sold out");

        Game storage game = games[item.gameId];
        require(game.active, "Game not active");
        require(msg.sender != item.creator, "Cannot purchase own item");

        // For non-consumables, check if already owned
        if (item.category != ItemCategory.Consumable) {
            require(!playerOwnsItem[msg.sender][itemId], "Already owned");
        }

        uint256 price = item.price;

        // Calculate split: 85% creator, 15% platform
        uint256 creatorAmount = (price * CREATOR_SHARE) / SHARE_DENOMINATOR;
        uint256 platformAmount = price - creatorAmount;

        // Transfer from buyer
        moltbucks.safeTransferFrom(msg.sender, address(this), price);

        // Pay creator instantly (85%)
        moltbucks.safeTransfer(item.creator, creatorAmount);

        // Send to treasury (15%)
        moltbucks.safeTransfer(treasury, platformAmount);

        // Update ownership
        if (item.category == ItemCategory.Consumable) {
            playerItemQuantity[msg.sender][itemId]++;
        } else {
            playerOwnsItem[msg.sender][itemId] = true;
        }

        // Update stats
        item.currentSupply++;
        game.totalRevenue += price;
        game.creatorEarnings += creatorAmount;

        emit ItemPurchased(itemId, item.gameId, msg.sender, price, creatorAmount, platformAmount);
        emit CreatorPaid(item.creator, item.gameId, creatorAmount);
        emit TreasuryFunded(platformAmount, "item_sale");
    }

    /**
     * @notice Purchase multiple items at once
     * @param itemIds Array of item IDs to purchase
     */
    function purchaseItems(string[] calldata itemIds) external nonReentrant whenNotPaused {
        for (uint256 i = 0; i < itemIds.length; i++) {
            _purchaseItemInternal(itemIds[i]);
        }
    }

    function _purchaseItemInternal(string calldata itemId) internal {
        Item storage item = items[itemId];
        require(item.active, "Item not active");
        require(item.maxSupply == 0 || item.currentSupply < item.maxSupply, "Sold out");

        Game storage game = games[item.gameId];
        require(game.active, "Game not active");
        require(msg.sender != item.creator, "Cannot purchase own item");

        if (item.category != ItemCategory.Consumable) {
            require(!playerOwnsItem[msg.sender][itemId], "Already owned");
        }

        uint256 price = item.price;
        uint256 creatorAmount = (price * CREATOR_SHARE) / SHARE_DENOMINATOR;
        uint256 platformAmount = price - creatorAmount;

        moltbucks.safeTransferFrom(msg.sender, address(this), price);
        moltbucks.safeTransfer(item.creator, creatorAmount);
        moltbucks.safeTransfer(treasury, platformAmount);

        if (item.category == ItemCategory.Consumable) {
            playerItemQuantity[msg.sender][itemId]++;
        } else {
            playerOwnsItem[msg.sender][itemId] = true;
        }

        item.currentSupply++;
        game.totalRevenue += price;
        game.creatorEarnings += creatorAmount;

        emit ItemPurchased(itemId, item.gameId, msg.sender, price, creatorAmount, platformAmount);
        emit CreatorPaid(item.creator, item.gameId, creatorAmount);
        emit TreasuryFunded(platformAmount, "item_sale");
    }

    // ============ Consumable Usage ============

    /**
     * @notice Use a consumable item (game calls this)
     * @param player The player using the item
     * @param itemId The consumable to use
     */
    function useConsumable(address player, string calldata itemId) external {
        Item storage item = items[itemId];
        require(item.category == ItemCategory.Consumable, "Not a consumable");
        require(games[item.gameId].creator == msg.sender, "Not game creator");
        require(playerItemQuantity[player][itemId] > 0, "No consumables owned");

        playerItemQuantity[player][itemId]--;
    }

    // ============ View Functions ============

    function getGame(string calldata gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function getItem(string calldata itemId) external view returns (Item memory) {
        return items[itemId];
    }

    function getGameItems(string calldata gameId) external view returns (string[] memory) {
        return gameItems[gameId];
    }

    function ownsItem(address player, string calldata itemId) external view returns (bool) {
        return playerOwnsItem[player][itemId];
    }

    function getConsumableBalance(address player, string calldata itemId) external view returns (uint256) {
        return playerItemQuantity[player][itemId];
    }

    // ============ Admin Functions ============

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
    }

    /**
     * @notice Authorize an address to publish games
     * @param publisher Address to authorize
     */
    function authorizePublisher(address publisher) external onlyOwner {
        require(publisher != address(0), "Invalid address");
        authorizedPublishers[publisher] = true;
        emit PublisherAuthorized(publisher);
    }

    /**
     * @notice Revoke publisher authorization
     * @param publisher Address to revoke
     */
    function revokePublisher(address publisher) external onlyOwner {
        authorizedPublishers[publisher] = false;
        emit PublisherRevoked(publisher);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice SC3: Recover accidentally sent ERC20 tokens (not MBUCKS)
     * @param token The ERC20 token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverTokens(IERC20 token, address to, uint256 amount) external onlyOwner {
        require(address(token) != address(moltbucks), "Cannot recover MBUCKS");
        require(to != address(0), "Invalid recipient");
        token.safeTransfer(to, amount);
    }
}
