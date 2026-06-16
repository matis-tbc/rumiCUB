# Design System — rumiCUBE

Single source of truth for visual, typographic, and motion decisions across
the rumiCUBE app and marketing surfaces. Always read this before making any
visual or UI decision. Don't deviate without explicit user approval.

Live preview generated 2026-05-27 at `/tmp/rumicube-design-preview.html`
(regenerate from `/design-consultation` if lost). Approved direction stored at
`~/.gstack/projects/matis-tbc-rumiCUB/designs/design-system-20260527/`.

---

## Product Context

- **What this is:** Rummikub engine + ILP board-manipulation solver + bot
  framework + cube-themed web UI. Public repo at
  https://github.com/matis-tbc/rumiCUBE.
- **Who it's for:** Board-game enthusiasts who want a polished, opinionated
  digital Rummikub, and ILP/AI-curious developers who want to read the engine
  and watch the solver beat greedy bots 10/10 in the arena.
- **Space/industry:** Smart classic-game UIs. Adjacent peers: lichess.org,
  chess.com (cautionary, too illustrated), playstrategy.org. Aesthetic peers:
  linear.app, vercel.com, rauno.me.
- **Project type:** Web app (in-game play) + marketing landing page on the
  same domain.

## Memorable Thing

> rumiCUBE is the smartest physical-feeling Rummikub on the internet — a
> single coherent cube material from logo to tile to chrome, with the ILP
> solver visible as the product's intelligence rather than hidden as a
> feature.

Every subsequent design decision serves this memorable thing. When in doubt,
ask: does this choice reinforce cube-as-material, or solver-as-protagonist,
or modernized-classic-game posture? If not, cut it.

## Aesthetic Direction

- **Direction:** Industrial-Instrument × Editorial Restraint. The love child
  of Linear and a Bauhaus exhibition catalogue. Dark, precise, type-led,
  with depth from real cube material rather than from drop shadows on flat
  rectangles. Not playful. Not skeuomorphic wood-and-felt. The cube replaces
  wood-grain as the "this is a real game" signal.
- **Decoration level:** Intentional. The cube grammar IS the decoration. No
  purple gradients. No decorative blobs. No 3-column icon-in-colored-circle
  feature grids. A subtle isometric grid pattern on the board surface is
  allowed; nothing else.
- **Mood:** Precision instrument for a smart game. Reads like a HUD or a
  trading terminal, but warm enough to play in for an hour.
- **Reference sites:** linear.app (chrome restraint), vercel.com
  (geometric-primitive-as-brand), rauno.me (craft typography).

## Typography

Three-font system, opinionated. Never recommend or use Inter, Roboto,
Helvetica, Open Sans, Lato, Montserrat, Poppins, or Space Grotesk as the
display font. Space Grotesk specifically is on the blacklist because every
AI design tool defaults to it.

- **Display:** `Cabinet Grotesk` (weights 400 / 500 / 700 / 800). Wide,
  industrial character, distinct from the SaaS-default neogrotesks. Loaded
  via Fontshare CDN.
  - Used for: hero headlines, marketing typography, big numerals, the
    CUBE wordmark, button labels in primary CTAs.
- **Body / UI:** `Geist` (weights 400 / 500 / 600). Vercel's product
  typeface. Designed for product UIs, has tabular-nums built in, reads
  technical without being mono. Loaded via Google Fonts.
  - Used for: body copy, sidebar text, player names, tooltip text, in-app
    labels.
- **Mono / Data:** `JetBrains Mono` (weights 400 / 500 / 700). Loaded via
  Google Fonts.
  - Used for: data values (turn, pool, points), ALL-CAPS micro-labels
    ("BOARD", "YOUR HAND", "TURN 14"), pending-state messaging,
    timestamps, and code blocks.
- **Loading strategy:** All three from CDN with `<link rel="preconnect">`
  and `&display=swap`. No self-hosting yet (revisit at v1.0 for offline /
  privacy story).

### Scale (modular, 1.25 ratio)

