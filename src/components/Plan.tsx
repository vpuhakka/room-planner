import type React from "react";
import { catMeta } from "../doc";
import { box, cutRects, doorZone } from "../geometry";
import type { Planner } from "../usePlanner";
import type { Item, Opening } from "../types";

const ACC = "#17635e";
const BAD = "#b03a2b";
const NOTE = "#96671b";
const LINE = "#57514a";
const INK = "#2c2a26";

export default function Plan({ p }: { p: Planner }) {
  const { room, items, settings, selItem, selOpening, flagged } = p;
  const pw = (v: number) => `${((v / room.w) * 100).toFixed(4)}%`;
  const ph = (v: number) => `${((v / room.d) * 100).toFixed(4)}%`;

  /* cm per px is read fresh from the live room box, so drag is correct at any zoom */
  const drag = (e: React.PointerEvent, o: Item | Opening, kind: "item" | "opening") => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const host = el.parentElement;
    if (!host) return;
    const k = host.getBoundingClientRect().width / room.w;
    const sx = e.clientX;
    const sy = e.clientY;
    el.setPointerCapture(e.pointerId);
    p.hist();

    let mv: (ev: PointerEvent) => void;
    if (kind === "item") {
      const it = o as Item;
      p.setSel({ t: "item", id: it.id });
      mv = (ev) => p.move(it.id, it.x + (ev.clientX - sx) / k, it.y + (ev.clientY - sy) / k, !ev.altKey);
    } else {
      const op = o as Opening;
      p.setSel({ t: "opening", id: op.id });
      const horiz = op.wall === "n" || op.wall === "s";
      mv = (ev) => {
        const span = horiz ? room.w : room.d;
        const dd = (horiz ? ev.clientX - sx : ev.clientY - sy) / k;
        const np = Math.min(Math.max(Math.round((op.pos + dd) / 5) * 5, 0), Math.max(0, span - op.len));
        p.setOpenings((l) => l.map((x) => (x.id === op.id ? { ...x, pos: np } : x)));
      };
    }
    const up = () => {
      el.removeEventListener("pointermove", mv);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", mv);
    el.addEventListener("pointerup", up);
  };

  const pan = (e: React.PointerEvent) => {
    const sx = e.clientX;
    const sy = e.clientY;
    const { panx, pany } = p.view;
    let moved = false;
    const mv = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      moved = true;
      p.setView((v) => ({ ...v, panx: panx + dx, pany: pany + dy }));
    };
    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      if (!moved) p.setSel(null);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="stagewrap" data-stagewrap onPointerDown={pan}>
      <div
        className="stage"
        style={{ transform: `translate(${p.view.panx}px, ${p.view.pany}px) scale(${p.view.zoom})` }}
      >
        <div
          className="room"
          style={{
            width: `min(100cqw - 60px, (100cqh - 60px) * ${(room.w / room.d).toFixed(4)})`,
            aspectRatio: `${room.w} / ${room.d}`
          }}
        >
          <div
            className="grid"
            style={{
              opacity: settings.showGrid ? 1 : 0,
              backgroundSize: `${pw(settings.gridCm)} ${ph(settings.gridCm)}`
            }}
          />

          {room.openings
            .filter((o) => o.kind === "Door")
            .map((d) => {
              const z = doorZone(room, d, d.len);
              const f = !!d.flip;
              const radius =
                d.wall === "n" ? (f ? "0 0 0 100%" : "0 0 100% 0")
                : d.wall === "s" ? (f ? "100% 0 0 0" : "0 100% 0 0")
                : d.wall === "w" ? (f ? "0 100% 0 0" : "0 0 100% 0")
                : f ? "100% 0 0 0" : "0 0 0 100%";
              return (
                <div
                  key={`swing-${d.id}`}
                  className="swing"
                  style={{
                    left: pw(z.x0), top: ph(z.y0),
                    width: pw(z.x1 - z.x0), height: ph(z.y1 - z.y0),
                    borderRadius: radius
                  }}
                />
              );
            })}

          {items.map((i) => {
            const b = box(i);
            const on = selItem?.id === i.id;
            const soft = i.cat === "soft";
            const flag = flagged[i.id];
            const edge = on ? ACC : flag === "bad" ? BAD : flag === "note" ? NOTE : LINE;
            const small = Math.min(b.w, b.h) < 55;
            return (
              <div
                key={i.id}
                className="piece"
                onPointerDown={(e) => drag(e, i, "item")}
                style={{
                  left: pw(b.x0), top: ph(b.y0), width: pw(b.w), height: ph(b.h),
                  background: on ? "#dae8e4" : settings.typeFills ? catMeta(i.cat).fill : "transparent",
                  border: `${soft ? "1px dashed" : on ? "2px solid" : "1px solid"} ${edge}`,
                  zIndex: soft ? 2 : on ? 5 : 3
                }}
              >
                <span
                  className="name"
                  style={{
                    fontSize: small ? "9px" : "11px",
                    display: Math.min(b.w, b.h) < 30 ? "none" : "block"
                  }}
                >
                  {i.name}
                </span>
                <span
                  className="dims"
                  style={{ display: !settings.showDims || b.h < 60 || b.w < 80 ? "none" : "block" }}
                >
                  {i.w} × {i.d}
                </span>
              </div>
            );
          })}

          {room.openings.map((o) => {
            const horiz = o.wall === "n" || o.wall === "s";
            const on = selOpening?.id === o.id;
            const style: React.CSSProperties = {
              cursor: horiz ? "ew-resize" : "ns-resize",
              boxShadow: `inset 0 0 0 ${on ? `2px ${ACC}` : `1.5px ${INK}`}`
            };
            if (o.kind === "Window") {
              style.backgroundImage = horiz
                ? `linear-gradient(to bottom, transparent 45%, ${INK} 45%, ${INK} 55%, transparent 55%)`
                : `linear-gradient(to right, transparent 45%, ${INK} 45%, ${INK} 55%, transparent 55%)`;
            }
            if (horiz) {
              style.left = pw(o.pos);
              style.width = pw(o.len);
              style.height = "12px";
              style.top = o.wall === "n" ? "-6px" : "calc(100% - 6px)";
            } else {
              style.top = ph(o.pos);
              style.height = ph(o.len);
              style.width = "12px";
              style.left = o.wall === "w" ? "-6px" : "calc(100% - 6px)";
            }
            return (
              <div
                key={`op-${o.id}`}
                className="opening"
                title={`${o.kind} ${o.len} cm — drag along the wall`}
                onPointerDown={(e) => drag(e, o, "opening")}
                style={style}
              />
            );
          })}

          {cutRects(room).map((c) => {
            /* filled with the stage colour and oversized by 2px, so it masks the room's own wall */
            const style: React.CSSProperties = {
              width: `calc(${pw(c.x1 - c.x0)} + 2px)`,
              height: `calc(${ph(c.y1 - c.y0)} + 2px)`
            };
            const wall = `2px solid ${INK}`;
            if (c.key === "nw") Object.assign(style, { left: -2, top: -2, borderRight: wall, borderBottom: wall });
            if (c.key === "ne") Object.assign(style, { right: -2, top: -2, borderLeft: wall, borderBottom: wall });
            if (c.key === "se") Object.assign(style, { right: -2, bottom: -2, borderLeft: wall, borderTop: wall });
            if (c.key === "sw") Object.assign(style, { left: -2, bottom: -2, borderRight: wall, borderTop: wall });
            return <div key={c.key} className="cut" style={style} />;
          })}

          <div className="dim-label dim-label--w">{room.w} cm</div>
          <div className="dim-label dim-label--d">{room.d} cm</div>
        </div>
      </div>
    </div>
  );
}
