import type { Units } from "./types";

/** All numbers in the app are centimetres; imperial exists only in formatting and parsing. */

const IN = 2.54;
const FRAC = ["", "¼", "½", "¾"];

function fmtImperial(cm: number): string {
  const q = Math.round((cm / IN) * 4); // quarter inches
  const ft = Math.floor(q / 48);
  const whole = Math.floor((q % 48) / 4);
  const frac = FRAC[q % 4];
  const inches = whole || frac ? `${whole || ""}${frac}″` : "";
  return `${ft ? `${ft}′` : ""}${inches}` || "0″";
}

export const fmtLen = (cm: number, u: Units) =>
  u === "imperial" ? fmtImperial(cm) : `${Math.round(cm)} cm`;

/** Like fmtLen but without the metric suffix, for "200 × 180" style pairs. */
export const fmtNum = (cm: number, u: Units) =>
  u === "imperial" ? fmtImperial(cm) : String(Math.round(cm));

export const fmtArea = (cm2: number, u: Units) =>
  u === "imperial" ? `${Math.round(cm2 / (IN * IN * 144))} ft²` : `${(cm2 / 10000).toFixed(1)} m²`;

/** Accepts 6'4", 6′4″, 6.5', 76 (bare inches) — or plain centimetres in metric. Null if unreadable. */
export function parseLen(s: string, u: Units): number | null {
  if (u !== "imperial") return +s || null;
  const m = /^\s*(?:(\d+(?:\.\d+)?)\s*(?:'|′|ft\b))?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|″|in\b)?)?\s*$/.exec(s);
  if (!m || (!m[1] && !m[2])) return null;
  return (+(m[1] || 0) * 12 + +(m[2] || 0)) * IN;
}

export const stepCm = (u: Units) => (u === "imperial" ? 2 * IN : 5); // drag/arrow grid
export const fineStepCm = (u: Units) => (u === "imperial" ? IN / 2 : 1); // Shift-nudge

export const unitLabel = (u: Units) => (u === "imperial" ? "ft/in" : "cm");
