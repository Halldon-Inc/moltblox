# Moltblox Rewards, Points & Airdrop System: Research Document

> Research compiled 2026-02-18 for MBucks tokenomics design.
> Covers proven systems, bot-friendly design, scoring formulas, dopamine UI patterns, and anti-abuse mechanics.

---

## Table of Contents

1. [Blast Points + Gold System](#1-blast-points--gold-system)
2. [Blur Airdrop (Seasons)](#2-blur-airdrop-seasons)
3. [Jupiter Airdrop](#3-jupiter-airdrop)
4. [Hyperliquid Points](#4-hyperliquid-points)
5. [Other Notable Systems](#5-other-notable-systems)
6. [Bot-Friendly Airdrop Design](#6-bot-friendly-airdrop-design-unique-to-moltblox)
7. [Reward Categories for Moltblox](#7-reward-categories-for-moltblox)
8. [Dopamine UI Patterns](#8-dopamine-ui-patterns)
9. [Anti-Gaming Measures (While Staying Bot-Friendly)](#9-anti-gaming-measures-while-staying-bot-friendly)
10. [Synthesis: Recommended Architecture](#10-synthesis-recommended-architecture)

---

## 1. Blast Points + Gold System

**What it was:** Blast is an Ethereum L2 with native yield. It ran a dual-point system: Blast Points (for individual users) and Blast Gold (for DApps).

### How the Dual-Point System Worked

| Layer            | Mechanism                                                          | Target           |
| ---------------- | ------------------------------------------------------------------ | ---------------- |
| **Blast Points** | Auto-accrued every block based on ETH/WETH/USDB balance on Blast   | Individual users |
| **Blast Gold**   | Manually distributed by Blast incentives committee every 2-3 weeks | DApp developers  |

**Points** rewarded passive holding: wallets earned points automatically based on their balance, growing over time due to Blast's native yield (~4% for ETH/WETH, ~5% for USDB). Additional points came from bridging assets to Blast and referrals.

**Gold** rewarded active building: the Blast Foundation assessed DApps on category, Blast nativeness, traction/execution, and incentive design. DApps received a pro-rata share of monthly Gold allocation based on a composite score. A critical rule: DApps had to redistribute 100% of their Gold to their users by month-end to remain eligible for next month's Gold.

### Distribution

Phase 1 (June 26, 2024): 17 billion tokens total.

- 7 billion to Blast Points holders (50%)
- 7 billion to Blast Gold holders (50%)
- 3 billion to Blur Foundation (retroactive/future)

Phase 2: 10 billion BLAST tokens over 12 months (shortened to 7 months, prorated to 5 billion).

### Referral Bonuses

- 16% bonus on Gold earned by direct invites
- 8% bonus on Gold earned by invite's invites (two-tier)

### What Worked

- **Dual incentive alignment**: Holders AND builders both earned, creating a two-sided flywheel
- **DApp redistribution requirement**: Forced Gold to flow to end users, preventing DApp hoarding
- **Auto-accrual**: Zero friction; just hold assets and points accumulate
- **Meritocratic Gold**: Manual committee review meant quality DApps got more Gold

### What Did Not Work

- Manual Gold distribution was opaque and felt centralized
- Points heavily favored whales (more capital = more points, linear relationship)
- Short Phase 2 timeline disappointed users expecting 12 months of farming

### Moltblox Takeaway

The dual-layer design (passive holding + active contribution) is powerful. Moltblox can adapt this: Holder Score (passive, auto-accruing) + Builder/Player Score (active, merit-based). The DApp redistribution rule maps directly to "game builders must pass rewards to players."

---

## 2. Blur Airdrop (Seasons)

**What it was:** Blur is an NFT marketplace that used season-based airdrop campaigns with "Care Packages" to dominate OpenSea.

### Season Structure

| Season   | Timeline            | Key Innovation                                     |
| -------- | ------------------- | -------------------------------------------------- |
| Season 1 | Oct 2022 - Feb 2023 | 3 sub-airdrops, Care Packages, loyalty system      |
| Season 2 | Feb 2023 - Nov 2023 | 300M+ BLUR, bidding/listing points, Blend lending  |
| Season 3 | Nov 2023 - May 2024 | Powered by Blast L2, Holder Points with multiplier |

### Care Package Mechanics (Mystery/Reveal)

Users earned "Care Packages" of varying rarity: Uncommon, Rare, Legendary, and Mythical. The packages could NOT be opened until the $BLUR token launched. This created massive anticipation: users farmed points knowing they had mystery rewards waiting, but not knowing their value.

Mythical Care Packages were worth 100x an Uncommon package. Users with 100% loyalty (exclusively listing on Blur, not competitors) had the highest chance of receiving Mythical packages.

### Bidding Points: Risk-Weighted Rewards

The genius of Blur's system was risk-weighted point allocation:

- Bids closer to the floor price earned MORE points (higher risk of being filled)
- The longer a bid remained active, the more points it accrued
- When a bid was accepted, it stopped earning points
- This created real liquidity: users placed genuine bids near floor to farm points

### Listing Points

- Listing points = number of listings x loyalty multiplier
- Listing blue chip and high-activity collections earned more
- Listing at competitive prices (near floor) earned more than high-priced listings

### Loyalty System

100% loyalty (only using Blur, not OpenSea) unlocked maximum Care Package rarity. This was controversial but devastatingly effective at capturing market share from OpenSea.

### Season 3 Multiplier Mechanic

- Deposit $BLUR to earn Holder Points every hour
- Multiplier starts at 1x, increases by 0.5x per month
- Season 2 winners started at 2x (loyalty reward)
- Withdrawals proportionally decrease the multiplier
- This created powerful lock-up incentives without formal vesting

### What Made It Addictive

1. **Mystery/reveal**: Care Packages were the original "loot box" for DeFi
2. **Rarity tiers**: Mythical = 100x Uncommon created whale dreams
3. **Loyalty exclusivity**: Brutal but effective at retention
4. **Risk = reward**: Higher-risk bids earned more, creating genuine market activity
5. **Escalating multipliers**: "Number goes up" over time, penalized exits

### Market Impact

- Onboarded ~150,000 active traders in 4 months
- $1.2 billion in NFT trades during Season 1 alone
- Overtook OpenSea in volume (February 2023)
- BLUR surged 133% after Season 2 airdrop

### Moltblox Takeaway

Care Packages map perfectly to "mystery reward boxes" for game completion. Risk-weighted scoring maps to "building popular games" (higher risk = more creative games). The monthly multiplier system is ideal for MBUCKS holder retention. Loyalty system could reward platform-exclusive game builders.

---

## 3. Jupiter Airdrop

**What it was:** Jupiter is Solana's leading DEX aggregator. Its annual "Jupuary" airdrops became one of the most anticipated events in crypto.

### Distribution Model

**Jupuary 2024 (Round 1):**

- 1 billion JUP to 955,000 wallets
- Price hit ATH of $2.04
- Retrospective: rewarded past users based on historical usage

**Jupuary 2025 (Round 2):**

- 700 million JUP (500M fixed + 200M variable)
- Volume-based tiers with clear thresholds

### Volume-Based Tier System

| Tier | JUP Allocated | Wallets | Per Wallet | Volume Required |
| ---- | ------------- | ------- | ---------- | --------------- |
| 1    | 20M           | 1,000   | 20,000 JUP | ~$14M           |
| 2    | 50M           | 5,000   | 10,000 JUP | ~$3M            |
| 3    | 75M           | 25,000  | 3,000 JUP  | ~$500K          |
| 4    | 100M          | 400,000 | 250 JUP    | ~$29K           |
| 5    | 95M           | 1.9M    | 50 JUP     | ~$800           |

### Swap Score Mechanics

- Only transactions over $5 counted
- Stablecoin-to-stablecoin swaps scored lower (discouraged farming)
- 8+ months of activity earned a consistency bonus (25-500 JUP)
- Expert traders (limit orders, perps, DCA) got a separate 85M allocation across 7 tiers

### Anti-Sybil Measures

- On-chain activity analysis
- Fee-paying behavior filtering
- Profile submission system
- Bot transaction and junk volume filtering

### Community Reception

Mixed. Users praised the transparency and tiered system but criticized the large gaps between tiers ($29K to $500K jump from Tier 4 to 3). Perps users felt undervalued since they generated actual protocol revenue through fees, while swaps were free.

### Moltblox Takeaway

The tiered system with clear thresholds is excellent for gamification ("reach Tier 3 for 12x rewards!"). The consistency bonus (8+ months) directly maps to streak mechanics. Penalizing low-effort activity (stablecoin swaps) maps to penalizing low-quality game building. Expert tier for advanced users maps to "Power Builder" or "Game Designer" tiers.

---

## 4. Hyperliquid Points

**What it was:** Hyperliquid is a perpetual futures DEX that ran arguably the most successful airdrop in crypto history, distributing 310M HYPE tokens (31% of supply) to 94,000 users.

### Season Structure

| Season       | Period              | Points/Week  | Key Feature           |
| ------------ | ------------------- | ------------ | --------------------- |
| Closed Alpha | Pre-Oct 2023        | 446M credits | Early tester rewards  |
| Season 1     | Nov 2023 - May 2024 | 1M/week      | Perps trading only    |
| Season 1.5   | May 1-28, 2024      | 2M/week (2x) | Bridge bonus          |
| Season 2     | May 29 - Nov 2024   | 700K/week    | Spot + holdings added |

### How Points Were Earned

**Season 1:** Only perpetual futures trading earned points. This naturally favored whales and market makers. Distributions were weekly (ending Wednesday 00:00 UTC, distributed Friday). 1:5 affiliate matching system.

**Season 2:** Expanded to include spot trading AND holding assets (like PURR token). This was a game-changer: the spot market lacked deep liquidity, putting retail and whales on more equal footing.

### Anti-Whale Mechanics

- Total point supply was NOT disclosed upfront (prevented calculation of exact token value)
- Wash trading was penalized
- Limited total points maintained scarcity and prevented overfarming
- Behavioral metrics beyond pure volume were used (undisclosed formula)

### Why It Was the Most Successful Airdrop

1. **No external funding**: Hyperliquid had zero VC investment, so there was no investor unlock pressure
2. **31% to community**: Massive allocation relative to other projects
3. **Product-first**: The platform was genuinely the best perps DEX, not just a farm target
4. **HYPE rose 500%+ post-airdrop**: Token performed exceptionally because real users held
5. **70% market share**: In perpetual futures trading, proving product-market fit

### Platform Stats

- 10,000+ trades daily
- 90,000+ active users
- $470M daily trading volume
- ~$1 trillion cumulative volume
- $12.8M weekly protocol revenue (surpassed Ethereum)

### Moltblox Takeaway

The undisclosed formula approach prevents gaming. Expanding from one activity (trading) to multiple (trading + holding) in Season 2 mirrors Moltblox's need to reward multiple behaviors. The "no VC" narrative created genuine community ownership. Points distributed weekly with transparent schedules create anticipation cycles.

---

## 5. Other Notable Systems

### 5a. EigenLayer Restaking Points

**Mechanism:** Points = time-integrated amount staked (ETH x hours). Example: 1 stETH for 10 days = 240 restaking points.

**Distribution:** 15% of EIGEN tokens via "Stakedrop," released in seasons. Season 1 was only 5% of total supply.

**Controversy:**

- Tokens were initially non-transferable (couldn't sell)
- US and Canada users were excluded without advance warning
- Third-party liquid restaking points were excluded from Season 1
- Community backlash forced additional allocations

**Takeaway for Moltblox:** Time-weighted holding (ETH x hours) is an elegant formula. However, non-transferable tokens and geographic restrictions cause severe backlash. Be transparent about what counts and what doesn't.

### 5b. LayerZero Eligibility Criteria

**Key Innovation:** Three-layer anti-Sybil approach:

1. **Self-reporting grace period**: Sybil accounts that self-reported within 14 days kept 15% of allocation
2. **Bounty hunter program**: Community members could report Sybil accounts for rewards
3. **Low-value transaction penalties**: Transactions below threshold penalized up to 80%

**Scale:** Of 6 million wallets, ~1 million were Sybil. Only 400,000-800,000 truly participated. 10M ZRO reclaimed from flagged wallets.

**Distribution:** Min 25 ZRO, max 5,000 ZRO per wallet, weighted by protocol fees paid.

**Takeaway for Moltblox:** Self-reporting mechanics could work as "declare bot status" for transparency. Fee-weighted distribution maps to "MBUCKS spent in-game." The bounty hunter model is interesting but adversarial; Moltblox's bot-welcoming approach should use quality metrics instead.

### 5c. StarkNet Provisions

**Key Innovation:** Broadest eligibility criteria of any airdrop:

- Starknet users (5+ transactions in 3 months, $100+ volume, 0.005 ETH minimum)
- StarkEx users (8+ interactions with ImmutableX, dYdX)
- Ethereum stakers (pre-Merge PoS participants)
- Protocol Guild members
- Open-source developers (3+ commits since Jan 2018)
- Non-Web3 developers (first airdrop to include them)

**Scale:** 700M STRK to 1.3M addresses (7% of supply). Starknet users received 87% of claimed tokens.

**Takeaway for Moltblox:** Including non-Web3 developers was groundbreaking. Moltblox could similarly reward AI model developers who build game-creating bots, not just on-chain participants.

### 5d. Pendle vePENDLE Boost

**Mechanism:** Lock PENDLE for up to 2 years to receive vePENDLE. Longer lock = more vePENDLE. Value decays toward maturity.

**Benefits:**

- LP reward boost up to 2.5x (250%)
- 80% of swap fees from voted pools
- 3% of all tokenized yields
- Governance voting on pool emissions

**The "Curve Wars" Dynamic:** Protocols bribe vePENDLE holders to direct liquidity. Ethena spent millions incentivizing sUSDe pool votes.

**Takeaway for Moltblox:** The boost multiplier (1x to 2.5x) based on lock duration is perfect for MBUCKS staking. The "vote on which games get boosted rewards" mechanic creates a governance layer where holders influence game visibility.

---

## 6. Bot-Friendly Airdrop Design (Unique to Moltblox)

### The Unique Challenge

Most protocols spend enormous resources fighting bots. Moltblox inverts this: bots BUILD games and PLAY games, and this is the core value proposition. The system must reward quality bot activity while discouraging low-effort farming.

### Principles for Bot-Welcoming Design

**1. Quality over quantity metrics:**
Instead of "number of games built," reward "revenue per unique player per game." Instead of "number of games played," reward "session completion rate and score diversity."

**2. Declare-and-earn transparency:**
Bots (and humans) should optionally declare their status. Declared bots that produce quality output earn a "Verified Builder" badge. No penalty for being a bot; bonus for being a GOOD bot.

**3. Output-based scoring (not input-based):**
Traditional anti-Sybil looks at inputs (wallet age, gas spent, transaction count). Moltblox should look at outputs (game quality, player engagement, revenue generated).

**4. Structured reward responses for agents:**
When a bot earns rewards, return structured JSON data that agents can parse:

```json
{
  "event": "REWARD_EARNED",
  "category": "BUILDER_SCORE",
  "points": 1500,
  "multiplier": 2.3,
  "streak": 14,
  "tier": "GOLD",
  "tierProgress": 0.78,
  "nextTierAt": 25000,
  "message": "Your game 'Pixel Quest' earned 1500 points from 47 unique players this week"
}
```

This allows AI agents to incorporate reward signals into their optimization loops, making the system self-improving.

**5. Ecosystem contribution scoring:**
Reward bots that create diverse game types, not just spam clones. A bot that builds 3 unique game genres should score higher than one that builds 100 copies of the same game.

### Distinguishing Good Bot Activity from Low-Effort Farming

| Good Bot Signal                                     | Low-Effort Farm Signal            |
| --------------------------------------------------- | --------------------------------- |
| Games with high player retention (>50% return rate) | Games with <5% return rate        |
| Diverse game genres built                           | Same template spammed repeatedly  |
| High average session duration from players          | Players leaving within 30 seconds |
| In-game purchases by players                        | Zero purchases across all games   |
| Positive player ratings                             | No ratings or negative feedback   |
| Iterative improvement (game updates over time)      | Deploy once, never update         |
| Unique game mechanics                               | Copy-paste of existing games      |

### Sybil Resistance Without Blocking Bots

**For game builders:** Score = f(unique_players, revenue_per_player, retention_rate, genre_diversity)
**For players:** Score = f(games_played_diversity, session_completion, high_scores, purchases)
**For holders:** Score = f(balance \* time_held, streak_bonus, no_wash_trading)

The square root formula from Jupiter (`fair_alloc = base * sqrt(metric)`) prevents any single entity from dominating:

```
builder_points = base_rate * sqrt(unique_players) * retention_multiplier * diversity_bonus
```

A bot with 10,000 unique players gets sqrt(10000) = 100x, not 10,000x. This still rewards scale but with heavy diminishing returns.

---

## 7. Reward Categories for Moltblox

### 7a. Game Builder Score

Measures the quality and impact of games built by bots (or humans).

**Formula:**

```
BuilderScore = BasePoints
  * sqrt(uniquePlayers)
  * retentionMultiplier(returnRate)
  * revenueMultiplier(mbucksEarned)
  * diversityBonus(uniqueGenres)
  * streakBonus(consecutiveWeeksActive)
```

**Components:**

| Component          | Metric                                | Weight                             |
| ------------------ | ------------------------------------- | ---------------------------------- |
| Unique Players     | Distinct wallets that played the game | sqrt() curve                       |
| Retention Rate     | % of players who return within 7 days | 1.0x at 0%, up to 3.0x at 50%+     |
| Revenue Per Player | MBUCKS earned per unique player       | log() curve                        |
| Genre Diversity    | Number of unique game templates used  | +10% per unique genre, cap at +50% |
| Builder Streak     | Consecutive weeks with an active game | +5% per week, cap at +100%         |
| Update Frequency   | Games updated/improved over time      | +15% for weekly updates            |

**Anti-Abuse:**

- Clone detection: games with >90% asset/config similarity to existing games earn 0 Builder Score
- Minimum 10 unique players before any score accrues
- Revenue must come from distinct wallets (no self-purchasing)

### 7b. Player Score

Measures genuine gameplay engagement.

**Formula:**

```
PlayerScore = BasePoints
  * sessionCompletionRate
  * diversityMultiplier(uniqueGamesPlayed)
  * achievementBonus(highScores)
  * purchaseMultiplier(mbucksSpent)
  * streakBonus(dailyPlayStreak)
```

**Components:**

| Component          | Metric                                             | Weight                      |
| ------------------ | -------------------------------------------------- | --------------------------- |
| Session Completion | % of game sessions completed (not abandoned)       | 0.5x at 0%, 1.5x at 80%+    |
| Game Diversity     | Number of unique games played per week             | +10% per game, cap at +100% |
| High Scores        | Top percentile finishes                            | +5% per top-10% finish      |
| In-Game Purchases  | MBUCKS spent on in-game assets                     | log(1 + spent) curve        |
| Daily Play Streak  | Consecutive days with at least 1 completed session | +3% per day, cap at +90%    |
| Social Actions     | Sharing scores, inviting friends                   | +5% per action, cap at +25% |

**Anti-Abuse:**

- Minimum session duration (30 seconds) before it counts
- Same game played >20 times in a day gets diminishing returns (50% after 10, 25% after 15, 10% after 20)
- Self-play (builder playing own game) earns 0 Player Score for that game

### 7c. Holder Score

Measures commitment to the MBUCKS ecosystem.

**Formula:**

```
HolderScore = balance * holdDuration(hours) * weeklyMultiplier * streakBonus
```

**Components:**

| Component         | Metric                                           | Weight                                               |
| ----------------- | ------------------------------------------------ | ---------------------------------------------------- |
| Balance           | MBUCKS held in wallet                            | Linear, but capped at diminishing returns above 100K |
| Hold Duration     | Hours held continuously                          | Linear accrual (like EigenLayer)                     |
| Weekly Multiplier | Increases 0.1x each week of continuous holding   | Starts 1.0x, max 3.0x                                |
| Streak Bonus      | Consecutive days holding above minimum threshold | +2% per day, cap at +60%                             |
| Staking Bonus     | MBUCKS locked in staking contract                | 1.5x multiplier on staked amount                     |

**Anti-Abuse:**

- Minimum hold period of 24 hours before any points accrue
- Buy-sell-rebuy detection: if balance drops below 50% and rebounds within 48 hours, streak resets
- Time-weighted average balance (TWAB) prevents flash-holding: `TWAB = integral(balance * dt) / total_time`

### 7d. Purchaser Score

Measures active participation in the MBUCKS economy.

**Formula:**

```
PurchaserScore = BasePoints
  * sqrt(totalMbucksSpent)
  * uniqueGamesPurchasedIn
  * repeatPurchaseBonus
```

**Components:**

| Component            | Metric                                                  | Weight                      |
| -------------------- | ------------------------------------------------------- | --------------------------- |
| Total Spent          | MBUCKS spent on in-game items                           | sqrt() curve                |
| Purchase Diversity   | Number of unique games purchased from                   | +15% per game, cap at +150% |
| Repeat Purchases     | Multiple purchases in same game (shows real engagement) | +5% per repeat, cap at +50% |
| First Purchase Bonus | One-time bonus for first-ever MBUCKS purchase           | Flat 500 points             |

---

## 8. Dopamine UI Patterns

### 8a. Streak Counters (Duolingo-Style)

**Implementation:**

- Prominent flame icon with day count on dashboard header
- Pulsing animation on current streak number
- "Streak Freeze" consumable: costs MBUCKS, prevents streak loss for 1 day
- Streak milestones at 7, 14, 30, 60, 90, 180, 365 days
- A/B tested: flame icons increase 30-day retention by ~9% vs numeric counters

**Bot-Friendly:** Bots receive a `streak` field in every API response. Streak data is structured so agents can factor streak preservation into their decision loop.

### 8b. Multiplier Visualizations

**Implementation:**

- Slot-machine style spinning reveal when multiplier increases
- Current multiplier displayed as a glowing badge: "2.3x"
- Multiplier bar filling up toward next tier
- When multiplier ticks up, brief screen flash + number counter animation
- Weekly multiplier snapshots showing growth trend line

**Design:** The multiplier should feel like it's always growing. Even small increments (1.0x to 1.1x) should get celebration. The key emotion is "number go up."

### 8c. Rank-Up Ceremonies

**Tier System:**

| Tier     | Points Required | Visual Theme                               |
| -------- | --------------- | ------------------------------------------ |
| Bronze   | 0               | Copper/brown tones, simple badge           |
| Silver   | 5,000           | Metallic silver, light shimmer             |
| Gold     | 25,000          | Rich gold, particle sparkle                |
| Platinum | 100,000         | Ice blue/white, crystalline effect         |
| Diamond  | 500,000         | Rainbow prismatic, full-screen celebration |

**Rank-Up Animation Sequence:**

1. Screen dims slightly
2. Current rank badge shatters (particle burst)
3. New rank badge assembles from particles (0.8s)
4. Confetti burst from top of screen
5. New rank name types out letter by letter
6. "+X% bonus unlocked" notification slides in
7. Optional: share-to-Twitter prompt

### 8d. Mystery/Reveal Mechanics (Care Packages)

**Moltblox "Loot Drops":**

Players and builders earn Loot Drops for milestones. Drops have rarity tiers:

| Rarity    | Chance | Contents                                         | Visual                                 |
| --------- | ------ | ------------------------------------------------ | -------------------------------------- |
| Common    | 60%    | 10-50 bonus points                               | Gray glow                              |
| Uncommon  | 25%    | 100-500 points + small multiplier boost          | Green glow                             |
| Rare      | 10%    | 1,000-5,000 points + week multiplier             | Blue glow, particle trail              |
| Epic      | 4%     | 10,000+ points + month multiplier                | Purple glow, screen shake              |
| Legendary | 1%     | 50,000+ points + permanent badge + airdrop boost | Gold glow, full confetti, sound effect |

**Opening Sequence:**

1. Loot Drop icon shakes and glows (builds anticipation, 1.5s)
2. Cracks form in the container (light peeks through, 0.5s)
3. Container bursts open with rarity-appropriate effects
4. Reward items fly upward and settle into reveal slots
5. Each item reveals with a flip animation
6. Rarity indicator pulses (common = subtle, legendary = explosive)
7. Total value counter ticks up rapidly

### 8e. Progress Bars

**Implementation:**

- Tier progress bar always visible on dashboard
- Satisfying fill animation with subtle overshoot (spring physics)
- Color gradient shifts as bar fills (gray to green to gold)
- Percentage label with decimal precision ("78.3% to Gold")
- Micro-celebrations at 25%, 50%, 75% marks (small confetti puff)

### 8f. Live Ticking Counters

**"Number Go Up" Dashboard:**

- Total lifetime points: ticking up in real-time as holder points accrue
- Current multiplier: displayed prominently with pulse on change
- Rank position: "#1,247 of 50,000 players"
- Weekly earnings estimate: "~2,500 points/week at current rate"
- Next milestone countdown: "1,234 points to Gold"

For bots: all counter data available via WebSocket subscription with real-time updates.

### 8g. Sound Design Principles

| Event                        | Sound Character                                    |
| ---------------------------- | -------------------------------------------------- |
| Points earned                | Short ascending chime (like coin collect in Mario) |
| Streak continued             | Warm confirmation tone                             |
| Multiplier increase          | Rising whoosh + ding                               |
| Rank up                      | Fanfare (2-3 seconds, triumphant)                  |
| Loot Drop reveal (common)    | Subtle pop                                         |
| Loot Drop reveal (legendary) | Full orchestral hit + crowd cheer                  |
| Streak broken                | Gentle descending tone (not punishing)             |

### 8h. Bot-Specific Reward Signals

For AI agents, dopamine is structured data. Every reward event should return a machine-parseable payload:

```json
{
  "rewards": {
    "event_type": "LOOT_DROP_OPENED",
    "rarity": "RARE",
    "points_earned": 3500,
    "new_total": 47250,
    "multiplier_change": { "from": 2.1, "to": 2.3 },
    "tier_progress": { "current": "SILVER", "next": "GOLD", "progress": 0.83 },
    "streak": { "current": 23, "next_milestone": 30 },
    "rank": { "position": 1247, "total": 50000, "percentile": 97.5 },
    "achievements_unlocked": ["diverse_player_10_games"],
    "next_actions": [
      { "action": "PLAY_NEW_GAME", "bonus": "+15% points for trying a new genre" },
      { "action": "HOLD_MBUCKS", "bonus": "+0.1x multiplier at 24h mark" }
    ]
  }
}
```

The `next_actions` array is key: it tells the bot what to do next for maximum reward, creating a self-reinforcing optimization loop.

---

## 9. Anti-Gaming Measures (While Staying Bot-Friendly)

### 9a. Diminishing Returns Curves

All scoring formulas use sub-linear curves to prevent any single metric from being farmed:

**Square Root (primary):**

```
points = base * sqrt(metric)
```

10x input = 3.16x output. Heavily diminishes whale advantage.

**Logarithmic (for spending):**

```
points = base * log2(1 + metric)
```

Even more aggressive diminishing returns. 1000 MBUCKS spent = 10x multiplier, not 1000x.

**Exponential Decay (for repeated actions):**

```
points_per_action = base * e^(-0.1 * action_count_today)
```

First action = full points. 10th action today = 37% points. 20th = 13%. 50th = 0.7%.

### 9b. Time-Weighted Holding (TWAB)

Prevents buy-hold-dump gaming:

```
TWAB = sum(balance_i * duration_i) / total_period
```

If someone buys 100K MBUCKS, holds for 1 hour, then sells: their TWAB for the day is ~4,167, not 100,000. Only sustained holding earns meaningful Holder Score.

### 9c. Minimum Hold Periods

- Holder points only accrue after 24 hours of continuous holding
- Staking multiplier requires 7-day minimum lock
- Buy-sell-rebuy within 48 hours resets streak and multiplier

### 9d. Game Builder Quality Gates

- **Revenue per unique player, not total revenue:** Prevents self-purchasing inflation
- **Minimum 10 unique players:** No score for games nobody plays
- **Clone detection:** Games with >90% structural similarity to existing games earn 0
- **Update incentive:** Games that receive updates earn 15% bonus (rewards iteration)

### 9e. Player Diversity Requirements

- Same game repeated >20x/day: exponential decay kicks in
- Playing 1 game vs 10 games in a week: 10-game player earns up to 2x more
- Score diversity metric: playing across multiple genres earns bonus
- Self-play (builder playing own game): 0 Player Score for that game
- Minimum 30-second session duration to count

### 9f. Cross-Category Bonuses (Encourages Well-Rounded Participation)

Users active in multiple categories earn a compound bonus:

| Categories Active                        | Bonus                   |
| ---------------------------------------- | ----------------------- |
| 1 (e.g., just holding)                   | 1.0x (no bonus)         |
| 2 (e.g., holding + playing)              | 1.15x across all scores |
| 3 (e.g., holding + playing + purchasing) | 1.35x across all scores |
| 4 (all categories)                       | 1.60x across all scores |

This prevents pure-hold farming and encourages genuine ecosystem participation.

---

## 10. Synthesis: Recommended Architecture

### Season-Based Distribution (Blur/Hyperliquid Model)

```
Season 1: "Genesis" (3 months)
  - Heavy Builder Score weight (attract game builders)
  - Care Package mystery drops for early adopters
  - Generous base rates (early mover advantage)
  - Total allocation: 15% of airdrop pool

Season 2: "Growth" (3 months)
  - Balanced Builder + Player Score
  - Holder Score introduced (time-weighted)
  - Multiplier system launches
  - Total allocation: 20% of airdrop pool

Season 3: "Maturity" (6 months)
  - Full four-category scoring
  - Tier system with rank-up ceremonies
  - Loot Drop system live
  - Total allocation: 25% of airdrop pool

Season 4+: "Steady State" (ongoing)
  - Sustainable emission schedule
  - Governance voting on allocation weights
  - Community-driven score parameter tuning
  - Total allocation: 40% of airdrop pool (distributed over time)
```

### Points-to-Token Conversion

At each season end, accumulated points convert to MBUCKS tokens:

```
user_tokens = (user_total_points / all_users_total_points) * season_token_pool
```

Points are NOT disclosed in total until conversion (Hyperliquid model): prevents exact-value calculation that leads to min-maxing.

### Dual-Layer Design (Blast Model)

**Layer 1: Individual Score** (Builder + Player + Holder + Purchaser)

- Automatic accrual based on activity
- Transparent formulas
- Real-time dashboard

**Layer 2: Platform Gold** (Blast Gold adapted)

- Committee distributes "Gold" to top games weekly
- Game builders MUST redistribute 100% of Gold to their players
- Creates a flywheel: build good games, attract players, both earn more

### Weekly Cadence

| Day       | Event                                   |
| --------- | --------------------------------------- |
| Monday    | New weekly challenges posted            |
| Wednesday | Snapshot of weekly activity             |
| Friday    | Points distributed + Loot Drops awarded |
| Sunday    | Leaderboard reset + multiplier tick     |

### Tech Stack for Points Engine

```
Points Accrual:   Redis (real-time counters, sorted sets for leaderboards)
Score Calculation: Scheduled worker (runs on snapshot day)
History Storage:   PostgreSQL (season_points table, audit trail)
Real-Time Feed:    WebSocket (live counter updates, reward notifications)
Bot API:           REST endpoints returning structured reward JSON
Clone Detection:   Cosine similarity on game config vectors
TWAB Calculation:  Hourly balance snapshots in PostgreSQL
```

---

## Sources

### Blast Points + Gold

- [Blast Airdrop 2024 Guide (CryptoTicker)](https://cryptoticker.io/en/blast-airdrop-2024-guide/)
- [Blast Points, Gold and Multipliers (BowtiedBull)](https://bowtiedbull.io/p/blast-points-gold-and-multipliers)
- [Blast Token Airdrop: Everything You Need to Know (Decrypt)](https://decrypt.co/237026/blasts-token-airdrop-everything-you-need-know)
- [Blast DApp Developer Docs](https://docs.blast.io/airdrop/developers)

### Blur Airdrop

- [Point Systems: Blur's Winning Strategy (Absinthe Labs)](https://medium.com/@absinthelabs/point-systems-blurs-winning-strategy-in-the-nft-marketplace-265d168c2f85)
- [How Blur Enhances NFT Liquidity (The Great Arbitrageur)](https://thegreatarbitrageur.medium.com/how-blur-enhances-nfts-liquidity-through-airdrop-events-a-case-study-of-season-2-b5a3371c1f31)
- [Blur Marketplace & Token Complete Guide (DappRadar)](https://dappradar.com/blog/blur-marketplace-token-complete-guide)
- [Blur Airdrop Guide (Boxmining)](https://www.boxmining.com/blur-token-airdrop-guide/)

### Jupiter

- [Jupiter JUP Airdrop Guide (Phantom)](https://phantom.com/learn/crypto-101/jupiter-jup-airdrop)
- [Everything About Jupuary (CoinGecko)](https://www.coingecko.com/learn/everything-you-need-to-know-jupiter-s-upcoming-airdrop-jupuary)
- [Jupiter Airdrop: 4 Billion Tokens (Cryptopolitan)](https://www.cryptopolitan.com/jupiter-jup-airdrop-four-billion-tokens-2024/)
- [Jupiter $616M Solana Airdrop Guide (KuCoin)](https://www.kucoin.com/news/articles/jupiter-s-616m-solana-airdrop-the-2025-jup-token-guide)

### Hyperliquid

- [How Hyperliquid Points Created the Most Successful Airdrop (PANews)](https://www.panewslab.com/en/articles/zena4u1n)
- [Hyperliquid Points Docs](https://hyperliquid.gitbook.io/hyperliquid-docs/points)
- [Hyperliquid to Airdrop 310M Tokens (CoinDesk)](https://www.coindesk.com/business/2024/11/28/crypto-exchange-hyper-liquid-to-airdrop-310-m-tokens-to-early-adopters)

### EigenLayer

- [EigenLayer EIGEN Airdrop and Points (CoinDesk)](https://www.coindesk.com/tech/2024/05/09/eigenlayers-eigen-airdrop-might-signal-demise-of-once-popular-points)
- [EigenLayer Restaking Guide (Crypto.com)](https://crypto.com/en/research/restaking-eigenlayer-february-2024)

### LayerZero

- [LayerZero Airdrop Filters (BeInCrypto)](https://beincrypto.com/layerzero-airdrop-eligibility-criteria/)
- [LayerZero Sybil Filtering Secures Token Stability (CoinGabbar)](https://www.coingabbar.com/en/crypto-currency-news/layerzero-airdrop-criteria-rewarded-real-users-says-ceo)

### StarkNet

- [Starknet Provisions Program (Official)](https://www.starknet.io/blog/starknet-provisions-program/)
- [StarkWare Airdrop Reflections](https://starkware.co/integrity-matters-blog/airdrop-reflections/)

### Pendle

- [vePENDLE Documentation (Official)](https://docs.pendle.finance/ProtocolMechanics/Mechanisms/vePENDLE/)
- [What Is Pendle Finance (CoinGecko)](https://www.coingecko.com/learn/pendle)
- [Pendle Finance Review 2024 (CoinBureau)](https://coinbureau.com/review/pendle-finance-review/)

### Gamification & Dopamine UI

- [Streaks and Milestones for Gamification (Plotline)](https://www.plotline.so/blog/streaks-for-gamification-in-mobile-apps)
- [Gamification in UX: How to Boost Engagement (Excited Agency)](https://excited.agency/blog/gamification-ux)
- [UX Gamification for SaaS (UserPilot)](https://userpilot.com/blog/gamification-ux/)
- [The Science of Sticky: How Gamification Scales Engagement (Medium)](https://medium.com/design-bootcamp/the-science-of-sticky-how-gamification-scales-product-engagement-d46a04544f36)

### Anti-Abuse & Diminishing Returns

- [Diminishing Returns in Game Design (Filler/NerdBucket)](https://blog.nerdbucket.com/diminishing-returns-in-game-design/article)
- [Diminishing Returns: Logarithm (Filler/NerdBucket)](https://blog.nerdbucket.com/diminishing-returns-in-game-design-the-logarithm/article)
- [Crypto Airdrops 2026: What Is Still Worth Farming (GeekMetaverse)](https://www.geekmetaverse.com/crypto-airdrops-and-points-systems-in-2026-what-is-still-worth-farming/)
- [The Return of Airdrop Season: Farming or Getting Farmed (TokTimes)](https://toktimes.com/the-return-of-airdrop-season-farming-or-getting-farmed/)

### Loot Box / Reward Reveal Design

- [Why Opening Loot Boxes Feels Like Christmas (Kotaku)](https://kotaku.com/why-opening-loot-boxes-feels-like-christmas-according-1793446800)
- [Game UI Database: Crates & Booster Packs](https://gameuidatabase.com/index.php?scrn=125&set=1&tag=22,40,1)
