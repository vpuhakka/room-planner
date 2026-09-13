# Handoff: Room Planner (furniture arrangement tool)

## Overview

A browser-based furniture arrangement planner. The user defines rooms (width × depth in cm, optional
corner cuts for L-shapes and alcoves), places furniture from an editable catalogue, drags and rotates
pieces on a scaled floor plan, and gets live warnings for overlaps, pieces outside the floor, blocked
door swings, and walkways narrower than a threshold. Plans are grouped into homes → rooms → three
alternative layouts per room ("slots" A/B/C). Everything persists to the browser automatically and can
be exported as JSON or shared as an encoded URL.

No accounts, no backend, no server-side state. It is a static single-page app.

## About the design files

`Room Planner Tool.dc.html` in this bundle is a **design reference created in HTML** — a working
prototype that shows the intended look, layout, and behaviour. It is not production code to copy
directly: it is a single-file prototype with all styling inline and all logic in one class.

The task is to **recreate this design in a real codebase** using that codebase's established patterns.
The target repository (`room-planner`) is currently empty apart from a README, so the implementer picks
the stack. The recommendation in "Suggested stack" below is a starting point, not a constraint.

The prototype is the source of truth for **appearance and behaviour**. It is also a correct reference
implementation for the **geometry and checks logic** — that code can be ported near-verbatim, since it
is plain JavaScript with no framework dependency.

## Fidelity

**High fidelity.** Final colours, typography, spacing, and interactions. Recreate the UI closely, using
the exact values in "Design tokens" below. The one deliberate flexibility: if the target codebase has an
existing design system, map the token *roles* (ink, muted ink, line, edge, soft, accent, bad, note) onto
its equivalents rather than hard-coding these hexes.

---

## Suggested stack

| Concern | Recommendation | Why |
|---|---|---|
| Build | Vite | Static output, zero config, instant dev server |
| Framework | React 18 + TypeScript | The prototype is already a React-shaped component tree; the data model benefits strongly from types |
| State | One `useReducer` + context, no library | Single document object, every mutation is a pure transform, undo is a stack of JSON snapshots |
| Styling | CSS modules or vanilla CSS with custom properties | Tokens become `--ink`, `--line`, etc.; the prototype's inline styles were a prototyping constraint, not a design decision |
| Persistence | `localStorage`, debounced 400 ms | Already the prototype's behaviour |
| Routing | None. URL hash only (`#p=<encoded>`) | Share links |
| Hosting | Any static host (GitHub Pages, Netlify, Cloudflare Pages) | No server needed |
| Tests | Vitest for the geometry/checks module | It is pure functions and it is where bugs will hide |

Deliberately **not** needed: canvas/WebGL (the plan is DOM elements positioned in percentages), a drag
library (pointer events are enough), a state library, a backend.

---

## Data model

Port this shape as-is. Units are **centimetres** throughout; `x`/`y` are the **centre** of a piece.

```ts
type Cat = "sleep" | "storage" | "work" | "soft" | "other";
type Wall = "n" | "e" | "s" | "w";
type SlotKey = "A" | "B" | "C";

interface Doc {
  nextHome: number;              // id counters, monotonic
  nextRoom: number;
  catalog: CatalogItem[];        // user-editable, shared across all homes
  homes: Home[];
}

interface CatalogItem { id: string; name: string; w: number; d: number; cat: Cat; }

interface Home { id: number; name: string; rooms: Room[]; }

interface Room {
  id: number;
  name: string;
  w: number;                     // width, cm
  d: number;                     // depth, cm
  cuts: Partial<Record<"nw"|"ne"|"se"|"sw", { w: number; d: number }>>;
  nextId: number;                // next furniture id within this room
  nextOid: number;               // next opening id within this room
  slots: Record<SlotKey, Item[]>;
  openings: Opening[];           // shared across all three slots
}

interface Item {
  id: number; name: string;
  w: number; d: number;          // unrotated footprint
  x: number; y: number;          // centre, cm from room's top-left
  r: 0 | 90 | 180 | 270;         // rotation
  cat: Cat;
}

interface Opening {
  id: number;
  kind: "Door" | "Window";
  wall: Wall;
  pos: number;                   // cm along the wall from its start
  len: number;                   // cm
  flip?: boolean;                // mirrors the door swing arc
}
```

Notes that matter:

- **Openings belong to the room, not the slot.** Doors and windows are physical; the three layouts share them.
- **The catalogue is document-level**, so a piece added in one home is available in all.
- `cuts` entries store `w` and `d` **independently** — that is what allows both square corner cuts and
  narrow alcoves. A corner with `w > 0 || d > 0` exists; when both hit 0 the key is deleted.
