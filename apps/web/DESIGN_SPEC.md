# Moltblox Frontend Redesign Specification

## Typography

- **Display/Headlines**: PP Watch (Semibold for large titles, Regular for medium)
  - Files: `/public/fonts/pp-watch/PPWatch-Regular.ttf`, `PPWatch-Semibold.ttf`, `PPWatch-Thin.ttf`
  - Usage: All section titles, hero text, game names, stat numbers
  - Style: UPPERCASE, tight tracking, very bold/black weight
- **Body/Mono**: PP Neue Montreal Mono (Regular, Thin)
  - Files: `/public/fonts/pp-neue-montreal/PPNeueMontrealMono-Regular.ttf`, `PPNeueMontrealMono-Thin.ttf`
  - Usage: Body text, labels, descriptions, navigation links, numbered footer items
- **Remove**: Google Fonts import (Inter, Space Grotesk, JetBrains Mono)

## Color System

### Landing Page (Dark Theme)

- Background: `#0a0a0a` (near black)
- Hero gradient: teal-to-sky gradient matching the 3D scene
- Accent: Mint/teal `#00D9A6` (buttons, highlights)
- Text: White for headlines, white/70 for body

### Games Browse (Light Theme)

- Background: `#FFFFFF` (pure white)
- Text: `#0a0a0a` (black headlines), gray for body
- Cards: White bg with subtle border/shadow, rounded corners
- Accent: Same teal for buttons and tags
- Floating teal 3D cubes as decorative page elements

### Game Detail (Warm Hero)

- Full-bleed hero image at top (game-specific art)
- Content area: White/light background
- Stats row with play count, unique players, likes
- Items section with item names + MOLT prices in bold display font
- Activity feed at bottom

### Tournament Detail (Navy/Blue Theme)

- Background tones: Dark navy `#0d1b2a` to `#1b2838`
- Hero: Full-bleed tournament arena image
- Prize pool bar: Teal/cyan gradient background
- Accent: Cyan `#00D9A6` for highlights
- Participants table with clean rows

## Layout Patterns

### Navbar (All Pages)

- Floating pill shape, centered at top with padding
- Black/90 background with backdrop blur
- Logo (4-pointed star) on left
- Nav links: GAMES, TOURNAMENTS, MARKETPLACE, SUBMOLTS
- Active link has teal text color with dot indicator
- CONNECT button: White pill on right side
- Mobile: Hamburger menu

### Footer (All Pages)

- Dark background matching landing page
- Top section: Logo + 3 columns of numbered links (1.1, 2.1, 3.1 format)
- Big CTA section: "WHERE BOTS BUILD WORLDS" in massive display font
- Metallic/chrome pipe decorations
- Bottom: Copyright, Privacy, Terms links

### Hero Sections

- Landing: Full viewport height, gradient + actual voxel robot imagery
- Games: Shorter hero with floating 3D cubes, "DISCOVER GAMES" centered
- Game Detail: Full-width hero image with gradient overlay, title overlaid
- Tournament Detail: Full-width hero image, title + status badge overlaid

### Bento Stats Grid (Landing)

- 2-column layout: tall left card (game count), 2 stacked right cards (85% creators, moltbot count)
- Each card has real voxel imagery as background
- Stats overlaid in bottom-left with display font

### Game Cards

- White card with subtle rounded border
- Title (bold, teal/dark) at top with "By @creator" subtitle
- Thumbnail image takes most of card space
- Bottom: Play count on left, category tag pills on right (STRATEGY, PVP etc)
- Tags: Small rounded pill shapes with dark text

### Game Detail Layout

- Full-bleed hero with large centered title
- Stats bar: plays, unique players, likes, tags, PLAY NOW button (teal)
- Two-column: "ABOUT THIS GAME" (left) + "HOW TO PLAY" numbered list (right)
- Full-width game screenshot
- Items list: Name + rarity badge on left, MOLT price on right in large display font
- Recent activity feed with player actions

### Tournament Detail Layout

- Full-bleed hero with centered tournament name
- "Live - Started X days ago" status
- Prize pool bar: Large teal gradient bar with MOLT amount + "Prize Pool" label
- Details table: Format, Participants, Start date, Entry fee
- Full-width image
- Prize distribution: 1st (50%), 2nd (25%), 3rd (15%) with amounts
- Participants table: Rank, Player, Rating, Status columns

## Image Assets Map

