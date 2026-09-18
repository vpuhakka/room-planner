import type { Cat, CatalogItem, Doc, Room } from "./types";

export const STORAGE_KEY = "room-planner-doc-v1";

export const CATS: Record<Cat, { label: string; fill: string; ink: string }> = {
  sleep: { label: "Sleeping", fill: "#e2e6da", ink: "#4e5a49" },
  storage: { label: "Storage", fill: "#e9e2d4", ink: "#6b6151" },
  work: { label: "Work", fill: "#f1e3cb", ink: "#8a6a26" },
  soft: { label: "Soft", fill: "#fdfbf6", ink: "#b3a893" },
  other: { label: "Other", fill: "#f0ebdf", ink: "#615a4d" }
};

export const catMeta = (c: Cat) => CATS[c] ?? CATS.other;

const BASE_CATALOG: CatalogItem[] = [
  { id: "bed", name: "Double bed", w: 200, d: 180, cat: "sleep" },
  { id: "single", name: "Single bed", w: 200, d: 90, cat: "sleep" },
  { id: "desk", name: "Desk", w: 125, d: 75, cat: "work" },
  { id: "chair", name: "Chair", w: 45, d: 45, cat: "work" },
  { id: "closet", name: "Closet", w: 200, d: 70, cat: "storage" },
  { id: "wardrobe", name: "Wardrobe", w: 120, d: 60, cat: "storage" },
  { id: "drawers", name: "Drawers", w: 80, d: 45, cat: "storage" },
  { id: "nightstand", name: "Nightstand", w: 45, d: 40, cat: "storage" },
  { id: "shelf", name: "Bookshelf", w: 80, d: 30, cat: "storage" },
  { id: "rug", name: "Rug", w: 160, d: 230, cat: "soft" }
];

export function newRoom(id: number, name: string): Room {
  return {
    id,
    name,
    w: 320,
    d: 300,
    cuts: {},
    nextId: 1,
    nextOid: 101,
    slots: { A: [], B: [], C: [] },
    openings: [{ id: 100, kind: "Door", wall: "s", pos: 30, len: 90 }]
  };
}

export function defaultDoc(): Doc {
  return {
    nextHome: 2,
    nextRoom: 3,
    catalog: BASE_CATALOG.map((c) => ({ ...c })),
    homes: [
      {
        id: 1,
        name: "Home",
        rooms: [
          {
            id: 1,
            name: "Bedroom 1",
            w: 310,
            d: 360,
            cuts: {},
            nextId: 4,
            nextOid: 103,
            slots: {
              A: [
                { id: 1, name: "Double bed", w: 200, d: 180, x: 155, y: 90, r: 0, cat: "sleep" },
                { id: 2, name: "Closet", w: 200, d: 70, x: 210, y: 325, r: 0, cat: "storage" },
                { id: 3, name: "Desk", w: 125, d: 75, x: 65, y: 218, r: 0, cat: "work" }
              ],
              B: [],
              C: []
            },
            openings: [
              { id: 101, kind: "Door", wall: "s", pos: 20, len: 90 },
              { id: 102, kind: "Window", wall: "n", pos: 95, len: 130 }
            ]
          },
          {
            id: 2,
            name: "Bedroom 2",
            w: 380,
            d: 257,
            cuts: {},
            nextId: 4,
            nextOid: 103,
            slots: {
              A: [
                { id: 1, name: "Double bed", w: 200, d: 180, x: 210, y: 90, r: 0, cat: "sleep" },
                { id: 2, name: "Closet", w: 200, d: 70, x: 345, y: 157, r: 90, cat: "storage" },
                { id: 3, name: "Desk", w: 125, d: 75, x: 75, y: 219, r: 0, cat: "work" }
              ],
              B: [],
              C: []
            },
            openings: [
              { id: 101, kind: "Door", wall: "w", pos: 20, len: 80 },
              { id: 102, kind: "Window", wall: "s", pos: 150, len: 130 }
            ]
          }
        ]
      }
    ]
  };
}

/** Shape check for anything arriving from a file, a URL or another browser session.
 *  Validates every field the app dereferences, so a passing doc cannot crash or NaN the UI. */
export function isDoc(v: unknown): v is Doc {
  const num = (x: unknown) => typeof x === "number" && Number.isFinite(x);
  const d = v as Doc;
  if (!d || typeof d !== "object" || !Array.isArray(d.homes) || !d.homes.length) return false;
  if (!Array.isArray(d.catalog) || !num(d.nextHome) || !num(d.nextRoom)) return false;
  return d.homes.every(
    (h) =>
      h &&
      num(h.id) &&
      typeof h.name === "string" &&
      Array.isArray(h.rooms) &&
      h.rooms.length > 0 &&
      h.rooms.every(
        (r) =>
          r &&
          typeof r.name === "string" &&
          num(r.w) &&
          num(r.d) &&
          num(r.nextId) &&
          num(r.nextOid) &&
          !!r.cuts &&
          typeof r.cuts === "object" &&
          r.slots &&
          (["A", "B", "C"] as const).every(
            (k) =>
              Array.isArray(r.slots[k]) &&
              r.slots[k].every(
                (i) =>
                  i && num(i.id) && typeof i.name === "string" &&
                  num(i.w) && num(i.d) && num(i.x) && num(i.y) && num(i.r)
              )
          ) &&
          Array.isArray(r.openings) &&
          r.openings.every(
            (o) => o && num(o.id) && num(o.pos) && num(o.len) && ["n", "e", "s", "w"].includes(o.wall)
          )
      )
  );
}

export function encodeDoc(doc: Doc): string {
  const s = JSON.stringify(doc);
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeDoc(str: string): Doc | null {
  try {
    let b = str.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const doc = JSON.parse(decodeURIComponent(escape(atob(b))));
    return isDoc(doc) ? doc : null;
  } catch {
    return null;
  }
}

/** A share-link hash wins once and is then consumed, so a reload goes back to the autosaved doc. */
export function loadDoc(): { doc: Doc; note: string } {
  const hash = (location.hash || "").replace(/^#/, "");
  const m = /(?:^|&)p=([^&]+)/.exec(hash);
  if (m) {
    const shared = decodeDoc(m[1]);
    if (shared) {
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch {
        /* ignore */
      }
      try {
        // autosave will overwrite the stored doc shortly; keep a hand-recoverable copy
        const prev = localStorage.getItem(STORAGE_KEY);
        if (prev) localStorage.setItem(`${STORAGE_KEY}-backup`, prev);
      } catch {
        /* private browsing */
      }
      return { doc: shared, note: "Opened from a shared link." };
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (isDoc(stored)) return { doc: stored, note: "Restored from this browser." };
    }
  } catch {
    /* private browsing */
  }
  return { doc: defaultDoc(), note: "Saved in this browser automatically." };
}

export function saveDoc(doc: Doc): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    /* private browsing, or quota */
  }
}