- Rotation is quantised to 90°, so the footprint swap is `r % 180 === 0 ? [w, d] : [d, w]`. No
  arbitrary-angle support, and the checks logic assumes axis-aligned boxes.

### UI state (not persisted)

`hi` (home index), `ri` (room index), `slot`, `sel` (`{t: "item"|"opening", id} | null`), `zoom`,
`panx`, `pany`, catalogue-editor fields, and the two status strings. Only `doc` is saved.

---

## Geometry and checks (port directly)

These are the parts worth porting line-for-line rather than reimplementing.

**Footprint / bounding box**

```
foot(it) = it.r % 180 === 0 ? [it.w, it.d] : [it.d, it.w]
box(it)  = { x0: x - w/2, y0: y - h/2, x1: x + w/2, y1: y + h/2, w, h }
```

**Intersection** — uses a 1 cm tolerance so touching pieces are not overlapping:

```
inter(a, b) = (min(a.x1,b.x1) - max(a.x0,b.x0)) > 1 && (min(a.y1,b.y1) - max(a.y0,b.y0)) > 1
```

**Corner cut rectangles** — `nw` anchors at `(0,0)`, `ne` at `(w - cut.w, 0)`, `se` at
`(w - cut.w, d - cut.d)`, `sw` at `(0, d - cut.d)`.

**Door zone** — a rectangle projected inward from the wall, depth = `max(len, requestedDepth)`. Called
twice per door: once with `depth = len` (the swing itself) and once with `depth = walkwayCm` (the
approach).

**Move** — snap and clamp, in this order:

1. Round to the nearest 5 cm.
2. Unless Alt is held, wall-snap: if the piece's edge is within 14 cm of a wall, pin it flush.
3. Clamp the centre so the footprint stays inside `0..w` / `0..d`.

**Checks** produce `{ bad: boolean, ids: number[], text: string }`, deduplicated by `text` and capped at
10. Pieces with `cat === "soft"` (rugs) are excluded from every check — they are meant to sit under
things. In order:

| Check | Severity | Message |
|---|---|---|
| Two solid pieces intersect | bad | `"{A} overlaps {B}"` |
| Any piece intersects a corner cut | bad | `"{A} sits outside the floor"` |
| Solid piece in a door's swing rectangle | bad | `"{A} blocks the door swing"` |
| Solid piece in the door's approach but not the swing | note | `"{A} leaves under {walkway} cm at the door"` |
| Gap between two solid pieces is 2..walkway cm, with >30 cm of overlap on the perpendicular axis | note | `"{n} cm gap between {A} and {B}"` |

The >30 cm perpendicular-overlap condition is what stops it reporting a "gap" between two pieces that
merely pass each other at a corner. Keep it.

**Area readout** — `room.w * room.d` minus the sum of the corner cuts, shown in m² to one decimal.
"Taken" is the sum of solid footprints.

---

## Layout

Three-column app shell, full viewport height, nothing scrolls at the page level.

```
┌──────────────────────────────────────────────────────────────┐
│ header  48px-ish, wraps: title · home select · room tabs · + │
│         ··· spacer ··· undo · redo · Share link · Print      │
├────────────┬────────────────────────────────┬────────────────┤
│ left rail  │ main                           │ right rail     │
│ 228px      │ minmax(0, 1fr)                 │ 252px          │
│            │ ┌ toolbar: layout A/B/C ·      │                │
│ Room       │ │ Copy here · Reset ·          │ Selection      │
│ Shape      │ │ − 100% + · Fit               │ Checks         │
│ Furniture  │ ├ stage (flex: 1) ────────────┐│ Pieces         │
│ Openings   │ │  room, centred, aspect-      ││                │
│ Plan file  │ │  ratio locked, grid overlay  ││                │
│            │ └ help line                    │                │
└────────────┴────────────────────────────────┴────────────────┘
```

- Outer: `height: 100vh; overflow: hidden; display: flex; flex-direction: column`.
- Columns: `display: grid; grid-template-columns: 228px minmax(0, 1fr) 252px; align-items: stretch`,
  inside `flex: 1; min-height: 0`.
- Both rails: `overflow-y: auto; min-height: 0; padding: 12px 12px 18px; gap: 16px` between sections.
- Rail sections: `h2` in mono, 10px, 600, `letter-spacing: 0.14em`, uppercase, muted ink.

### The stage — do not measure it in JavaScript

