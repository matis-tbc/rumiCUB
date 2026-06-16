# Phase 5b — UX improvement plan (post-v0.7.0 dogfooding)

**Status:** draft, awaiting review + approval
**Target tag:** v0.7.1
**Branch:** continue on `session-review-cleanup-and-docs` (or cut a new branch — call it)
**Reviewer:** `/plan-design-review` OR `/plan-eng-review` on this file before code lands

---

## Why this plan exists

After dogfooding v0.7.0 (PR #8 just pushed), real problems surfaced:

1. **Solver Eye overlay is confusing.** The ghost tiles sit ON TOP of the real
   board. Two stacked layers of tiles competing for the eye. Reading "what is
   real vs what is proposed" is hard.
2. **Hand tiles can't be reordered.** You can drag a hand tile to the board,
   but not rearrange tiles within the hand. People naturally want to
   pre-arrange their tiles before playing.
3. **Building a meld is awkward.** Drag a single tile at a time to the board;
   if you want a 4-tile run, that's 4 separate drag operations. Each one
   you have to wait for the prior drop to finish before starting the next.
4. **No instructions / no help.** First-time users have no idea what to do.
   Rummikub rules aren't obvious from chrome alone.
5. **Drop targets feel small.** The "+ new meld" zone and meld containers are
   smallish; missing a drop is easy.

## Locked direction (from interactive Q&A 2026-05-27)

| ID | Question | Decision |
|----|----------|----------|
| U1 | Solver Eye | **Preview mode that REPLACES the board.** Toggle on -> board shows the proposed state with changed melds outlined in lime. Toggle off -> real state. No more overlay. |
| U2 | Hand reordering | **Sortable hand + drag-to-board.** Hand tiles become reorderable via @dnd-kit/sortable, which is already a project dependency. |
| U3 | Help / onboarding | **Combined approach (robust):** hideable in-app help panel + auto-opening first-time tour + better inline empty-state hints. All three work together. |
| U4 | Concurrent drags | **Accept single-drag, make it faster.** Bigger drop targets, click-to-pick as an alternative path, brighter hover states. Don't fight dnd-kit. |

## Locked design decisions (from /plan-design-review 2026-05-27)

| ID | Question | Decision |
|----|----------|----------|
| D1 | Solver Eye toggle with pending changes | **Auto-cancel pending first.** Toggling Solver Eye on auto-reverts pendingBoard -> committedBoard, runs solver on clean state. Toast: "reverted N pending changes." Predictable mental model. |
| D2 | Click-to-pick discoverability | **Hover tooltip + drop-zone CTA + Help mention.** Tile hover shows tiny mono tooltip "click or drag". After first click into selected state, drop zones get a lime "click here" label. Both hints auto-suppress after user has used click-to-place twice (`localStorage.click_seen_count >= 2`). |
| D3 | Accessibility scope for v0.7.1 | **Minimum-viable a11y.** Touch targets 44x44px min on tile/button/toggle, keyboard nav (Tab + Enter/Space + Esc), ARIA labels on tiles + drop zones, aria-live polite on Solver Eye banner, focus trap inside open HelpPanel. No full mobile redesign in v0.7.1. |
| D4 | Click-selected tile visual | **Lime 2px outer ring + soft glow + scale 1.06.** Ring: 2px solid var(--color-accent), 4px offset. Glow: rgba(199,242,61,0.4) blur 12px. Distinct from the hover-1.04 lift (which uses tile-color glow). Reads as "committed pickup". |

## Locked engineering decisions (from /plan-eng-review 2026-05-27)

| ID | Question | Decision |
|----|----------|----------|
| E1 | Sortable hand IDs | **Stable client-side UUIDs.** When applyServerState fires, map each hand tile to `{id: crypto.randomUUID(), tile: TileDTO}` and store the wrapper array in pendingHand. Sortable IDs use the uuid. Reorders preserve identity across renders. `DndContext` uses `collisionDetection={closestCenter}` for sortable + droppable mix. |
| E2 | Suggestion freshness | **Clear suggestion on every `applyServerState`.** Add `setSuggestion(null)` to App.tsx's applyServerState. Server-acknowledged state changes always invalidate the cached suggestion. Simplest possible invalidation rule. |
| E3 | D1 cancelPending wiring | **Callback injection.** SolverContext exposes `setCancelPending(fn)`. Game.tsx effect-injects its `cancelPending` on mount. `toggleSolverEye` calls the injected fn before fetch when `nextOn && pendingChanges`. Clean separation: Game owns pending, Context owns solver. |
| E4 | HelpPanel modal primitive | **focus-trap-react + custom slide-in panel.** Per user preference for animation polish. ~3KB dep, focus trap + escape handling delegated to the library. Tailwind transition for slide-in from right (300ms ease-out). |
| E5 | Drag during Solver Eye preview | **Disable drag pickup entirely.** Every `useDraggable` and `useSortable` on tiles gets `disabled: solverEyeOn`. Cursor `not-allowed` on tile hover during preview. Mirrors dimmed drop zones. Preview is read-only top to bottom. |
| E6 | Frontend test scope | **Vitest unit tests on SolverContext + safeStorage + arrayMove (12 tests).** Vitest is Vite-native, zero config thrash. Defer E2E (Playwright) to v0.7.2. Manual QA checklist still gates the user flows. |

## Auto-applied engineering fixes (no question needed)

- **safeStorage wrapper** (new `frontend/src/lib/safeStorage.ts`): exports `safeGet(key)`, `safeSet(key, value)`, `safeRemove(key)`. All call sites for `rumicube.game_id`, `rumicube.seen_intro`, `rumicube.click_seen_count` go through it. Wraps in try/catch so incognito / `QuotaExceededError` / disabled storage gracefully degrade (returns null on read, false on write).
- **arrayMove bounds check**: clamp `to` to `[0, items.length - 1]` before calling `arrayMove`. Out-of-bounds becomes no-op.
- **"Reverted N changes" toast styling**: top-of-board strip, mono ALL-CAPS 11px lime, `rgba(199,242,61,0.06)` bg + `1px solid rgba(199,242,61,0.35)` border, `role="status" aria-live="polite"`, 3s auto-dismiss, slide-out animation.
- **aria-live banner anti-spam**: banner re-renders rapidly across state transitions. Use a single child element with the live region; the text is the announcement. Browser collapses identical announcements within ~500ms, so the natural state transitions (computing → success) don't double-fire.

## Acceptance criteria

1. Solver Eye no longer renders ghost tiles overlaid on the live board. The
   board itself shows either the real state or the proposed state, never both
   simultaneously.
2. Dragging within the hand reorders tiles. `pendingHand` order persists in
   server submissions (server treats hand as a set, but our visual order is
   preserved across re-renders).
3. A `?` button in the header opens a help panel with rules + controls. First
   visit auto-opens it; subsequent visits do not.
4. Clicking any tile (hand or board) selects it; clicking a valid drop target
   places it. Drag still works.
5. `+ new meld` zone min-height >= 80px, min-width >= 120px.
6. `tsc -b` clean after every commit.
7. Manual QA checklist (below) passes in Chrome AND Safari.

## NOT in scope

- Multi-tile selection / bulk drag (defer to v0.8.0 if still wanted)
- Full mobile redesign (rack-at-bottom, sidebar drawer) — defer to v0.8.0.
  v0.7.1 ships touch targets at 44px min but the layout stays desktop-first.
- Animation polish (drop animations, drag ghost preview improvements) —
  defer to v0.7.2
- Marketing landing page (still on the v0.8.0 list)
- Screen reader full sweep beyond the minimum-viable spec in D3

## Solver Eye state machine (covers all entry / exit / edge cases)

```
                           ┌─────────────────────────────────┐
                           │  Toggle OFF (default)           │
                           │  Board shows real state          │
                           │  DnD enabled                    │
                           └─────────────┬───────────────────┘
                                         │  click toggle
                                         ▼
                  ┌──────────────────────────────────────────────────┐
                  │  CHECK: hasPendingChanges?                       │
                  └────────────────┬─────────────────────────────────┘
                                   │
                  ┌────────────────┴──────────────────┐
                  ▼                                   ▼
        pending changes exist                    no pending changes
        auto-revert pending                      go straight to fetch
        toast "reverted N changes"
                  │                                   │
                  └────────────────┬──────────────────┘
                                   ▼
                  ┌──────────────────────────────────────────────────┐
                  │  CHECK: suggestion exists + fresh?               │
                  └────────────────┬─────────────────────────────────┘
                                   │
                  ┌────────────────┴──────────────────┐
                  ▼                                   ▼
              fresh                                stale or null
              skip fetch                           fetch /suggest?use_ilp=true
                  │                                   │
                  │                          ┌────────┴───────────┐
                  │                          │ 5s timeout         │
                  │                          ▼                    ▼
                  │                       success                error or timeout
                  │                          │                    │
                  │                          │                    ▼
                  │                          │              banner "solver error · try again"
                  │                          │              [retry] [exit preview]
                  │                          │                    │
                  │                          │              user clicks retry → re-fetch
                  │                          │              user clicks exit → toggle OFF
                  │                          ▼
                  └─────────────────────►┌──────────────────────────────────┐
                                         │  PREVIEW MODE                    │
                                         │  Board shows new_board           │
                                         │  Changed melds outlined lime     │
                                         │  Drop zones DISABLED + dimmed    │
                                         │  Banner: stats + PLAY THIS + exit│
                                         │  aria-live polite announces      │
                                         └─────┬────────────────────────────┘
                                               │
                              ┌────────────────┼──────────────────┐
                              ▼                ▼                  ▼
                       click PLAY THIS    click exit          game ends (winner declared)
                       commits play       toggle OFF          auto-exit preview
                       toggle OFF         restore board       restore board
                       restore board                          show winner banner
                              │                │                  │
                              └────────────────┴──────────────────┘
                                               │
                                               ▼
                                       back to Toggle OFF state

NO-PLAY-FOUND VARIANT:
  If suggestion.melds_to_place.length === 0:
    Banner: "solver eye · no play found · drawing is the only option"
    [exit preview] button only (no PLAY THIS)
    Board shows real state (no swap, nothing to preview)
```

## Accessibility (minimum-viable for v0.7.1)

### Touch targets
- Tile minimum hit area: 44x44px (currently 56px+ from cube size — already passes)
- Btn minimum: 44px height in `md` size (currently 40px from `py-2 + text-sm`). **Bump to py-2.5.**
- Btn `sm` size: 36px height. **Acceptable for desktop sidebar** but add `min-h-[44px]` on mobile breakpoint via Tailwind.
- SolverEyeToggle: already meets 44px (padding 6px + content) — verify in QA.
- HelpButton (?): 44x44px target even though icon is smaller.
- `+ new meld` zone: already 80x120px after T-T3 (covered).
- Meld drop zones: 76px min-height after T-T3 (covered).

### Keyboard navigation
- Tab order: `?` button → SolverEye toggle → New Game → board tiles (left-to-right, top-to-bottom by meld) → hand tiles (left-to-right) → action buttons → sidebar suggestion → players → probabilities.
- `Enter` or `Space` on a focused tile = click-to-pick (toggle selection).
- `Enter` or `Space` on a focused drop zone (meld or `+ new meld`) while a tile is selected = place tile.
- `Escape`:
  - if HelpPanel is open → close panel
  - else if a tile is selected → deselect
  - else if Solver Eye is on → exit preview (toggle off)
- `?` (no modifier) anywhere = open HelpPanel.

### ARIA
- `<Tile>` renders with `role="button"`, `tabIndex={0}`, `aria-label="{color} {number}"` or `"joker"`.
- `<DraggableTile>` / `<SortableTile>` inherit ARIA from Tile.
- `MeldDropZone`: `role="group"`, `aria-label="meld {N}"`.
- `NewMeldDropZone`: `role="button"` (it's a target for click-to-pick AND a drop zone), `aria-label="start a new meld"`.
- Solver Eye banner container: `role="status"` + `aria-live="polite"` so screen reader users hear "Solver preview, plus 5 tiles, 38 points" when the banner content changes.
- HelpPanel: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the panel's `<h2>`.

### Focus management
- When HelpPanel opens: focus moves to the panel's close (X) button. Tab cycles within the panel only (focus trap). When closed, focus returns to the trigger (`?` or `Got it`).
- When a play commits (PLAY THIS or submit): focus returns to the first hand tile if any remain, else to the Draw button.
- When Solver Eye enters preview: focus stays where it was; the toggle visually updates but doesn't steal focus.

### Implementation notes
- Use `focus-trap-react` for HelpPanel (small dep, ~3KB).
- ARIA labels can derive from existing `tile.c` and `tile.n` props. No new state needed.
- `aria-live` on banner: a single child element gets the live region; React re-renders update its textContent which screen readers announce.

## Helper hints lifecycle (click-to-pick discoverability per D2)

```
First-time user (no localStorage entry):
  - Hover any tile → small tooltip below: "click or drag"
  - Click a tile → tile gets lime ring + scale 1.06
  - Drop zones show small lime "click here" label
  - Click a drop zone → tile lands, hints reset
  - localStorage.setItem('click_seen_count', '1')

Second click experience:
  - Same as above
  - localStorage.setItem('click_seen_count', '2')

Third click onward:
  - Hover tooltip suppressed (user knows now)
  - Drop zone "click here" label suppressed
  - Click-to-pick still works, just no training wheels

If user only ever drags (never clicks): tooltips persist forever (they
weren't disruptive enough to find — they're a hint, not a tutorial).
```

---

## File-by-file change spec

### 1. `frontend/src/lib/SolverContext.tsx` — extend the provider

Add helpers for "exit preview" so the toggle and the play-this button both
funnel through one code path. No major refactor.

```ts
interface SolverContextValue {
  // existing fields...
  exitPreview(): void;        // turns Solver Eye off AND clears suggestion
}
```

### 2. `frontend/src/components/Board.tsx` — Solver Eye preview mode (rewrite the overlay path)

**Remove** the `GhostOverlay` function entirely. Delete `containsAll`,
`meldKind`, `tileKey`, `meldKey` helpers (move what's still needed up to App
or keep as private to this file but unused -> delete).

**Add** a `previewMode` derivation at top of `Board`:

```ts
const { solverEyeOn, suggestion, fetching, exitPreview } = useSolver();
const inPreview = solverEyeOn && !!suggestion;
const meldsToRender = inPreview ? suggestion!.new_board : melds;
```

When `inPreview`:
- Replace the existing `pendingMeldIndices` highlight logic with a new
  derivation: which melds in `suggestion.new_board` differ from `melds`
  (the committed/pending board). Compute `proposedDeltaIndices: Set<number>`.
- Render those melds with a lime outline + `+N` annotation pill above each.
- Render the rest of the proposed board normally (so the user sees the
  WHOLE board as it would look, with deltas highlighted).
- DnD drop targets are DISABLED during preview (set `disabled: true` on
  `useDroppable` for each MeldDropZone + NewMeldDropZone). Visual cue:
  drop-zone outlines render at 30% opacity.

Add a persistent banner that **REPLACES the existing "BOARD · N MELDS" header
during preview** (never two stacked headers competing):

```
[ ● SOLVER PREVIEW · +5 tiles · 38 pts · ILP · 42ms ]    [PLAY THIS →]  [exit preview]
```

Banner styling: `rgba(199,242,61,0.08)` background, `1px solid rgba(199,242,61,0.4)` border, mono ALL-CAPS 11px, height ~44px (a11y target), flexed with stats left + actions right. Lime indicator dot left of the label. `role="status"` `aria-live="polite"` so screen readers announce updates.

**Full state coverage** (see state machine above):

| State | Banner text | Buttons |
|---|---|---|
| Fetching (suggestion null, loading) | `SOLVER PREVIEW · computing...` | [exit preview] |
| Success with play | `SOLVER PREVIEW · +N tiles · M pts · ILP · Xms` | [PLAY THIS →] [exit preview] |
| No play found | `SOLVER EYE · no play found · drawing is the only option` | [exit preview] |
| Solver API error | `SOLVER ERROR · could not compute · try again?` | [retry] [exit preview] |
| Solver API timeout (>5s) | `SOLVER TIMEOUT · the move space is too big right now` | [retry] [exit preview] |
| Game ends while in preview | (banner auto-disappears, winner banner takes over) | n/a |
| Toggle ON with pending changes | (toast: "reverted N pending changes", then enters fetch state) | [exit preview] |

During preview ANY state: `MeldDropZone` and `NewMeldDropZone` set `disabled: true` on `useDroppable`; outlines render at 30% opacity; `cursor: not-allowed` on hover; aria-disabled true.

### 3. `frontend/src/components/TileRack.tsx` — sortable hand

Wrap the tile list in `<SortableContext items={...} strategy={horizontalListSortingStrategy}>`:

```tsx
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';

const ids = tiles.map((_, i) => `hand-${i}`);

<SortableContext items={ids} strategy={horizontalListSortingStrategy}>
  {tiles.map((tile, i) => (
    <SortableTile key={ids[i]} dragId={ids[i]} tile={tile} />
  ))}
</SortableContext>
```

Replace `DraggableTile` usage inside the hand with a new `SortableTile`
component that wraps `Tile` with `useSortable` instead of `useDraggable`.
Board tiles keep using `DraggableTile` since they don't reorder
horizontally.

Hand drop zone (`useDroppable({ id: "hand" })`) still works for return-to-hand
from the board.

### 4. `frontend/src/components/SortableTile.tsx` — NEW

```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tile } from './Tile';
import { type TileDTO } from '../lib/api';

export function SortableTile({
  dragId,
  tile,
  selected,
  onClick,
}: {
  dragId: string;
  tile: TileDTO;
  selected?: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: dragId });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
        cursor: 'grab',
      }}
      {...listeners}
      {...attributes}
    >
      <Tile tile={tile} selected={selected} onClick={onClick} />
    </div>
  );
}
```

### 5. `frontend/src/App.tsx` — drag handler + click-to-pick + sortable hand wiring

`onDragEnd` needs two new branches:

1. `dragId.startsWith("hand-")` AND `targetId.startsWith("hand-")`: reorder
   within the hand. Move the tile in `pendingHand` to the new index.
2. Everything else: unchanged.

`@dnd-kit/sortable` provides `arrayMove(items, from, to)` for the reorder.
Use it:

```ts
import { arrayMove } from '@dnd-kit/sortable';

if (dragId.startsWith('hand-') && targetId.startsWith('hand-')) {
  const from = parseInt(dragId.slice('hand-'.length), 10);
  const to = parseInt(targetId.slice('hand-'.length), 10);
  if (!Number.isNaN(from) && !Number.isNaN(to)) {
    setPendingHand(prev => arrayMove(prev, from, to));
  }
  return;
}
```

Add a new piece of state: `selectedTileDragId: string | null`. Pass it
through to `Tile` (via SortableTile and DraggableTile) so it renders the
selected lime ring. When set, hovering a drop zone shows a subtle indicator;
clicking a drop zone places the tile.

The `Tile.tsx` `onClick` handler already exists and toggles `selected`.
We wire it: `onClick={() => setSelectedTileDragId(prev => prev === dragId ? null : dragId)}`.

When `selectedTileDragId` is set AND user clicks a meld or new-meld zone,
call the same `takeTile` + `placeTile` helpers as the drag-end handler,
then clear the selection. This means click-to-pick is just drag-without-the-drag.

### 6. `frontend/src/components/Board.tsx` — bigger drop targets

- `NewMeldDropZone`: `min-width: 120px` (was 96), `min-height: 80px` (was 60)
- `MeldDropZone`: `min-height: 76px` (was 60), gap between melds bumped to 32px
  horizontal (from 24)
- `isOver` bg opacity: 0.18 -> 0.25 (more obvious snap target)

### 7. `frontend/src/components/HelpPanel.tsx` — NEW

A slide-in right panel triggered by a `?` button in the header. Contents:

```
HOW TO PLAY
  Rummikub: form valid melds from 104 numbered tiles plus 2 jokers.
  A run is 3+ same-color consecutive numbers. A group is 3+ same-number
  different-color tiles. Opening play must total 30+ points.

CONTROLS
  - Drag a tile from your hand to a meld or the +new meld zone.
  - Drag tiles within your hand to rearrange them.
  - Or click a tile to pick it up, then click any drop zone to place it.
  - Click submit play when you're done with your turn.
  - Click cancel to revert all pending changes.

SOLVER
  - Suggest hand-only: fastest, only considers what's in your hand.
  - Suggest ILP solver: slower, but rearranges existing melds to fit
    more of your tiles. The hard part of Rummikub strategy.
  - Solver Eye: see the board AS IT WOULD LOOK after the solver's play.
    Toggle off to return to your real state.

KEYBOARD (coming soon)

ABOUT
  rumiCUBE v0.7.x. Open source at github.com/matis-tbc/rumiCUBE.
  ILP solver wins 10/10 against the greedy bot in the arena CLI.
```

Styling: `var(--color-surface)` bg, `1px solid var(--color-border)`,
`6px` radius (top + bottom-left only since it's a side panel), slides in
from the right at 360px wide, takes the full viewport height, lime accent
on the section headers. Mono labels. Closes via X button top-right OR
clicking outside (backdrop click).

A `[ ✓ got it, don't show this again ]` button at the bottom appears
only when the panel was auto-opened by the first-time-visit logic. Writes
`localStorage.setItem('rumicube.seen_intro', '1')` and closes.

### 8. `frontend/src/components/HelpButton.tsx` — NEW

A small `?` button in the header. Renders as a Chip with a question mark
or as a small ghost button (~28x28). Opens HelpPanel on click. Shows a
small lime dot on first visit (`!seen_intro`) to draw the eye.

### 9. `frontend/src/App.tsx` — first-time tour + help button

Add `isHelpOpen: boolean` state. On mount, check `localStorage` for
`rumicube.seen_intro`; if absent, open the panel auto.

Header layout updated:

```
[ rumiCUBE logo ]               [ Turn ][ Pool ][ ? ][ Solver Eye ][ New Game ]
```

### 10. Inline empty-state hints (sweep)

- Board empty + no suggestion: existing "drag tiles from your hand
  into the new meld zone -> " — keep as is, but soften to
  `var(--color-text-mute)` 11px italic.
- Hand empty: TileRack already renders "empty" — change to a more
  helpful "your rack is empty. draw a tile or commit your pending play."
- No suggestion + Solver Eye off: don't show any hint about the solver
  (suggesting it would clutter the empty state for users who don't care).
- New game just started: small toast "Tip: drag tiles to the +new meld
  zone to start building. Click `?` for help." Auto-dismisses in 8s.
  Stored in localStorage so it shows only on the first game ever.

### 11. Manual QA checklist (PR template)

Run all of these in Chrome AND Safari. Sign off in PR description.

**Help / first-time tour:**
- [ ] Clear localStorage, reload, help panel auto-opens
- [ ] Click "got it" -> panel closes, reload, panel does NOT auto-open
- [ ] Click `?` button -> panel opens manually
- [ ] Click outside panel or X -> panel closes

**Hand reordering:**
- [ ] Drag tile 1 to tile 5's position -> hand order updates
- [ ] Drag tile 5 to tile 1's position -> hand order updates
- [ ] Drag hand tile to board meld -> tile moves to board (not reorder)
- [ ] Drag board tile to hand -> tile returns to hand at end

**Solver Eye preview mode:**
- [ ] Toggle on with no suggestion -> banner "computing..." then board
  swaps to proposed state with deltas outlined in lime
- [ ] Toggle on, no play available -> banner "no play found" + exit button
- [ ] Toggle on -> drop zones are disabled (dimmed), can't drag tiles
- [ ] Click PLAY THIS in banner -> play commits, toggle resets to off
- [ ] Click exit preview in banner -> toggle off, board back to real state

**Click-to-pick:**
- [ ] Click a hand tile -> tile renders lime selected ring
- [ ] Click again on same tile -> deselects
- [ ] Click tile, then click +new meld zone -> tile moves there
- [ ] Click tile, then click an existing meld -> tile appends to that meld

**Drag still works in parallel:**
- [ ] Drag a tile (no click first) -> normal drag behavior

**Cross-browser:**
- [ ] Chrome: all of the above
- [ ] Safari: all of the above (preserve-3d quirks)

---

## Failure modes + handling

| Mode | Trigger | Mitigation | User sees |
|------|---------|------------|-----------|
| User toggles Solver Eye, then tries to drag | normal flow | drop zones disabled, dim state, hover cursor not-allowed | nothing happens; subtle banner hint "exit preview to drag" |
| Sortable hand collides with drag-to-board target detection | sortable + droppable overlap | use distinct dragId namespaces ("hand-N" vs "meld-N"); detect in onDragEnd by prefix | nothing — should just work |
| HelpPanel doesn't close on outside-click on Safari | event bubbling quirk | add explicit close button + ESC key handler | close button always available |
| First-time tour fires every time on incognito | localStorage cleared each session | accept this; incognito is a power-user scenario | tour shows; one click dismisses |
| Click-to-pick interferes with double-click selection on touch | rapid tap | dnd-kit pointer sensor `distance: 4` keeps tap = click; double-tap = single select cycle | works fine on touch |

---

## Risk register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Sortable hand breaks board drag detection | M | Distinct dragId prefixes + explicit branch in onDragEnd; unit-test the parser if it grows |
| Solver Eye preview confuses "is this real?" | L | Lime banner ABOVE the board makes it impossible to miss the mode |
| Click-to-pick + drag triggers fire together | L | dnd-kit pointer sensor distance:4 keeps tap as click, drag as drag |
| HelpPanel content drifts from rules | L | Single source in HelpPanel.tsx; if rules change, one file edit |
| First-time tour annoys returning users | L | Strict localStorage check; opens once ever per origin |

---

## Implementation order (atomic commits, each tsc-clean)

1. **Commit 1:** Extend SolverContext with `exitPreview()`, add prep state
2. **Commit 2:** Board preview-mode rewrite (delete overlay, add preview path + banner)
3. **Commit 3:** Bigger drop targets (Board sizing tweaks)
4. **Commit 4:** SortableTile.tsx + TileRack sortable wrapper
5. **Commit 5:** App.tsx drag handler reorder branch + click-to-pick state
6. **Commit 6:** HelpPanel.tsx + HelpButton.tsx (new files, no integration yet)
7. **Commit 7:** Wire HelpButton into header + first-time tour localStorage check
8. **Commit 8:** Inline empty-state hint sweep
9. **Commit 9:** Manual QA + final polish

Estimated total: ~5-6 hours human time, ~45 min CC time.

---

## Implementation Tasks

- [ ] **U-T1 (P1, human: ~30m / CC: ~10m)** — context — Add `exitPreview()` + `cancelPendingThenToggle()` to SolverContext per D1
  - Surfaced by: D1 decision
- [ ] **U-T2 (P1, human: ~2h / CC: ~25m)** — board — Solver Eye preview-mode rewrite. Banner replaces board header. Full state table (loading / success / no-play / error / timeout / game-end). aria-live announce. Drop zones disabled during preview.
  - Surfaced by: U1 + D1 + state-machine spec
- [ ] **U-T3 (P2, human: ~15m / CC: ~5m)** — board — Drop target sizing (`+ new meld` 120x80, meld 76 min-height, gap 32px)
  - Surfaced by: U4
- [ ] **U-T4 (P1, human: ~1h / CC: ~15m)** — hand — SortableTile + TileRack sortable wrapper, horizontalListSortingStrategy
  - Surfaced by: U2
- [ ] **U-T5 (P1, human: ~1h / CC: ~20m)** — app — Drag handler reorder branch + click-to-pick state + selection ring per D4 (lime 2px outer + glow + scale 1.06)
  - Surfaced by: U4 + D4
- [ ] **U-T6 (P1, human: ~1.5h / CC: ~25m)** — help — HelpPanel.tsx (focus trap, dialog role) + HelpButton.tsx with first-visit dot
  - Surfaced by: U3 + D3 (focus trap)
- [ ] **U-T7 (P1, human: ~30m / CC: ~10m)** — app — Wire help button in header + first-time auto-open (localStorage `rumicube.seen_intro`) + Esc to close
  - Surfaced by: U3 + D3 (keyboard)
- [ ] **U-T8 (P2, human: ~45m / CC: ~15m)** — chrome — Inline hint sweep + click-to-pick discoverability hints per D2 (hover tooltip + drop-zone CTA + suppress after `click_seen_count >= 2`)
  - Surfaced by: U3 + D2
- [ ] **U-T9 (P1, human: ~1h / CC: ~15m)** — a11y — Minimum-viable a11y per D3 (touch targets 44px, Tab order, Enter/Space/Esc handlers, ARIA labels on tiles + drop zones, aria-live on banner, focus trap in HelpPanel)
  - Surfaced by: D3
- [ ] **U-T10 (P1, human: ~30m / CC: ~10m)** — qa — Manual QA pass per checklist in Chrome + Safari, plus VoiceOver pass on macOS for ARIA verification
  - Surfaced by: T1 in original plan + D3
- [ ] **U-T11 (P1, human: ~30m / CC: ~10m)** — lib — `safeStorage.ts` wrapper for incognito-safe localStorage; sweep `localStorage.getItem/setItem` callers to use it
  - Surfaced by: C1
- [ ] **U-T12 (P1, human: ~30m / CC: ~10m)** — hand — Stable UUID wrapper for hand tiles in pendingHand state + `closestCenter` collision detection
  - Surfaced by: E1
- [ ] **U-T13 (P1, human: ~15m / CC: ~5m)** — context — Wire SolverContext.setCancelPending() callback; Game.tsx injects on mount
  - Surfaced by: E3
- [ ] **U-T14 (P1, human: ~15m / CC: ~5m)** — context — `setSuggestion(null)` in applyServerState
  - Surfaced by: E2
- [ ] **U-T15 (P1, human: ~15m / CC: ~5m)** — tile — `disabled: solverEyeOn` on every useDraggable / useSortable
  - Surfaced by: E5
- [ ] **U-T16 (P1, human: ~2h / CC: ~25m)** — tests — Install Vitest + write 12 unit tests on SolverContext state machine, safeStorage, arrayMove
  - Surfaced by: E6
- [ ] **U-T17 (P2, human: ~15m / CC: ~5m)** — toast — "Reverted N changes" toast component spec'd in auto-fixes
  - Surfaced by: C3

---

## What still won't be solved after this lands

- Multi-tile selection for bulk drag (you'll still drag tiles one at a time;
  click-to-pick is just an alternative input, not faster for multi-tile).
- Mobile-touch UX (resize, font scaling, touch-drag precision) is untested.
- No undo button beyond "cancel pending changes" (committed plays can't be
  undone).
- No replay / game history viewer.

These all become v0.8.0 candidates.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | disabled per user config | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | **CLEAR (PLAN)** | 6 issues resolved (E1 stable UUIDs, E2 suggestion freshness, E3 cancel wiring, E4 modal primitive, E5 preview-mode drag, E6 Vitest scope) + 3 auto-fixes (safeStorage, arrayMove bounds, toast spec). 0 critical gaps. 8 new implementation tasks (U-T11 to U-T17). |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | **CLEAR (FULL)** | score: 7/10 → 9/10. 4 decisions resolved (D1 pending+preview, D2 click discoverability, D3 min-viable a11y, D4 selection visual). State machine + a11y section added. |
| DX Review | `/plan-devex-review` | DX gaps | 0 | not run | — |

- **CROSS-MODEL:** N/A — Codex disabled, single-model review
- **UNRESOLVED:** 0
- **VERDICT:** Design + Eng CLEARED — ready to implement. 17 atomic tasks (U-T1 to U-T17) defined. No P0/P1 bugs remaining unresolved.
