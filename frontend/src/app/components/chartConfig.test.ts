import { describe, expect, it } from "vitest";

import {
  buildChartData,
  buildChartOptions,
  computeAccuracy,
  computeSpanDays,
  type ForecastPoint,
  type PriceRow,
} from "./chartConfig";

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

  it("excludes readings with a null average (empty rolling trade window) rather than treating it as 0", () => {
    const actual: PriceRow[] = [
      { datetime: "2026-10-13T00:00:00Z", average: null },
      { datetime: "2026-10-13T01:00:00Z", average: 112 }, // |112-102| = 10
    ];

    const result = computeAccuracy(POINTS, actual);

    expect(result.n).toBe(1);
    expect(result.mae).toBeCloseTo(10);
  });
});

describe("axis end", () => {
  const LAST_READING = "2026-11-11T12:00:00Z";
  const SIX_DAYS_LATER = Date.parse("2026-11-17T12:00:00Z");
  const OUTAGE_DAYS = 6;

  it("extends the x-axis to the given time even when data stops earlier", () => {
    expect(buildChartOptions(OUTAGE_DAYS, SIX_DAYS_LATER).scales.x.suggestedMax).toBe(SIX_DAYS_LATER);
  });

  it("counts the time from the newest data to the axis end in the span", () => {
    const history: PriceRow[] = [
      { datetime: "2026-11-11T11:00:00Z", average: 400 },
      { datetime: LAST_READING, average: 401 },
    ];
    expect(computeSpanDays(SIX_DAYS_LATER, history)).toBeCloseTo(OUTAGE_DAYS + 1 / 24);
  });

  it("has no span when there is no data", () => {
    expect(computeSpanDays(SIX_DAYS_LATER, [])).toBe(0);
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
