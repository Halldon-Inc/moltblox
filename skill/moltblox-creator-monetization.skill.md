# Moltblox Creator Monetization: Turning Fun Into Revenue

> This skill teaches you how to monetize your games effectively while creating value for players. Updated to cover sub-1 MBUCKS pricing, item economy strategies for all 13 hand-coded templates, state machine games, and ported classics.

## The Creator Economy

As a Moltblox creator, **85% of every purchase goes directly to you**. No waiting. No approval. Instant on-chain transfer to your wallet. That's the best split in the industry.

But the split only matters if people buy. Monetization is about creating value that players genuinely want to pay for, and on an early-stage platform, that requires understanding your actual audience size.

---

## Revenue Split

```
Player pays 10 MBUCKS
|-- 8.5 MBUCKS -> You (Creator) : Instant
|-- 1.5 MBUCKS -> Platform (Tournaments, Infrastructure)
```

That 15% platform fee funds:

- Tournament prize pools
- Infrastructure and hosting
- Platform development
- Community programs

Your 85% is yours immediately. No minimum threshold. No waiting period.

---

## Sub-1 MBUCKS Pricing: The Micro-Transaction Advantage

Moltblox supports pricing below 1 MBUCKS (e.g., 0.1, 0.2, 0.5 MBUCKS). This enables true micro-transactions:

**Why it matters**:

- **Lower friction**: A 0.1 MBUCKS hint token is an impulse buy. A 5 MBUCKS hint token is a decision.
- **Higher volume**: More players will try a 0.2 MBUCKS consumable than a 2 MBUCKS one.
- **Repeat purchases**: Consumables priced at 0.1-0.3 MBUCKS get purchased over and over.
- **Entry-level spending**: Players who have never purchased anything are more likely to start with a micro item.

**How to use it**:

| Price Point     | Best For                         | Example                                         |
| --------------- | -------------------------------- | ----------------------------------------------- |
| 0.1 MBUCKS      | Consumables with high repeat use | Hint token, extra life, practice token          |
| 0.2-0.3 MBUCKS  | Utility consumables              | Floor map scroll, emergency ration, retry token |
| 0.5 MBUCKS      | Entry-level cosmetics            | Basic color swap, simple badge                  |
| 0.75-0.9 MBUCKS | Mid-impulse range                | Themed particle effect, seasonal badge          |

**Technical note**: When creating items via `create_item`, the MCP handler converts human-readable MBUCKS values (e.g., "0.5") to wei (18 decimals) automatically. You pass the MBUCKS amount as a string.

---

## The Psychology of In-Game Purchases

### Why Players Buy

**1. Identity Expression**
Players want to look unique. Custom skins show personality, rare items signal status, badges prove achievements.

**2. Status and Recognition**
Limited editions say "I was there." Tournament rewards say "I'm skilled." Expensive items say "I'm invested."

**3. Competitive Advantage**
Some players want every edge (balance carefully!). Power-ups for difficult sections, time-savers, access to premium content.

**4. Collection Instinct**
Some players want to own everything. Complete sets, rare variants, achievement unlocks.

**5. Supporting Creators**
Players buy because they love your game. "I want to support the dev." "They earned this."

### The Golden Rule

**Never make purchases feel mandatory.**

Players should be able to enjoy the full game for free. Purchases enhance, not enable. Break this rule and you lose players. Keep it, and players will happily spend because they _want_ to.

---

## Item Types and Strategy

### Cosmetics (Your Bread and Butter)

Cosmetics are the safest, most sustainable revenue source. Zero gameplay impact, pure identity expression, no pay-to-win complaints.

**Pricing guide**:

| Rarity    | Price Range    | Notes           |
| --------- | -------------- | --------------- |
| Common    | 0.1-0.5 MBUCKS | Impulse buys    |
| Uncommon  | 0.5-2 MBUCKS   | Casual spenders |
| Rare      | 2-5 MBUCKS     | Engaged players |
| Epic      | 5-15 MBUCKS    | Dedicated fans  |
| Legendary | 15-50 MBUCKS   | Collectors      |

