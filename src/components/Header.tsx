import type { Planner } from "../usePlanner";

export default function Header({ p }: { p: Planner }) {
  return (
    <header className="header" data-noprint>
      <h1>Room plan</h1>

      <select
        className="field field--quiet"
        style={{ fontWeight: 600, maxWidth: 170, borderColor: "var(--line)" }}
        value={p.home.id}
        onChange={(e) => p.pickHome(+e.target.value)}
        aria-label="Home"
      >
        {p.doc.homes.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {p.home.rooms.map((rm, i) => (
          <button
            key={rm.id}
            type="button"
            className="pill"
            aria-pressed={i === p.ri}
            onClick={() => p.pickRoom(i)}
          >
            {rm.name}
          </button>
        ))}
        <button type="button" className="btn--dash" title="Add a room" onClick={p.addRoom}>+</button>
      </div>

      <div className="spacer" />

      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button type="button" className="btn--ghost" disabled={!p.canUndo} onClick={p.undo} title="Undo (⌘Z)">Undo</button>
        <button type="button" className="btn--ghost" disabled={!p.canRedo} onClick={p.redo} title="Redo (⇧⌘Z)">Redo</button>
        <button type="button" className="btn btn--fill" onClick={p.share}>{p.shareLabel}</button>
        <button type="button" className="btn" onClick={() => window.print()}>Print</button>
      </div>
    </header>
  );
}
