"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

import { fetchPrices } from "../actions";
import { deleteForecastSnapshot, listForecastSnapshots, type ForecastSnapshot } from "../forecastActions";
import type { PriceRow } from "./chartConfig";
import SnapshotChart from "./snapshotChart";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function horizonLabel(snapshot: ForecastSnapshot): string {
  const anchor = snapshot.history[snapshot.history.length - 1];
  const end = snapshot.points[snapshot.points.length - 1];
  if (!anchor || !end) return "";
  const days = (new Date(end.datetime).getTime() - new Date(anchor.datetime).getTime()) / MS_PER_DAY;
  return `${days < 1 ? days.toFixed(1) : Math.round(days)}-day horizon`;
}

// Snapshots' forecast windows overlap heavily, so one fetch spanning all of
// them beats fetching per snapshot.
function unionForecastRange(snapshots: ForecastSnapshot[]): { since: string; until: string } | null {
  const ends = snapshots.flatMap((s) => [s.points[0]?.datetime, s.points[s.points.length - 1]?.datetime]).filter(
    (d): d is string => Boolean(d),
  );
  if (ends.length === 0) return null;
  const since = ends.reduce((a, b) => (new Date(a) < new Date(b) ? a : b));
  const until = ends.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
  return { since, until };
}

function actualForSnapshot(snapshot: ForecastSnapshot, allActual: PriceRow[] | null): PriceRow[] | null {
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

export default function PredictionsList({ initialSnapshots }: { initialSnapshots: ForecastSnapshot[] }) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [allActual, setAllActual] = useState<PriceRow[] | null>(null);

  useEffect(() => {
    const range = unionForecastRange(snapshots);
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
                    {horizonLabel(snapshot)} · {snapshot.history.length} history points ·{" "}
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
                    onClick={() => setExpandedId(isExpanded ? null : snapshot.id)}
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
                  <SnapshotChart snapshot={snapshot} actual={actualForSnapshot(snapshot, allActual)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