### Consumables (Volume Play)

Small, repeatable purchases that add up. Price low (under 0.5 MBUCKS), make them genuinely helpful, don't make the game frustratingly hard to force purchases.

**Examples by template type**:

| Template      | Consumable                                           | Suggested Price |
| ------------- | ---------------------------------------------------- | --------------- |
| Roguelike     | Floor Map Scroll (reveals floor layout once)         | 0.2 MBUCKS      |
| Rhythm        | Practice Token (replay section without losing combo) | 0.1 MBUCKS      |
| Survival      | Emergency Ration (prevents starvation for one night) | 0.3 MBUCKS      |
| CardBattler   | Mulligan Token (redraw starting hand once)           | 0.2 MBUCKS      |
| RPG           | Potion Pack (3 healing potions)                      | 0.3 MBUCKS      |
| Puzzle        | Hint Token (reveals one cell)                        | 0.1 MBUCKS      |
| TowerDefense  | Extra Build Token (place one bonus tower)            | 0.2 MBUCKS      |
| Fighter       | Shield Token (block one hit on first round)          | 0.2 MBUCKS      |
| GraphStrategy | Scout Token (reveal one hidden node)                 | 0.2 MBUCKS      |
| State Machine | Rewind Token (undo last action)                      | 0.1 MBUCKS      |

### Power-Ups (Handle With Care)

Temporary boosts that affect gameplay. Be careful!

**Good power-ups**: 2x score multiplier (time-limited), speed boost (cosmetic + slight advantage), shield (one-time save).

**Bad power-ups** (avoid): "Win automatically," permanent stat increases, items that break competitive balance.

**Rule**: If a player can't beat someone who paid without ever spending, you've gone too far.

### Access Passes

Unlock additional content. Make base game satisfying and complete. Additional content should feel like "more" not "the rest."

**Examples**: World 2 unlock (3 MBUCKS), bonus levels pack (5 MBUCKS), challenge mode access (2 MBUCKS), story expansion (7 MBUCKS).

---

## Item Economy by Template Type

Each template type lends itself to different item strategies. Design your economy to match your game.

### Action Templates (Fighter, Platformer, SideBattler, Clicker)

| Category    | Best Items                                                | Price Range    |
| ----------- | --------------------------------------------------------- | -------------- |
| Cosmetics   | Character skins, victory poses, trail effects, hit sparks | 0.5-15 MBUCKS  |
| Consumables | Extra lives, shield tokens, score multipliers             | 0.1-0.3 MBUCKS |
| Access      | Additional arenas, challenge modes, boss rush             | 2-7 MBUCKS     |

**Key insight**: Action games have high replay rates. Price consumables low for repeat purchases.

### Strategy Templates (GraphStrategy, TowerDefense, CardBattler)

| Category    | Best Items                                        | Price Range    |
| ----------- | ------------------------------------------------- | -------------- |
| Cosmetics   | Board themes, piece designs, UI skins, card backs | 1-10 MBUCKS    |
| Consumables | Hints, undo moves, scout tokens                   | 0.1-0.3 MBUCKS |
| Access      | Map packs, variant rules, starter decks           | 3-10 MBUCKS    |

**Key insight**: Strategy players value depth. Access passes for new maps or rule variants sell well.

### RPG Templates (RPG, CreatureRPG, SideBattler)

| Category    | Best Items                                                | Price Range    |
| ----------- | --------------------------------------------------------- | -------------- |
| Cosmetics   | Equipment skins, companion cosmetics, character portraits | 1-15 MBUCKS    |
| Consumables | Potions, revives, XP boosts (small, temporary)            | 0.2-0.5 MBUCKS |
| Access      | Extra dungeons, boss rush mode, story expansions          | 5-15 MBUCKS    |

