// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY, decodeDoc, defaultDoc, encodeDoc, isDoc, loadDoc } from "./doc";

describe("isDoc", () => {
  it("accepts the default document", () => expect(isDoc(defaultDoc())).toBe(true));

  it("survives an encode/decode round trip", () => {
    expect(decodeDoc(encodeDoc(defaultDoc()))).toEqual(defaultDoc());
  });

  it("rejects a room without cuts", () => {
    const d = defaultDoc();
    delete (d.homes[0].rooms[0] as Partial<(typeof d.homes)[0]["rooms"][0]>).cuts;
    expect(isDoc(d)).toBe(false);
  });

  it("rejects a room without id counters", () => {
    const d = defaultDoc();
    delete (d.homes[0].rooms[0] as Partial<(typeof d.homes)[0]["rooms"][0]>).nextId;
    expect(isDoc(d)).toBe(false);
  });

  it("rejects an empty object posing as an item", () => {
    const d = defaultDoc();
    d.homes[0].rooms[0].slots.A = [{} as (typeof d.homes)[0]["rooms"][0]["slots"]["A"][0]];
    expect(isDoc(d)).toBe(false);
  });

  it("rejects an opening without a length", () => {
    const d = defaultDoc();
    delete (d.homes[0].rooms[0].openings[0] as Partial<(typeof d.homes)[0]["rooms"][0]["openings"][0]>).len;
    expect(isDoc(d)).toBe(false);
  });

  it("rejects a home with no rooms", () => {
    const d = defaultDoc();
    d.homes[0].rooms = [];
    expect(isDoc(d)).toBe(false);
  });
});

describe("loadDoc", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/");
  });

  const named = (name: string) => {
    const d = defaultDoc();
    d.homes[0].name = name;
    return d;
  };

  it("opens a share-link hash and consumes it", () => {
    location.hash = `#p=${encodeDoc(named("Shared"))}`;
    expect(loadDoc().doc.homes[0].name).toBe("Shared");
    expect(location.hash).toBe("");
  });

  it("falls back to the autosaved doc once the hash is consumed", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(named("Mine")));
    location.hash = `#p=${encodeDoc(named("Shared"))}`;
    expect(loadDoc().doc.homes[0].name).toBe("Shared");
    expect(loadDoc().doc.homes[0].name).toBe("Mine");
  });

  it("backs up the stored plan before a shared one replaces it", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(named("Mine")));
    location.hash = `#p=${encodeDoc(named("Shared"))}`;
    loadDoc();
    const backup = localStorage.getItem(`${STORAGE_KEY}-backup`);
    expect(JSON.parse(backup!).homes[0].name).toBe("Mine");
  });
});
