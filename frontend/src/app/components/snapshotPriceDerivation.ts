import type { ForecastSnapshotSummary } from "../forecastActions";
import type { PriceRow } from "./chartConfig";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

// createdAt approximates the last history timestamp, within an hour.
export function horizonLabel(snapshot: ForecastSnapshotSummary): string {
  const end = snapshot.points[snapshot.points.length - 1];
  if (!end) return "";
  const days = (new Date(end.datetime).getTime() - new Date(snapshot.createdAt).getTime()) / MS_PER_DAY;
  return `${days < 1 ? days.toFixed(1) : Math.round(days)}-day horizon`;
}

// historyCount rows can span more than historyCount hours (collection gaps).
const HISTORY_FETCH_SAFETY_FACTOR = 2;

function historyFetchStart(snapshot: ForecastSnapshotSummary): number {
  return new Date(snapshot.createdAt).getTime() - snapshot.historyCount * MS_PER_HOUR * HISTORY_FETCH_SAFETY_FACTOR;
}

// One fetch spanning the earliest snapshot's start through now covers all of them.
export function eagerPriceFetchRange(snapshots: ForecastSnapshotSummary[]): { since: string; until: string } | null {
  if (snapshots.length === 0) return null;
  const since = new Date(Math.min(...snapshots.map(historyFetchStart))).toISOString();
  return { since, until: new Date().toISOString() };
}

// Mirrors get_recent_training_prices(before=createdAt, limit=historyCount).
export function historyForSnapshot(snapshot: ForecastSnapshotSummary, allPrices: PriceRow[] | null): PriceRow[] {
  if (allPrices === null) return [];
  const cutoff = new Date(snapshot.points[0]?.datetime ?? snapshot.createdAt).getTime();
  const before = allPrices.filter((p) => new Date(p.datetime).getTime() < cutoff);
  return before.slice(-snapshot.historyCount);
}

export function actualForSnapshot(snapshot: ForecastSnapshotSummary, allPrices: PriceRow[] | null): PriceRow[] | null {
  if (allPrices === null) return null;
  const first = snapshot.points[0];
  const last = snapshot.points[snapshot.points.length - 1];
  if (!first || !last) return [];
  const start = new Date(first.datetime).getTime();
  const end = new Date(last.datetime).getTime();
  return allPrices.filter((p) => {
    const t = new Date(p.datetime).getTime();
    return t >= start && t <= end;
  });
}
