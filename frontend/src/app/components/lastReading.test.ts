import { describe, expect, it } from "vitest";

import { isReadingStale, STALE_AFTER_MINUTES } from "./lastReading";

const MS_PER_MINUTE = 60 * 1000;
const READING = "2026-11-21T12:01:00Z";
const READING_MS = Date.parse(READING);

describe("isReadingStale", () => {
  it("is fresh just before the stale threshold", () => {
    expect(isReadingStale(READING, READING_MS + (STALE_AFTER_MINUTES - 1) * MS_PER_MINUTE)).toBe(false);
  });

  it("is stale at the threshold (one missed hourly post)", () => {
    expect(isReadingStale(READING, READING_MS + STALE_AFTER_MINUTES * MS_PER_MINUTE)).toBe(true);
  });
});
