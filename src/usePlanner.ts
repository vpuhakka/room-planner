import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { encodeDoc, isDoc, loadDoc, newRoom, saveDoc } from "./doc";
import { clampOpening, floorArea, issueList, snapMove } from "./geometry";
import type { Cat, Doc, Home, Item, Opening, Room, Sel, Settings, SlotKey, Wall } from "./types";

const SLOTS: SlotKey[] = ["A", "B", "C"];
const HISTORY_MAX = 80;

/* Indices are clamped exactly like the reads, so a stale hi/ri after undo or import
   still writes to the home/room the user is looking at. */
const mapHome = (d: Doc, hi: number, fn: (h: Home) => Partial<Home>): Doc => {
  const i0 = Math.min(hi, d.homes.length - 1);
  return { ...d, homes: d.homes.map((h, i) => (i === i0 ? { ...h, ...fn(h) } : h)) };
};

const mapRoom = (d: Doc, hi: number, ri: number, fn: (r: Room) => Partial<Room>): Doc =>
  mapHome(d, hi, (h) => {
    const i0 = Math.min(ri, h.rooms.length - 1);
    return { rooms: h.rooms.map((r, i) => (i === i0 ? { ...r, ...fn(r) } : r)) };
  });

export function usePlanner(): Planner {
  const [initial] = useState(loadDoc);
  const [doc, setDocState] = useState<Doc>(initial.doc);
  const [savedNote, setSavedNote] = useState(initial.note);
  const [hi, setHi] = useState(0);
  const [ri, setRi] = useState(0);
  const [slot, setSlotState] = useState<SlotKey>("A");
  const [sel, setSel] = useState<Sel>(null);
  const [view, setView] = useState({ zoom: 1, panx: 0, pany: 0 });
  const [settings, setSettings] = useState<Settings>({
    showGrid: true,
    gridCm: 50,
    showDims: true,
    typeFills: true,
    walkwayCm: 60
  });
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [shareLabel, setShareLabel] = useState("Share link");

  const docRef = useRef(doc);
  docRef.current = doc;

  const home = doc.homes[Math.min(hi, doc.homes.length - 1)];
  const room = home.rooms[Math.min(ri, home.rooms.length - 1)];
  const items = room.slots[slot] ?? [];

  /* ---- history: one snapshot per gesture, pushed before the change ----
     The stacks live in refs and are mirrored to state for canUndo/canRedo; updater
     functions stay pure, which StrictMode's double-invoking requires. */
  const pastRef = useRef(past);
  const futureRef = useRef(future);

  const hist = useCallback(() => {
    pastRef.current = [...pastRef.current, JSON.stringify(docRef.current)].slice(-HISTORY_MAX);
    futureRef.current = [];
    setPast(pastRef.current);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    if (!pastRef.current.length) return;
    const snap = pastRef.current[pastRef.current.length - 1];
    futureRef.current = [...futureRef.current, JSON.stringify(docRef.current)];
    pastRef.current = pastRef.current.slice(0, -1);
    setPast(pastRef.current);
    setFuture(futureRef.current);
    setDocState(JSON.parse(snap));
    setSel(null);
  }, []);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    const snap = futureRef.current[futureRef.current.length - 1];
    pastRef.current = [...pastRef.current, JSON.stringify(docRef.current)].slice(-HISTORY_MAX);
    futureRef.current = futureRef.current.slice(0, -1);
    setPast(pastRef.current);
    setFuture(futureRef.current);
    setDocState(JSON.parse(snap));
    setSel(null);
  }, []);

  /* ---- mutations ---- */
  const setDoc = useCallback((fn: (d: Doc) => Doc) => setDocState((d) => fn(d)), []);
  const setHome = useCallback((fn: (h: Home) => Partial<Home>) => setDocState((d) => mapHome(d, hi, fn)), [hi]);
  const setRoom = useCallback(
    (fn: (r: Room) => Partial<Room>) => setDocState((d) => mapRoom(d, hi, ri, fn)),
    [hi, ri]
  );
  const setItems = useCallback(
    (fn: (list: Item[]) => Item[]) =>
      setRoom((r) => ({ slots: { ...r.slots, [slot]: fn(r.slots[slot] ?? []) } })),
    [setRoom, slot]
  );
  const setOpenings = useCallback(
    (fn: (list: Opening[]) => Opening[]) => setRoom((r) => ({ openings: fn(r.openings) })),
    [setRoom]
  );

  const selItem = sel?.t === "item" ? items.find((i) => i.id === sel.id) ?? null : null;
  const selOpening = sel?.t === "opening" ? room.openings.find((o) => o.id === sel.id) ?? null : null;

  const roomRef = useRef(room);
  roomRef.current = room;

  const move = useCallback(
    (id: number, x: number, y: number, snap = true) =>
      setItems((list) =>
        list.map((it) => (it.id === id ? { ...it, ...snapMove(roomRef.current, it, x, y, snap) } : it))
      ),
    [setItems]
  );

  const rotate = useCallback(() => {
    if (!selItem) return;
    setItems((l) => l.map((i) => (i.id === selItem.id ? { ...i, r: ((i.r + 90) % 360) as Item["r"] } : i)));
  }, [selItem, setItems]);

  const del = useCallback(() => {
    if (!sel) return;
    hist();
    if (sel.t === "item") setItems((l) => l.filter((i) => i.id !== sel.id));
    else setOpenings((l) => l.filter((o) => o.id !== sel.id));
    setSel(null);
  }, [sel, hist, setItems, setOpenings]);

  const addItem = useCallback(
    (name: string, w: number, d: number, cat: Cat) => {
      const id = room.nextId;
      hist();
      setRoom((r) => ({
        nextId: id + 1,
        slots: {
          ...r.slots,
          [slot]: (r.slots[slot] ?? []).concat([
            { id, name, w, d, cat, x: Math.round(r.w / 2), y: Math.round(r.d / 2), r: 0 }
          ])
        }
      }));
      setSel({ t: "item", id });
    },
    [room.nextId, hist, setRoom, slot]
  );

  const addOpening = useCallback(
    (kind: Opening["kind"]) => {
      const id = room.nextOid;
      hist();
      const o: Opening =
        kind === "Door"
          ? { id, kind, wall: "w", pos: 20, len: 90 }
          : { id, kind, wall: "e", pos: 60, len: 120 };
      setRoom((r) => ({ openings: r.openings.concat([o]), nextOid: id + 1 }));
      setSel({ t: "opening", id });
    },
    [room.nextOid, hist, setRoom]
  );

  const setSlot = useCallback((s: SlotKey) => {
    setSlotState(s);
    setSel(null);
  }, []);

  const copyToNext = useCallback(() => {
    const next = SLOTS[(SLOTS.indexOf(slot) + 1) % SLOTS.length];
    hist();
    setRoom((r) => ({ slots: { ...r.slots, [next]: (r.slots[slot] ?? []).map((o) => ({ ...o })) } }));
    setSlot(next);
  }, [slot, hist, setRoom, setSlot]);

  const emptySlot = useCallback(() => {
    hist();
    setItems(() => []);
    setSel(null);
  }, [hist, setItems]);

  const pickHome = useCallback(
    (id: number) => {
      const i = doc.homes.findIndex((h) => h.id === id);
      if (i < 0) return;
      setHi(i);
      setRi(0);
      setSel(null);
      setView({ zoom: 1, panx: 0, pany: 0 });
    },
    [doc.homes]
  );

  const pickRoom = useCallback((i: number) => {
    setRi(i);
    setSel(null);
    setView({ zoom: 1, panx: 0, pany: 0 });
  }, []);

  const addHome = useCallback(() => {
    const id = doc.nextHome;
    const rid = doc.nextRoom;
    hist();
    setDoc((d) => ({
      ...d,
      nextHome: id + 1,
      nextRoom: rid + 1,
      homes: d.homes.concat([{ id, name: `Home ${id}`, rooms: [newRoom(rid, "Room 1")] }])
    }));
    setHi(doc.homes.length);
    setRi(0);
    setSel(null);
  }, [doc.nextHome, doc.nextRoom, doc.homes.length, hist, setDoc]);

  const addRoom = useCallback(() => {
    const rid = doc.nextRoom;
    hist();
    setDocState((d) =>
      mapHome({ ...d, nextRoom: rid + 1 }, hi, (h) => ({
        rooms: h.rooms.concat([newRoom(rid, `Room ${h.rooms.length + 1}`)])
      }))
    );
    setRi(home.rooms.length);
    setSel(null);
  }, [doc.nextRoom, hi, home.rooms.length, hist]);

  const deleteRoom = useCallback(() => {
    if (home.rooms.length < 2) return;
    if (!confirm(`Delete ${room.name}? All three layouts go with it.`)) return;
    hist();
    setHome((h) => ({ rooms: h.rooms.filter((_, i) => i !== ri) }));
    setRi(Math.max(0, ri - 1));
    setSel(null);
  }, [home.rooms.length, room.name, ri, hist, setHome]);

  const setWall = useCallback(
    (wall: Wall) => {
      if (!selOpening) return;
      hist();
      setOpenings((l) =>
        l.map((x) => (x.id === selOpening.id ? clampOpening(roomRef.current, { ...x, wall }) : x))
      );
    },
    [selOpening, hist, setOpenings]
  );

  /* ---- issues, area ---- */
  const issues = useMemo(
    () => issueList(room, items, settings.walkwayCm),
    [room, items, settings.walkwayCm]
  );
  const flagged = useMemo(() => {
    const m: Record<number, "bad" | "note"> = {};
    issues.forEach((i) => i.ids.forEach((id) => { m[id] = m[id] === "bad" || i.bad ? "bad" : "note"; }));
    return m;
  }, [issues]);

  const total = floorArea(room);
  const taken = items.filter((i) => i.cat !== "soft").reduce((a, i) => a + i.w * i.d, 0);

  /* ---- autosave, debounced ---- */
  useEffect(() => {
    const t = setTimeout(() => saveDoc(doc), 400);
    setShareLabel("Share link");
    return () => clearTimeout(t);
  }, [doc]);

  /* ---- share, export, import ---- */
  /* The hash only goes into the address bar as a clipboard fallback — a lingering
     hash would resurrect this snapshot over newer autosaved edits on reload. */
  const share = useCallback(() => {
    const hash = `#p=${encodeDoc(docRef.current)}`;
    const url = location.origin + location.pathname + hash;
    const inBar = () => {
      try {
        history.replaceState(null, "", hash);
      } catch {
        /* ignore */
      }
      setShareLabel("Link in address bar");
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => setShareLabel("Link copied"), inBar);
    } else {
      inBar();
    }
  }, []);

  const exportFile = useCallback(() => {
    const blob = new Blob([JSON.stringify(docRef.current, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(home.name || "plan").replace(/\s+/g, "-").toLowerCase()}-plan.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, [home.name]);

  const importFile = useCallback(
    (file: File) => {
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const d = JSON.parse(String(rd.result));
          if (!isDoc(d)) throw new Error("bad shape");
          hist();
          setDocState(d);
          setHi(0);
          setRi(0);
          setSlotState("A");
          setSel(null);
          setSavedNote(`Imported ${file.name}`);
        } catch {
          setSavedNote("That file could not be read.");
        }
      };
      rd.readAsText(file);
    },
    [hist]
  );

  return {
    doc, home, room, items, slot, hi, ri, sel, selItem, selOpening, view, settings, issues, flagged,
    areaCm2: total, takenCm2: taken, savedNote, shareLabel,
    canUndo: past.length > 0, canRedo: future.length > 0,
    hist, undo, redo, setDoc, setHome, setRoom, setItems, setOpenings, setSel, setView, setSettings,
    move, rotate, del, addItem, addOpening, setSlot, copyToNext, emptySlot,
    pickHome, pickRoom, addHome, addRoom, deleteRoom, setWall,
    share, exportFile, importFile
  };
}

