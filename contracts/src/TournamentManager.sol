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

    // Maximum contributors cap to prevent unbounded loops in cancel refunds
    uint256 public constant MAX_CONTRIBUTORS_CAP = 256;

    // Storage
    mapping(string => Tournament) public tournaments;
    mapping(string => mapping(address => bool)) public isParticipant;
    mapping(string => uint256) public participantEntryFees; // Total fees collected
    mapping(string => uint256) public originalPrizePool; // SC1: Track sponsor's original deposit

    // Donation tracking for addToPrizePool refunds
    mapping(string => mapping(address => uint256)) public contributions;
    mapping(string => address[]) private contributorList;
    mapping(string => mapping(address => bool)) private isContributor;

    // Pull-payment refund tracking for cancelled tournaments
    mapping(string => mapping(address => uint256)) public cancelRefunds;
    mapping(string => mapping(address => uint256)) public donationRefunds;

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

    event ParticipantDeregistered(
        string indexed tournamentId,
        address indexed participant,
        uint256 refundAmount
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
    event CancelRefundClaimed(string indexed tournamentId, address indexed participant, uint256 amount);
    event DonationRefundClaimed(string indexed tournamentId, address indexed donor, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // Donation tracking events
    event PrizePoolContribution(string indexed tournamentId, address indexed donor, uint256 amount);
    event DonationRefunded(string indexed tournamentId, address indexed donor, uint256 amount);

    // Treasury timelock events
    event TreasuryChangeProposed(address indexed newTreasury, uint256 effectiveTime);
    event TreasuryChangeConfirmed(address indexed oldTreasury, address indexed newTreasury);
    event TreasuryChangeCancelled();

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

        moltbucks.safeTransferFrom(treasury, address(this), prizePool);
    }

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

        moltbucks.safeTransferFrom(msg.sender, address(this), prizePool);
    }

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
        require(first > 0, "First must be > 0");
        require(second > 0, "Second must be > 0");
        require(third > 0, "Third must be > 0");

        t.distribution = PrizeDistribution({
            first: first,
            second: second,
            third: third,
            participation: participation
        });
    }

    // ============ Registration ============

    function register(string calldata tournamentId) external nonReentrant whenNotPaused {
        Tournament storage t = tournaments[tournamentId];

        require(t.status == TournamentStatus.Registration, "Not in registration");
        require(block.timestamp >= t.registrationStart, "Registration not open");
        require(block.timestamp <= t.registrationEnd, "Registration closed");
        require(t.currentParticipants < t.maxParticipants, "Tournament full");
        require(!isParticipant[tournamentId][msg.sender], "Already registered");

        if (t.entryFee > 0) {
            moltbucks.safeTransferFrom(msg.sender, address(this), t.entryFee);
            participantEntryFees[tournamentId] += t.entryFee;

            if (t.tournamentType == TournamentType.CommunitySponsored) {
                t.prizePool += t.entryFee;
            }
        }

        t.participants.push(msg.sender);
        t.currentParticipants++;
        isParticipant[tournamentId][msg.sender] = true;

        emit ParticipantRegistered(tournamentId, msg.sender, t.entryFee);
    }

    /**
     * @notice Deregister from a tournament before registrationEnd with entry fee refund
     */
    function deregister(string calldata tournamentId) external nonReentrant {
        Tournament storage t = tournaments[tournamentId];

        require(t.status == TournamentStatus.Registration, "Not in registration");
        require(block.timestamp <= t.registrationEnd, "Registration closed");
        require(isParticipant[tournamentId][msg.sender], "Not registered");

        isParticipant[tournamentId][msg.sender] = false;
        t.currentParticipants--;

        // Remove participant from array (swap and pop)
        for (uint256 i = 0; i < t.participants.length; i++) {
            if (t.participants[i] == msg.sender) {
                t.participants[i] = t.participants[t.participants.length - 1];
                t.participants.pop();
                break;
            }
        }

        uint256 refundAmount = 0;
        if (t.entryFee > 0) {
            participantEntryFees[tournamentId] -= t.entryFee;
            refundAmount = t.entryFee;

            if (t.tournamentType == TournamentType.CommunitySponsored) {
                t.prizePool -= t.entryFee;
            }

            moltbucks.safeTransfer(msg.sender, t.entryFee);
        }

        emit ParticipantDeregistered(tournamentId, msg.sender, refundAmount);
    }

    // ============ Tournament Lifecycle ============

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

    function completeTournament(
        string calldata tournamentId,
        address first,
        address second,
        address third
    ) external nonReentrant whenNotPaused {
        _distributePrizes(tournamentId, first, second, third);
    }

    /**
     * @notice Cancel a tournament. Sets status and refunds sponsor directly.
     *         Participants claim refunds via claimCancelRefund().
     *         Donors claim refunds via claimDonationRefund().
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

        // Record refund amounts for pull-payment (participants)
        if (t.entryFee > 0) {
            for (uint256 i = 0; i < t.participants.length; i++) {
                address participant = t.participants[i];
                cancelRefunds[tournamentId][participant] = t.entryFee;
                emit RefundIssued(tournamentId, participant, t.entryFee);
            }
        }

        // Refund sponsor directly (single trusted address)
        uint256 sponsorRefund = originalPrizePool[tournamentId];
        if (sponsorRefund > 0) {
            moltbucks.safeTransfer(t.sponsor, sponsorRefund);
        }

        // Record donation refund amounts for pull-payment
        address[] storage donors = contributorList[tournamentId];
        for (uint256 i = 0; i < donors.length; i++) {
            address donor = donors[i];
            uint256 donorAmount = contributions[tournamentId][donor];
            if (donorAmount > 0) {
                donationRefunds[tournamentId][donor] = donorAmount;
                contributions[tournamentId][donor] = 0;
                emit DonationRefunded(tournamentId, donor, donorAmount);
            }
        }

        emit TournamentCancelled(tournamentId, reason);
    }

    /**
     * @notice Claim entry fee refund for a cancelled tournament (pull-payment)
     */
    function claimCancelRefund(string calldata tournamentId) external nonReentrant {
        uint256 refundAmount = cancelRefunds[tournamentId][msg.sender];
        require(refundAmount > 0, "No refund available");

        cancelRefunds[tournamentId][msg.sender] = 0;
        moltbucks.safeTransfer(msg.sender, refundAmount);

        emit CancelRefundClaimed(tournamentId, msg.sender, refundAmount);
    }

    /**
     * @notice Claim donation refund for a cancelled tournament (pull-payment)
     */
    function claimDonationRefund(string calldata tournamentId) external nonReentrant {
        uint256 refundAmount = donationRefunds[tournamentId][msg.sender];
        require(refundAmount > 0, "No donation refund available");

        donationRefunds[tournamentId][msg.sender] = 0;
        moltbucks.safeTransfer(msg.sender, refundAmount);

        emit DonationRefundClaimed(tournamentId, msg.sender, refundAmount);
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

    function cancelTreasuryChange() external onlyOwner {
        require(pendingTreasury != address(0), "No pending treasury change");
        pendingTreasury = address(0);
        treasuryChangeTime = 0;
        emit TreasuryChangeCancelled();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Add to prize pool (for community-sponsored tournaments only)
     */
    function addToPrizePool(string calldata tournamentId, uint256 amount) external whenNotPaused {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Registration, "Cannot add to pool");
        require(amount > 0, "Amount must be positive");
        require(t.tournamentType == TournamentType.CommunitySponsored, "Only community-sponsored tournaments");

        moltbucks.safeTransferFrom(msg.sender, address(this), amount);
        t.prizePool += amount;

        contributions[tournamentId][msg.sender] += amount;
        if (!isContributor[tournamentId][msg.sender]) {
            require(contributorList[tournamentId].length < MAX_CONTRIBUTORS_CAP, "Max contributors reached");
            contributorList[tournamentId].push(msg.sender);
            isContributor[tournamentId][msg.sender] = true;
        }

        emit PrizePoolContribution(tournamentId, msg.sender, amount);
    }

    /**
     * @notice SC3: Recover accidentally sent ERC20 tokens (not MBUCKS)
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

    function commitResults(string calldata tournamentId, bytes32 resultHash) external whenNotPaused {
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

        // H3-TM: If commit hash exists, require the reveal path
        ResultCommit storage commit = resultCommits[tournamentId];
        require(commit.commitBlock == 0, "Must use reveal path");

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

            // L3: Use configured distribution instead of hardcoded 70/30
            uint256 firstPct = t.distribution.first;
            uint256 secondPct = t.distribution.second;
            // Rescale to total 100% (exclude third and participation)
            uint256 totalPct = firstPct + secondPct;
            uint256 firstPrize = (totalPool * firstPct) / totalPct;
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

            // H4: Fix 3-participant math: use /100 not /(100 - participation)
            uint256 firstPrize = (totalPool * t.distribution.first) / 100;
            uint256 secondPrize = (totalPool * t.distribution.second) / 100;
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
