// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { usePlanner, type Planner } from "./usePlanner";

// StrictMode is on in main.tsx, so the tests run under it too — history must
// survive double-invoked renders and updaters.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let p: Planner;
function Probe() {
  p = usePlanner();
  return null;
}

let root: Root;
beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  root = createRoot(document.createElement("div"));
  act(() => root.render(<StrictMode><Probe /></StrictMode>));
});
afterEach(() => act(() => root.unmount()));

it("undo/redo walk the history exactly once each", () => {
  const before = p.items.length;
  act(() => p.addItem("Stool", 40, 40, "other"));
  expect(p.items.length).toBe(before + 1);

  act(() => p.undo());
  expect(p.items.length).toBe(before);
  expect(p.canRedo).toBe(true);

  act(() => p.redo());
  expect(p.items.length).toBe(before + 1);
  expect(p.canRedo).toBe(false);
});

it("edits still land after undoing a new home", () => {
  act(() => p.addHome());
  expect(p.doc.homes.length).toBe(2);

  act(() => p.undo());
  expect(p.doc.homes.length).toBe(1);

  act(() => p.setRoom(() => ({ name: "Painted" })));
  expect(p.doc.homes[0].rooms[0].name).toBe("Painted");
});

it("share copies the link without leaving a hash in the URL", async () => {
  const writes: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: (s: string) => (writes.push(s), Promise.resolve()) }
  });
  await act(async () => p.share());
  expect(writes[0]).toContain("#p=");
  expect(location.hash).toBe("");
});
