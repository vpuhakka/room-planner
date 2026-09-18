// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import NumField from "./NumField";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(value: number, onCommit: (v: number) => void, units?: "metric" | "imperial") {
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() =>
    createRoot(host).render(<NumField value={value} min={150} max={2000} units={units} onCommit={onCommit} />)
  );
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

it("shows and parses feet-and-inches in imperial", () => {
  const got: number[] = [];
  const el = mount(193.04, (v) => got.push(v), "imperial");
  expect(el.value).toBe("6′4″");
  blur(el, "7'");
  expect(got).toHaveLength(1);
  expect(got[0]).toBeCloseTo(213.36);
});

it("reformats without committing when the imperial value is unchanged", () => {
  const got: number[] = [];
  const el = mount(193.04, (v) => got.push(v), "imperial");
  blur(el, `6'4"`);
  expect(got).toEqual([]);
  expect(el.value).toBe("6′4″");
});
