import type React from "react";
import { clamp } from "../geometry";
import { fmtNum, parseLen } from "../units";
import type { Units } from "../types";

/** Uncontrolled measure input holding centimetres, shown and parsed in the user's units
 *  (plain cm, or feet-and-inches like 6′4″). Commits one clamped value on blur or Enter,
 *  so low values can be typed digit by digit and each edit is one undo step.
 *  The key remounts it whenever the committed value or the units change from outside. */
export default function NumField({
  value,
  min,
  max = Infinity,
  onCommit,
  units = "metric",
  ...rest
}: { value: number; min: number; max?: number; onCommit: (v: number) => void; units?: Units } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "min" | "max" | "defaultValue" | "onBlur" | "type"
>) {
  const show = (v: number) => (v ? fmtNum(v, units) : "");
  const commit = (e: React.FocusEvent<HTMLInputElement>) => {
    const v = clamp(parseLen(e.target.value, units) ?? min, min, max);
    e.target.value = show(v);
    // compare displays, not raw cm — quarter-inch rounding must not cause phantom commits
    if (show(v) !== show(value)) onCommit(v);
  };
  return (
    <input
      className="field field--num"
      {...rest}
      key={`${units}:${value}`}
      type={units === "imperial" ? "text" : "number"}
      defaultValue={show(value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}
