// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import NumField from "./NumField";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(value: number, onCommit: (v: number) => void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() => createRoot(host).render(<NumField value={value} min={150} max={2000} onCommit={onCommit} />));
  return host.querySelector("input")!;
}

const blur = (el: HTMLInputElement, typed: string) => {
  act(() => {
    el.value = typed;
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
};

it("lets a value below the minimum be typed, committing it whole on blur", () => {
  const got: number[] = [];
  const el = mount(310, (v) => got.push(v));
  blur(el, "180"); // typing "1", "18" must not be clamped away mid-edit
  expect(got).toEqual([180]);
});

it("clamps only the final value", () => {
  const got: number[] = [];
  const el = mount(310, (v) => got.push(v));
  blur(el, "12");
  expect(got).toEqual([150]);
});

it("does not commit an unchanged value", () => {
  const got: number[] = [];
  const el = mount(310, (v) => got.push(v));
  blur(el, "310");
  expect(got).toEqual([]);
});