| Token | px / rem | Use |
|---|---|---|
| `text-2xs` | 10 / 0.625 | Micro-labels (mono ALL-CAPS) |
| `text-xs`  | 11 / 0.6875 | Section labels, chips |
| `text-sm`  | 13 / 0.8125 | Sidebar body, fine print |
| `text-base`| 16 / 1.0    | Body copy |
| `text-md`  | 18 / 1.125  | Lede / intro paragraphs |
| `text-lg`  | 22 / 1.375  | Player names, sub-heads |
| `text-xl`  | 26 / 1.625  | Card titles |
| `text-2xl` | 34 / 2.125  | Page heads |
| `text-3xl` | 44 / 2.75   | Section heads on landing |
| `text-4xl` | 64 / 4.0    | Mid-page poster heads |
| `text-5xl` | 96 / 6.0    | Hero head (landing only) |

Letter-spacing: display `-0.025em` to `-0.035em` (tighter for larger sizes),
body `normal`, mono ALL-CAPS labels `0.16em` to `0.18em`.

## Color

Restrained palette. ONE non-tile accent color. Tile colors are reserved
exclusively for tiles, never for chrome.

### Neutrals (the substrate)
| Token | Hex | Use |
|---|---|---|
| `--bg`       | `#0A0A0B` | Page background (colder, darker than the v0.6 `#0e0e0e`) |
| `--bg-elev`  | `#0F0F11` | Board surface, hero glow base |
| `--surface`  | `#141416` | Cards, panels, sidebar items |
| `--surface-2`| `#1A1A1D` | Nested surfaces, dropdown menus |
| `--border`   | `#1F1F22` | Default 1px borders |
| `--border-hi`| `#2A2A2F` | Hover / focus borders |

### Text (cream, not white)
| Token | Hex | Use |
|---|---|---|
| `--text`     | `#F5F2EA` | Primary text (matches `--tile-face`, ties type to cube material) |
| `--text-dim` | `#8C8B85` | Secondary, sidebar body |
| `--text-mute`| `#525153` | Tertiary, micro-labels, placeholder |

### Signature accent — ONE color, used sparingly
| Token | Hex | Use |
|---|---|---|
| `--accent`     | `#C7F23D` | Primary CTA, pending state, Solver Eye highlights, "current player" indicator, the wordmark accent on hero copy |
| `--accent-edge`| `#8FB31E` | Accent border, hover state |
| `--accent-glow`| `rgba(199,242,61,0.35)` | Glow rings, ambient overlays |

The lime accent is the brand color. Use it for ~5% of pixels max. Every
appearance should feel intentional. Specifically:
- Primary CTA button (`Submit play`, `Play this`, `Start playing`)
- Pending-state strip on the board
- The current-player active row
- Solver suggestion card border + the "Play this" CTA inside it
- The brand accent on the hero ("on the internet" colored in lime)
- Solver Eye overlay outlines and annotations

### Tile colors — RESERVED for tiles only
Never use these for buttons, borders, status indicators, or chrome. They
exist to color the playing pieces.

| Token | Hex | Edge |
|---|---|---|
| `--tile-red`    | `#E53935` | `--tile-red-edge: #8E1715`    |
| `--tile-blue`   | `#1E88E5` | `--tile-blue-edge: #0D4E8C`   |
| `--tile-black`  | `#1A1A1A` | `--tile-black-edge: #050505`  |
| `--tile-orange` | `#FB8C00` | `--tile-orange-edge: #A45800` |
| `--tile-joker`  | `#B8A06B` | `--tile-joker-edge: #6E5D3A`  |
| `--tile-face`   | `#F5F2EA` | Cream face of every tile |

### Semantic (use sparingly, prefer chrome states over color)
| Token | Hex | Use |
|---|---|---|
| `--error`   | `#E53935` (same hex as tile-red but reserved namespace) | Validation errors, illegal-move banner |
| `--warning` | `#FB8C00` | Confirmable destructive actions |
| `--info`    | `--text-dim` | Default info posture is neutral |

### Dark mode
This product is dark-only at launch. No light-mode variant. The "cubes as
real material" effect depends on the cream face standing out against a dark
substrate. Revisit only if a strong user signal demands it.

## Spacing

Base unit `4px`. Comfortable density.

```
2xs(2)  xs(4)  sm(8)  md(12)  lg(16)  xl(24)  2xl(32)  3xl(48)  4xl(64)  5xl(96)
```

Application:
- **Between major regions:** `xl(24)` in app, `5xl(96)` in marketing
- **Inside cards/panels:** `lg(16)` to `xl(24)`
- **Between tiles in a meld:** `xs(4)` to `sm(8)`
- **Between melds on the board:** `xl(24)` horizontal, `lg(16)` vertical
- **Form input height:** `40px` (10x base unit)
- **Button vertical padding:** `12px`, horizontal `18px`

