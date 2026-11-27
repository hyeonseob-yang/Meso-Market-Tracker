import { describe, expect, it } from "vitest";

import { formatAmount, formatSigned, parseAmount100m } from "./tradeFormat";

describe("parseAmount100m", () => {
  it.each([
    ["1", 1],
    ["25", 25],
    ["1000", 1000],
  ])("parses %s into %i units of 100M", (input, units) => {
    expect(parseAmount100m(input)).toBe(units);
  });

  it.each(["", "0", "-1", "2.5", "abc"])("rejects %j", (input) => {
    expect(parseAmount100m(input)).toBeNull();
  });
});

describe("formatAmount", () => {
  it.each([
    [1, "1 × 100M"],
    [25, "25 × 100M"],
    [1000, "1,000 × 100M"],
  ])("formats %i units as %s", (units, text) => {
    expect(formatAmount(units)).toBe(text);
  });
});

describe("formatSigned", () => {
  it.each([
    [544, "+544"],
    [-530, "−530"],
    [0, "0"],
    [1250, "+1,250"],
  ])("formats %i as %s", (value, text) => {
    expect(formatSigned(value)).toBe(text);
  });
});
