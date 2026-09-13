import type { Planner } from "../usePlanner";
import type { SlotKey } from "../types";

const SLOTS: SlotKey[] = ["A", "B", "C"];

export default function Toolbar({ p }: { p: Planner }) {
  return (
    <div className="toolbar" data-noprint>
      <span className="cap">Layout</span>
      <div style={{ display: "flex", gap: 3 }}>
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            className="pill pill--square"
            aria-pressed={p.slot === s}
            onClick={() => p.setSlot(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--quiet" onClick={p.copyToNext}>Copy to next</button>
      <button type="button" className="btn btn--quiet" onClick={p.emptySlot}>Empty</button>

      <div className="spacer" />

      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <button
          type="button"
          className="btn btn--zoom"
          onClick={() => p.setView((v) => ({ ...v, zoom: Math.max(0.3, v.zoom / 1.25) }))}
          aria-label="Zoom out"
        >−</button>
        <span
          style={{
            minWidth: 44, textAlign: "center", fontFamily: "var(--mono)",
            fontSize: 11, fontWeight: 500, color: "var(--mute)"
          }}
        >
          {Math.round(p.view.zoom * 100)}%
        </span>
        <button
          type="button"
          className="btn btn--zoom"
          onClick={() => p.setView((v) => ({ ...v, zoom: Math.min(6, v.zoom * 1.25) }))}
          aria-label="Zoom in"
        >+</button>
        <button
          type="button"
          className="btn"
          style={{ height: 26, padding: "0 9px" }}
          onClick={() => p.setView({ zoom: 1, panx: 0, pany: 0 })}
        >Fit</button>
      </div>
    </div>
  );
}