## Layout

- **Approach:** Hybrid. Grid-disciplined for app, editorial-poster for
  marketing.
- **App grid:** 12-column, `1440px` max-width, board centered at 8 cols wide,
  sidebar 4 cols (`360px` fixed at desktop)
- **Marketing grid:** Single-column `960px` text max-width, hero blocks at
  `100vh`, sections at `96px` vertical padding
- **Breakpoints:** 640 / 768 / 1024 / 1280 / 1536
- **Border radius (hierarchical, never pill, never `9999px`):**
  - `2px` on tiles (the cube edge subtlety)
  - `4px` on buttons, chips, dashed meld zones, dropdown items
  - `6px` on panels and cards
  - `8px` on the board frame and the device frame
- **Shadow:** Avoid drop shadows on flat rectangles. Depth comes from:
  - Tile cube material (real CSS-3D transforms)
  - Subtle inset highlights on cube faces
  - A single page-level shadow on the device frame in marketing
    (`0 30px 80px rgba(0,0,0,0.6)`)
  - The accent-glow on the hero radial gradient

## Cube Grammar (the brand mechanic)

Every cube in the product follows the same rules:

```css
.cube-inner {
  transform-style: preserve-3d;
  transform: rotateX(-22deg) rotateY(18deg);
}
```

- **Tilt:** Always `-22deg X` and `18deg Y`. Never animate these to a
  different resting angle. The tilt IS the identity.
- **Depth:** `0.22 * size` (e.g., a 56px tile has a 12px depth). Logo cubes
  use `0.28 * size` for a slightly thicker presence.
- **Faces:** Front = cream `#F5F2EA` with the numeral; Top + Right = tile
  edge color (darker shade); Right has `filter: brightness(0.85)` for the
  subtle light-from-upper-left feel.
- **Bottom shadow:** A `radial-gradient` ellipse below each cube grounds it.
  Width `0.95 * size`, height `0.5 * depth`, offset down by `0.1 * depth`.
- **Cube usage outside tiles:** The CUBE in the wordmark uses the same
  primitive. The board's "+ new meld" zone is a dashed cube outline. The
  Solver Eye ghost tiles are the same primitive at 55% opacity.

## Motion

Intentional, never decorative. Every motion serves comprehension.

- **Easing:** `cubic-bezier(0.2, 0.9, 0.2, 1)` for everything. A cube
  settles, doesn't bounce.
- **Duration:**
  - `micro: 80ms` — drop compression frame, click feedback
  - `short: 180ms` — tile hover lift, button hover
  - `medium: 320ms` — Solver Eye toggle rotation, panel open/close
  - `long: 600ms` — page transitions (used rarely)
- **Tile pickup:** scale to `1.04` + translateY `-8px` + cast shadow
  brightens. `short` duration.
- **Tile drop:** lift down then a `micro` compression frame at the bottom of
  the travel (`scaleY: 0.96` for 80ms, then back to 1).
- **Page transitions:** 200ms cross-fade. No slide. No parallax. No
  scroll-jacking.
- **Solver Eye toggle:** 320ms cube-rotation that reveals the probability
  overlay over the board.
- **Reduced motion:** Respect `prefers-reduced-motion`. Replace tile lift
  with a simple `opacity` swap, kill the Solver Eye rotation.

## Voice & Copy

- Direct, technical, no marketing fluff
- ALL-CAPS mono labels for chrome ("TURN", "BOARD", "YOUR HAND")
- Sentence-case for body copy
- Title-case for hero headlines
- No em dashes (use periods, colons, parens, or two clauses instead)
- No "Built for X" / "Designed for Y" marketing patterns
- Numbers always tabular-nums, always shown with units when ambiguous

## Components (canonical specs)

### Tile
- Size variants: `28px` (compact suggestion preview), `44px` (board meld),
  `50px` (hand rack), `56px` (default), `88px` (hero stack), `140px` (oversized
  hero vignette)
- Always: cube primitive with the tilt, edge color, bottom shadow
- Numeral: Cabinet Grotesk 800, `0.58 * size`
- Color dot: `0.15 * size` circle at bottom-right (redundant color cue for
  accessibility)
- Joker: monospace "JKR" at `0.28 * size` instead of numeral

