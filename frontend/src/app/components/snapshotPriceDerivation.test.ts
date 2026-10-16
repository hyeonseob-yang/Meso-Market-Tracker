import { describe, expect, it } from "vitest";

import type { ForecastSnapshotSummary } from "../forecastActions";
import type { PriceRow } from "./chartConfig";
import {
  actualForSnapshot,
  eagerPriceFetchRange,
  historyForSnapshot,
  horizonLabel,
} from "./snapshotPriceDerivation";

function snapshot(overrides: Partial<ForecastSnapshotSummary> = {}): ForecastSnapshotSummary {
  return {
    id: 1,
    createdAt: "2026-10-13T00:00:00Z",
    model: "AutoETS",
    modelParams: null,
    historyCount: 3,
    points: [
      { datetime: "2026-10-13T00:00:00Z", predicted: 100, lower: 90, upper: 110 },
      { datetime: "2026-10-15T00:00:00Z", predicted: 104, lower: 94, upper: 114 },
    ],
    ...overrides,
  };
}

describe("horizonLabel", () => {
  it("rounds to whole days for multi-day horizons", () => {
    expect(horizonLabel(snapshot())).toBe("2-day horizon");
  });

  it("returns an empty string when there are no forecast points", () => {
    expect(horizonLabel(snapshot({ points: [] }))).toBe("");
  });
});

describe("eagerPriceFetchRange", () => {
  it("returns null for an empty snapshot list", () => {
    expect(eagerPriceFetchRange([])).toBeNull();
  });

  it("picks the earliest history start across all snapshots", () => {
    const older = snapshot({ createdAt: "2026-10-01T00:00:00Z", historyCount: 10 });
    const newer = snapshot({ createdAt: "2026-10-13T00:00:00Z", historyCount: 10 });

    const range = eagerPriceFetchRange([newer, older]);

    // historyCount hours, padded by the module's 2x safety factor, back from older's createdAt.
    const expectedSince = new Date("2026-10-01T00:00:00Z").getTime() - 10 * 2 * 60 * 60 * 1000;
    expect(new Date(range!.since).getTime()).toBe(expectedSince);
  });
});

describe("historyForSnapshot", () => {
  const hourly: PriceRow[] = Array.from({ length: 5 }, (_, i) => ({
    datetime: new Date(Date.UTC(2026, 9, 12, i)).toISOString(),
    average: 100 + i,
  }));

  it("returns an empty array when prices haven't loaded yet", () => {
    expect(historyForSnapshot(snapshot(), null)).toEqual([]);
  });

  it("takes the last historyCount rows before the forecast's start", () => {
    const s = snapshot({
      historyCount: 2,
      points: [{ datetime: new Date(Date.UTC(2026, 9, 12, 4)).toISOString(), predicted: 1, lower: 0, upper: 2 }],
    });

    const result = historyForSnapshot(s, hourly);

    expect(result.map((p) => p.average)).toEqual([102, 103]);
  });

  it("falls back to createdAt as the cutoff when there are no forecast points", () => {
    const s = snapshot({ historyCount: 2, createdAt: new Date(Date.UTC(2026, 9, 12, 4)).toISOString(), points: [] });

    const result = historyForSnapshot(s, hourly);

    expect(result.map((p) => p.average)).toEqual([102, 103]);
  });
});

describe("actualForSnapshot", () => {
  it("returns null when prices haven't loaded yet", () => {
    expect(actualForSnapshot(snapshot(), null)).toBeNull();
  });

  it("returns an empty array when there are no forecast points", () => {
    expect(actualForSnapshot(snapshot({ points: [] }), [])).toEqual([]);
  });

  it("includes only prices within the forecast's own range, inclusive", () => {
    const s = snapshot({
      points: [
        { datetime: "2026-10-13T00:00:00Z", predicted: 1, lower: 0, upper: 2 },
        { datetime: "2026-10-13T02:00:00Z", predicted: 1, lower: 0, upper: 2 },
      ],
    });
    const prices: PriceRow[] = [
      { datetime: "2026-10-12T23:00:00Z", average: 1 }, // before - excluded
      { datetime: "2026-10-13T00:00:00Z", average: 2 }, // at start - included
      { datetime: "2026-10-13T01:00:00Z", average: 3 }, // inside - included
      { datetime: "2026-10-13T02:00:00Z", average: 4 }, // at end - included
      { datetime: "2026-10-13T03:00:00Z", average: 5 }, // after - excluded
    ];

    const result = actualForSnapshot(s, prices);

    expect(result?.map((p) => p.average)).toEqual([2, 3, 4]);
  });
});