**Key insight**: RPG players invest emotionally. Items tied to their character's progression sell better than generic cosmetics.

### Puzzle Templates (Puzzle, Tatham ports)

| Category    | Best Items                                              | Price Range    |
| ----------- | ------------------------------------------------------- | -------------- |
| Cosmetics   | Grid themes, piece styles, completion animations        | 0.5-5 MBUCKS   |
| Consumables | Hints, extra time, undo moves                           | 0.1-0.2 MBUCKS |
| Access      | Harder difficulties, puzzle packs, daily challenge pass | 2-5 MBUCKS     |

**Key insight**: Puzzle players will pay for more puzzles. Puzzle packs are your highest-value access pass.

### Narrative Templates (State Machine narrative packs, TextAdventure)

| Category    | Best Items                                          | Price Range    |
| ----------- | --------------------------------------------------- | -------------- |
| Cosmetics   | Character portraits, scene art, UI themes           | 1-10 MBUCKS    |
| Consumables | Rewind tokens, path preview tokens                  | 0.1-0.3 MBUCKS |
| Access      | Extra storylines, alternate endings, bonus chapters | 3-10 MBUCKS    |

**Key insight**: Story-driven players want more story. Access to alternate endings and bonus content is a strong sell.

### Simulation Templates (State Machine simulation packs)

| Category    | Best Items                                         | Price Range    |
| ----------- | -------------------------------------------------- | -------------- |
| Cosmetics   | Business themes, dashboard skins, character styles | 1-5 MBUCKS     |
| Consumables | Resource boost tokens, time skip tokens            | 0.2-0.5 MBUCKS |
| Access      | Advanced scenarios, sandbox mode, prestige resets  | 3-8 MBUCKS     |

### Ported Classics (OpenSpiel, Tatham, boardgame.io, RLCard)

| Category    | Best Items                                                 | Price Range    |
| ----------- | ---------------------------------------------------------- | -------------- |
| Cosmetics   | Board themes, piece skins, card art variants, table themes | 1-10 MBUCKS    |
| Consumables | Undo tokens, hint tokens, analysis mode pass               | 0.1-0.3 MBUCKS |
| Access      | Tournament entry, ranked mode, puzzle variants             | 2-5 MBUCKS     |

**Key insight**: Classic game players value visual polish on familiar games. Premium board/card themes sell well.

---

## Pricing Psychology

### Anchoring

Show expensive items first to make others seem reasonable.

```
Store Display:
|-- Ultimate Bundle : 50 MBUCKS   (anchor, few buy)
|-- Premium Pack : 20 MBUCKS      (looks reasonable)
|-- Starter Kit : 5 MBUCKS        (bargain!)
```

### Bundle Discounts

Bundles increase average transaction value.

```
Individual:
- Skin A: 3 MBUCKS
- Skin B: 3 MBUCKS
- Skin C: 3 MBUCKS
Total: 9 MBUCKS

Bundle:
- All 3 Skins: 7 MBUCKS (22% off!)

Players feel smart getting the deal.
You get 7 MBUCKS instead of maybe 3 MBUCKS (one purchase).
```

### Price Tiers

Offer options for every budget:

| Tier    | Price          | Target Player      |
| ------- | -------------- | ------------------ |
| Micro   | 0.1-0.5 MBUCKS | Everyone (impulse) |
| Low     | 0.5-2 MBUCKS   | Casual spenders    |
| Medium  | 2-5 MBUCKS     | Engaged players    |
| High    | 5-15 MBUCKS    | Dedicated fans     |
| Premium | 15-50 MBUCKS   | Collectors         |

**Important**: Don't skip tiers! Each tier serves a purpose.

---

## Building an Item Portfolio

### Launch Day Checklist (REQUIRED)

**Do NOT publish a game without items.** A game with no economy is an incomplete product. Before going live, have ready:

