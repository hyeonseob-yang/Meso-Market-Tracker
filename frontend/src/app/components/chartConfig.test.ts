import { describe, expect, it } from "vitest";

import { buildChartData, computeAccuracy, type ForecastPoint, type PriceRow } from "./chartConfig";

const POINTS: ForecastPoint[] = [
  { datetime: "2026-10-13T00:00:00Z", predicted: 100, lower: 90, upper: 110 },
  { datetime: "2026-10-13T01:00:00Z", predicted: 102, lower: 92, upper: 112 },
  { datetime: "2026-10-13T02:00:00Z", predicted: 104, lower: 94, upper: 114 },
];

describe("computeAccuracy", () => {
  it("returns zero when there's no actual data yet", () => {
    expect(computeAccuracy(POINTS, [])).toEqual({ n: 0, mae: 0, mape: 0 });
  });

  it("averages error over matched points", () => {
    const actual: PriceRow[] = [
      { datetime: "2026-10-13T00:00:00Z", average: 105 }, // |105-100| = 5
      { datetime: "2026-10-13T01:00:00Z", average: 112 }, // |112-102| = 10
    ];

    const result = computeAccuracy(POINTS, actual);

    expect(result.n).toBe(2);
    expect(result.mae).toBeCloseTo((5 + 10) / 2);
  });

  it("excludes actual readings too far from any predicted point", () => {
    const actual: PriceRow[] = [
      { datetime: "2026-10-13T00:00:00Z", average: 105 }, // matches, within 30 min
      { datetime: "2026-10-14T00:00:00Z", average: 999 }, // a full day away - no match
    ];

    const result = computeAccuracy(POINTS, actual);

    expect(result.n).toBe(1);
    expect(result.mae).toBeCloseTo(5);
  });
});

describe("buildChartData", () => {
  it("omits the Actual dataset when there's nothing to compare yet", () => {
    const data = buildChartData([], POINTS, []);
    expect(data.datasets.some((d) => d.label === "Actual")).toBe(false);
  });

  it("includes an Actual dataset when actual data is provided", () => {
    const actual: PriceRow[] = [{ datetime: "2026-10-13T00:00:00Z", average: 105 }];
    const data = buildChartData([], POINTS, actual);
    expect(data.datasets.some((d) => d.label === "Actual")).toBe(true);
  });
});
