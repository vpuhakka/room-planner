# Room planner

Browser-based furniture arrangement planner. Define rooms in centimetres (with optional corner cuts for
L-shapes and alcoves), place pieces from an editable catalogue, drag and rotate them on a scaled floor
plan, and get live warnings for overlaps, pieces off the floor, blocked door swings and tight walkways.
Plans are grouped as homes → rooms → three alternative layouts per room (A/B/C), persist to
`localStorage`, and can be exported as JSON or shared as an encoded URL.

Static single-page app: no accounts, no backend.

```sh
npm install
npm run dev      # dev server
npm test         # geometry and checks unit tests
npm run build    # static output in dist/
```

## Layout of the source

| File | What lives there |
|---|---|
| `src/types.ts` | The document model (`Doc` → `Home` → `Room` → slots of `Item`, plus `Opening`) |
| `src/geometry.ts` | Pure functions: footprints, intersection, corner cuts, door zones, snapping, `issueList` |
| `src/geometry.test.ts` | Vitest cover for the above — the part where bugs hide |
| `src/doc.ts` | Default document, catalogue, share-link encoding, `localStorage`, import validation |
| `src/usePlanner.ts` | All state and every mutation, plus undo/redo snapshots |
| `src/components/` | `Header`, `Toolbar`, `LeftRail`, `Plan` (the stage), `RightRail` |
| `src/styles.css` | Design tokens as custom properties, then component classes |

Notes worth keeping in mind when editing:

- **The plan is sized entirely in CSS.** The stage is a size container; the room is
  `width: min(100cqw - 60px, (100cqh - 60px) * ratio)` with a locked `aspect-ratio`, and everything
  inside it is positioned in percentages. No resize observers, no stored pixel sizes. The only place
  that reads pixels is drag, which measures the live room box once per gesture.
- **Openings belong to the room**, not to a layout slot — doors and windows are physical.
- **Undo is one snapshot per gesture**, pushed on pointerdown, capped at 80 `JSON.stringify(doc)` strings.
- Rugs (`cat: "soft"`) are excluded from every check; they are meant to sit under things.

## Known gaps

- Share links carry the whole document in the URL hash, so a large multi-home plan can outgrow practical
  URL length. Compressing, or sharing a single room, would fix it.
- No touch/mobile layout: drag works, the 228/252 px rails do not.
- The plan itself is drag-only; there is no keyboard route to select a piece (arrows only move an
  already-selected one). The Pieces list is the natural place to close that.
- Rotation is 90°-only and the checks assume axis-aligned boxes.
- Centimetres only, no multi-select, no measure tool.