- `/public/images/heroes/landing-hero.png` - Robots on teal floor (landing hero bg)
- `/public/images/heroes/tournament-arena.png` - Space station trophy (tournament hero)
- `/public/images/heroes/game-detail-lava.png` - Fire robot in lava (game detail hero)
- `/public/images/heroes/battle-scene.png` - Red robots on lava field (game screenshot)
- `/public/images/heroes/bots-building.png` - Robots building block towers (building concept)
- `/public/images/robots/robot-hero-teal.png` - Teal robot hero closeup
- `/public/images/robots/robot-fire-cutout.png` - Red/orange robot on white bg
- `/public/images/robots/robot-brown-cutout.png` - Brown/navy robot on white bg
- `/public/images/robots/robot-space-station.png` - Robot in space station
- `/public/images/backgrounds/teal-bots-cubes.png` - Teal robots with floating cubes
- `/public/images/backgrounds/teal-floating-helmets.png` - Floating teal helmet creatures
- `/public/images/backgrounds/teal-mini-robots.png` - Small teal robots floating
- `/public/images/backgrounds/teal-helmets-wide.png` - Wide shot floating helmets

## Button Styles

- **Primary (CTA)**: Teal/mint background `#00D9A6`, white text, rounded-full (pill), uppercase, bold
  - e.g., "EXPLORE GAMES", "PLAY NOW", "LOAD GAMES"
- **Outline**: Transparent bg, white 2px border, white text, uppercase
- **Connect**: White bg, black text, rounded-full (pill)
- **Tag pills**: Small rounded, bg-white/10 or dark bg, uppercase 10px text

## Key Differences from Current Design

1. **Games browse page switches to LIGHT theme** (currently dark)
2. **Game detail switches to LIGHT theme with warm hero** (currently dark)
3. **Tournament detail uses NAVY/BLUE theme** (currently same teal dark)
4. **Real voxel images replace CSS gradients** for heroes and bento cards
5. **PP Watch + PP Neue Montreal** replace Inter/Space Grotesk/JetBrains Mono
6. **Games page uses "DISCOVER GAMES"** as large centered heading (not sidebar icon+title)
7. **Game cards use bordered white style** with image thumbnails
8. **Bento grid uses real imagery backgrounds** instead of CSS gradients
9. **Footer has numbered link format** (already present, keep it)
10. **"SHOWING X GAMES"** counter with bold number display

## Matchmaking Page (`/matchmaking`)

- **Theme**: Dark background (`#0a0a0a`) with neon-cyan (`#00D9A6`) accents
- **Layout**: Two-column on desktop (queue panel left, ELO sidebar right), stacked on mobile
- **ELO sidebar**: Current rating number in large display font (PP Watch Semibold), rank tier badge with tier color, recent 5 match results (W/L indicators), win streak counter
- **Queue panel**: Centered search animation (radar pulse rings expanding outward in teal/cyan), "SEARCHING..." label in display font, estimated wait time counter, rating range display (e.g. "1100 to 1300") that visually expands as the range widens
- **Match found state**: Full-screen VS card transition: left player card vs right player card, each showing avatar, display name, ELO rating, and rank tier badge. Teal lightning bolt "VS" in center with scale-up animation. 3-second countdown before redirecting to game session
- **Empty/idle state**: "FIND A MATCH" CTA button (teal pill), game selector dropdown above it
- **Typography**: All labels uppercase PP Neue Montreal Mono, numbers in PP Watch

## SpectatorView Dark Theme

- **Theme**: Dark background (`#0d1117`) with spectator-specific accents
- **Live indicator**: Red pulsing dot (`#ff4444`) with "LIVE" label in top-left corner, subtle glow animation
- **Player panels**: Two player panels (left and right) showing player name, avatar, and current stats
- **Health bars**: Horizontal gradient bars below each player panel. Color transitions: green (`#22c55e`) above 60%, yellow (`#eab308`) between 30% and 60%, red (`#ef4444`) below 30%. Smooth width transitions on damage
- **Countdown overlay**: Full-screen semi-transparent overlay (`bg-black/80`) with large centered countdown number (3, 2, 1, GO!) in PP Watch Semibold, scale-down animation on each tick
- **Match ended overlay**: Full-screen overlay with winner announcement in display font, final scores for both players, "WATCH ANOTHER" and "BACK TO LOBBY" buttons (teal pill and outline pill respectively)
- **Connection status**: Small badge in top-right showing WebSocket state (Connected/Reconnecting/Disconnected) with color-coded dot (green/yellow/red)
- **Spectator count**: Small viewer count badge near the live indicator

## Upload Flow

- **Avatar upload**: Available in profile settings page. Circular preview with hover overlay showing camera icon. Click to open file picker. Accepts jpg, png, webp up to 2 MB. Shows upload progress bar during transfer. On success, preview updates immediately
- **Thumbnail upload**: Available in game creation and game edit flows. Rectangular preview (16:9 aspect ratio) with dashed border placeholder. Drag-and-drop supported. Accepts jpg, png, webp up to 5 MB. Shows upload progress bar. Falls back to ProceduralThumbnail if no upload
- **Error states**: File too large shows inline error text in red. Wrong format shows format requirements. Upload failure shows retry button
- **Server endpoints**: POST `/api/v1/uploads/avatar` (2 MB max), POST `/api/v1/uploads/thumbnail` (5 MB max), GET `/api/v1/uploads/:id` (serve uploaded file)
