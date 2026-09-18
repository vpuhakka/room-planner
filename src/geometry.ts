import type { Box, CornerKey, Issue, Item, Opening, Rect, Room } from "./types";

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Rotation is quantised to 90°, so the footprint is just a swap. */
export function foot(it: Item): [number, number] {
  return it.r % 180 === 0 ? [it.w, it.d] : [it.d, it.w];
}

export function box(it: Item): Box {
  const [w, h] = foot(it);
  return { x0: it.x - w / 2, y0: it.y - h / 2, x1: it.x + w / 2, y1: it.y + h / 2, w, h };
}

/** 1 cm tolerance, so pieces that merely touch are not overlapping. */
export function inter(a: Rect, b: Rect): boolean {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 1 && h > 1;
}

export function cutRects(room: Room): (Rect & { key: CornerKey })[] {
  const c = room.cuts || {};
  const out: (Rect & { key: CornerKey })[] = [];
  const live = (x?: { w: number; d: number }) => !!x && x.w > 0 && x.d > 0;
  if (live(c.nw)) out.push({ x0: 0, y0: 0, x1: c.nw!.w, y1: c.nw!.d, key: "nw" });
  if (live(c.ne)) out.push({ x0: room.w - c.ne!.w, y0: 0, x1: room.w, y1: c.ne!.d, key: "ne" });
  if (live(c.se)) out.push({ x0: room.w - c.se!.w, y0: room.d - c.se!.d, x1: room.w, y1: room.d, key: "se" });
  if (live(c.sw)) out.push({ x0: 0, y0: room.d - c.sw!.d, x1: c.sw!.w, y1: room.d, key: "sw" });
  return out;
}

/** Rectangle projected inward from the wall: the swing (depth = len) or the approach (depth = walkway). */
export function doorZone(room: Room, d: Opening, depth?: number): Rect {
  const L = d.len;
  const t = Math.max(L, depth ?? L);
  if (d.wall === "n") return { x0: d.pos, y0: 0, x1: d.pos + L, y1: t };
  if (d.wall === "s") return { x0: d.pos, y0: room.d - t, x1: d.pos + L, y1: room.d };
  if (d.wall === "w") return { x0: 0, y0: d.pos, x1: t, y1: d.pos + L };
  return { x0: room.w - t, y0: d.pos, x1: room.w, y1: d.pos + L };
}

/** Snap to the grid step (5 cm or 2″) and wall-snap within 14 cm unless suppressed, then clamp
 *  inside the floor. snap=false leaves positions as given, so Alt-drag and Shift-nudge stay fine. */
export function snapMove(room: Room, it: Item, x: number, y: number, snap = true, step = 5): { x: number; y: number } {
  const [w, h] = foot(it);
  let nx = x;
  let ny = y;
  if (snap) {
    nx = Math.round(nx / step) * step;
    ny = Math.round(ny / step) * step;
    if (Math.abs(nx - w / 2) < 14) nx = w / 2;
    if (Math.abs(room.w - nx - w / 2) < 14) nx = room.w - w / 2;
    if (Math.abs(ny - h / 2) < 14) ny = h / 2;
    if (Math.abs(room.d - ny - h / 2) < 14) ny = room.d - h / 2;
  }
  nx = clamp(nx, w / 2, Math.max(w / 2, room.w - w / 2));
  ny = clamp(ny, h / 2, Math.max(h / 2, room.d - h / 2));
  return { x: nx, y: ny };
}

/** Keep an opening on its wall: the length fits the span, the position keeps both ends inside. */
export function clampOpening(room: Room, o: Opening): Opening {
  const span = o.wall === "n" || o.wall === "s" ? room.w : room.d;
  const len = clamp(o.len, 20, span);
  return { ...o, len, pos: clamp(o.pos, 0, span - len) };
}

/** Resize the room, re-fitting openings and corner cuts to the new bounds. */
export function fitRoom(room: Room, w: number, d: number): Partial<Room> {
  const next = { ...room, w, d };
  const cuts: Room["cuts"] = {};
  for (const k of Object.keys(room.cuts) as CornerKey[]) {
    const c = room.cuts[k]!;
    cuts[k] = { w: Math.max(0, Math.min(c.w, w - 10)), d: Math.max(0, Math.min(c.d, d - 10)) };
  }
  return { w, d, cuts, openings: room.openings.map((o) => clampOpening(next, o)) };
}

/** Floor area in cm², minus the corner cuts. */
export function floorArea(room: Room): number {
  return room.w * room.d - cutRects(room).reduce((a, c) => a + (c.x1 - c.x0) * (c.y1 - c.y0), 0);
}

/** Rugs sit under things, so they are excluded from every check.
 *  fmt renders measures in the user's units; issues stay deduplicated by their text. */
export function issueList(
  room: Room,
  items: Item[],
  walkwayCm: number,
  fmt: (cm: number) => string = (cm) => `${Math.round(cm)} cm`
): Issue[] {
  const list = items.map((i) => ({ i, b: box(i) }));
  const solid = list.filter((x) => x.i.cat !== "soft");
  const out: Issue[] = [];

  for (let a = 0; a < solid.length; a++) {
    for (let b = a + 1; b < solid.length; b++) {
      if (inter(solid[a].b, solid[b].b)) {
        out.push({ bad: true, ids: [solid[a].i.id], text: `${solid[a].i.name} overlaps ${solid[b].i.name}` });
      }
    }
  }

  const cuts = cutRects(room);
  for (const x of list) {
    // same 1 cm tolerance as inter(); catches rotate/resize/import paths that bypass snapMove's clamp
    if (x.b.x0 < -1 || x.b.y0 < -1 || x.b.x1 > room.w + 1 || x.b.y1 > room.d + 1) {
      out.push({ bad: true, ids: [x.i.id], text: `${x.i.name} sits outside the floor` });
    }
    for (const c of cuts) {
      if (inter(x.b, c)) out.push({ bad: true, ids: [x.i.id], text: `${x.i.name} sits outside the floor` });
    }
  }

  for (const d of room.openings) {
    if (d.kind !== "Door") continue;
    const swing = doorZone(room, d, d.len);
    const approach = doorZone(room, d, walkwayCm);
    for (const x of solid) {
      if (inter(x.b, swing)) out.push({ bad: true, ids: [x.i.id], text: `${x.i.name} blocks the door swing` });
      else if (inter(x.b, approach)) {
        out.push({ bad: false, ids: [x.i.id], text: `${x.i.name} leaves under ${fmt(walkwayCm)} at the door` });
      }
    }
  }

  for (let a = 0; a < solid.length; a++) {
    for (let b = a + 1; b < solid.length; b++) {
      const A = solid[a].b;
      const B = solid[b].b;
      const gx = Math.max(A.x0, B.x0) - Math.min(A.x1, B.x1);
      const gy = Math.max(A.y0, B.y0) - Math.min(A.y1, B.y1);
      // >30 cm of perpendicular overlap, else two pieces merely passing at a corner read as a gap
      const overX = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) > 30;
      const overY = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) > 30;
      let g: number | null = null;
      if (overY && gx > 2 && gx < walkwayCm) g = gx;
      else if (overX && gy > 2 && gy < walkwayCm) g = gy;
      if (g !== null) {
        out.push({
          bad: false,
          ids: [solid[a].i.id],
          text: `${fmt(g)} gap between ${solid[a].i.name} and ${solid[b].i.name}`
        });
      }
    }
  }

  const seen = new Set<string>();
  return out.filter((o) => (seen.has(o.text) ? false : (seen.add(o.text), true))).slice(0, 10);
}
