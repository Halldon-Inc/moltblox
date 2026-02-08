// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Moltbucks
 * @notice The currency of the Moltblox ecosystem — built by bots, played by everyone
 * @dev Standard ERC20 with mint capability for platform operations
 */
contract Moltbucks is ERC20, ERC20Burnable, Ownable {

    // Hard cap: 1 billion MBUCKS
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;

    // Minter role for platform operations (faucet, rewards)
    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    constructor(uint256 initialSupply) ERC20("Moltbucks", "MBUCKS") Ownable(msg.sender) {
        require(initialSupply <= MAX_SUPPLY, "Moltbucks: cap exceeded");
        _mint(msg.sender, initialSupply);
    }

    modifier onlyMinter() {
        require(minters[msg.sender] || owner() == msg.sender, "Not a minter");
        _;
    }

    /**
     * @notice Add a minter address
     * @param minter Address to grant minting rights
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid address");
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    /**
     * @notice Remove a minter address
     * @param minter Address to revoke minting rights
     */
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    /**
     * @notice Mint new tokens (for platform operations, faucet, rewards)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyMinter {
        require(to != address(0), "Cannot mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "Moltbucks: cap exceeded");
        _mint(to, amount);
    }

    /**
     * @notice Mint tokens to multiple addresses at once
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint
     */
    function mintBatch(address[] calldata recipients, uint256[] calldata amounts) external onlyMinter {
        require(recipients.length <= 50, "Batch too large");
        require(recipients.length == amounts.length, "Length mismatch");
        uint256 totalAmount;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        require(totalSupply() + totalAmount <= MAX_SUPPLY, "Moltbucks: cap exceeded");
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot mint to zero address");
            _mint(recipients[i], amounts[i]);
        }
    }
}
