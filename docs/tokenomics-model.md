# MBucks Tokenomics Allocation Model

> Version: 2.0 | Date: 2026-02-18 | Revised allocation: 65% airdrop reserve, simplified 5-category model
> Token: MBucks (MBUCKS) | Chain: Base (L2) | Standard: ERC20
> Total Supply Cap: 1,000,000,000 (1 billion) | Decimals: 18
> Contract: Minter-role based (supply minted over time up to 1B cap)

---

## 1. Allocation Summary

| Category                  | % of Supply | Tokens            | Unlock Model                                        |
| ------------------------- | ----------- | ----------------- | --------------------------------------------------- |
| Airdrop Reserve (Seasons) | 65.0%       | 650,000,000       | Season-based distributions over 24+ months          |
| Team & Founders           | 15.0%       | 150,000,000       | 12-month cliff, then 24-month linear vest           |
| Future Development        | 10.0%       | 100,000,000       | Locked 18 months, then governance-approved releases |
| Liquidity Pool (Launch)   | 5.0%        | 50,000,000        | Immediate at TGE                                    |
| Treasury & Partnerships   | 5.0%        | 50,000,000        | Governed multisig, 6-month cliff, quarterly unlocks |
| **TOTAL**                 | **100%**    | **1,000,000,000** |                                                     |

### Visual Breakdown

```
Airdrop Reserve   █████████████████████████████████████████████████████████████████  65%
Team & Founders   ███████████████                                                    15%
Future Developmt  ██████████                                                         10%
Liquidity Pool    █████                                                               5%
Treasury & Partn  █████                                                               5%
```

---

## 2. Category Details & Rationale

### 2a. Liquidity Pool: 5% (50M tokens)

**Purpose**: Seed the initial MBUCKS/WETH trading pair on Aerodrome Finance.

**Details**:

