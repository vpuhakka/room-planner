import { useState } from "react";
import { CATS, catMeta } from "../doc";
import { fitRoom } from "../geometry";
import { fmtLen, fmtNum, parseLen, unitLabel } from "../units";
import NumField from "./NumField";
import type { Planner } from "../usePlanner";
import type { Cat, CornerKey, Settings } from "../types";

const CORNERS: [CornerKey, string][] = [
  ["nw", "Top left"],
  ["ne", "Top right"],
  ["se", "Low right"],
  ["sw", "Low left"]
];

export default function LeftRail({ p }: { p: Planner }) {
  const { room, home, doc, settings } = p;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", w: "", d: "", cat: "storage" as Cat });

  const setCut = (key: CornerKey, f: "w" | "d", v: number) => {
    p.hist();
    p.setRoom((r) => {
      const cuts = { ...r.cuts };
      const cur = { w: 0, d: 0, ...cuts[key] };
      cur[f] = v;
      if (cur.w > 0 || cur.d > 0) cuts[key] = cur;
      else delete cuts[key];
      return { cuts };
    });
  };

  const addToCatalog = () => {
    const w = parseLen(form.w, settings.units) ?? 0;
    const d = parseLen(form.d, settings.units) ?? 0;
    if (!(w > 0 && d > 0)) return;
    p.hist();
    p.setDoc((dd) => ({
      ...dd,
      catalog: dd.catalog.concat([
        { id: `c${Date.now()}`, name: form.name.trim() || "Piece", w, d, cat: form.cat }
      ])
    }));
    setForm({ name: "", w: "", d: "", cat: form.cat });
  };

  return (
    <aside className="rail rail--left" data-noprint>
      <section className="sec">
        <h2>Room</h2>
        <input
          className="field"
          value={room.name}
          onChange={(e) => p.setRoom(() => ({ name: e.target.value }))}
          aria-label="Room name"
        />
        <div className="grid2">
          <label className="lbl">
            Width {unitLabel(settings.units)}
            <NumField
              step={10} value={room.w} min={1} max={2000} units={settings.units}
              onCommit={(v) => {
                p.hist();
                p.setRoom((r) => fitRoom(r, v, r.d));
              }}
            />
          </label>
          <label className="lbl">
            Depth {unitLabel(settings.units)}
            <NumField
              step={10} value={room.d} min={1} max={2000} units={settings.units}
              onCommit={(v) => {
                p.hist();
                p.setRoom((r) => fitRoom(r, r.w, v));
              }}
            />
          </label>
        </div>
        <div className="row">
          <input
            className="field field--quiet" style={{ flex: 1 }} value={home.name}
            title="Name of this home or project"
            onChange={(e) => p.setHome(() => ({ name: e.target.value }))}
          />
          <button type="button" className="btn btn--quiet" style={{ padding: "0 8px" }} onClick={p.addHome}>
            New home
          </button>
        </div>
        <button type="button" className="btn btn--sub btn--danger" onClick={p.deleteRoom}>
          Delete this room
        </button>
      </section>

      <section className="sec">
        <h2>Shape</h2>
        <p>Cut a corner to make an L-shape or leave an alcove.</p>
        {CORNERS.map(([key, label]) => {
          const c = room.cuts[key];
          return (
            <div className="corner-row" key={key}>
              <span>{label}</span>
              <NumField
                className="field field--corner" step={10} placeholder="w"
                value={c?.w || 0} min={0} max={Math.max(0, room.w - 10)} units={settings.units}
                onCommit={(v) => setCut(key, "w", v)}
                aria-label={`${label} cut width`}
              />
              <NumField
                className="field field--corner" step={10} placeholder="d"
                value={c?.d || 0} min={0} max={Math.max(0, room.d - 10)} units={settings.units}
                onCommit={(v) => setCut(key, "d", v)}
                aria-label={`${label} cut depth`}
              />
              <button
                type="button" className="btn btn--tiny" title="Clear"
                onClick={() => {
                  p.hist();
                  p.setRoom((r) => {
                    const cuts = { ...r.cuts };
                    delete cuts[key];
                    return { cuts };
                  });
                }}
              >×</button>
            </div>
          );
        })}
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2>Furniture</h2>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn--link" onClick={() => setEditing(!editing)}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {doc.catalog.map((c) => (
            <div className="cat-row" key={c.id}>
              <button type="button" className="cat-btn" onClick={() => p.addItem(c.name, c.w, c.d, c.cat)}>
                <span
                  className="swatch"
                  style={{ background: catMeta(c.cat).fill, border: `1px solid ${catMeta(c.cat).ink}` }}
                />
                <span className="name">{c.name}</span>
                <span style={{ flex: 1 }} />
                <span className="dims">{fmtNum(c.w, settings.units)} × {fmtNum(c.d, settings.units)}</span>
              </button>
              {editing && (
                <button
                  type="button" className="btn btn--tiny" aria-label={`Remove ${c.name}`}
                  onClick={() => {
                    p.hist();
                    p.setDoc((d) => ({ ...d, catalog: d.catalog.filter((x) => x.id !== c.id) }));
                  }}
                >×</button>
              )}
            </div>
          ))}
        </div>
        {editing && (
          <div className="cat-form">
            <input
              className="field field--quiet" placeholder="New piece name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div className="grid2" style={{ gap: 4 }}>
              <input
                className="field field--quiet" style={{ fontFamily: "var(--mono)" }}
                type={settings.units === "imperial" ? "text" : "number"}
                placeholder="w" value={form.w} onChange={(e) => setForm({ ...form, w: e.target.value })}
              />
              <input
                className="field field--quiet" style={{ fontFamily: "var(--mono)" }}
                type={settings.units === "imperial" ? "text" : "number"}
                placeholder="d" value={form.d} onChange={(e) => setForm({ ...form, d: e.target.value })}
              />
            </div>
            <select
              className="field field--quiet" value={form.cat}
              onChange={(e) => setForm({ ...form, cat: e.target.value as Cat })}
            >
              {(Object.keys(CATS) as Cat[]).map((k) => (
                <option key={k} value={k}>{CATS[k].label}</option>
              ))}
            </select>
            <button type="button" className="btn btn--fill" style={{ height: 30 }} onClick={addToCatalog}>
              Save to catalogue
            </button>
          </div>
        )}
      </section>

      <section className="sec">
        <h2>Openings</h2>
        <div className="row">
          <button type="button" className="btn" style={{ flex: 1, height: 30 }} onClick={() => p.addOpening("Door")}>Door</button>
          <button type="button" className="btn" style={{ flex: 1, height: 30 }} onClick={() => p.addOpening("Window")}>Window</button>
        </div>
      </section>

      <section className="sec">
        <h2>Plan view</h2>
        <select
          className="field field--quiet" value={settings.units}
          onChange={(e) => {
            const units = e.target.value as Settings["units"];
            p.setSettings((s) => ({ ...s, units, gridCm: units === "imperial" ? 60.96 : 50 }));
          }}
          aria-label="Units"
        >
          <option value="metric">Centimetres</option>
          <option value="imperial">Feet &amp; inches</option>
        </select>
        <label className="check">
          <input
            type="checkbox" checked={settings.showGrid}
            onChange={(e) => p.setSettings((s) => ({ ...s, showGrid: e.target.checked }))}
          />
          Grid
        </label>
        <select
          className="field field--quiet" style={{ fontFamily: "var(--mono)" }} value={settings.gridCm}
          onChange={(e) => p.setSettings((s) => ({ ...s, gridCm: +e.target.value }))}
          aria-label="Grid size"
        >
          {(settings.units === "imperial" ? [15.24, 30.48, 60.96, 121.92] : [10, 25, 50, 100]).map((g) => (
            <option key={g} value={g}>{fmtLen(g, settings.units)} grid</option>
          ))}
        </select>
        <label className="check">
          <input
            type="checkbox" checked={settings.showDims}
            onChange={(e) => p.setSettings((s) => ({ ...s, showDims: e.target.checked }))}
          />
          Sizes on pieces
        </label>
        <label className="check">
          <input
            type="checkbox" checked={settings.typeFills}
            onChange={(e) => p.setSettings((s) => ({ ...s, typeFills: e.target.checked }))}
          />
          Colour by type
        </label>
      </section>

      <section className="sec">
        <h2>Plan file</h2>
        <button type="button" className="btn" onClick={p.exportFile}>Export .json</button>
        <label className="lbl lbl--plain">
          Import a plan file
          <input
            type="file" accept="application/json,.json" style={{ fontSize: 11, color: "var(--mute)" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) p.importFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <p className="note-mono">{p.savedNote}</p>
      </section>
    </aside>
  );
}
