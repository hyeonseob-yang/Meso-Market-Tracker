"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";

import { fetchPrices } from "../actions";
import { deleteForecastSnapshot, listForecastSnapshots, type ForecastSnapshotSummary } from "../forecastActions";
import type { PriceRow } from "./chartConfig";
import SnapshotChart from "./snapshotChart";
import {
  actualForSnapshot,
  eagerPriceFetchRange,
  historyForSnapshot,
  horizonLabel,
} from "./snapshotPriceDerivation";

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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
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
