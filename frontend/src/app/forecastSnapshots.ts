// TEMPORARY: localStorage-backed, not the real forecast_snapshot table.
// Swap for real server actions once that exists.

import type { ForecastPoint } from "./dummyForecast";
import type { PriceRow } from "./components/chartConfig";

export type ForecastSnapshot = {
  id: string;
  createdAt: string;
  horizonDays: number;
  history: PriceRow[];
  points: ForecastPoint[];
};

const STORAGE_KEY = "meso-forecast-snapshots";

function readAll(): ForecastSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ForecastSnapshot[]) : [];
    return parsed.map((s) => ({ ...s, history: s.history ?? [] })); // pre-`history` snapshots
  } catch {
    return [];
  }
}

function writeAll(snapshots: ForecastSnapshot[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // Storage full or unavailable (private browsing, etc.) - this is a
    // preview feature, fail silently rather than breaking the page.
  }
}

export function listSnapshots(): ForecastSnapshot[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveSnapshot(
  horizonDays: number,
  history: PriceRow[],
  points: ForecastPoint[],
): ForecastSnapshot {
  const snapshot: ForecastSnapshot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    horizonDays,
    history,
    points,
  };
  writeAll([snapshot, ...readAll()]);
  return snapshot;
}

export function deleteSnapshot(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}