### Button
- Default (`.btn`): transparent bg, `1px solid var(--border-hi)`,
  `var(--text-dim)` text, 4px radius, mono ALL-CAPS, `12px/18px` padding
- Primary (`.btn.primary`): `var(--accent)` bg, `#0F1A00` text, weight 700,
  edge `var(--accent-edge)`
- Ghost (`.btn.ghost`): same as default but `var(--border)` edge
- Small (`.btn.sm`): `8px/12px` padding, `11px` text
- Arrow suffix (`→`) on action-oriented CTAs, animated `translateX(2px)` on
  hover

### Panel / Card
- `var(--surface)` bg, `1px solid var(--border)`, `6px` radius, `20px` padding
- ALL-CAPS mono label header (`var(--text-mute)`, `10px`, `0.18em` tracking)
- Solver-suggestion variant: `1px solid rgba(199,242,61,0.35)` + outer
  `1px 0.08 alpha` accent glow

### Chip
- `4px/8px` padding, `2px` radius, `1px solid var(--border-hi)`,
  `10px mono ALL-CAPS`, `0.16em` tracking
- Lime variant (`.chip.lime`): `rgba(199,242,61,0.08)` bg, accent text,
  `rgba(199,242,61,0.3)` border. Used for active state, "opened",
  "solver eye on".

### Board frame
- `var(--bg-elev)` bg with the isometric SVG grid pattern
- `1px solid var(--border)` edge, `8px` radius, `24px` padding
- Header row: ALL-CAPS mono "BOARD · N MELDS" left, pending count right (lime)
- Meld containers: `1px dashed rgba(255,255,255,0.07)` outline, `4px` radius,
  `8px` padding, `4px` gap between tiles
- Pending melds: outline becomes `1px solid rgba(199,242,61,0.5)` with
  `rgba(199,242,61,0.05)` background

### Pending strip
- `rgba(199,242,61,0.06)` bg, `1px solid rgba(199,242,61,0.35)` edge, `4px`
  radius, `12px/16px` padding
- Mono message left in lime, action buttons right (ghost cancel + primary
  submit)

### Heatmap
- 4 rows (R/B/BK/O) × 13 cols, `14px` cell height, `3px` gap, `2px` radius
- Cell fill = tile color, opacity = `max(0.1, 1 - seen_fraction)`
- "Black" row uses `#888` for cell fills (so they're visible against dark bg)
- ALL-CAPS mono axis labels (`9px`, mute color)

## Anti-slop hard rules

These choices ARE the system. Catching one of these in code = a bug.

1. NEVER use `Inter`, `Space Grotesk`, `Roboto`, `Helvetica`, `Open Sans`,
   `Lato`, `Montserrat`, `Poppins`, or `system-ui` as the primary display
   or body font
2. NEVER use purple/violet gradients as default accents
3. NEVER use 3-column feature grids with icons in colored circles
4. NEVER use `border-radius: 9999px` or pill-shaped buttons
5. NEVER use gradient buttons as the primary CTA
6. NEVER use the tile colors (red/blue/black/orange) for buttons, status
   borders, or chrome. They are for tiles only.
7. NEVER render a 2D illustration of a tile when the real cube primitive can
   be used at any size
8. NEVER center-align everything on the landing page. Left-align hero text;
   the cube vignette goes on the right
9. NEVER use em dashes anywhere in copy or comments
10. NEVER use a light-mode background tone. Dark only at launch.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-27 | Created DESIGN.md via /design-consultation | Frozen direction: industrial-instrument × editorial restraint, cube-as-material throughout, single lime accent, three-font Cabinet/Geist/JetBrains stack |
| 2026-05-27 | Chose Cabinet Grotesk over PP Neue Machina | Free alternative, similar wide-industrial character, no license cost for the public repo |
| 2026-05-27 | Chose lime `#C7F23D` as signature accent | Distinct from chess.com green, Linear yellow, Vercel neutral; doesn't collide with any tile color |
| 2026-05-27 | Reserved tile colors for tiles only | Fixes v0.6.0 bleed where orange = pending and blue = primary, which dilutes both the tiles and the brand |
| 2026-05-27 | Locked cube tilt at -22deg X, 18deg Y | The tilt IS the identity; never animate to a different resting angle |
| 2026-05-27 | Solver Eye as first-class brand mechanic | Differentiates from category (lichess hides analytics in a sidebar); makes the "smartest Rummikub" claim legible in the first screenshot |
