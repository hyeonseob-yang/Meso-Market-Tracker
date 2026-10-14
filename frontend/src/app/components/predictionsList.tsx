"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

import { fetchPrices } from "../actions";
import {
  deleteForecastSnapshot,
  fetchForecastSnapshotHistory,
  listForecastSnapshots,
  type ForecastSnapshotSummary,
} from "../forecastActions";
import type { PriceRow } from "./chartConfig";
import SnapshotChart from "./snapshotChart";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// `createdAt` stands in for the exact last-history timestamp (the two are
// within an hour of each other) - avoids fetching the full history array
// just to label a collapsed row.
function horizonLabel(snapshot: ForecastSnapshotSummary): string {
  const end = snapshot.points[snapshot.points.length - 1];
  if (!end) return "";
  const days = (new Date(end.datetime).getTime() - new Date(snapshot.createdAt).getTime()) / MS_PER_DAY;
  return `${days < 1 ? days.toFixed(1) : Math.round(days)}-day horizon`;
}

// Snapshots' forecast windows overlap heavily, so one fetch from the oldest
// snapshot's forecast start through now covers all of them. Snapshots come
// back newest-first (ORDER BY created_at DESC), so the oldest is the last
// element.
function actualFetchRange(snapshots: ForecastSnapshotSummary[]): { since: string; until: string } | null {
  const since = snapshots[snapshots.length - 1]?.points[0]?.datetime;
  return since ? { since, until: new Date().toISOString() } : null;
}

function actualForSnapshot(snapshot: ForecastSnapshotSummary, allActual: PriceRow[] | null): PriceRow[] | null {
  if (allActual === null) return null;
  const first = snapshot.points[0];
  const last = snapshot.points[snapshot.points.length - 1];
  if (!first || !last) return [];
  const start = new Date(first.datetime).getTime();
  const end = new Date(last.datetime).getTime();
  return allActual.filter((p) => {
    const t = new Date(p.datetime).getTime();
    return t >= start && t <= end;
  });
}

export default function PredictionsList({ initialSnapshots }: { initialSnapshots: ForecastSnapshotSummary[] }) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [allActual, setAllActual] = useState<PriceRow[] | null>(null);
  // Keyed by snapshot id - fetched only once a snapshot is actually expanded.
  const [historyById, setHistoryById] = useState<Record<number, PriceRow[]>>({});

  useEffect(() => {
    const range = actualFetchRange(snapshots);
    if (!range) {
      setAllActual([]);
      return;
    }
    let cancelled = false;
    fetchPrices(range.since, range.until).then((result) => {
      if (!cancelled) setAllActual(result);
    });
    return () => {
      cancelled = true;
    };
  }, [snapshots]);

  async function handleDelete(id: number) {
    setDeletingId(id);
    const ok = await deleteForecastSnapshot(id);
    setDeletingId(null);
    if (ok) {
      setSnapshots(await listForecastSnapshots());
      if (expandedId === id) setExpandedId(null);
    }
  }

  async function handleToggleExpand(snapshot: ForecastSnapshotSummary) {
    const wasExpanded = expandedId === snapshot.id;
    setExpandedId(wasExpanded ? null : snapshot.id);
    if (wasExpanded || snapshot.id in historyById) return;

    const history = await fetchForecastSnapshotHistory(snapshot.id);
    if (history) setHistoryById((prev) => ({ ...prev, [snapshot.id]: history }));
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
                  {historyById[snapshot.id] ? (
                    <SnapshotChart
                      snapshot={{ ...snapshot, history: historyById[snapshot.id] }}
                      actual={actualForSnapshot(snapshot, allActual)}
                    />
                  ) : (
                    <p className="text-xs text-gray-500">Loading…</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
