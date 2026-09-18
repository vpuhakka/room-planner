export type Cat = "sleep" | "storage" | "work" | "soft" | "other";
export type Wall = "n" | "e" | "s" | "w";
export type SlotKey = "A" | "B" | "C";
export type CornerKey = "nw" | "ne" | "se" | "sw";

export interface CatalogItem {
  id: string;
  name: string;
  w: number;
  d: number;
  cat: Cat;
}

export interface Item {
  id: number;
  name: string;
  w: number;
  d: number;
  /** centre, cm from the room's top-left */
  x: number;
  y: number;
  r: 0 | 90 | 180 | 270;
  cat: Cat;
}

export interface Opening {
  id: number;
  kind: "Door" | "Window";
  wall: Wall;
  /** cm along the wall from its start */
  pos: number;
  len: number;
  flip?: boolean;
}

export interface Room {
  id: number;
  name: string;
  w: number;
  d: number;
  cuts: Partial<Record<CornerKey, { w: number; d: number }>>;
  nextId: number;
  nextOid: number;
  slots: Record<SlotKey, Item[]>;
  /** physical, so shared by all three slots */
  openings: Opening[];
}

export interface Home {
  id: number;
  name: string;
  rooms: Room[];
}

export interface Doc {
  nextHome: number;
  nextRoom: number;
  catalog: CatalogItem[];
  homes: Home[];
}

export type Units = "metric" | "imperial";

export interface Settings {
  showGrid: boolean;
  gridCm: number;
  showDims: boolean;
  typeFills: boolean;
  walkwayCm: number;
  units: Units;
}

export type Sel = { t: "item" | "opening"; id: number } | null;

export interface Issue {
  bad: boolean;
  ids: number[];
  text: string;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