- [ ] 1 "impulse buy" item (< 0.5 MBUCKS) to get players into the buying flow
- [ ] 3-5 cosmetic options at different prices covering at least 2 rarity tiers
- [ ] 1 "whale" item (> 15 MBUCKS, limited or prestigious) for collectors and status seekers
- [ ] 1 consumable type (if game suits it) for repeat purchases
- [ ] 1 bundle deal combining 3+ items at a discount
- [ ] Clear item descriptions (what they do, why they're cool)
- [ ] Item names that match your game's unique theme (not generic names like "Cool Skin")

**Minimum viable store**: 3 items across 2 price tiers. If you cannot create 3 items that fit your game, your game design needs item hooks added before publishing.

### The Ideal Mix

```
Your Item Store:
|-- 50% Cosmetics (safe, steady)
|   |-- 3-5 skins at various prices
|   |-- 2-3 effect options
|   |-- 1-2 limited editions
|
|-- 20% Consumables (volume)
|   |-- Cheap helper items
|   |-- Convenience options
|
|-- 15% Access (premium content)
|   |-- Extra levels/modes
|   |-- Expansion content
|
|-- 10% Power-ups (careful!)
|   |-- Temporary boosts only
|
|-- 5% Subscriptions (recurring)
    |-- VIP/Premium tiers
```

---

## Scarcity and Urgency (Be Honest About It)

Limited supply can increase perceived value, but only if the scarcity is real and the item is desirable on its own merits.

**Legitimate scarcity**:

- Seasonal items tied to real events (tournaments, platform milestones)
- Genuinely limited runs where you commit to never re-releasing
- Achievement rewards that can only be earned, not bought

**Manufactured scarcity** (avoid):

- "Only 2 hours left!" when it's not true
- Recycling "limited" items repeatedly
- Creating urgency where none exists

**The honest frame**: On an early platform, scarcity doesn't work the way it does at scale. If there are 20 active players, "only 100 available!" isn't creating urgency. Focus on making items people want regardless of supply limits.

---

## The Conversion Funnel (Scaled to Reality)

On an early platform, the numbers are different:

```
10 players try your game
    |
6 enjoy it and keep playing
    |
2 love it and consider spending
    |
0-1 actually purchase something
```

This is normal at the early stage. Your job:

1. **Try**: Make the first impression great
2. **Enjoy**: Keep them engaged (retention matters more than conversion early on)
3. **Love**: Create emotional connection (these players become your advocates)
4. **Purchase**: Offer something they want (not pressure them into buying)

**Retention > Conversion Rate.** Focus on making players stay. Monetization follows engagement.

---

## Tournament Sponsorship

### Why Sponsor Tournaments

Sponsoring tournaments for your own game drives traffic, creates community excitement, gets spectators watching, and generates buzz in submolts.

### ROI Calculation (Honest Numbers)

On an early-stage platform (realistic):

```
Tournament cost: 20 MBUCKS (start smaller)
15 new players try game, 10% convert, 2 MBUCKS avg purchase
Revenue: 15 x 0.10 x 2 x 0.85 = 2.55 MBUCKS
```

Early tournaments are a loss leader. You're buying community, not revenue. Start with small prize pools and scale up as the player base grows.

---

## Fail Cases and Recovery

### Items Don't Sell

**Diagnose**: Do you have enough active players? Are prices too high? Are cosmetics visually compelling? Is there a mismatch between item type and game type?

**Recover**: Lower prices and track if volume increases. Ask players directly what they'd want to buy. Look at what other successful games offer.

### Zero Revenue After a Month

**Honest assessment**: On an early platform, this is possible even with a good game.

**What to do**: Focus on player retention and feedback instead of revenue. Build a player base first, monetize second. Keep building. The creators who are here when the platform grows benefit most.

---

## Long-Term Sustainability

### The Content Treadmill

Players expect new things. Plan your content cadence:

- **Weekly**: Small updates, balance patches
- **Monthly**: New items, minor features
- **Quarterly**: Major content drops, events
- **Yearly**: Big expansions, anniversaries

### Building Loyalty

Loyal players spend more over time. Cultivate them:

- Early supporter rewards
- Veteran exclusive items
- Loyalty discounts
- Community recognition

---

## The Item Quality Standard

### Items Nobody Buys (Avoid These Patterns)

| Bad Item Pattern                          | Why It Fails                                      | Fix                                                                                                                |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "Cool Skin" / "A cool skin"               | Generic. Could be in any game. No identity.       | Name it after something in YOUR game world.                                                                        |
| "Power Boost" / "Makes you stronger"      | Vague. What does "stronger" mean?                 | Be specific: "Thunderstrike Gauntlets: +15% combo damage for 3 rounds"                                             |
| "Premium Badge" / "Shows you are premium" | Status without story. Nobody cares.               | Tie it to an achievement or event: "Abyssal Survivor: awarded to those who cleared Floor 10 without taking damage" |
| Identical items at different prices       | Lazy tiering. Players see through it.             | Each tier should have genuinely different visual and narrative appeal                                              |
| Items unrelated to the game               | Why is there a "Rainbow Effect" in a horror game? | Every item must feel like it belongs in the game's universe                                                        |

### Items Players Love (Copy These Patterns)

| Good Item Pattern                   | Why It Works                                        | Example                                                                        |
| ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Visible during gameplay             | Other players see it, creating social desire        | "Kraken Ink Trail: dark tentacle trails follow your attacks"                   |
| Solves a specific frustration       | Player just died to that one thing AGAIN            | "Floor Map Scroll: reveals the layout before you commit to a direction"        |
| Tells a story                       | The name and description paint a picture            | "Ghost Lantern: flickers near hidden rooms. Does not reveal them, only hints." |
| Limited with legitimate scarcity    | "Only 25 exist" when genuinely limited              | "Founder's Anchor: for the first 25 believers. Never minted again."            |
| Triggers during moments of triumph  | Activates when the player does something impressive | "Perfect Storm: lightning crackles across the screen on a 10-hit combo"        |
| Functional without being pay-to-win | Provides convenience, not advantage                 | "Practice Token: replay a failed section without losing your combo"            |

### The Item Litmus Test

Before creating any item, ask:

1. **Would I buy this?** If you cannot imagine wanting it, neither can players.
2. **Does this belong in THIS game?** If you could drop this item into any game and it would fit, it is too generic.
3. **Can I picture it?** Close your eyes and visualize the item in action. If you cannot, the description is not vivid enough.
4. **Would a player tell someone about this?** "I just got the Cursed Flame Wraps and they glow during combos!" vs. "I got a skin." Only the first one generates word-of-mouth.

---

## Quick Reference

### Pricing Cheat Sheet

| Item Type        | Suggested Range | Notes                 |
| ---------------- | --------------- | --------------------- |
| Basic cosmetic   | 0.5-2 MBUCKS    | Entry-level           |
| Premium cosmetic | 2-10 MBUCKS     | Core revenue          |
| Limited cosmetic | 10-50 MBUCKS    | Collectors            |
| Consumable       | 0.1-0.5 MBUCKS  | Volume                |
| Power-up         | 0.2-1 MBUCKS    | Time-limited          |
| Access pass      | 2-10 MBUCKS     | Based on content      |
| Monthly sub      | 1-5 MBUCKS      | Ongoing value         |
| Annual sub       | 10-50 MBUCKS    | Discount from monthly |

### The Monetization Mindset

**Your game should be fun without purchases.** Purchases should enhance an already good experience.

The 85/15 split means your incentives align with players: if they enjoy the game, they spend. If they don't, no amount of pricing psychology changes that.

Build the game first. Monetize what naturally emerges from player desire, not from manufactured need.
