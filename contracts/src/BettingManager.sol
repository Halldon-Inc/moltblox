// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BettingManager
 * @notice Peer-to-peer wagering with escrow and spectator betting using MBUCKS
 * @dev Supports player vs player wagers and spectator betting pools
 */
contract BettingManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable moltbucks;
    address public treasury;

    // Platform fee: 5% of player wagers, 3% of spectator pool
    uint256 public constant PLAYER_FEE_BPS = 500;      // 5%
    uint256 public constant SPECTATOR_FEE_BPS = 300;    // 3%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Limits
    uint256 public maxStakePerWager = 1000 ether;  // 1000 MBUCKS max
    uint256 public minStake = 0.1 ether;            // 0.1 MBUCKS min
    uint256 public constant MAX_SPECTATOR_BET = 100 ether;
    uint256 public constant MIN_SPECTATOR_BET = 0.1 ether;

    // Timeouts
    uint256 public constant ACCEPT_TIMEOUT = 24 hours;
    uint256 public constant SETTLE_TIMEOUT = 2 hours;
    uint256 public constant DISPUTE_WINDOW = 1 hours;

    enum WagerStatus { Open, Locked, Settled, Cancelled, Disputed, Refunded }

    struct Wager {
        string gameId;
        address creator;
        address opponent;          // address(0) = open to anyone
        address acceptor;          // actual opponent who accepted
        uint256 stakeAmount;
        WagerStatus status;
        address winner;
        uint256 createdAt;
        uint256 lockedAt;
        uint256 settledAt;
    }

    struct SpectatorPool {
        uint256 totalPool;
        uint256 pool1;          // bets on creator
        uint256 pool2;          // bets on acceptor
        bool settled;
    }

    struct SpectatorBet {
        address bettor;
        uint256 amount;
        address predictedWinner;  // creator or acceptor address
        bool paid;
    }

    // Storage
    uint256 public nextWagerId;
    mapping(uint256 => Wager) public wagers;
    mapping(uint256 => SpectatorPool) public spectatorPools;
    mapping(uint256 => SpectatorBet[]) public spectatorBets;
    mapping(address => bool) public authorizedSettlers;  // Server backend addresses

    // Events
    event WagerCreated(uint256 indexed wagerId, address indexed creator, uint256 stakeAmount, string gameId);
    event WagerAccepted(uint256 indexed wagerId, address indexed acceptor);
    event WagerSettled(uint256 indexed wagerId, address indexed winner, uint256 payout);
    event WagerCancelled(uint256 indexed wagerId);
    event WagerDisputed(uint256 indexed wagerId, address indexed disputant);
    event WagerRefunded(uint256 indexed wagerId);
    event SpectatorBetPlaced(uint256 indexed wagerId, address indexed bettor, address predictedWinner, uint256 amount);
    event SpectatorBetsSettled(uint256 indexed wagerId, address indexed winner);
    event SettlerAuthorized(address indexed settler);
    event SettlerRevoked(address indexed settler);

    constructor(address _moltbucks, address _treasury) Ownable(msg.sender) {
        require(_moltbucks != address(0), "Invalid token address");
        require(_treasury != address(0), "Invalid treasury address");
        moltbucks = IERC20(_moltbucks);
        treasury = _treasury;
    }

    // ============ Wager Creation ============

    /**
     * @notice Create a new wager
     * @param gameId The game being wagered on
     * @param stakeAmount Amount of MBUCKS to stake
     * @param opponent Specific opponent address, or address(0) for open wager
     */
    function createWager(
        string calldata gameId,
        uint256 stakeAmount,
        address opponent
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(bytes(gameId).length > 0, "Invalid game ID");
        require(stakeAmount >= minStake, "Stake below minimum");
        require(stakeAmount <= maxStakePerWager, "Stake above maximum");
        require(opponent != msg.sender, "Cannot wager against yourself");

        uint256 wagerId = nextWagerId++;

        Wager storage w = wagers[wagerId];
        w.gameId = gameId;
        w.creator = msg.sender;
        w.opponent = opponent;
        w.stakeAmount = stakeAmount;
        w.status = WagerStatus.Open;
        w.createdAt = block.timestamp;

        // Transfer stake from creator to contract (escrow)
        moltbucks.safeTransferFrom(msg.sender, address(this), stakeAmount);

        emit WagerCreated(wagerId, msg.sender, stakeAmount, gameId);
        return wagerId;
    }

    // ============ Wager Acceptance ============

    /**
     * @notice Accept an open or private wager
     * @param wagerId The wager to accept
     */
    function acceptWager(uint256 wagerId) external nonReentrant whenNotPaused {
        Wager storage w = wagers[wagerId];
        require(w.status == WagerStatus.Open, "Wager not open");
        require(block.timestamp <= w.createdAt + ACCEPT_TIMEOUT, "Wager expired");
        require(msg.sender != w.creator, "Creator cannot accept own wager");

        // If private wager, enforce specific opponent
        if (w.opponent != address(0)) {
            require(msg.sender == w.opponent, "Not the designated opponent");
        }

        w.acceptor = msg.sender;
        w.status = WagerStatus.Locked;
        w.lockedAt = block.timestamp;

        // Transfer matching stake from acceptor to contract (escrow)
        moltbucks.safeTransferFrom(msg.sender, address(this), w.stakeAmount);

        emit WagerAccepted(wagerId, msg.sender);
    }

    // ============ Wager Settlement ============

    /**
     * @notice Settle a wager (authorized settlers only, typically the server backend)
     * @param wagerId The wager to settle
     * @param winnerId The address of the winner (must be creator or acceptor)
     */
    function settleWager(uint256 wagerId, address winnerId) external nonReentrant whenNotPaused {
        require(authorizedSettlers[msg.sender], "Not an authorized settler");

        Wager storage w = wagers[wagerId];
        require(w.status == WagerStatus.Locked, "Wager not locked");
        require(block.timestamp <= w.lockedAt + SETTLE_TIMEOUT, "Settlement window expired");
        require(
            winnerId == w.creator || winnerId == w.acceptor,
            "Winner must be creator or acceptor"
        );

        w.winner = winnerId;
        w.status = WagerStatus.Settled;
        w.settledAt = block.timestamp;

        // Calculate payout: total pot minus platform fee
        uint256 totalPot = w.stakeAmount * 2;
        uint256 fee = (totalPot * PLAYER_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = totalPot - fee;

        // Transfer payout to winner
        moltbucks.safeTransfer(winnerId, payout);

        // Transfer fee to treasury
        moltbucks.safeTransfer(treasury, fee);

        // Settle spectator bets
        _settleSpectatorBets(wagerId, winnerId);

        emit WagerSettled(wagerId, winnerId, payout);
    }

    // ============ Wager Cancellation ============

    /**
     * @notice Cancel an open wager (creator only)
     * @param wagerId The wager to cancel
     */
    function cancelWager(uint256 wagerId) external nonReentrant {
        Wager storage w = wagers[wagerId];
        require(msg.sender == w.creator, "Only creator can cancel");
        require(w.status == WagerStatus.Open, "Can only cancel open wagers");

        w.status = WagerStatus.Cancelled;

        // Refund creator's stake
        moltbucks.safeTransfer(w.creator, w.stakeAmount);

        emit WagerCancelled(wagerId);
    }

    // ============ Disputes ============

    /**
     * @notice Dispute a settled wager
     * @param wagerId The wager to dispute
     * @param reason Reason for the dispute (emitted in event, stored off-chain)
     */
    function disputeWager(uint256 wagerId, string calldata reason) external {
        Wager storage w = wagers[wagerId];
        require(
            msg.sender == w.creator || msg.sender == w.acceptor,
            "Only participants can dispute"
        );
        require(w.status == WagerStatus.Settled, "Can only dispute settled wagers");
        require(
            block.timestamp <= w.settledAt + DISPUTE_WINDOW,
            "Dispute window has closed"
        );
        require(bytes(reason).length > 0, "Reason required");

        w.status = WagerStatus.Disputed;

        emit WagerDisputed(wagerId, msg.sender);
    }

    /**
     * @notice Resolve a disputed wager (admin only)
     * @param wagerId The wager to resolve
     * @param winnerId The correct winner address
     */
    function resolveDispute(uint256 wagerId, address winnerId) external onlyOwner nonReentrant {
        Wager storage w = wagers[wagerId];
        require(w.status == WagerStatus.Disputed, "Wager not disputed");
        require(
            winnerId == w.creator || winnerId == w.acceptor,
            "Winner must be creator or acceptor"
        );

        address previousWinner = w.winner;
        w.winner = winnerId;
        w.status = WagerStatus.Settled;

        // If winner changed, transfer the payout from old winner to new winner
        // The fee was already sent to treasury during initial settlement, so we
        // only need to move the payout amount between players
        if (previousWinner != winnerId) {
            uint256 totalPot = w.stakeAmount * 2;
            uint256 fee = (totalPot * PLAYER_FEE_BPS) / BPS_DENOMINATOR;
            uint256 payout = totalPot - fee;

            // Transfer payout to the correct winner (from contract reserves)
            // Note: this requires the previous winner to have returned funds,
            // or the contract to hold sufficient balance. In practice, the admin
            // should ensure the contract is funded for dispute resolution.
            moltbucks.safeTransfer(winnerId, payout);
        }

        emit WagerSettled(wagerId, winnerId, 0);
    }

    // ============ Spectator Betting ============

    /**
     * @notice Place a spectator bet on a locked wager
     * @param wagerId The wager to bet on
     * @param predictedWinner The address the bettor thinks will win
     * @param amount Amount of MBUCKS to bet
     */
    function placeBet(
        uint256 wagerId,
        address predictedWinner,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        Wager storage w = wagers[wagerId];
        require(w.status == WagerStatus.Locked, "Wager not locked");
        require(amount >= MIN_SPECTATOR_BET, "Bet below minimum");
        require(amount <= MAX_SPECTATOR_BET, "Bet above maximum");
        require(
            predictedWinner == w.creator || predictedWinner == w.acceptor,
            "Must bet on creator or acceptor"
        );
        require(msg.sender != w.creator && msg.sender != w.acceptor, "Participants cannot place spectator bets");

        // Transfer bet amount from bettor to contract
        moltbucks.safeTransferFrom(msg.sender, address(this), amount);

        // Update spectator pool
        SpectatorPool storage pool = spectatorPools[wagerId];
        pool.totalPool += amount;
        if (predictedWinner == w.creator) {
            pool.pool1 += amount;
        } else {
            pool.pool2 += amount;
        }

        // Store individual bet
        spectatorBets[wagerId].push(SpectatorBet({
            bettor: msg.sender,
            amount: amount,
            predictedWinner: predictedWinner,
            paid: false
        }));

        emit SpectatorBetPlaced(wagerId, msg.sender, predictedWinner, amount);
    }

    /**
     * @notice Internal function to settle spectator bets after wager settlement
     * @param wagerId The wager whose spectator bets to settle
     * @param winner The wager winner
     */
    function _settleSpectatorBets(uint256 wagerId, address winner) internal {
        SpectatorPool storage pool = spectatorPools[wagerId];

        // If no spectator bets, nothing to do
        if (pool.totalPool == 0) {
            pool.settled = true;
            return;
        }

        Wager storage w = wagers[wagerId];

        // Determine winning and losing pools
        uint256 winningPool;
        uint256 losingPool;
        if (winner == w.creator) {
            winningPool = pool.pool1;
            losingPool = pool.pool2;
        } else {
            winningPool = pool.pool2;
            losingPool = pool.pool1;
        }

        // Deduct platform fee from total pool
        uint256 totalFee = (pool.totalPool * SPECTATOR_FEE_BPS) / BPS_DENOMINATOR;
        uint256 distributablePool = pool.totalPool - totalFee;

        // Send fee to treasury
        if (totalFee > 0) {
            moltbucks.safeTransfer(treasury, totalFee);
        }

        SpectatorBet[] storage bets = spectatorBets[wagerId];

        if (winningPool == 0) {
            // No one bet on the winner: refund all bettors (minus fee already taken)
            // Distribute the remaining pool proportionally
            for (uint256 i = 0; i < bets.length; i++) {
                if (!bets[i].paid) {
                    uint256 refundShare = (bets[i].amount * distributablePool) / pool.totalPool;
                    bets[i].paid = true;
                    if (refundShare > 0) {
                        moltbucks.safeTransfer(bets[i].bettor, refundShare);
                    }
                }
            }
        } else {
            // Distribute to winning bettors proportionally
            for (uint256 i = 0; i < bets.length; i++) {
                if (!bets[i].paid && bets[i].predictedWinner == winner) {
                    // Winner gets their proportional share of the distributable pool
                    uint256 winnerShare = (bets[i].amount * distributablePool) / winningPool;
                    bets[i].paid = true;
                    if (winnerShare > 0) {
                        moltbucks.safeTransfer(bets[i].bettor, winnerShare);
                    }
                } else if (!bets[i].paid) {
                    // Losing bettors get nothing
                    bets[i].paid = true;
                }
            }
        }

        pool.settled = true;

        emit SpectatorBetsSettled(wagerId, winner);
    }

    // ============ Expired Wager Refund ============

    /**
     * @notice Refund an expired open wager (anyone can call)
     * @param wagerId The expired wager to refund
     */
    function refundExpiredWager(uint256 wagerId) external nonReentrant {
        Wager storage w = wagers[wagerId];
        require(w.status == WagerStatus.Open, "Wager not open");
        require(
            block.timestamp > w.createdAt + ACCEPT_TIMEOUT,
            "Wager not yet expired"
        );

        w.status = WagerStatus.Refunded;

        // Refund creator's stake
        moltbucks.safeTransfer(w.creator, w.stakeAmount);

        emit WagerRefunded(wagerId);
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize an address as a wager settler
     * @param settler Address to authorize
     */
    function authorizeSettler(address settler) external onlyOwner {
        require(settler != address(0), "Invalid settler address");
        authorizedSettlers[settler] = true;
        emit SettlerAuthorized(settler);
    }

    /**
     * @notice Revoke settler authorization
     * @param settler Address to revoke
     */
    function revokeSettler(address settler) external onlyOwner {
        authorizedSettlers[settler] = false;
        emit SettlerRevoked(settler);
    }

    /**
     * @notice Update the maximum stake per wager
     * @param newMax New maximum stake amount
     */
    function setMaxStake(uint256 newMax) external onlyOwner {
        require(newMax > 0, "Max stake must be positive");
        require(newMax >= minStake, "Max must be >= min");
        maxStakePerWager = newMax;
    }

    /**
     * @notice Update the minimum stake
     * @param newMin New minimum stake amount
     */
    function setMinStake(uint256 newMin) external onlyOwner {
        require(newMin > 0, "Min stake must be positive");
        require(newMin <= maxStakePerWager, "Min must be <= max");
        minStake = newMin;
    }

    /**
     * @notice Update the treasury address
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        treasury = newTreasury;
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @notice Get the number of spectator bets for a wager
     * @param wagerId The wager to query
     */
    function getSpectatorBetCount(uint256 wagerId) external view returns (uint256) {
        return spectatorBets[wagerId].length;
    }

    /**
     * @notice Get a specific spectator bet
     * @param wagerId The wager to query
     * @param index The bet index
     */
    function getSpectatorBet(uint256 wagerId, uint256 index) external view returns (
        address bettor,
        uint256 amount,
        address predictedWinner,
        bool paid
    ) {
        SpectatorBet storage bet = spectatorBets[wagerId][index];
        return (bet.bettor, bet.amount, bet.predictedWinner, bet.paid);
    }
}