This is the one implementation detail most likely to be got wrong on a rewrite. The plan is sized
**entirely in CSS**, using container queries, so it re-fits on any window resize with no resize
observers, no stored pixel sizes, and no layout thrash.

```css
/* stage: absolutely positioned fill of the plan area */
position: absolute; inset: 0;
container-type: size;
display: flex; align-items: center; justify-content: center;
transform: translate(<panx>px, <pany>px) scale(<zoom>);
transform-origin: center center;
```

```css
/* room: the floor itself */
position: relative; flex: none;
width: min(100cqw - 60px, (100cqh - 60px) * <w/d>);
aspect-ratio: <w> / <d>;
background: var(--paper); border: 2px solid var(--ink);
```

The `60px` is breathing room for the dimension labels. Everything *inside* the room — furniture,
openings, door swings, corner cuts, grid — is positioned in **percentages of the room box**:

```
pw(cm) = (cm / room.w * 100).toFixed(4) + "%"
ph(cm) = (cm / room.d * 100).toFixed(4) + "%"
```

Consequences to preserve:

- Zoom and pan are a transform on the **stage**, layered over a plan that is already correctly sized.
- The only place that reads pixels is drag: on pointerdown, `rect.width / room.w` gives cm-per-pixel for
  that gesture. It is read fresh each drag, so it is correct at any zoom, and never cached.
- Grid overlay: two `linear-gradient` 1px lines at `rgba(87,81,74,0.18)`,
  `background-size: pw(gridCm) ph(gridCm)`, toggled with `opacity` (not `display`) so nothing reflows.

### Plan elements and z-order

| Element | z-index | Notes |
|---|---|---|
| Door swing arc | 1 | 1px dashed `#b3a893`, quarter-circle via asymmetric `border-radius` (`0 0 100% 0` etc., mirrored by `flip`) |
| Soft pieces (rugs) | 2 | 1px dashed border, sits under everything |
| Solid pieces | 3 | |
| Selected piece | 5 | 2px solid accent border, accent-light fill |
| Openings | 6 | 12px band straddling the wall, offset `-6px`; windows get a centre line via gradient |
| Corner cuts | 8 | Filled with the stage background to mask the floor, with 2px ink borders on the two inner edges; sized `calc(<pct> + 2px)` and offset `-2px` so they cover the room's own border |

Piece labels degrade with size: name hidden below 30 cm on the short side, 9px instead of 11px below
55 cm, dimension line hidden when height < 60 cm or width < 80 cm.

---

## Controls, by panel

**Header** — app title ("Room plan"); home `<select>`; room tabs (pill buttons, active = ink fill); `+`
button (dashed border) adds a room; undo/redo (ghost buttons, visibly dead when the stack is empty);
"Share link" (ink fill, the only filled accent-weight button in the header); "Print".

**Left rail**

- *Room* — name text field; W and D number fields (`step="10"`, mono); home-name field + "New home";
  "Delete this room" (quiet, full width).
- *Shape* — four rows, one per corner (Top left, Top right, Low right, Low left), each with a `w` and a
  `d` number input and a `×` clear button. Grid `54px 1fr 1fr 24px`. Values clamp to `roomDim - 10`.
- *Furniture* — the catalogue. Each row: colour swatch (9px, category fill + category ink border), name,
  right-aligned mono `w × d`. Clicking adds the piece at room centre and selects it. "Edit" toggles
  delete buttons per row plus an add form (name, w, d, category select, "Add to list") on a dashed
  panel.
- *Openings* — "Add door" and "Add window" (default lengths 90 cm and 130 cm, placed on the north wall).
- *Plan file* — "Export plan file" (downloads JSON), "Import a plan file" (`<input type="file">`), and
  the autosave status line.

