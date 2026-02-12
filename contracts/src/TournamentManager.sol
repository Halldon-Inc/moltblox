// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TournamentManager
 * @notice Manages Moltblox tournaments with auto-payout to winner wallets
 * @dev Supports platform-sponsored, creator-sponsored, and community tournaments
 */
contract TournamentManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // MBUCKS token
    IERC20 public immutable moltbucks;

    // Platform treasury (source of platform-sponsored prizes)
    address public treasury;

    // Tournament types
    enum TournamentType {
        PlatformSponsored,  // Funded by 15% platform fee
        CreatorSponsored,   // Funded by game creator
        CommunitySponsored  // Funded by community pool
    }

    // Tournament status
    enum TournamentStatus {
        Registration,  // Accepting participants
        Active,        // Tournament in progress
        Completed,     // Finished, prizes distributed
        Cancelled      // Cancelled, refunds issued
    }

    // Prize distribution preset
    struct PrizeDistribution {
        uint256 first;        // Percentage for 1st (default 50%)
        uint256 second;       // Percentage for 2nd (default 25%)
        uint256 third;        // Percentage for 3rd (default 15%)
        uint256 participation; // Percentage split among all others (default 10%)
    }

    // Tournament struct
    struct Tournament {
        string tournamentId;
        string gameId;
        address sponsor;           // Creator or platform
        TournamentType tournamentType;
        TournamentStatus status;

        uint256 prizePool;
        uint256 entryFee;          // 0 for free entry
        uint256 maxParticipants;
        uint256 currentParticipants;

        PrizeDistribution distribution;

        uint256 registrationStart;
        uint256 registrationEnd;
        uint256 startTime;

        address[] participants;
        address[] winners;         // [1st, 2nd, 3rd]
        bool prizesDistributed;
    }

    // Maximum participants cap to prevent unbounded loops
    uint256 public constant MAX_PARTICIPANTS_CAP = 256;

    // Storage
    mapping(string => Tournament) public tournaments;
    mapping(string => mapping(address => bool)) public isParticipant;
    mapping(string => uint256) public participantEntryFees; // Total fees collected
    mapping(string => uint256) public originalPrizePool; // SC1: Track sponsor's original deposit

    // Donation tracking for addToPrizePool refunds
    mapping(string => mapping(address => uint256)) public contributions;
    mapping(string => address[]) private contributorList;
    mapping(string => mapping(address => bool)) private isContributor;

    // Treasury timelock (2-step change)
    address public pendingTreasury;
    uint256 public treasuryChangeTime;

    // Emergency MBUCKS recovery (7-day timelock)
    uint256 public pendingRecoveryAmount;
    uint256 public recoveryProposalTime;
    bool public recoveryPending;

    // Commit-reveal for tournament completion
    struct ResultCommit {
        bytes32 resultHash;
        uint256 commitBlock;
    }
    mapping(string => ResultCommit) public resultCommits;

    // Events
    event TournamentCreated(
        string indexed tournamentId,
        string indexed gameId,
        address indexed sponsor,
        TournamentType tournamentType,
        uint256 prizePool,
        uint256 entryFee,
        uint256 maxParticipants
    );

    event ParticipantRegistered(
        string indexed tournamentId,
        address indexed participant,
        uint256 entryFee
    );

    event TournamentStarted(string indexed tournamentId, uint256 participantCount);

    event TournamentCompleted(
        string indexed tournamentId,
        address indexed first,
        address indexed second,
        address third
    );

    event PrizeDistributed(
        string indexed tournamentId,
        address indexed winner,
        uint256 place,
        uint256 amount
    );

    event ParticipationRewardDistributed(
        string indexed tournamentId,
        address indexed participant,
        uint256 amount
    );

    event TournamentCancelled(string indexed tournamentId, string reason);
    event RefundIssued(string indexed tournamentId, address indexed participant, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // Donation tracking events
    event PrizePoolContribution(string indexed tournamentId, address indexed donor, uint256 amount);
    event DonationRefunded(string indexed tournamentId, address indexed donor, uint256 amount);

    // Treasury timelock events
    event TreasuryChangeProposed(address indexed newTreasury, uint256 effectiveTime);
    event TreasuryChangeConfirmed(address indexed oldTreasury, address indexed newTreasury);

    // Emergency recovery events
    event RecoveryProposed(uint256 amount, uint256 effectiveTime);
    event RecoveryExecuted(uint256 amount);
    event RecoveryCancelled();

    // Commit-reveal events
    event ResultsCommitted(string indexed tournamentId, bytes32 resultHash, uint256 commitBlock);

    constructor(address _moltbucks, address _treasury) Ownable(msg.sender) {
        require(_moltbucks != address(0), "Invalid token address");
        require(_treasury != address(0), "Invalid treasury address");
        moltbucks = IERC20(_moltbucks);
        treasury = _treasury;
    }

    // ============ Tournament Creation ============

    /**
     * @notice Create a platform-sponsored tournament (admin only)
     * @param tournamentId Unique identifier
     * @param gameId The game being played
     * @param prizePool Total prize pool in MBUCKS
     * @param entryFee Entry fee (0 for free)
     * @param maxParticipants Maximum participants
     * @param registrationStart When registration opens
     * @param registrationEnd When registration closes
     * @param startTime When tournament starts
     */
    function createPlatformTournament(
        string calldata tournamentId,
        string calldata gameId,
        uint256 prizePool,
        uint256 entryFee,
        uint256 maxParticipants,
        uint256 registrationStart,
        uint256 registrationEnd,
        uint256 startTime
    ) external onlyOwner {
        _createTournament(
            tournamentId,
            gameId,
            treasury,
            TournamentType.PlatformSponsored,
            prizePool,
            entryFee,
            maxParticipants,
            registrationStart,
            registrationEnd,
            startTime
        );

        // Transfer prize pool from treasury
        moltbucks.safeTransferFrom(treasury, address(this), prizePool);
    }

    /**
     * @notice Create a creator-sponsored tournament
     * @param tournamentId Unique identifier
     * @param gameId The game being played (must be creator's game)
     * @param prizePool Total prize pool in MBUCKS (funded by creator)
     * @param entryFee Entry fee (0 for free)
     * @param maxParticipants Maximum participants
     * @param registrationStart When registration opens
     * @param registrationEnd When registration closes
     * @param startTime When tournament starts
     */
    function createCreatorTournament(
        string calldata tournamentId,
        string calldata gameId,
        uint256 prizePool,
        uint256 entryFee,
        uint256 maxParticipants,
        uint256 registrationStart,
        uint256 registrationEnd,
        uint256 startTime
    ) external {
        _createTournament(
            tournamentId,
            gameId,
            msg.sender,
            TournamentType.CreatorSponsored,
            prizePool,
            entryFee,
            maxParticipants,
            registrationStart,
            registrationEnd,
            startTime
        );

        // Transfer prize pool from creator
        moltbucks.safeTransferFrom(msg.sender, address(this), prizePool);
    }

    /**
     * @notice Create a community-sponsored tournament
     * @param tournamentId Unique identifier
     * @param gameId The game being played
     * @param prizePool Initial prize pool (can be added to by community)
     * @param entryFee Entry fee (added to prize pool)
     * @param maxParticipants Maximum participants
     * @param registrationStart When registration opens
     * @param registrationEnd When registration closes
     * @param startTime When tournament starts
     */
    function createCommunityTournament(
        string calldata tournamentId,
        string calldata gameId,
        uint256 prizePool,
        uint256 entryFee,
        uint256 maxParticipants,
        uint256 registrationStart,
        uint256 registrationEnd,
        uint256 startTime
    ) external {
        _createTournament(
            tournamentId,
            gameId,
            msg.sender,
            TournamentType.CommunitySponsored,
            prizePool,
            entryFee,
            maxParticipants,
            registrationStart,
            registrationEnd,
            startTime
        );

        // Transfer initial prize pool from creator
        if (prizePool > 0) {
            moltbucks.safeTransferFrom(msg.sender, address(this), prizePool);
        }
    }

    function _createTournament(
        string calldata tournamentId,
        string calldata gameId,
        address sponsor,
        TournamentType tournamentType,
        uint256 prizePool,
        uint256 entryFee,
        uint256 maxParticipants,
        uint256 registrationStart,
        uint256 registrationEnd,
        uint256 startTime
    ) internal {
        require(bytes(tournamentId).length > 0, "Invalid tournament ID");
        require(tournaments[tournamentId].sponsor == address(0), "Tournament exists");
        require(maxParticipants >= 2, "Need at least 2 participants");
        require(maxParticipants <= MAX_PARTICIPANTS_CAP, "Exceeds max participants cap");
        require(registrationStart < registrationEnd, "Invalid registration period");
        require(registrationEnd <= startTime, "Registration must end before start");

        // Default prize distribution: 50% / 25% / 15% / 10%
        PrizeDistribution memory distribution = PrizeDistribution({
            first: 50,
            second: 25,
            third: 15,
            participation: 10
        });

        Tournament storage t = tournaments[tournamentId];
        t.tournamentId = tournamentId;
        t.gameId = gameId;
        t.sponsor = sponsor;
        t.tournamentType = tournamentType;
        t.status = TournamentStatus.Registration;
        t.prizePool = prizePool;
        t.entryFee = entryFee;
        t.maxParticipants = maxParticipants;
        t.currentParticipants = 0;
        t.distribution = distribution;
        t.registrationStart = registrationStart;
        t.registrationEnd = registrationEnd;
        t.startTime = startTime;
        t.prizesDistributed = false;

        // SC1: Track original sponsor deposit separately for accurate cancel refunds
        originalPrizePool[tournamentId] = prizePool;

        emit TournamentCreated(
            tournamentId,
            gameId,
            sponsor,
            tournamentType,
            prizePool,
            entryFee,
            maxParticipants
        );
    }

    // ============ Custom Prize Distribution ============

    /**
     * @notice Set custom prize distribution (sponsor only)
     * @param tournamentId The tournament to update
     * @param first Percentage for 1st place
     * @param second Percentage for 2nd place
     * @param third Percentage for 3rd place
     * @param participation Percentage for all participants
     */
    function setDistribution(
        string calldata tournamentId,
        uint256 first,
        uint256 second,
        uint256 third,
        uint256 participation
    ) external {
        Tournament storage t = tournaments[tournamentId];
        require(t.sponsor == msg.sender || owner() == msg.sender, "Not authorized");
        require(t.status == TournamentStatus.Registration, "Cannot modify");
        require(first + second + third + participation == 100, "Must total 100%");

        t.distribution = PrizeDistribution({
            first: first,
            second: second,
            third: third,
            participation: participation
        });
    }

    // ============ Registration ============

    /**
     * @notice Register for a tournament
     * @param tournamentId The tournament to join
     */
    function register(string calldata tournamentId) external nonReentrant whenNotPaused {
        Tournament storage t = tournaments[tournamentId];

        require(t.status == TournamentStatus.Registration, "Not in registration");
        require(block.timestamp >= t.registrationStart, "Registration not open");
        require(block.timestamp <= t.registrationEnd, "Registration closed");
        require(t.currentParticipants < t.maxParticipants, "Tournament full");
        require(!isParticipant[tournamentId][msg.sender], "Already registered");

        // Collect entry fee if applicable
        if (t.entryFee > 0) {
            moltbucks.safeTransferFrom(msg.sender, address(this), t.entryFee);
            participantEntryFees[tournamentId] += t.entryFee;

            // For community tournaments, entry fees add to prize pool
            if (t.tournamentType == TournamentType.CommunitySponsored) {
                t.prizePool += t.entryFee;
            }
        }

        t.participants.push(msg.sender);
        t.currentParticipants++;
        isParticipant[tournamentId][msg.sender] = true;

        emit ParticipantRegistered(tournamentId, msg.sender, t.entryFee);
    }

    // ============ Tournament Lifecycle ============

    /**
     * @notice Start a tournament (auto-called or admin)
     * @param tournamentId The tournament to start
     */
    function startTournament(string calldata tournamentId) external whenNotPaused {
        Tournament storage t = tournaments[tournamentId];
        require(
            t.sponsor == msg.sender || owner() == msg.sender,
            "Not authorized"
        );
        require(t.status == TournamentStatus.Registration, "Invalid status");
        require(block.timestamp >= t.startTime, "Not start time yet");
        require(t.currentParticipants >= 2, "Not enough participants");

        t.status = TournamentStatus.Active;

        emit TournamentStarted(tournamentId, t.currentParticipants);
    }

    /**
     * @notice Complete tournament and distribute prizes
     * @dev Auto-sends prizes to winner wallets. Supports 2, 3, or 4+ player tournaments.
     *      For 2 players: pass winners as [first, second, address(0)]
     *      For 3 players: pass winners as [first, second, third]
     *      For 4+ players: pass winners as [first, second, third] with participation rewards
     * @param tournamentId The tournament to complete
     * @param first Address of 1st place winner
     * @param second Address of 2nd place winner
     * @param third Address of 3rd place winner (address(0) for 2-player tournaments)
     */
    function completeTournament(
        string calldata tournamentId,
        address first,
        address second,
        address third
    ) external nonReentrant whenNotPaused {
        _distributePrizes(tournamentId, first, second, third);
    }

    /**
     * @notice Cancel a tournament and refund entry fees
     * @param tournamentId The tournament to cancel
     * @param reason Reason for cancellation
     */
    function cancelTournament(string calldata tournamentId, string calldata reason) external nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        require(
            t.sponsor == msg.sender || owner() == msg.sender,
            "Not authorized"
        );
        require(
            t.status == TournamentStatus.Registration || t.status == TournamentStatus.Active,
            "Cannot cancel"
        );

        t.status = TournamentStatus.Cancelled;

        // Refund entry fees to all participants
        if (t.entryFee > 0) {
            for (uint256 i = 0; i < t.participants.length; i++) {
                address participant = t.participants[i];
                moltbucks.safeTransfer(participant, t.entryFee);
                emit RefundIssued(tournamentId, participant, t.entryFee);
            }
        }

        // SC1: Return original sponsor deposit (tracked separately to prevent double-counting)
        uint256 sponsorRefund = originalPrizePool[tournamentId];
        if (sponsorRefund > 0) {
            moltbucks.safeTransfer(t.sponsor, sponsorRefund);
        }

        // Refund third-party donations
        address[] storage donors = contributorList[tournamentId];
        for (uint256 i = 0; i < donors.length; i++) {
            address donor = donors[i];
            uint256 donorAmount = contributions[tournamentId][donor];
            if (donorAmount > 0) {
                contributions[tournamentId][donor] = 0;
                moltbucks.safeTransfer(donor, donorAmount);
                emit DonationRefunded(tournamentId, donor, donorAmount);
            }
        }

        emit TournamentCancelled(tournamentId, reason);
    }

    // ============ View Functions ============

    function getTournament(string calldata tournamentId) external view returns (
        string memory gameId,
        address sponsor,
        TournamentType tournamentType,
        TournamentStatus status,
        uint256 prizePool,
        uint256 entryFee,
        uint256 maxParticipants,
        uint256 currentParticipants,
        uint256 startTime
    ) {
        Tournament storage t = tournaments[tournamentId];
        return (
            t.gameId,
            t.sponsor,
            t.tournamentType,
            t.status,
            t.prizePool,
            t.entryFee,
            t.maxParticipants,
            t.currentParticipants,
            t.startTime
        );
    }

    function getParticipants(string calldata tournamentId) external view returns (address[] memory) {
        return tournaments[tournamentId].participants;
    }

    function getWinners(string calldata tournamentId) external view returns (address[] memory) {
        return tournaments[tournamentId].winners;
    }

    function getDistribution(string calldata tournamentId) external view returns (
        uint256 first,
        uint256 second,
        uint256 third,
        uint256 participation
    ) {
        PrizeDistribution storage d = tournaments[tournamentId].distribution;
        return (d.first, d.second, d.third, d.participation);
    }

    // ============ Admin Functions ============

    function setTreasury(address _treasury) external onlyOwner {
        proposeTreasury(_treasury);
    }

    function proposeTreasury(address _newTreasury) public onlyOwner {
        require(_newTreasury != address(0), "Invalid treasury address");
        pendingTreasury = _newTreasury;
        treasuryChangeTime = block.timestamp;
        emit TreasuryChangeProposed(_newTreasury, block.timestamp + 24 hours);
    }

    function confirmTreasury() external onlyOwner {
        require(pendingTreasury != address(0), "No pending treasury change");
        require(block.timestamp >= treasuryChangeTime + 24 hours, "Timelock not elapsed");
        address oldTreasury = treasury;
        treasury = pendingTreasury;
        pendingTreasury = address(0);
        treasuryChangeTime = 0;
        emit TreasuryChangeConfirmed(oldTreasury, treasury);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Add to prize pool (for community sponsorship)
     * @param tournamentId The tournament to sponsor
     * @param amount Amount of MBUCKS to add
     */
    function addToPrizePool(string calldata tournamentId, uint256 amount) external whenNotPaused {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Registration, "Cannot add to pool");
        require(amount > 0, "Amount must be positive");

        moltbucks.safeTransferFrom(msg.sender, address(this), amount);
        t.prizePool += amount;

        // Track contribution for refund on cancel
        contributions[tournamentId][msg.sender] += amount;
        if (!isContributor[tournamentId][msg.sender]) {
            contributorList[tournamentId].push(msg.sender);
            isContributor[tournamentId][msg.sender] = true;
        }

        emit PrizePoolContribution(tournamentId, msg.sender, amount);
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

    // ============ Emergency MBUCKS Recovery (7-day timelock) ============

    function proposeRecovery(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be positive");
        pendingRecoveryAmount = amount;
        recoveryProposalTime = block.timestamp;
        recoveryPending = true;
        emit RecoveryProposed(amount, block.timestamp + 7 days);
    }

    function executeRecovery() external onlyOwner {
        require(recoveryPending, "No pending recovery");
        require(block.timestamp >= recoveryProposalTime + 7 days, "Recovery timelock not elapsed");
        uint256 amount = pendingRecoveryAmount;
        pendingRecoveryAmount = 0;
        recoveryProposalTime = 0;
        recoveryPending = false;
        moltbucks.safeTransfer(owner(), amount);
        emit RecoveryExecuted(amount);
    }

    function cancelRecovery() external onlyOwner {
        require(recoveryPending, "No pending recovery");
        pendingRecoveryAmount = 0;
        recoveryProposalTime = 0;
        recoveryPending = false;
        emit RecoveryCancelled();
    }

    // ============ Commit-Reveal for Tournament Completion ============

    function commitResults(string calldata tournamentId, bytes32 resultHash) external {
        Tournament storage t = tournaments[tournamentId];
        require(
            t.sponsor == msg.sender || owner() == msg.sender,
            "Not authorized"
        );
        require(t.status == TournamentStatus.Active, "Not active");
        require(resultCommits[tournamentId].commitBlock == 0, "Already committed");

        resultCommits[tournamentId] = ResultCommit({
            resultHash: resultHash,
            commitBlock: block.number
        });

        emit ResultsCommitted(tournamentId, resultHash, block.number);
    }

    function revealResults(
        string calldata tournamentId,
        address first,
        address second,
        address third,
        bytes32 salt
    ) external nonReentrant whenNotPaused {
        ResultCommit storage commit = resultCommits[tournamentId];
        require(commit.commitBlock > 0, "No committed results");
        require(block.number > commit.commitBlock, "Must wait at least one block");

        bytes32 expectedHash = keccak256(abi.encodePacked(tournamentId, first, second, third, salt));
        require(expectedHash == commit.resultHash, "Hash mismatch");

        // Clear commit
        commit.resultHash = bytes32(0);
        commit.commitBlock = 0;

        // Proceed with existing prize distribution logic
        _distributePrizes(tournamentId, first, second, third);
    }

    function _distributePrizes(
        string calldata tournamentId,
        address first,
        address second,
        address third
    ) internal {
        Tournament storage t = tournaments[tournamentId];
        require(
            t.sponsor == msg.sender || owner() == msg.sender,
            "Not authorized"
        );
        require(t.status == TournamentStatus.Active, "Not active");
        require(!t.prizesDistributed, "Already distributed");

        // Verify winners are participants
        require(isParticipant[tournamentId][first], "1st not participant");
        require(isParticipant[tournamentId][second], "2nd not participant");

        // Add entry fees to the total pool for non-community tournaments
        uint256 totalPool = t.prizePool;
        uint256 collectedFees = participantEntryFees[tournamentId];
        if (t.tournamentType != TournamentType.CommunitySponsored && collectedFees > 0) {
            totalPool += collectedFees;
        }

        uint256 numParticipants = t.currentParticipants;

        if (numParticipants == 2) {
            require(third == address(0), "Use address(0) for 3rd in 2-player tournament");
            require(first != second, "Duplicate winner");

            t.winners = new address[](2);
            t.winners[0] = first;
            t.winners[1] = second;
            t.status = TournamentStatus.Completed;

            uint256 firstPrize = (totalPool * 70) / 100;
            uint256 secondPrize = totalPool - firstPrize;

            moltbucks.safeTransfer(first, firstPrize);
            emit PrizeDistributed(tournamentId, first, 1, firstPrize);

            moltbucks.safeTransfer(second, secondPrize);
            emit PrizeDistributed(tournamentId, second, 2, secondPrize);

        } else if (numParticipants == 3) {
            require(third != address(0), "3rd cannot be zero address");
            require(first != second && first != third && second != third, "Duplicate winner");
            require(isParticipant[tournamentId][third], "3rd not participant");

            t.winners = new address[](3);
            t.winners[0] = first;
            t.winners[1] = second;
            t.winners[2] = third;
            t.status = TournamentStatus.Completed;

            uint256 firstPrize = (totalPool * t.distribution.first) / (100 - t.distribution.participation);
            uint256 secondPrize = (totalPool * t.distribution.second) / (100 - t.distribution.participation);
            uint256 thirdPrize = totalPool - firstPrize - secondPrize;

            moltbucks.safeTransfer(first, firstPrize);
            emit PrizeDistributed(tournamentId, first, 1, firstPrize);

            moltbucks.safeTransfer(second, secondPrize);
            emit PrizeDistributed(tournamentId, second, 2, secondPrize);

            moltbucks.safeTransfer(third, thirdPrize);
            emit PrizeDistributed(tournamentId, third, 3, thirdPrize);

        } else {
            require(third != address(0), "3rd cannot be zero address");
            require(first != second && first != third && second != third, "Duplicate winner");
            require(isParticipant[tournamentId][third], "3rd not participant");

            t.winners = new address[](3);
            t.winners[0] = first;
            t.winners[1] = second;
            t.winners[2] = third;
            t.status = TournamentStatus.Completed;

            uint256 firstPrize = (totalPool * t.distribution.first) / 100;
            uint256 secondPrize = (totalPool * t.distribution.second) / 100;
            uint256 thirdPrize = (totalPool * t.distribution.third) / 100;
            uint256 participationPool = totalPool - firstPrize - secondPrize - thirdPrize;

            moltbucks.safeTransfer(first, firstPrize);
            emit PrizeDistributed(tournamentId, first, 1, firstPrize);

            moltbucks.safeTransfer(second, secondPrize);
            emit PrizeDistributed(tournamentId, second, 2, secondPrize);

            moltbucks.safeTransfer(third, thirdPrize);
            emit PrizeDistributed(tournamentId, third, 3, thirdPrize);

            uint256 nonWinnerCount = numParticipants - 3;
            if (nonWinnerCount > 0 && participationPool > 0) {
                uint256 participationReward = participationPool / nonWinnerCount;

                for (uint256 i = 0; i < t.participants.length; i++) {
                    address participant = t.participants[i];
                    if (participant != first && participant != second && participant != third) {
                        moltbucks.safeTransfer(participant, participationReward);
                        emit ParticipationRewardDistributed(tournamentId, participant, participationReward);
                    }
                }

                uint256 remaining = participationPool - (participationReward * nonWinnerCount);
                if (remaining > 0) {
                    moltbucks.safeTransfer(first, remaining);
                }
            }
        }

        t.prizesDistributed = true;

        emit TournamentCompleted(tournamentId, first, second, third);
    }
}
