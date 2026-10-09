// TEMPORARY, frontend-only. Snapshots live in the browser's localStorage,
// not a database - this previews the "save a forecast, view it later"
// feature before the real forecast_snapshot table + GraphQL
// save/list/delete operations exist (see the 2026-10 "save snapshots of
// predictions" discussion). Includes the full history that was on screen
// at save time, not just an anchor point - a forecast isn't meaningful
// without the data it was built from. Still cheap (a few KB to a few
// hundred KB per snapshot depending on the window selected), but notably
// bigger than forecast-points-alone, worth knowing if many "All"-window
// snapshots pile up against localStorage's ~5-10MB per-origin limit.
// Swap this module for real server actions once that's built; the shape of
// ForecastSnapshot is deliberately close to what that table would store.

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
    // Guards against snapshots saved before `history` existed on this
    // type - without this they'd be missing the field entirely and crash
    // whatever tries to read snapshot.history.length.
    return parsed.map((s) => ({ ...s, history: s.history ?? [] }));
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
