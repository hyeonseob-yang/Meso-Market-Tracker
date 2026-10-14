"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";

import { fetchPrices } from "../actions";
import { deleteForecastSnapshot, listForecastSnapshots, type ForecastSnapshotSummary } from "../forecastActions";
import type { PriceRow } from "./chartConfig";
import SnapshotChart from "./snapshotChart";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

// createdAt approximates the last history timestamp, within an hour.
function horizonLabel(snapshot: ForecastSnapshotSummary): string {
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
function eagerPriceFetchRange(snapshots: ForecastSnapshotSummary[]): { since: string; until: string } | null {
  if (snapshots.length === 0) return null;
  const since = new Date(Math.min(...snapshots.map(historyFetchStart))).toISOString();
  return { since, until: new Date().toISOString() };
}

// Mirrors get_recent_training_prices(before=createdAt, limit=historyCount).
function historyForSnapshot(snapshot: ForecastSnapshotSummary, allPrices: PriceRow[] | null): PriceRow[] {
  if (allPrices === null) return [];
  const cutoff = new Date(snapshot.points[0]?.datetime ?? snapshot.createdAt).getTime();
  const before = allPrices.filter((p) => new Date(p.datetime).getTime() < cutoff);
  return before.slice(-snapshot.historyCount);
}

function actualForSnapshot(snapshot: ForecastSnapshotSummary, allPrices: PriceRow[] | null): PriceRow[] | null {
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

export default function PredictionsList({ initialSnapshots }: { initialSnapshots: ForecastSnapshotSummary[] }) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [allPrices, setAllPrices] = useState<PriceRow[] | null>(null);
  // Guards against re-fetching on every expand.
  const pricesFetchStarted = useRef(false);

  function ensurePricesFetched() {
    if (pricesFetchStarted.current) return;
    pricesFetchStarted.current = true;

    const range = eagerPriceFetchRange(snapshots);
    if (!range) {
      setAllPrices([]);
      return;
    }
    fetchPrices(range.since, range.until).then(setAllPrices);
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    const ok = await deleteForecastSnapshot(id);
    setDeletingId(null);
    if (ok) {
      setSnapshots(await listForecastSnapshots());
      if (expandedId === id) setExpandedId(null);
    }
  }

  function handleToggleExpand(snapshot: ForecastSnapshotSummary) {
    const wasExpanded = expandedId === snapshot.id;
    setExpandedId(wasExpanded ? null : snapshot.id);
    if (!wasExpanded) ensurePricesFetched();
  }

  if (snapshots.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-medium text-gray-900">Saved Predictions</h2>
        <p className="mt-2 text-gray-600">No saved predictions yet.</p>
        <p className="mt-1 text-sm text-gray-500">
          Go to the Chart tab, turn on &quot;Show Forecast&quot;, and click &quot;Save Snapshot&quot;.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-gray-900">Saved Predictions</h2>
      <div className="space-y-3">
        {snapshots.map((snapshot) => {
          const first = snapshot.points[0];
          const last = snapshot.points[snapshot.points.length - 1];
          const isExpanded = expandedId === snapshot.id;

          return (
            <div key={snapshot.id} className="rounded border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {format(new Date(snapshot.createdAt), "MMM d, yyyy HH:mm")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {horizonLabel(snapshot)} · {snapshot.historyCount} history points ·{" "}
                    {snapshot.points.length} forecast points
                    {first && last && (
                      <> · predicted {Math.round(first.predicted)} → {Math.round(last.predicted)}</>
                    )}{" "}
                    · model: {snapshot.model}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(snapshot)}
                    className="rounded px-3 py-1 text-sm font-medium bg-white text-gray-700 hover:bg-gray-200"
                  >
                    {isExpanded ? "Hide" : "View"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(snapshot.id)}
                    disabled={deletingId === snapshot.id}
                    className="rounded px-3 py-1 text-sm font-medium bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === snapshot.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-4">
                  <SnapshotChart
                    snapshot={{ ...snapshot, history: historyForSnapshot(snapshot, allPrices) }}
                    actual={actualForSnapshot(snapshot, allPrices)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
