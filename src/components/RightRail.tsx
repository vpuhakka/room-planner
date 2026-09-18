import { clampOpening } from "../geometry";
import NumField from "./NumField";
import type { Planner } from "../usePlanner";
import type { Wall } from "../types";

const WALLS: [Wall, string][] = [
  ["n", "Top"],
  ["e", "Right"],
  ["s", "Bottom"],
  ["w", "Left"]
];

export default function RightRail({ p }: { p: Planner }) {
  const { selItem: it, selOpening: op, items, issues, settings } = p;
  const areaText = `${(p.areaCm2 / 10000).toFixed(1)} m²`;
  const fillText = p.areaCm2 > 0 ? `${Math.round((p.takenCm2 / p.areaCm2) * 100)}%` : "—";

  return (
    <aside className="rail rail--right">
      <section className="sec" data-noprint style={{ gap: 8 }}>
        <h2>Selected</h2>

        {it && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <input
              className="field field--sel" value={it.name} aria-label="Piece name"
              onChange={(e) => p.setItems((l) => l.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))}
            />
            <div className="grid2">
              <label className="lbl">
                Width
                <NumField
                  step={5} value={it.w} min={10}
                  onCommit={(v) => {
                    p.hist();
                    p.setItems((l) => l.map((x) => (x.id === it.id ? { ...x, w: v } : x)));
                  }}
                />
              </label>
              <label className="lbl">
                Depth
                <NumField
                  step={5} value={it.d} min={10}
                  onCommit={(v) => {
                    p.hist();
                    p.setItems((l) => l.map((x) => (x.id === it.id ? { ...x, d: v } : x)));
                  }}
                />
              </label>
            </div>
            <div className="row">
              <button
                type="button" className="btn" style={{ flex: 1, height: 30 }}
                onClick={() => { p.hist(); p.rotate(); }}
              >Rotate 90°</button>
              <button type="button" className="btn btn--quiet btn--danger" style={{ height: 30, padding: "0 11px" }} onClick={p.del}>
                Remove
              </button>
            </div>
          </div>
        )}

        {op && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{op.kind}</p>
            <div className="lbl">
              Wall
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
                {WALLS.map(([w, label]) => (
                  <button
                    key={w} type="button" className="pill pill--wall"
                    aria-pressed={op.wall === w} onClick={() => p.setWall(w)}
                  >{label}</button>
                ))}
              </div>
            </div>
            <label className="lbl">
              Opening width, cm
              <NumField
                step={5} value={op.len} min={20}
                max={op.wall === "n" || op.wall === "s" ? p.room.w : p.room.d}
                onCommit={(v) => {
                  p.hist();
                  p.setOpenings((l) =>
                    l.map((x) => (x.id === op.id ? clampOpening(p.room, { ...x, len: v }) : x))
                  );
                }}
              />
            </label>
            {op.kind === "Door" && (
              <button
                type="button" className="btn" style={{ height: 30, width: "100%" }}
                onClick={() => {
                  p.hist();
                  p.setOpenings((l) => l.map((x) => (x.id === op.id ? { ...x, flip: !x.flip } : x)));
                }}
              >Flip hinge side</button>
            )}
            <button type="button" className="btn btn--quiet btn--danger" style={{ height: 30 }} onClick={p.del}>
              Remove
            </button>
          </div>
        )}

        {!it && !op && (
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--mute)" }}>
            Click anything in the plan to size, rotate or move it.
          </p>
        )}
      </section>

      <section className="sec" style={{ gap: 5 }}>
        <h2>Checks</h2>
        {issues.map((i) => (
          <button
            key={i.text} type="button" className={`issue${i.bad ? " issue--bad" : ""}`}
            onClick={() => p.setSel({ t: "item", id: i.ids[0] })}
          >
            <span className={`dot${i.bad ? " dot--bad" : ""}`} />
            <span className="text">{i.text}</span>
          </button>
        ))}
        {issues.length === 0 && (
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: "var(--mute)" }}>
            Nothing overlaps, the door swings free and walkways are at least {settings.walkwayCm} cm.
          </p>
        )}
        <label className="lbl" data-noprint style={{ marginTop: 4 }}>
          Walkway, cm
          <NumField
            step={5} value={settings.walkwayCm} min={40} max={120}
            onCommit={(v) => p.setSettings((s) => ({ ...s, walkwayCm: v }))}
          />
        </label>
      </section>

      <section className="sec" style={{ gap: 4 }}>
        <h2>In the room</h2>
        {items.map((i) => (
          <button
            key={i.id} type="button" className="list-btn" aria-pressed={it?.id === i.id}
            onClick={() => p.setSel({ t: "item", id: i.id })}
          >
            <span className="name">{i.name}</span>
            <span className="dims">{i.w} × {i.d} cm</span>
          </button>
        ))}
        <p className="note-mono" style={{ marginTop: 4 }}>
          Floor {areaText} · furniture covers {fillText}
        </p>
      </section>
    </aside>
  );
}
