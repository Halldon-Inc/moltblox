# MBUCKS DEX Liquidity Launch: Research Report

> Date: 2026-02-18 | Chain: Base (L2) | Token: MBucks (MBUCKS) ERC20
> Total Supply: 1,000,000,000 (1B) with 18 decimals
> Budget: ~$10,000 USD for initial liquidity

---

## 1. DEX Comparison on Base

### Aerodrome Finance (RECOMMENDED)

- **TVL**: ~$4.8B on Base (dominant DEX, ~25% of Base's total TVL)
- **Weekly Volume**: ~$2.96B, exceeding $450M in 24hr activity
- **Revenue**: $250M+ cumulative swap fees, $10M+ in 2026 so far
- **Model**: ve(3,3) AMM combining Curve, Convex, and Uniswap mechanics
- **Pool Types**: Volatile (x\*y=k), Stable (Curve StableSwap), Concentrated (Slipstream/CL, fork of Uni V3)
- **Why Best for MBUCKS**: Largest Base DEX by far, supports new token pool creation, has AERO emission incentives for LPs, native to Base ecosystem
- **Upcoming**: Merging with Velodrome into "Aero" (Q2 2026), expanding to Ethereum mainnet

### Uniswap V3 on Base

- **TVL**: ~$4.5B globally (significant portion on Base; Base contributes ~50% of Uniswap revenue)
- **Weekly Volume**: ~$10B globally across all chains
- **Model**: Concentrated liquidity (tick-based), well-known brand
- **Pros**: Brand recognition, familiar UI, large existing user base
- **Cons**: Higher scam token prevalence, no native emission incentives (no UNI farming on Base)
- **Verdict**: Strong second choice, but Aerodrome has deeper Base-native liquidity and incentive mechanisms

### BaseSwap

- **TVL**: ~$915K (very small)
- **Volume**: Recent 155% spike but still modest
- **Model**: Native Base DEX, community-driven
- **Verdict**: Too small for a serious launch. Low liquidity means high slippage for traders.

### SushiSwap on Base

- **TVL**: ~$140M across 40+ chains (fragmented)
- **Model**: Multi-chain DEX with cross-chain swap (SushiXSwap)
- **Verdict**: Liquidity fragmented across too many chains. Not competitive on Base specifically.

### Recommendation: **Aerodrome Finance**

Aerodrome is the clear winner for a Base-native token launch. It has:

1. The deepest liquidity on Base (~$4.8B TVL)
2. Native AERO emission incentives for LPs
3. veAERO governance that can direct rewards to your pool
4. Multiple pool types (volatile for launch, CL for optimization later)
5. Strong ecosystem integration with Coinbase/Base

---

## 2. Liquidity Pool Setup

### Pair Selection: MBUCKS/WETH vs MBUCKS/USDC

| Factor             | MBUCKS/WETH                    | MBUCKS/USDC                |
| ------------------ | ------------------------------ | -------------------------- |
| Impermanent Loss   | High (both volatile)           | Moderate (one side stable) |
| Price Discovery    | Crypto-denominated             | USD-denominated (clearer)  |
| Target Audience    | Crypto-native traders          | Broader retail + DeFi      |
| LP Yield Potential | Higher (volatile pair)         | Lower without incentives   |
| User Friction      | Must hold ETH/WETH             | Must hold USDC             |
| Price Readability  | "0.0000001 ETH" (hard to read) | "$0.0001" (intuitive)      |

**Recommendation: MBUCKS/WETH**

Rationale:

- Gaming platform users are crypto-native (already on Base, already have ETH)
- WETH pairs tend to get more organic trading volume on Aerodrome
- ETH is the native gas token on Base, so all users already hold it
- Can add a MBUCKS/USDC pool later as a secondary pair
- Most successful Base token launches use WETH pairs

### Pool Type: Volatile (V2-style) vs Concentrated (Slipstream)

| Factor             | Volatile Pool (V2)          | Concentrated Liquidity (CL) |
| ------------------ | --------------------------- | --------------------------- |
| Formula            | x\*y=k (full range)         | Tick-based (price ranges)   |
| Management         | Set and forget              | Active rebalancing needed   |
| Capital Efficiency | Lower                       | Higher                      |
| Best For           | New tokens, price discovery | Established price range     |
| IL Risk            | Standard                    | Higher if price exits range |
| Complexity         | Simple                      | Complex                     |

**Recommendation: Start with Volatile Pool**

For a brand-new token with no price history, a volatile pool (V2-style) is the safest choice:

- Full-range liquidity means the token is always tradeable at any price
- No risk of liquidity going inactive if price moves
- Simple to set up and manage
- Switch to CL pool (with CL2000 tick spacing for emerging tokens) once price stabilizes

On Aerodrome specifically:

- **Volatile pool** (not stable): MBUCKS is not pegged to anything, so stable pool formulas would cause problems
- Pool swap fee: 0.3% is standard for volatile pairs

### LP Supply Allocation

Industry benchmarks for gaming tokens:

- Liquidity Pool allocation: **5-10% of total supply** is typical for initial LP
- Community/Ecosystem: 30-50%
- Team: 15-20% (with vesting)
- Play-to-earn rewards: 20-30%

**Recommendation: 5% of supply (50,000,000 MBUCKS) to initial LP**

With 10% released at launch, allocating half (5% of total = 50M tokens) to the LP is a solid ratio. The other 5% can go to early community distribution, airdrops, or initial rewards.

---

## 3. Price Math

### Scenario: 50M MBUCKS + $10,000 in ETH

Using the constant product formula (x \* y = k):

```
LP tokens:     50,000,000 MBUCKS
LP ETH value:  $10,000 USD in WETH

Initial price = $10,000 / 50,000,000 = $0.0002 per MBUCKS
```

### Market Cap Calculations

```
Circulating Supply at Launch:  100,000,000 (10% of 1B)
Initial Token Price:           $0.0002
Initial Market Cap:            100,000,000 x $0.0002 = $20,000
Fully Diluted Valuation (FDV): 1,000,000,000 x $0.0002 = $200,000
```

### Alternative Scenarios

| LP Tokens  | ETH Value | Token Price | Market Cap (10%) | FDV      |
| ---------- | --------- | ----------- | ---------------- | -------- |
| 50M (5%)   | $5,000    | $0.0001     | $10,000          | $100,000 |
| 50M (5%)   | $10,000   | $0.0002     | $20,000          | $200,000 |
| 100M (10%) | $10,000   | $0.0001     | $10,000          | $100,000 |
| 25M (2.5%) | $10,000   | $0.0004     | $40,000          | $400,000 |

### Analysis

- $0.0001 to $0.0004 per token is a reasonable range for a gaming utility token at launch
- FDV of $100K-$400K is modest and leaves room for growth
- Comparable gaming tokens (smaller projects) launched in similar ranges
- The key is having enough LP depth that a $500-$1000 buy doesn't cause massive slippage

### Slippage Check

With $10,000 in ETH in the pool:

- A $100 buy would cause ~1% price impact (acceptable)
- A $500 buy would cause ~5% price impact (noticeable but okay for early stage)
- A $1,000 buy would cause ~10% price impact (high but normal for micro-cap)

**Recommendation: $10,000 in ETH + 50M MBUCKS at $0.0002 starting price**

This gives a $20K market cap and $200K FDV, which is reasonable for a gaming utility token launching organically.

---

## 4. Launch Process: Step by Step

### Phase 1: Pre-Launch Preparation

1. **Finalize token contract** (already deployed on Base)
2. **Mint 100M tokens (10% of supply)** to team wallet
3. **Acquire ~$10,000 in WETH on Base**
   - Bridge ETH from mainnet via Base Bridge or buy on Coinbase and withdraw to Base
   - Wrap ETH to WETH (Aerodrome handles this automatically during LP creation)
4. **Prepare a multisig wallet** (Gnosis Safe on Base recommended for team treasury)

### Phase 2: Pool Creation on Aerodrome

1. **Go to** [aerodrome.finance/liquidity](https://aerodrome.finance/liquidity)
2. **Connect wallet** (MetaMask/Rabby) on Base network
3. **Click "New Position"** or "Create Pool"
4. **Add MBUCKS token**:
   - Paste the MBUCKS contract address
   - Accept the "unknown token" warning (normal for new tokens)
5. **Select pair**: MBUCKS / WETH
6. **Choose pool type**: Basic/Volatile (NOT Stable, NOT Concentrated for initial launch)
7. **Set initial price**: Enter the ratio of tokens to set the $0.0002/token price
   - Deposit 50,000,000 MBUCKS
   - Deposit equivalent WETH (~$10,000 worth)
8. **Approve MBUCKS** (one-time token approval transaction)
9. **Confirm deposit** (creates the pool and adds liquidity)
10. **Receive LP tokens** representing your pool position

### Phase 3: Post-Pool Setup

1. **Stake LP tokens on Aerodrome** to earn AERO rewards
2. **Add token to Aerodrome's Tokenlist**:
   - Submit a PR to the Aerodrome Tokenlist repo on GitHub
   - Or request help on Aerodrome Discord
3. **Verify token contract on BaseScan** (if not already)
4. **Lock LP tokens** (see Section 6)

### Phase 4: Listings & Visibility

1. **Apply to CoinGecko** (free listing, requires active LP and trading volume)
2. **Apply to CoinMarketCap** (free listing)
3. **Submit to DexScreener** (auto-indexed, but can expedite)
4. **Add to Base ecosystem directories**

---

## 5. Base-Specific Considerations

### Gas Costs (Very Low)

| Action                      | Estimated Cost |
| --------------------------- | -------------- |
| Token deployment            | < $1.00        |
| Pool creation               | < $0.50        |
| Adding liquidity            | < $0.50        |
| Token approval              | < $0.10        |
| LP staking                  | < $0.10        |
| **Total launch cost (gas)** | **< $3.00**    |

Current Base gas: ~0.020 Gwei (Feb 2026). Post-Dencun upgrade, typical transactions cost $0.05-$0.30.

### Base Ecosystem Grants & Programs

| Program                           | Amount                                 | Details                                |
| --------------------------------- | -------------------------------------- | -------------------------------------- |
| Builder Grants (Retroactive)      | 1-5 ETH                                | For shipped projects ready to scale    |
| Base Batches 2026 (Startup Track) | $10K grant + potential $50K investment | 8-week virtual program, Demo Day in SF |
| Base Batches 2026 (Student Track) | Travel + Demo Day                      | Undergraduate teams only               |
| Weekly Builder Rewards            | 2 ETH/week                             | Via Talent Protocol                    |
| Base Ecosystem Fund               | Pre-seed to seed investment            | Coinbase Ventures backed               |
| OP Retro Funding                  | Varies                                 | Public goods contributions             |

**Action Item**: Apply to Base Batches 2026 Startup Track. Moltblox (gaming platform with on-chain economy) fits the profile. $10K grant + potential $50K investment from Coinbase Ventures.

Website: [basebatches.xyz](https://www.basebatches.xyz/)
Funding docs: [docs.base.org/get-started/get-funded](https://docs.base.org/get-started/get-funded)

### Coinbase Distribution Advantages

- Base is built by Coinbase, meaning potential exposure to Coinbase's 100M+ verified users
- Tokens on Base can be bridged to Coinbase Wallet seamlessly
- Coinbase has been listing Base-native tokens more frequently
- cbETH and USDC on Base are deeply liquid, providing strong trading pairs

---

## 6. LP Lock / Vesting

### Why Lock LP Tokens

- **Prevents rug pulls**: Locking LP tokens in a smart contract means the team cannot withdraw liquidity and run away
- **Builds trust**: Locked LP is one of the first things investors/traders check
- **Required for listings**: CoinGecko and CoinMarketCap often require LP lock proof
- **Community confidence**: Shows long-term commitment to the project

### LP Locking Platforms on Base

| Platform             | TVL (Locked) | Base Support      | V3 NFT Lock            | Cost      |
| -------------------- | ------------ | ----------------- | ---------------------- | --------- |
| **UNCX Network**     | ~$63M        | Yes               | Yes (V3 NFT positions) | Small fee |
| **Team Finance**     | ~$124M       | Yes               | Dashboard-driven       | Small fee |
| **GoPlus Locker V3** | ~$46M        | Yes (Base-native) | Yes                    | Small fee |
| **FlokiFi Locker**   | ~$25.78M     | Yes               | Varies                 | Small fee |
| **DxLock (DxSale)**  | Varies       | Yes               | Self-custody model     | Small fee |

**Recommendation: UNCX Network or Team Finance**

- UNCX has the most advanced features (relock, incremental locks, lock splitting)
- Team Finance has the highest TVL and broadest recognition
- Both are well-established and trusted by the DeFi community
- Both support Base chain and Aerodrome LP tokens

### Recommended Lock Parameters

- **Lock Duration**: 12 months minimum (6 months is seen as weak; 12+ months is standard)
- **Ideal**: 12-24 months, with option to extend (UNCX relock feature)
- **What to Lock**: 100% of team-held LP tokens
- **Vesting**: Linear unlock after cliff is also acceptable (e.g., 6-month cliff, then linear over 12 months)

### Lock Process (UNCX Example)

1. Go to uncx.network
2. Connect wallet on Base
3. Select "Lock Liquidity"
4. Choose the MBUCKS/WETH LP token
5. Enter amount (all LP tokens)
6. Set unlock date (12-24 months from launch)
7. Approve and confirm transaction
8. Share the lock proof URL with community

---

## 7. Launch Checklist Summary

```
PRE-LAUNCH
[ ] Token contract deployed and verified on BaseScan
[ ] Multisig wallet set up (Gnosis Safe on Base)
[ ] 100M MBUCKS minted (10% of supply)
[ ] $10,000 WETH acquired on Base
[ ] Tokenomics finalized and published

POOL CREATION
[ ] Create MBUCKS/WETH volatile pool on Aerodrome
[ ] Deposit 50M MBUCKS + $10K WETH (price: $0.0002/token)
[ ] Stake LP tokens on Aerodrome for AERO rewards
[ ] Lock LP tokens via UNCX or Team Finance (12+ months)

POST-LAUNCH
[ ] Submit token to Aerodrome Tokenlist
[ ] Submit to DexScreener / DEXTools
[ ] Apply to CoinGecko listing
[ ] Apply to CoinMarketCap listing
[ ] Announce launch with LP lock proof

ECOSYSTEM
[ ] Apply to Base Batches 2026 Startup Track
[ ] Apply for Base Builder Grants (1-5 ETH)
[ ] Explore AERO gauge voting for LP incentives
```

---

## 8. Sources

- [DeFiLlama: Base Chain](https://defillama.com/chain/base)
- [DeFiLlama: Aerodrome](https://defillama.com/protocol/aerodrome-finance)
- [DeFiLlama: Uniswap](https://defillama.com/protocol/uniswap)
- [DeFiLlama: BaseSwap](https://defillama.com/protocol/baseswap)
- [DeFiLlama: SushiSwap](https://defillama.com/protocol/sushiswap)
- [Aerodrome Finance](https://aerodrome.finance/liquidity)
- [Aerodrome Docs (GitHub)](https://github.com/aerodrome-finance/docs/blob/main/content/liquidity.mdx)
- [Aerodrome Contracts (GitHub)](https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md)
- [Base Gas Tracker](https://basescan.org/gastracker)
- [Base Network Fees Documentation](https://docs.base.org/base-chain/network-information/network-fees)
- [Base Get Funded](https://docs.base.org/get-started/get-funded)
- [Base Batches 2026](https://www.basebatches.xyz/)
- [UNCX Network Docs](https://docs.uncx.network/guides/for-projects/liquidity-lockers-v3)
- [Team Finance](https://www.team.finance/lockups)
- [Token Vesting Benchmarks (LiquiFi)](https://www.liquifi.finance/post/token-vesting-and-allocation-benchmarks)
- [Gaming Tokenomics Design (Black Tokenomics)](https://blacktokenomics.com/designing-tokenomics-for-crypto-games/)
- [Tokenomics for Crypto Games (Blaize)](https://blaize.tech/article-type/tokenomics-for-crypto-games-how-to-develop-economy-for-gamefi)
- [Aerodrome Ecosystem Review (SimpleSwap)](https://simpleswap.io/learn/analytics/projects/aerodrome-finance-ecosystem-review)
- [CoinDesk: Aero DEX](https://www.coindesk.com/business/2026/01/29/aero-dex-aims-to-fix-liquidity-fragmentation-and-dethrone-the-incumbents)
- [Coinbase Ventures](https://www.coinbase.com/ventures)
- [How to Create Base Liquidity Pool (Smithii)](https://smithii.io/en/create-base-liquidity-pool/)
- [How to Create Liquidity Pool on Uniswap (Smithii)](https://smithii.io/en/create-liquidity-pool-uniswap/)
- [Crypto Adventure: Top Token Lockers 2026](https://cryptoadventure.com/top-token-lockers-in-2026/)
