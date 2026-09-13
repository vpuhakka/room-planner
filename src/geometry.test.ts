import { describe, expect, it } from "vitest";
import { box, cutRects, doorZone, floorArea, foot, inter, issueList, snapMove } from "./geometry";
import type { Item, Room } from "./types";

const item = (o: Partial<Item>): Item =>
  ({ id: 1, name: "Piece", w: 100, d: 50, x: 100, y: 100, r: 0, cat: "other", ...o }) as Item;

const room = (o: Partial<Room> = {}): Room => ({
  id: 1, name: "Room", w: 400, d: 300, cuts: {}, nextId: 1, nextOid: 1,
  slots: { A: [], B: [], C: [] }, openings: [], ...o
});

describe("footprint", () => {
  it("swaps w and d on quarter turns only", () => {
    expect(foot(item({ r: 0 }))).toEqual([100, 50]);
    expect(foot(item({ r: 90 }))).toEqual([50, 100]);
    expect(foot(item({ r: 180 }))).toEqual([100, 50]);
    expect(foot(item({ r: 270 }))).toEqual([50, 100]);
  });

  it("boxes around the centre", () => {
    expect(box(item({ x: 100, y: 100 }))).toMatchObject({ x0: 50, y0: 75, x1: 150, y1: 125 });
  });
});

describe("inter", () => {
  const a = { x0: 0, y0: 0, x1: 100, y1: 100 };
  it("overlaps", () => expect(inter(a, { x0: 50, y0: 50, x1: 150, y1: 150 })).toBe(true));
  it("ignores a touch", () => expect(inter(a, { x0: 100, y0: 0, x1: 200, y1: 100 })).toBe(false));
  it("ignores a 1 cm bite, the tolerance", () => {
    expect(inter(a, { x0: 99, y0: 0, x1: 200, y1: 100 })).toBe(false);
  });
  it("catches a 2 cm bite", () => expect(inter(a, { x0: 98, y0: 0, x1: 200, y1: 100 })).toBe(true));
});

describe("cutRects", () => {
  it("anchors each corner and drops half-empty ones", () => {
    const r = room({ cuts: { nw: { w: 50, d: 60 }, se: { w: 30, d: 40 }, ne: { w: 20, d: 0 } } });
    expect(cutRects(r)).toEqual([
      { x0: 0, y0: 0, x1: 50, y1: 60, key: "nw" },
      { x0: 370, y0: 260, x1: 400, y1: 300, key: "se" }
    ]);
  });

  it("subtracts cuts from the floor area", () => {
    expect(floorArea(room())).toBe(120000);
    expect(floorArea(room({ cuts: { nw: { w: 100, d: 100 } } }))).toBe(110000);
  });
});

describe("doorZone", () => {
  const r = room();
  const door = { id: 1, kind: "Door" as const, wall: "n" as const, pos: 100, len: 90 };
  it("projects the swing inward", () => {
    expect(doorZone(r, door, door.len)).toEqual({ x0: 100, y0: 0, x1: 190, y1: 90 });
  });
  it("never shrinks below the swing, even for a smaller walkway", () => {
    expect(doorZone(r, door, 60)).toEqual({ x0: 100, y0: 0, x1: 190, y1: 90 });
  });
  it("grows to the walkway when it is deeper", () => {
    expect(doorZone(r, { ...door, wall: "e" }, 120)).toEqual({ x0: 280, y0: 100, x1: 400, y1: 190 });
  });
});

describe("snapMove", () => {
  const r = room();
  const pc = item({ w: 100, d: 50 });
  it("rounds to 5 cm", () => expect(snapMove(r, pc, 123, 97)).toMatchObject({ x: 125, y: 95 }));
  it("pins to a wall within 14 cm", () => expect(snapMove(r, pc, 60, 150).x).toBe(50));
  it("leaves the piece alone beyond 14 cm", () => expect(snapMove(r, pc, 70, 150).x).toBe(70));
  it("skips wall snapping when asked", () => expect(snapMove(r, pc, 60, 150, false).x).toBe(60));
  it("clamps the footprint inside the floor", () => {
    expect(snapMove(r, pc, 900, -400)).toMatchObject({ x: 350, y: 25 });
  });
  it("clamps the rotated footprint", () => {
    expect(snapMove(r, item({ w: 100, d: 50, r: 90 }), 900, 900)).toMatchObject({ x: 375, y: 250 });
  });
});

describe("issueList", () => {
  const walk = 60;

  it("reports overlapping solids", () => {
    const issues = issueList(room(), [
      item({ id: 1, name: "Bed", x: 100, y: 100 }),
      item({ id: 2, name: "Desk", x: 150, y: 100 })
    ], walk);
    expect(issues).toContainEqual({ bad: true, ids: [1], text: "Bed overlaps Desk" });
  });

  it("ignores rugs everywhere", () => {
    const issues = issueList(room(), [
      item({ id: 1, name: "Rug", cat: "soft", x: 100, y: 100 }),
      item({ id: 2, name: "Desk", x: 120, y: 100 })
    ], walk);
    expect(issues).toEqual([]);
  });

  it("flags a piece over a corner cut, rugs included", () => {
    const r = room({ cuts: { nw: { w: 100, d: 100 } } });
    const issues = issueList(r, [item({ id: 1, name: "Rug", cat: "soft", x: 50, y: 50 })], walk);
    expect(issues).toContainEqual({ bad: true, ids: [1], text: "Rug sits outside the floor" });
  });

  it("separates a blocked swing from a tight approach", () => {
    const r = room({ openings: [{ id: 1, kind: "Door", wall: "n", pos: 100, len: 90 }] });
    const inSwing = issueList(r, [item({ id: 1, name: "Bed", w: 80, d: 80, x: 140, y: 40 })], walk);
    expect(inSwing).toContainEqual({ bad: true, ids: [1], text: "Bed blocks the door swing" });

    // clear of the 90 cm swing, inside a 150 cm approach
    const nearby = issueList(r, [item({ id: 1, name: "Bed", w: 80, d: 40, x: 140, y: 115 })], 150);
    expect(nearby).toContainEqual({ bad: false, ids: [1], text: "Bed leaves under 150 cm at the door" });
  });

  it("reports a narrow walkway between two pieces", () => {
    const issues = issueList(room(), [
      item({ id: 1, name: "Bed", w: 200, d: 100, x: 150, y: 50 }),
      item({ id: 2, name: "Closet", w: 200, d: 100, x: 150, y: 180 })
    ], walk);
    expect(issues).toContainEqual({ bad: false, ids: [1], text: "30 cm gap between Bed and Closet" });
  });

  it("stays quiet when the pieces only pass at a corner", () => {
    const issues = issueList(room(), [
      item({ id: 1, name: "Bed", w: 100, d: 20, x: 60, y: 50 }),
      item({ id: 2, name: "Closet", w: 20, d: 100, x: 125, y: 120 })
    ], walk);
    expect(issues).toEqual([]);
  });

  it("deduplicates by text and caps at ten", () => {
    const many = Array.from({ length: 12 }, (_, n) =>
      item({ id: n + 1, name: `P${n}`, w: 40, d: 40, x: 100 + n, y: 100 })
    );
    const issues = issueList(room(), many, walk);
    expect(issues).toHaveLength(10);
    expect(new Set(issues.map((i) => i.text)).size).toBe(10);
  });
});