**Main toolbar** — layout slot A/B/C (30px mono squares, active = ink fill); "Copy here" (copies the
current slot's items into the active slot); "Reset" (empties the slot); zoom `−` / percentage / `+`;
"Fit" (re-measures and resets zoom to 1, pan to 0).

**Right rail**

- *Selection* — for a piece: name, W/D, rotate, flip-nothing, delete. For an opening: kind, length, wall
  picker (N/E/S/W as four small buttons), flip swing (doors only), delete. Empty state when nothing is
  selected.
- *Checks* — the issue list. Each row is a button: 7px round dot (bad = `#b03a2b`, note = `#96671b`),
  message text, border red for bad. Clicking selects the offending piece.
- *Pieces* — flat list of everything in the current slot; the selected one gets an accent border and
  accent-light fill.

**Help line** under the stage, 12px muted: drag pieces, drag empty space to pan, scroll to zoom, arrows
nudge 5 cm (shift = 1 cm), R rotates, Delete removes.

---

## Interactions

| Input | Behaviour |
|---|---|
| Drag a piece | Live move, 5 cm grid, wall-snap within 14 cm, clamped to the floor. Hold **Alt** to suppress snapping. |
| Drag an opening | Slides along its own wall, 5 cm steps, clamped to `0..(wallSpan - len)`. |
| Drag empty stage | Pans. |
| Wheel over the stage | Zooms about the cursor: `f = exp(-deltaY * 0.0016)`, clamped `0.3..6`, with pan corrected so the point under the cursor stays put. `passive: false`, `preventDefault`. |
| Arrow keys | Nudge 5 cm, shift-arrow 1 cm. |
| `R` | Rotate 90°. |
| `Delete` / `Backspace` | Delete selection. |
| `Escape` | Clear selection. |
| `⌘Z` / `⇧⌘Z` | Undo / redo. |
| Click a check row | Selects that piece. |

Keyboard handlers are on `window` and must bail out when the event target is an `input`, `select`, or
`textarea`.

**Pointer capture:** drags use `setPointerCapture` on the dragged element and attach
`pointermove`/`pointerup` to it, not to the document. Keep that — it is what makes dragging survive the
cursor leaving the element.

**Undo granularity:** a snapshot is pushed **once per gesture**, on pointerdown, not per move event.
History is `JSON.stringify(doc)` strings, capped at 80 entries; any new snapshot clears the redo stack.
Coarse but correct, and cheap enough that a document of this size makes it a non-issue.

---

## Persistence, sharing, printing

- **Autosave** — debounced 400 ms after any `doc` change, into `localStorage` key
  `room-planner-doc-v1`. Wrap in try/catch (private browsing).
- **Load order on boot** — URL hash `#p=<encoded>` wins, then `localStorage`, then the default
  document. The status line reflects which happened ("Opened from a shared link." / "Restored from this
  browser." / "Saved in this browser automatically.").
- **Share link** — `btoa(unescape(encodeURIComponent(JSON.stringify(doc))))`, then URL-safe
  (`+`→`-`, `/`→`_`, strip `=`), written to `location.hash` as `p=…` and copied to the clipboard; the
  button label confirms. Decoding reverses it and re-pads to a multiple of 4. **Caveat worth flagging to
  the user:** a whole multi-home document can outgrow practical URL length. Consider compressing
  (e.g. `lz-string`) or sharing a single room, and validate the decoded shape before trusting it.
- **Export / import** — the same JSON, as a downloaded `.json` file and a file input. Validate on
  import; never `JSON.parse` into state without a shape check.
- **Print** — a print stylesheet that hides `[data-noprint]`, unlocks the app's fixed height, drops the
  stage's overflow and background, and reveals a `[data-printonly]` title block ("Home — Room, layout A"
  and "310 × 360 cm · 11.2 m²"). `@page { margin: 14mm }`. Printing uses the **current** zoom
  deliberately; "Fit" is the way to normalise first.

---

## Design tokens

Warm drafting-paper palette. Roles matter more than the hexes if you are mapping onto an existing system.

| Role | Value | Used for |
|---|---|---|
| Ink | `#2c2a26` | Body text, walls (2px), filled buttons |
| Muted ink | `#615a4d` | Section headings, field labels, help text, dimension labels |
| Line | `#57514a` | Piece borders, strong control borders |
| Edge | `#d9d0bf` | Inactive pill borders |
| Soft | `#e4dccd` | Quiet borders, list rows |
| Accent | `#17635e` | Selection borders, links, the "Edit" toggle |
| Accent light | `#dae8e4` | Selected fills |
| Bad | `#b03a2b` | Errors |
| Note | `#96671b` | Warnings |
| Paper | `#fdfbf6` | Floor, inputs, list rows |
| Rail | `#f5f1e7` | Both side rails |
| Ground | `#e9e2d4` | App background |
| Header | `#ded6c5` | Header bar |
| Stage | `#e1d9c9` | Around the plan, and corner-cut fill |
| Dashed | `#b3a893` | Door swings, dashed add-panels |
| Disabled | `#a3977f` | Dead undo/redo labels |

Category fills (fill / ink pairs, used for the plan blocks and catalogue swatches):

| Category | Fill | Ink |
|---|---|---|
| Sleeping | `#e2e6da` | `#4e5a49` |
| Storage | `#e9e2d4` | `#6b6151` |
| Work | `#f1e3cb` | `#8a6a26` |
| Soft | `#fdfbf6` | `#b3a893` |
| Other | `#f0ebdf` | `#615a4d` |

**Typography** — IBM Plex Sans (400/500/600/700) for names and body; IBM Plex Mono (400/500/600) for all
numbers, dimensions, labels, and section headings. Sizes in use: 9, 10, 11, 12, 13, 14px. Mono labels are
uppercase with `letter-spacing: 0.06em`–`0.14em`.

**Radii** — 5px on controls, 3px on furniture blocks, 50% on status dots. **Walls stay square** — the
room's own border has no radius, deliberately, so the plan still reads as a floor plan.

**Spacing** — 4 / 5 / 6 / 7 / 8 / 10 / 12 / 14 / 16 / 18px. Control heights 26 / 28 / 30 / 32px.

**Borders** — 1px hairlines; 1.5px under the header; 2px for walls and for the selected piece.

**Contrast** — every text/background pair here clears WCAG AA (4.5:1) at the sizes used; muted ink on the
rail is 5.8:1 and on the ground 5.0:1. If you retune the palette, re-check the small mono labels first —
they are the tightest cases.

---

## Configuration

The prototype exposes five settings. Expose them however the target app prefers (a settings popover is
the obvious home):

| Setting | Type | Default | Range |
|---|---|---|---|
| `showGrid` | boolean | `true` | |
| `gridCm` | enum | `50` | 10 / 25 / 50 / 100 |
| `showDims` | boolean | `true` | |
| `typeFills` | boolean | `true` | Category colour fills on plan blocks |
| `walkwayCm` | int | `60` | 40–120, step 5 |

`walkwayCm` is the clearance threshold for the checks, so it belongs near the Checks panel.

---

## Suggested build order

1. **Scaffold + tokens.** Vite + React + TS, fonts, CSS custom properties, the three-column shell.
2. **Types + reducer + default document.** Port `Doc`/`Room`/`Item` and the `defaultDoc()` fixture.
   `localStorage` load/save with the debounce.
3. **Static plan rendering.** The container-query stage, the room box, percentage-positioned furniture
   and openings, grid overlay, dimension labels. No interaction yet. This is the highest-risk piece —
   get the CSS sizing right before anything is draggable.
4. **Selection + rails.** Click to select, selection panel, pieces list, room/shape fields.
5. **Drag, keyboard, undo.** Pointer capture, snapping, the 5 cm grid, arrows, `R`, delete, history.
6. **Geometry module + checks panel.** Port `inter`, `box`, `cutRects`, `doorZone`, `issueList` as pure
   functions with unit tests. This is where Vitest earns its place.
7. **Zoom and pan.** Stage transform, wheel-to-cursor zoom, Fit.
8. **Catalogue editing, homes and rooms, slots A/B/C.**
9. **Export/import, share links, print stylesheet.**
10. **Settings, empty states, deploy.**

Steps 1–3 give a viewable plan; 1–6 give a genuinely useful tool. Steps 9–10 are what make it shareable.

## Known gaps to decide on

These are deliberately absent from the prototype and should be settled before or during implementation:

- **No confirmation** on "Delete this room", "Reset", or catalogue deletion — undo covers pieces and
  openings, but structural deletions are a bigger loss. Worth a confirm step.
- **Share-link size** — see the caveat above.
- **No touch/mobile pass.** Pointer events mean drag works on touch, but the 228/252px rails and the
  small controls do not. If mobile matters, it needs its own layout.
- **No accessibility pass on the plan.** The rails are ordinary form controls and are fine; the plan
  itself is drag-only, with no keyboard route to select a piece (arrows only move an already-selected
  one). A focusable, arrow-navigable piece list would close this — the Pieces panel is most of the way
  there already.
- **Rotation is 90°-only,** and the checks assume axis-aligned boxes. Free rotation would mean replacing
  every rectangle test with polygon intersection.
- **No multi-select, no grouping, no measure tool.**
- **Units are cm only.** An imperial toggle would be display-only if all storage stays metric.

## Assets

None. No images or icon files — the `+`, `×`, `−` glyphs are text characters, and the door swing and
window symbols are drawn with CSS borders and gradients. Fonts come from Google Fonts (IBM Plex Sans,
IBM Plex Mono).

## Files

- `Room Planner Tool.dc.html` — the full prototype. Template markup first, then the logic class: data
  model and constants at the top, then geometry helpers, then the component (lifecycle, history,
  accessors, mutations, drag, `issueList`, and a `renderVals()` that computes every style object).
- `Room Planner.dc.html` (in the project, not bundled) — an earlier version, superseded.
