import { useEffect } from "react";
import Header from "./components/Header";
import LeftRail from "./components/LeftRail";
import Plan from "./components/Plan";
import RightRail from "./components/RightRail";
import Toolbar from "./components/Toolbar";
import { floorArea } from "./geometry";
import { usePlanner } from "./usePlanner";

export default function App() {
  const p = usePlanner();
  const { selItem } = p;

  /* wheel: window listener, because React's own is passive and cannot preventDefault */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const host = (e.target as HTMLElement)?.closest?.("[data-stagewrap]");
      if (!host) return;
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      p.setView((v) => {
        const cx = e.clientX - (rect.left + rect.width / 2) - v.panx;
        const cy = e.clientY - (rect.top + rect.height / 2) - v.pany;
        const z = Math.min(6, Math.max(0.3, v.zoom * Math.exp(-e.deltaY * 0.0016)));
        const k = z / v.zoom;
        return { zoom: z, panx: v.panx - cx * (k - 1), pany: v.pany - cy * (k - 1) };
      });
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [p.setView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        return e.shiftKey ? p.redo() : p.undo();
      }
      if (!p.sel) return;
      if (e.key === "Escape") return p.setSel(null);
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        return p.del();
      }
      if (!selItem) return;
      const step = e.shiftKey ? 1 : 5;
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]
      };
      if (nudge[e.key]) {
        e.preventDefault();
        p.hist();
        p.move(selItem.id, selItem.x + nudge[e.key][0], selItem.y + nudge[e.key][1], false);
      } else if (e.key === "r" || e.key === "R") {
        p.hist();
        p.rotate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="app">
      <Header p={p} />
      <div className="cols">
        <LeftRail p={p} />
        <main className="main">
          <Toolbar p={p} />
          <div data-printonly style={{ marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              {p.home.name} — {p.room.name}, layout {p.slot}
            </p>
            <p style={{ margin: "2px 0 0", fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)" }}>
              {p.room.w} × {p.room.d} cm · {(floorArea(p.room) / 10000).toFixed(1)} m²
            </p>
          </div>
          <Plan p={p} />
          <p className="help" data-noprint>
            Drag pieces, or drag empty space to pan. Scroll to zoom. Alt ignores wall snapping.
            Arrows nudge 5 cm (Shift for 1 cm), R rotates, Backspace removes, ⌘Z undoes.
          </p>
        </main>
        <RightRail p={p} />
      </div>
    </div>
  );
}