export interface Planner {
  doc: Doc;
  home: Home;
  room: Room;
  items: Item[];
  slot: SlotKey;
  hi: number;
  ri: number;
  sel: Sel;
  selItem: Item | null;
  selOpening: Opening | null;
  view: { zoom: number; panx: number; pany: number };
  settings: Settings;
  issues: ReturnType<typeof issueList>;
  flagged: Record<number, "bad" | "note">;
  areaCm2: number;
  takenCm2: number;
  savedNote: string;
  shareLabel: string;
  canUndo: boolean;
  canRedo: boolean;
  hist: () => void;
  undo: () => void;
  redo: () => void;
  setDoc: (fn: (d: Doc) => Doc) => void;
  setHome: (fn: (h: Home) => Partial<Home>) => void;
  setRoom: (fn: (r: Room) => Partial<Room>) => void;
  setItems: (fn: (list: Item[]) => Item[]) => void;
  setOpenings: (fn: (list: Opening[]) => Opening[]) => void;
  setSel: (s: Sel) => void;
  setView: React.Dispatch<React.SetStateAction<{ zoom: number; panx: number; pany: number }>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  move: (id: number, x: number, y: number, snap?: boolean) => void;
  rotate: () => void;
  del: () => void;
  addItem: (name: string, w: number, d: number, cat: Cat) => void;
  addOpening: (kind: Opening["kind"]) => void;
  setSlot: (s: SlotKey) => void;
  copyToNext: () => void;
  emptySlot: () => void;
  pickHome: (id: number) => void;
  pickRoom: (i: number) => void;
  addHome: () => void;
  addRoom: () => void;
  deleteRoom: () => void;
  setWall: (w: Wall) => void;
  share: () => void;
  exportFile: () => void;
  importFile: (f: File) => void;
}
