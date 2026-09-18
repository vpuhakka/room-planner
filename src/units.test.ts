import { describe, expect, it } from "vitest";
import { fmtArea, fmtLen, fmtNum, parseLen, stepCm, fineStepCm } from "./units";

describe("fmtLen imperial", () => {
  it("formats feet and inches", () => expect(fmtLen(193.04, "imperial")).toBe("6′4″"));
  it("drops zero inches", () => expect(fmtLen(30.48, "imperial")).toBe("1′"));
  it("drops zero feet", () => expect(fmtLen(22.86, "imperial")).toBe("9″"));
  it("rounds to the nearest quarter inch", () => expect(fmtLen(45, "imperial")).toBe("1′5¾″"));
  it("shows a bare fraction", () => expect(fmtLen(1.27, "imperial")).toBe("½″"));
  it("handles zero", () => expect(fmtLen(0, "imperial")).toBe("0″"));
});

describe("fmtLen metric", () => {
  it("rounds and suffixes cm", () => expect(fmtLen(45.72, "metric")).toBe("46 cm"));
});

describe("fmtNum", () => {
  it("is a bare number in metric", () => expect(fmtNum(310, "metric")).toBe("310"));
  it("keeps the marks in imperial", () => expect(fmtNum(193.04, "imperial")).toBe("6′4″"));
});

describe("parseLen imperial", () => {
  it("parses feet and inches", () => expect(parseLen(`6'4"`, "imperial")).toBeCloseTo(193.04));
  it("parses unicode marks", () => expect(parseLen("6′4″", "imperial")).toBeCloseTo(193.04));
  it("treats a bare number as inches", () => expect(parseLen("76", "imperial")).toBeCloseTo(193.04));
  it("parses decimal feet", () => expect(parseLen("6.5'", "imperial")).toBeCloseTo(198.12));
  it("parses feet alone", () => expect(parseLen("6'", "imperial")).toBeCloseTo(182.88));
  it("rejects garbage", () => expect(parseLen("abc", "imperial")).toBeNull());
  it("rejects empty", () => expect(parseLen("", "imperial")).toBeNull());
});

describe("parseLen metric", () => {
  it("parses centimetres", () => expect(parseLen("310", "metric")).toBe(310));
  it("rejects empty", () => expect(parseLen("", "metric")).toBeNull());
});

describe("fmtArea", () => {
  it("metric m²", () => expect(fmtArea(112000, "metric")).toBe("11.2 m²"));
  it("imperial ft²", () => expect(fmtArea(112000, "imperial")).toBe("121 ft²"));
});

describe("steps", () => {
  it("snaps 5 cm or 2 inches", () => {
    expect(stepCm("metric")).toBe(5);
    expect(stepCm("imperial")).toBeCloseTo(5.08);
  });
  it("nudges 1 cm or half an inch", () => {
    expect(fineStepCm("metric")).toBe(1);
    expect(fineStepCm("imperial")).toBeCloseTo(1.27);
  });
});
