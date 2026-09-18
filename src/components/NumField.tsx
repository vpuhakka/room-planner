import type React from "react";
import { clamp } from "../geometry";

/** Uncontrolled number input that commits one clamped value on blur or Enter,
 *  so low values can be typed digit by digit and each edit is one undo step.
 *  The key remounts it whenever the committed value changes from outside (undo, import). */
export default function NumField({
  value,
  min,
  max = Infinity,
  onCommit,
  ...rest
}: { value: number; min: number; max?: number; onCommit: (v: number) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "min" | "max" | "defaultValue" | "onBlur" | "type"
>) {
  const commit = (e: React.FocusEvent<HTMLInputElement>) => {
    const v = clamp(+e.target.value || min, min, max);
    e.target.value = v ? String(v) : "";
    if (v !== value) onCommit(v);
  };
  return (
    <input
      className="field field--num"
      {...rest}
      key={value}
      type="number"
      defaultValue={value || ""}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}