- Paired with ~$5,000 in WETH on Aerodrome volatile pool (your cash; tokens are minted for free)
- Initial price: $0.0001 per MBUCKS ($5,000 WETH / 50M tokens)
- Market cap at launch: $5,000 (only LP tokens circulating, valued at pool-side WETH)
- FDV: $100,000
- Total LP value: $10,000 ($5K WETH + $5K worth of MBUCKS at initial price)
- MCap/FDV ratio: 0.05 (in the "winning zone" per 2025 launch data)
- LP tokens locked via UNCX for 3-month initial lock with relock strategy (extended quarterly as needed using UNCX's relock feature)
- Pool type: Volatile (x\*y=k), 0.3% swap fee

**Why 5%**: Industry standard for gaming tokens is 5-10% LP allocation. Starting at 5% keeps the initial circulating supply minimal for a fair-launch model where price discovery happens organically. The remaining supply is minted over time as rewards are earned. MCap/FDV of 0.05 avoids the "low float / high FDV" death pattern that killed most 2024-2025 VC-backed launches. $50K FDV is ultra-humble, leaving massive room for organic growth.

**Comparable**: GALA launched at $0.0003 with ~14% float and no ICO (pure node emissions). Grew organically to $0.83 (x2,766). MBUCKS follows the same playbook: ultra-low starting price, no VC, community-first distribution.

**Circulating at launch**: Only these 50M tokens are liquid on day one. No team tokens, no unlocked reserves. This is a true fair launch.

### 2b. Airdrop Reserve: 65% (650M tokens)

**Purpose**: The core incentive engine. ALL rewards (Builder Score, Player Score, Holder Score, Purchaser Score, Cross-Category Bonus) flow through season-based airdrop distributions. Users accumulate points through quality activity, and points convert to MBUCKS at the end of each season.

**Scoring categories within the airdrop system**:

| Score Category       | Description                                                                |
| -------------------- | -------------------------------------------------------------------------- |
| Builder Score        | Rewards for building quality games (retention, revenue, diversity)         |
| Player Score         | Rewards for genuine gameplay engagement (completion, diversity, purchases) |
| Holder Score         | Rewards for holding MBUCKS (TWAB, weekly multiplier, streak bonus)         |
| Purchaser Score      | Rewards for in-game MBUCKS spending                                        |
| Cross-Category Bonus | Up to 1.6x bonus for users active in 2+ categories                         |

**Season distribution**:

| Season                  | Duration    | % of Airdrop Pool | Tokens      | Focus                                    |
| ----------------------- | ----------- | ----------------- | ----------- | ---------------------------------------- |
| Season 1: Genesis       | Months 1-3  | 10%               | 65,000,000  | Builder acquisition (60% Builder weight) |
| Season 2: Growth        | Months 4-6  | 15%               | 97,500,000  | Builder + Player balance                 |
| Season 3: Maturity      | Months 7-12 | 30%               | 195,000,000 | Full four-category scoring + Loot Drops  |
| Season 4+: Steady State | Month 13+   | 45%               | 292,500,000 | Ongoing, governance-directed             |

**Conversion formula** (at each season end):

```
user_tokens = (user_total_points / all_users_total_points) * season_token_pool
```

**Scoring weight shifts per season**:

| Score Category  | S1 Weight | S2 Weight | S3 Weight | S4+ Weight |
| --------------- | --------- | --------- | --------- | ---------- |
| Builder Score   | 60%       | 40%       | 30%       | 25%        |
| Player Score    | 25%       | 35%       | 35%       | 35%        |
| Holder Score    | 5%        | 10%       | 15%       | 20%        |
| Purchaser Score | 10%       | 15%       | 20%       | 20%        |

**Mystery mechanics**: Total point supply is NOT disclosed until conversion (Hyperliquid model). This prevents exact-value calculation and discourages min-maxing.

**Care Packages**: Loot Drops with rarity tiers (Common through Legendary) award bonus points at milestones. Legendary drops carry up to 100x the value of Common drops (Blur model).

**Why 65%**: This is the heart of the platform. By consolidating all rewards into a single season-based airdrop system, the model is simpler, more predictable, and gives the team flexibility to adjust scoring weights between seasons. 65% to community rewards with no VC allocation creates a genuinely community-first distribution. Comparable: HYPE allocated 31% to community airdrop with no VC; MBUCKS more than doubles that ratio.

### 2c. Team & Founders: 15% (150M tokens)

**Purpose**: Compensate the founding team and align long-term incentives.

**Vesting schedule**:

- **Cliff**: 12 months (zero tokens accessible for the first year)
- **Vest**: 24-month linear unlock after cliff
- **Total vest period**: 36 months from TGE
- **Monthly unlock after cliff**: 6,250,000 tokens/month (150M / 24 months)

**Vesting timeline**:

```
Month  1-12:  0 tokens unlocked (cliff)
Month 13:     6,250,000 unlocked (first vest)
Month 14:     12,500,000 cumulative
Month 15:     18,750,000 cumulative
...
Month 36:     150,000,000 cumulative (fully vested)
```

**Safeguards**:

- Tokens held in a Gnosis Safe multisig (3-of-5 signers)
- Vesting enforced on-chain via smart contract (not just an agreement)
- Public vesting contract address displayed on project website
- Any team member departure forfeits unvested tokens back to Treasury

**Why 15%**: Industry benchmark for team allocation is 15-20%. 15% with a 12-month cliff and 24-month vest is conservative and signals long-term commitment. The 12-month cliff means the team has zero liquid tokens for an entire year, which is the strongest trust signal in crypto.

### 2e. Treasury & Partnerships: 5% (50M tokens)

**Purpose**: Fund strategic partnerships, exchange listings, market making, bug bounties, and critical operational expenses.

**Unlock schedule**:

- **Cliff**: 6 months (no access for first 6 months)
- **After cliff**: Quarterly unlocks of 4,166,667 tokens (~8.33% of treasury per quarter)
- **Full unlock**: 36 months from TGE
- **Governed by**: Multisig wallet (initially team-controlled, transitioning to DAO governance)

**Use cases**:

- CEX listing fees and market maker partnerships
- Bug bounties and security audits
- Base ecosystem grant matching
- Critical operational expenses (infrastructure, legal)

**Why 5%**: Lean treasury forces capital discipline. Most token projects over-allocate to treasury and it becomes a dumping pool. 5% covers essential expenses while the bulk of tokens go to community via airdrops. If more funds are needed, governance can propose releases from the Future Development fund.

### 2d. Future Development: 10% (100M tokens)

**Purpose**: Reserved for unforeseen needs: protocol upgrades, new game modes, additional LP depth, emergency reserves, or community-voted initiatives.

**Unlock schedule**:

- **Hard lock**: 18 months (no access under any circumstances)
- **After lock**: Governance-approved releases only
- **Maximum single release**: 10M tokens per quarter (requires DAO vote)
- **Remaining unallocated tokens at month 48**: Burned permanently

**Why 10%**: Every tokenomics model needs a buffer for the unknown. 10% is conservative enough not to spook investors but large enough to fund meaningful initiatives. The 18-month hard lock and governance requirement prevent misuse. The 48-month burn deadline creates a deflationary mechanism if the tokens are not needed.

---

## 3. Season Structure & Airdrop Emission Schedule

### Season Timeline

```
                SEASON 1         SEASON 2         SEASON 3              SEASON 4+
               "Genesis"        "Growth"         "Maturity"          "Steady State"
              Months 1-3       Months 4-6       Months 7-12          Month 13+
             +-----------+   +-----------+   +-----------------+   +--------------
             | Builders  |   | Builders  |   | Full scoring    |   | Governance-
             | + early   |   | + Players |   | all 4 categories|   | directed
             | adopters  |   | balanced  |   | + Loot Drops    |   | emissions
             +-----------+   +-----------+   +-----------------+   +--------------
```

### Airdrop Distribution Per Season (from 650M pool)

| Season       | Duration   | % of Airdrop Pool | Tokens      | Monthly Rate | Focus                    |
| ------------ | ---------- | ----------------- | ----------- | ------------ | ------------------------ |
| S1: Genesis  | 3 months   | 10%               | 65,000,000  | 21,667,000   | Builder acquisition      |
| S2: Growth   | 3 months   | 15%               | 97,500,000  | 32,500,000   | Builder + Player balance |
| S3: Maturity | 6 months   | 30%               | 195,000,000 | 32,500,000   | Full 4-category scoring  |
| S4+: Steady  | 12+ months | 45%               | 292,500,000 | ~24,375,000  | Governance-directed      |

All rewards flow through season-end point-to-token conversions. No separate staking contracts or continuous emission streams.

---

## 4. Monthly Emission Curve & Circulating Supply

### Month-by-Month Breakdown (Year 1)

| Month | LP  | Airdrops | Team | Treasury | Dev | Monthly New | Cumulative | %     |
| ----- | --- | -------- | ---- | -------- | --- | ----------- | ---------- | ----- |
| 1     | 50M | 0        | 0    | 0        | 0   | 50M         | 50M        | 5.0%  |
| 2     | 0   | 0        | 0    | 0        | 0   | 0           | 50M        | 5.0%  |
| 3     | 0   | 65M      | 0    | 0        | 0   | 65M         | 115M       | 11.5% |
| 4     | 0   | 0        | 0    | 0        | 0   | 0           | 115M       | 11.5% |
| 5     | 0   | 0        | 0    | 0        | 0   | 0           | 115M       | 11.5% |
| 6     | 0   | 97.5M    | 0    | 0        | 0   | 97.5M       | 212.5M     | 21.3% |
| 7     | 0   | 0        | 0    | 4.2M     | 0   | 4.2M        | 216.7M     | 21.7% |
| 8     | 0   | 0        | 0    | 0        | 0   | 0           | 216.7M     | 21.7% |
| 9     | 0   | 0        | 0    | 0        | 0   | 0           | 216.7M     | 21.7% |
| 10    | 0   | 0        | 0    | 4.2M     | 0   | 4.2M        | 220.9M     | 22.1% |
| 11    | 0   | 0        | 0    | 0        | 0   | 0           | 220.9M     | 22.1% |
| 12    | 0   | 195M     | 0    | 0        | 0   | 195M        | 415.9M     | 41.6% |

**Year 1 End**: ~415.9M tokens circulating (41.6% of supply)

Notes:

- LP: 50M minted at TGE only
- Airdrops: Distributed at season end (Month 3: S1, Month 6: S2, Month 12: S3)
- Team: 0 in Year 1 (12-month cliff)
- Treasury: First unlock at month 7 (6-month cliff), then 4.2M quarterly
- Dev: Locked for 18 months
- Between seasons, no new tokens enter circulation (clean, predictable model)

### Month-by-Month Breakdown (Year 2)

| Month | Airdrops | Team  | Treasury | Dev | Monthly New | Cumulative | %     |
| ----- | -------- | ----- | -------- | --- | ----------- | ---------- | ----- |
| 13    | 0        | 6.25M | 4.2M     | 0   | 10.45M      | 426.4M     | 42.6% |
| 14    | 0        | 6.25M | 0        | 0   | 6.25M       | 432.6M     | 43.3% |
| 15    | 0        | 6.25M | 0        | 0   | 6.25M       | 438.9M     | 43.9% |
| 16    | 0        | 6.25M | 4.2M     | 0   | 10.45M      | 449.3M     | 44.9% |
| 17    | 0        | 6.25M | 0        | 0   | 6.25M       | 455.6M     | 45.6% |
| 18    | 0        | 6.25M | 0        | 0   | 6.25M       | 461.8M     | 46.2% |
| 19    | 0        | 6.25M | 4.2M     | 10M | 20.45M      | 482.3M     | 48.2% |
| 20    | 0        | 6.25M | 0        | 0   | 6.25M       | 488.5M     | 48.9% |
| 21    | 0        | 6.25M | 0        | 0   | 6.25M       | 494.8M     | 49.5% |
| 22    | 0        | 6.25M | 4.2M     | 10M | 20.45M      | 515.2M     | 51.5% |
| 23    | 0        | 6.25M | 0        | 0   | 6.25M       | 521.5M     | 52.1% |
| 24    | 292.5M   | 6.25M | 0        | 0   | 298.75M     | 820.2M     | 82.0% |

**Year 2 End**: ~820.2M tokens circulating (82.0% of supply)

Notes:

- Team vesting begins month 13 (6.25M/month for 24 months)
- Dev fund unlocks at month 19 (18-month lock), up to 10M/quarter via governance
- Season 4+ airdrop at month 24 (292.5M, the largest single distribution)
- S4+ airdrop can be split across multiple months if governance decides to

### Emission Pattern

Key pattern: Tokens enter circulation in discrete season-end bursts, not continuous streams. Between seasons, only small treasury quarterly unlocks add to supply. This creates a clean, predictable emission model:

- **Month 1**: 50M (LP only)
- **Month 3**: +65M (S1 airdrop)
- **Month 6**: +97.5M (S2 airdrop)
- **Month 12**: +195M (S3 airdrop, largest Year 1 event)
- **Month 13+**: Team vest begins (6.25M/month, steady drip)
- **Month 24**: +292.5M (S4+ airdrop, largest single distribution)

The season-end model means holders know exactly when new supply enters. No daily selling pressure from continuous emissions.

---

## 5. Inflation Rate Projections

### Year 1

| Period      | Circulating Start | New Tokens | Circulating End | Inflation Rate |
| ----------- | ----------------- | ---------- | --------------- | -------------- |
| Q1 (M1-3)   | 0                 | 115M       | 115M            | N/A (genesis)  |
| Q2 (M4-6)   | 115M              | 97.5M      | 212.5M          | 84.8%          |
| Q3 (M7-9)   | 212.5M            | 4.2M       | 216.7M          | 2.0%           |
| Q4 (M10-12) | 216.7M            | 199.2M     | 415.9M          | 91.9%          |

Q3 is nearly flat (only a treasury unlock), while Q2 and Q4 spike at season-end airdrop distributions. This is by design: bursts of supply enter at predictable moments, not as constant drip.

### Year 2

| Period      | Circulating Start | New Tokens | Circulating End | Inflation Rate |
| ----------- | ----------------- | ---------- | --------------- | -------------- |
| Q5 (M13-15) | 415.9M            | 22.95M     | 438.9M          | 5.5%           |
| Q6 (M16-18) | 438.9M            | 22.95M     | 461.8M          | 5.2%           |
| Q7 (M19-21) | 461.8M            | 33.15M     | 494.8M          | 7.2%           |
| Q8 (M22-24) | 494.8M            | 325.4M     | 820.2M          | 65.8%          |

Q5-Q7 are low-inflation quarters (just team vesting + small treasury/dev unlocks). Q8 spike is the Season 4+ airdrop (292.5M). This can be smoothed by governance splitting S4+ across multiple sub-seasons.

By Year 3:

- Team fully vested at month 36
- Treasury fully distributed by month 36
- Only Dev fund (governance-gated) continues
- Expected quarterly inflation < 3% in Year 3

---

## 6. Circulating Supply Milestones

| Milestone | When         | Circulating Supply | % of Total | Event                       |
| --------- | ------------ | ------------------ | ---------- | --------------------------- |
| TGE       | Day 1        | 50,000,000         | 5.0%       | LP seeded on Aerodrome      |
| 115M      | Month 3      | 115,000,000        | 11.5%      | Season 1 airdrop            |
| 212.5M    | Month 6      | 212,500,000        | 21.3%      | Season 2 airdrop            |
| 415.9M    | Month 12     | 415,900,000        | 41.6%      | Season 3 airdrop + treasury |
| 500M      | ~Month 19    | ~500,000,000       | 50.0%      | Team vesting + dev unlock   |
| 820.2M    | Month 24     | 820,200,000        | 82.0%      | Season 4+ airdrop           |
| 900M      | ~Month 30    | ~900,000,000       | 90.0%      | Most vesting complete       |
| 1B (cap)  | ~Month 36-48 | 1,000,000,000      | 100.0%     | Full supply minted          |

---

## 7. LP Growth Roadmap: Emission-Liquidity Sync

The 95% locked supply must unlock in sync with growing LP depth. Thin liquidity + high emission = dump. The emission schedule is designed so that new circulating tokens enter the market only as LP grows to absorb them.

### 3-Phase LP Growth Plan

```
PHASE 1: Stealth             PHASE 2: Expansion           PHASE 3: Scale
"Seed Liquidity"             "Protocol-Owned Growth"      "Community Liquidity"
Months 1-3                   Months 4-9                   Months 10-24
LP: $10K                     LP: $10K -> $50K             LP: $50K -> $250K+
Price: $0.0001               Price: $0.0001 -> $0.001     Price: $0.001 -> $0.01+
Circ: 5% -> 11.5%            Circ: 11.5% -> 22.1%        Circ: 22.1% -> 82.0%
```

### Phase 1: Seed Liquidity (Months 1-3, LP = $10K)

**LP depth**: $10,000 ($5K WETH + 50M MBUCKS)
**Price range**: $0.0001
**New tokens entering**: 65M (S1 airdrop at season end)
**Slippage**: ~2% on $100 buy, ~10% on $500 buy

**Why this works**: Only core community and game builders are active. Low volume, low sell pressure. Season 1 rewards are heavily weighted toward Builder Score (60%), and builders are building, not selling. Holder Score incentivizes keeping tokens (higher TWAB = more points next season).

**LP growth sources**:

- 100% of Aerodrome swap fees reinvested into LP
- Platform in-game purchase fees partially routed to LP
- Apply for Aerodrome gauge votes to attract AERO emission incentives

**Gate**: Season 2 airdrop does NOT start until LP reaches $25K minimum. If LP hasn't grown, Season 2 distribution is reduced by 50%.

### Phase 2: Protocol-Owned Expansion (Months 4-9, LP target = $50K)

**LP depth target**: $50,000
**Price target**: $0.001 (10x from launch)
**New tokens entering**: ~101.7M (S2 airdrop + treasury quarterly unlocks)
**Slippage at $50K LP**: ~1% on $500 buy, ~5% on $2,500 buy

**LP growth sources**:

- Protocol-owned liquidity (POL): 20% of in-game transaction fees buy MBUCKS + WETH and add to LP
- Treasury's first quarterly unlock (4.2M tokens at Month 7): a portion can be paired with WETH for LP depth
- Aerodrome gauge voting: veAERO holders direct AERO emissions to the MBUCKS/WETH pool
- Community LP program: users who add liquidity earn 2x Holder Score multiplier
- Fee reinvestment continues

**Gate**: Team vesting (Month 13) does NOT begin if LP is below $50K. Cliff extends month-by-month until LP threshold is met.

### Phase 3: Community Scale (Months 10-24, LP target = $250K+)

**LP depth target**: $250,000+
**Price target**: $0.01 (100x from launch)
**New tokens entering**: ~597.6M (S3 airdrop + S4+ airdrop + team vest + treasury + dev)
**Slippage at $250K LP**: ~1% on $2,500 buy, ~5% on $12,500 buy

**LP growth sources**:

- All Phase 2 sources continue
- Buyback mechanism: 50% of platform net revenue used to buy MBUCKS from open market (like HYPE's 97% fee buyback, scaled down)
- Secondary MBUCKS/USDC pool launched for stablecoin traders
- DEX aggregator listings (DexScreener, DEXTools, GeckoTerminal auto-index)
- CoinGecko and CoinMarketCap listing applications
- Base Batches 2026 grant funds ($10K-$50K) partially allocated to LP

### Price Targets Synced to LP Depth

| LP Depth | Token Price | MCap (at current float) | FDV   | Emission Phase      | Key Unlock             |
| -------- | ----------- | ----------------------- | ----- | ------------------- | ---------------------- |
| $10K     | $0.0001     | $5K                     | $100K | S1: Genesis         | LP only                |
| $25K     | $0.0005     | $50K                    | $500K | S1 -> S2 gate       | S1 airdrop distributed |
| $50K     | $0.001      | $150K                   | $1M   | S2: Growth          | Treasury Q1 unlock     |
| $100K    | $0.005      | $500K                   | $5M   | S3: Maturity        | Team vesting gate      |
| $250K    | $0.01       | $2.5M                   | $10M  | S3 -> S4 transition | Dev fund access        |
| $500K    | $0.02       | $7.5M                   | $20M  | S4: Steady State    | Full economy           |
| $5M      | $0.10       | $75M                    | $100M | Mature              | Secondary CEX listings |

### Emission-to-LP Ratio Health Check

A healthy emission-to-LP ratio ensures new tokens don't overwhelm available liquidity.

**Target ratio**: Season-end airdrop value should not exceed 50% of LP depth at the time of distribution.

| Month | New Tokens | Price (est.) | New Value  | LP Depth (est.) | Ratio | Status                   |
| ----- | ---------- | ------------ | ---------- | --------------- | ----- | ------------------------ |
| 1     | 50M        | $0.0001      | $5,000     | $10,000         | 50%   | Acceptable (LP seed)     |
| 3     | 65M        | $0.0002      | $13,000    | $15,000         | 87%   | High (S1 airdrop spike)  |
| 6     | 97.5M      | $0.0005      | $48,750    | $30,000         | 163%  | High (S2 airdrop spike)  |
| 7     | 4.2M       | $0.0007      | $2,940     | $35,000         | 8%    | Healthy (treasury only)  |
| 12    | 195M       | $0.002       | $390,000   | $100,000        | 390%  | High (S3 airdrop spike)  |
| 24    | 298.75M    | $0.01        | $2,987,500 | $500,000        | 598%  | High (S4+ airdrop spike) |

Notes on high-ratio months:

- Month 1 (50%): LP seed event. Tokens ARE the liquidity; not sell pressure.
- Months 3, 6, 12, 24 (airdrop spikes): Season-end distributions cause temporary high ratios. Mitigated by: (1) Holder Score rewards incentivize keeping tokens for next season's multiplier, (2) batch distribution means sell pressure is one-time not continuous, (3) governance can split large distributions across sub-seasons if needed.
- Between seasons (Month 7 example): Ratio drops to single digits. Only small treasury unlocks add supply.

### LP Growth Flywheel

```
  More Games Built
       |
       v
  More Players     <--- S1 Builder rewards attract builders
       |
       v
  More In-Game Purchases
       |
       v
  Purchase Fee Revenue
       |
       v
  20% -> Protocol-Owned LP     50% -> Buyback (Phase 3)
       |                              |
       v                              v
  Deeper Liquidity              Reduced Sell Pressure
       |                              |
       v                              v
  Lower Slippage               Higher Token Price
       |                              |
       v                              v
  More Buyers                  More Holder Confidence
       |                              |
       +-----------> Repeat <---------+
```

---

## 8. Key Design Principles

### Fair Launch Philosophy

- Zero team tokens at launch. Only LP tokens circulate on day one.
- No private sale, no pre-sale, no VC allocation. Community earns tokens through participation.
- Team tokens have the longest cliff (12 months) and vest (24 months) of any category.
- LP locked via UNCX with 3-month initial lock, extended quarterly via relock.

### Sustainability Over Hype

- Season-end burst model (not continuous emission) prevents "death spiral" inflation.
- Square root scoring prevents whale domination of rewards.
- Diminishing returns on repeated actions prevent low-effort farming.
- 65% to community via airdrops, no separate staking ponzi mechanics.

### Bot-Welcoming Design

- Airdrop scoring is based on OUTPUT quality (game retention, player engagement), not INPUT volume.
- Bots that build popular games earn proportionally more Builder Score.
- Structured JSON reward responses let AI agents optimize their game-building loops.
- No anti-bot mechanics. Quality metrics are the natural filter.

### Governance Transition

- Year 1: Team-controlled multisig
- Year 2: Community advisory board
- Year 3+: Full DAO governance for treasury and dev fund releases

---

## 9. Comparison to Gaming Token Benchmarks

| Metric              | MBUCKS    | IMX               | AXS              | GALA         | PRIME             | HYPE         |
| ------------------- | --------- | ----------------- | ---------------- | ------------ | ----------------- | ------------ |
| Total Supply        | 1B        | 2B                | 270M             | 50B          | 1.11B             | 1B           |
| Initial Float       | 5%        | 0.9%              | 22.2%            | 14%          | 32%               | 33%          |
| Launch Price        | $0.0001   | $0.30             | $0.10            | $0.0003      | $1.50             | $3.20        |
| Initial FDV         | $100K     | $600M             | $27M             | $15M         | $167M             | $3.2B        |
| MCap/FDV            | 0.05      | 0.009             | 0.22             | 0.14         | 0.32              | 0.33         |
| Team %              | 15%       | 25%               | 21%              | N/A          | 23%               | 0% (no VC)   |
| Team Cliff          | 12 months | 12 months         | 4.5 years        | N/A          | 12 months         | N/A          |
| Community/Airdrop % | 65%       | 30%               | 29%              | 22%          | 20%               | 31%          |
| Fair Launch?        | Yes       | No (private sale) | No (Binance IEO) | Yes (no ICO) | No (private sale) | Yes (no VC)  |
| ATH Multiple        | TBD       | x31               | x1,659           | x2,766       | x18.8             | x9 (ongoing) |

MBUCKS is most comparable to GALA: no ICO, ultra-low starting price ($0.0003 vs $0.0001), community-first distribution, gaming utility. GALA achieved x2,766 from launch to ATH. HYPE is the model for execution: no VC, high community allocation, product-first, buyback-driven price support.

MBUCKS stands out with its fair launch model (no private sale, no VC, no pre-mine beyond LP) and the highest community allocation of any comparable gaming token at 65%. The 15% team allocation with 12-month cliff is on the conservative end compared to peers.

---

## 10. Risk Factors & Mitigations

| Risk                                              | Likelihood | Impact   | Mitigation                                                                                                                                                |
| ------------------------------------------------- | ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Low initial liquidity ($10K) causes high slippage | Medium     | Medium   | Add secondary MBUCKS/USDC pool once volume grows; apply for Aerodrome gauge votes for AERO incentives                                                     |
| Sell pressure from airdrop distributions          | Medium     | High     | Season-end burst model (not continuous); holder scoring incentivizes holding for next season; governance can split large distributions across sub-seasons |
| Team token dump at cliff end                      | Low        | High     | On-chain vesting contract (not just a promise); linear vest over 24 months prevents single dump event                                                     |
| Bot farming with low-quality games                | Medium     | Medium   | Quality-based scoring (sqrt curves, retention metrics, clone detection); minimum 10 unique players before score accrues                                   |
| Regulatory classification                         | Low        | High     | MBUCKS is a utility token (used to play games, buy in-game items); no profit-sharing or dividend mechanics; no securities language                        |
| Smart contract exploit                            | Low        | Critical | Audit before launch; use battle-tested OpenZeppelin contracts; multisig for minter role; bug bounty from treasury                                         |

---

## 11. Launch Day Snapshot

```
Day 1 State:
  Total Supply Cap:       1,000,000,000 MBUCKS
  Minted at TGE:          50,000,000 MBUCKS (5%)
  Circulating:            50,000,000 MBUCKS (LP only)
  Airdrop Reserve:        0 (earned through points, distributed at season end)
  Team Tokens:            0 (12-month cliff)
  Treasury Tokens:        0 (6-month cliff)
  Dev Fund:               0 (18-month lock)
  Token Price:            $0.0001
  Market Cap:             $5,000
  FDV:                    $100,000
  MCap/FDV Ratio:         0.05
  LP Pair:                MBUCKS/WETH on Aerodrome (volatile pool)
  LP Cash In:             $5,000 WETH (tokens minted for free)
  LP Total Value:         ~$10,000 ($5K WETH + $5K MBUCKS at initial price)
  LP Lock:                3-month initial (UNCX, relock quarterly)
  Swap Widget:            Relay (relay.link) with lockToToken=MBUCKS
  Allocation:             65% Airdrop | 15% Team | 10% Dev | 5% LP | 5% Treasury
  Next Token Event:       Season 1 airdrop (Month 3, up to 65M tokens)
```

---

## Sources

- [Token Vesting Benchmarks (LiquiFi)](https://www.liquifi.finance/post/token-vesting-and-allocation-benchmarks)
- [Gaming Tokenomics Design (Black Tokenomics)](https://blacktokenomics.com/designing-tokenomics-for-crypto-games/)
- [Tokenomics for Crypto Games (Blaize)](https://blaize.tech/article-type/tokenomics-for-crypto-games-how-to-develop-economy-for-gamefi)
- [Sustainable ERC20 Supply Models (Speedrun Ethereum)](https://speedrunethereum.com/guides/sustainable-erc20-supply-models)
- [Understanding Tokenomics (LinkedIn)](https://www.linkedin.com/pulse/understanding-tokenomics-liquidity-allocation-price-michal-bacia)
- Moltblox Research: [research-dex-launch.md](./research-dex-launch.md)
- Moltblox Research: [research-rewards-airdrop.md](./research-rewards-airdrop.md)
- Moltblox Research: [research-swap-widget.md](./research-swap-widget.md)
- Moltblox Research: [research-launch-supply.md](./research-launch-supply.md)
- [Low FDV Launches Outperformed in 2025 (The Defiant)](https://thedefiant.io/news/research-and-opinion/token-launches-with-low-fdvs-vastly-outperformed-hyped-debuts-in-2025-memento-research)
- [Low Float and High FDV (Binance Research)](https://public.bnbstatic.com/static/files/research/low-float-and-high-fdv-how-did-we-get-here.pdf)
- [GALA Tokenomics (Official)](https://support.gala.com/hc/en-us/articles/22440785898651--GALA-Tokenomics)
- [HYPE Launch (CoinDesk)](https://www.coindesk.com/business/2024/11/29/hyper-liquids-native-token-debuts-at-fully-diluted-4-2-b-market-cap)
