import { describe, expect, it } from "vitest";

import { formatAmount, formatSigned, parseAmountInBillions } from "./tradeFormat";

describe("parseAmountInBillions", () => {
  it.each([
    ["2.5", 25],
    ["0.1", 1],
    ["10", 100],
    ["0.3", 3],
  ])("parses %s billion into %i units of 100M", (input, units) => {
    expect(parseAmountInBillions(input)).toBe(units);
  });

  it.each(["", "0", "-1", "0.05", "2.55", "abc"])("rejects %j", (input) => {
    expect(parseAmountInBillions(input)).toBeNull();
  });
});

describe("formatAmount", () => {
  it.each([
    [1, "100M"],
    [5, "500M"],
    [10, "1B"],
    [25, "2.5B"],
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
