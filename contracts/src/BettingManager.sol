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
    uint256 public constant MAX_SPECTATOR_BETS_PER_WAGER = 100;

    // Timeouts
    uint256 public constant ACCEPT_TIMEOUT = 24 hours;
    uint256 public constant SETTLE_TIMEOUT = 2 hours;
    uint256 public constant DISPUTE_WINDOW = 24 hours;
    uint256 public constant LOCKED_WAGER_TIMEOUT = 7 days;

    // Treasury timelock (2-step change)
    address public pendingTreasury;
    uint256 public treasuryChangeTimestamp;
    uint256 public constant TREASURY_TIMELOCK = 48 hours;

    enum WagerStatus { Open, Locked, Settled, Cancelled, Disputed, Refunded, Claimed }

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
        uint256 claimableAfter;
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
    event WagerClaimed(uint256 indexed wagerId, address indexed winner, uint256 payout);
    event SpectatorBetPlaced(uint256 indexed wagerId, address indexed bettor, address predictedWinner, uint256 amount);
    event SpectatorBetsSettled(uint256 indexed wagerId, address indexed winner);
    event SpectatorBetsRefunded(uint256 indexed wagerId);
    event SpectatorWinningsClaimed(uint256 indexed wagerId, address indexed bettor, uint256 amount);
    event SettlerAuthorized(address indexed settler);
    event SettlerRevoked(address indexed settler);
    event MaxStakeUpdated(uint256 newMax);
    event MinStakeUpdated(uint256 newMin);
    event TreasuryChangeProposed(address indexed newTreasury, uint256 effectiveTime);
    event TreasuryChangeConfirmed(address indexed oldTreasury, address indexed newTreasury);
    event TreasuryChangeCancelled();
    event LockedWagerRefunded(uint256 indexed wagerId);

    constructor(address _moltbucks, address _treasury) Ownable(msg.sender) {
        require(_moltbucks != address(0), "Invalid token address");
        require(_treasury != address(0), "Invalid treasury address");
        moltbucks = IERC20(_moltbucks);
        treasury = _treasury;
    }

    // ============ Wager Creation ============

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

        moltbucks.safeTransferFrom(msg.sender, address(this), stakeAmount);

        emit WagerCreated(wagerId, msg.sender, stakeAmount, gameId);
        return wagerId;
    }

    // ============ Wager Acceptance ============

    function acceptWager(uint256 wagerId) external nonReentrant whenNotPaused {
        Wager storage w = wagers[wagerId];
        require(w.status == WagerStatus.Open, "Wager not open");
        require(block.timestamp <= w.createdAt + ACCEPT_TIMEOUT, "Wager expired");
        require(msg.sender != w.creator, "Creator cannot accept own wager");

        if (w.opponent != address(0)) {
            require(msg.sender == w.opponent, "Not the designated opponent");
        }

        w.acceptor = msg.sender;
        w.status = WagerStatus.Locked;
        w.lockedAt = block.timestamp;

        moltbucks.safeTransferFrom(msg.sender, address(this), w.stakeAmount);

        emit WagerAccepted(wagerId, msg.sender);
    }

    // ============ Wager Settlement (Pull-Payment) ============

    /**
     * @notice Settle a wager: records winner but does NOT transfer tokens.
     *         Winner must call claimWinnings() after the dispute window.
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
        w.claimableAfter = block.timestamp + DISPUTE_WINDOW;

        // Calculate payout for event only (no transfer yet)
        uint256 totalPot = w.stakeAmount * 2;
        uint256 fee = (totalPot * PLAYER_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = totalPot - fee;

        emit WagerSettled(wagerId, winnerId, payout);
    }

    /**
     * @notice Claim winnings after the dispute window has passed
     */
    function claimWinnings(uint256 wagerId) external nonReentrant {
        Wager storage w = wagers[wagerId];
        require(w.status == WagerStatus.Settled, "Wager not settled");
        require(block.timestamp >= w.claimableAfter, "Dispute window still open");
        require(msg.sender == w.winner, "Not the winner");

        w.status = WagerStatus.Claimed;

        uint256 totalPot = w.stakeAmount * 2;
        uint256 fee = (totalPot * PLAYER_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = totalPot - fee;

        moltbucks.safeTransfer(w.winner, payout);
        moltbucks.safeTransfer(treasury, fee);

        // Settle spectator bets (mark claimable, not transferred)
        _markSpectatorBetsSettled(wagerId, w.winner);

        emit WagerClaimed(wagerId, w.winner, payout);
    }

    // ============ Wager Cancellation ============

    function cancelWager(uint256 wagerId) external nonReentrant {
        Wager storage w = wagers[wagerId];
        require(msg.sender == w.creator, "Only creator can cancel");
        require(w.status == WagerStatus.Open, "Can only cancel open wagers");

        w.status = WagerStatus.Cancelled;

        moltbucks.safeTransfer(w.creator, w.stakeAmount);

        emit WagerCancelled(wagerId);
    }

    // ============ Disputes ============

    function disputeWager(uint256 wagerId, string calldata reason) external nonReentrant {
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
     * @notice Resolve a disputed wager (admin only). Resets the claimable timer.
     */
    function resolveDispute(uint256 wagerId, address winnerId) external onlyOwner nonReentrant {
        Wager storage w = wagers[wagerId];
        require(w.status == WagerStatus.Disputed, "Wager not disputed");
        require(
            winnerId == w.creator || winnerId == w.acceptor,
            "Winner must be creator or acceptor"
        );

        w.winner = winnerId;
        w.status = WagerStatus.Settled;
        w.settledAt = block.timestamp;
        w.claimableAfter = block.timestamp + DISPUTE_WINDOW;

        uint256 totalPot = w.stakeAmount * 2;
        uint256 fee = (totalPot * PLAYER_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = totalPot - fee;

        emit WagerSettled(wagerId, winnerId, payout);
    }

    // ============ Spectator Betting ============

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
        require(spectatorBets[wagerId].length < MAX_SPECTATOR_BETS_PER_WAGER, "Max spectator bets reached");

        moltbucks.safeTransferFrom(msg.sender, address(this), amount);

        SpectatorPool storage pool = spectatorPools[wagerId];
        pool.totalPool += amount;
        if (predictedWinner == w.creator) {
            pool.pool1 += amount;
        } else {
            pool.pool2 += amount;
        }

        spectatorBets[wagerId].push(SpectatorBet({
            bettor: msg.sender,
            amount: amount,
            predictedWinner: predictedWinner,
            paid: false
        }));

        emit SpectatorBetPlaced(wagerId, msg.sender, predictedWinner, amount);
    }

    /**
     * @notice Internal: mark spectator pool as settled (called during claimWinnings).
     *         Individual spectators must call claimSpectatorWinnings() to withdraw.
     */
    function _markSpectatorBetsSettled(uint256 wagerId, address winner) internal {
        SpectatorPool storage pool = spectatorPools[wagerId];

        if (pool.totalPool == 0) {
            pool.settled = true;
            return;
        }

        pool.settled = true;

        emit SpectatorBetsSettled(wagerId, winner);
    }

    /**
     * @notice Claim spectator winnings (pull-payment pattern)
     */
    function claimSpectatorWinnings(uint256 wagerId) external nonReentrant {
        Wager storage w = wagers[wagerId];
        require(w.status == WagerStatus.Claimed, "Wager not claimed yet");

        SpectatorPool storage pool = spectatorPools[wagerId];
        require(pool.settled, "Spectator bets not settled");

        address winner = w.winner;
        uint256 totalPool = pool.totalPool;
        uint256 totalFee = (totalPool * SPECTATOR_FEE_BPS) / BPS_DENOMINATOR;
        uint256 distributablePool = totalPool - totalFee;

        uint256 winningPool;
        if (winner == w.creator) {
            winningPool = pool.pool1;
        } else {
            winningPool = pool.pool2;
        }

        SpectatorBet[] storage bets = spectatorBets[wagerId];
        uint256 totalPayout = 0;

        for (uint256 i = 0; i < bets.length; i++) {
            if (!bets[i].paid && bets[i].bettor == msg.sender) {
                bets[i].paid = true;

                if (winningPool == 0) {
                    // No one bet on the winner: refund proportionally minus fee
                    uint256 refundShare = (bets[i].amount * distributablePool) / totalPool;
                    totalPayout += refundShare;
                } else if (bets[i].predictedWinner == winner) {
                    // Winner gets proportional share
                    uint256 winnerShare = (bets[i].amount * distributablePool) / winningPool;
                    totalPayout += winnerShare;
                }
                // Losing bettors get nothing
            }
        }

        require(totalPayout > 0, "No winnings to claim");

        // Send fee to treasury on first claim (tracked via a simple approach: deduct from pool)
        // Fee is handled as part of distributablePool calculation above
        moltbucks.safeTransfer(msg.sender, totalPayout);

        emit SpectatorWinningsClaimed(wagerId, msg.sender, totalPayout);
    }

    // ============ Expired Wager Refund ============

    function refundExpiredWager(uint256 wagerId) external nonReentrant {
        Wager storage w = wagers[wagerId];
        require(w.status == WagerStatus.Open, "Wager not open");
        require(
            block.timestamp > w.createdAt + ACCEPT_TIMEOUT,
            "Wager not yet expired"
        );

        w.status = WagerStatus.Refunded;

        moltbucks.safeTransfer(w.creator, w.stakeAmount);

        emit WagerRefunded(wagerId);
    }

    /**
     * @notice Refund an expired locked wager that was never settled
     */
    function refundExpiredLockedWager(uint256 wagerId) external nonReentrant {
        Wager storage w = wagers[wagerId];
        require(
            w.status == WagerStatus.Locked || w.status == WagerStatus.Open,
            "Wager not active"
        );
        require(
            block.timestamp > w.createdAt + LOCKED_WAGER_TIMEOUT,
            "Wager not yet expired"
        );

        w.status = WagerStatus.Refunded;

        // Refund creator
        moltbucks.safeTransfer(w.creator, w.stakeAmount);

        // Refund acceptor if wager was locked
        if (w.acceptor != address(0)) {
            moltbucks.safeTransfer(w.acceptor, w.stakeAmount);
        }

        // Refund spectator bets
        SpectatorBet[] storage bets = spectatorBets[wagerId];
        for (uint256 i = 0; i < bets.length; i++) {
            if (!bets[i].paid) {
                bets[i].paid = true;
                moltbucks.safeTransfer(bets[i].bettor, bets[i].amount);
            }
        }

        emit LockedWagerRefunded(wagerId);
    }

    // ============ Spectator Bet Refunds (Admin) ============

    /**
     * @notice Refund all spectator bets for a disputed or cancelled wager
     */
    function refundSpectatorBets(uint256 wagerId) external onlyOwner nonReentrant {
        Wager storage w = wagers[wagerId];
        require(
            w.status == WagerStatus.Disputed || w.status == WagerStatus.Cancelled || w.status == WagerStatus.Refunded,
            "Wager must be disputed, cancelled, or refunded"
        );

        SpectatorPool storage pool = spectatorPools[wagerId];
        require(!pool.settled, "Spectator bets already settled");

        SpectatorBet[] storage bets = spectatorBets[wagerId];
        for (uint256 i = 0; i < bets.length; i++) {
            if (!bets[i].paid) {
                bets[i].paid = true;
                moltbucks.safeTransfer(bets[i].bettor, bets[i].amount);
            }
        }

        pool.settled = true;

        emit SpectatorBetsRefunded(wagerId);
    }

    // ============ Admin Functions ============

    function authorizeSettler(address settler) external onlyOwner {
        require(settler != address(0), "Invalid settler address");
        authorizedSettlers[settler] = true;
        emit SettlerAuthorized(settler);
    }

    function revokeSettler(address settler) external onlyOwner {
        authorizedSettlers[settler] = false;
        emit SettlerRevoked(settler);
    }

    function setMaxStake(uint256 newMax) external onlyOwner {
        require(newMax > 0, "Max stake must be positive");
        require(newMax >= minStake, "Max must be >= min");
        maxStakePerWager = newMax;
        emit MaxStakeUpdated(newMax);
    }

    function setMinStake(uint256 newMin) external onlyOwner {
        require(newMin > 0, "Min stake must be positive");
        require(newMin <= maxStakePerWager, "Min must be <= max");
        minStake = newMin;
        emit MinStakeUpdated(newMin);
    }

    // Treasury timelock: propose, confirm, cancel
    function proposeTreasuryChange(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        pendingTreasury = newTreasury;
        treasuryChangeTimestamp = block.timestamp;
        emit TreasuryChangeProposed(newTreasury, block.timestamp + TREASURY_TIMELOCK);
    }

    function confirmTreasuryChange() external onlyOwner {
        require(pendingTreasury != address(0), "No pending treasury change");
        require(block.timestamp >= treasuryChangeTimestamp + TREASURY_TIMELOCK, "Timelock not elapsed");
        address oldTreasury = treasury;
        treasury = pendingTreasury;
        pendingTreasury = address(0);
        treasuryChangeTimestamp = 0;
        emit TreasuryChangeConfirmed(oldTreasury, treasury);
    }

    function cancelTreasuryChange() external onlyOwner {
        require(pendingTreasury != address(0), "No pending treasury change");
        pendingTreasury = address(0);
        treasuryChangeTimestamp = 0;
        emit TreasuryChangeCancelled();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    function getSpectatorBetCount(uint256 wagerId) external view returns (uint256) {
        return spectatorBets[wagerId].length;
    }

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
