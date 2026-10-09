"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

import SnapshotChart from "../components/snapshotChart";
import { deleteSnapshot, listSnapshots, type ForecastSnapshot } from "../forecastSnapshots";

export default function PredictionsPage() {
  // Snapshots live in localStorage, which doesn't exist during server
  // rendering - start empty and load after mount to avoid a hydration
  // mismatch, rather than reading it directly in the render body.
  const [snapshots, setSnapshots] = useState<ForecastSnapshot[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setSnapshots(listSnapshots());
  }, []);

  function handleDelete(id: string) {
    deleteSnapshot(id);
    setSnapshots(listSnapshots());
    if (expandedId === id) setExpandedId(null);
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
                    {snapshot.horizonDays}-day horizon · {snapshot.history.length} history points ·{" "}
                    {snapshot.points.length} forecast points
                    {first && last && (
                      <> · predicted {Math.round(first.predicted)} → {Math.round(last.predicted)}</>
                    )}
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
                    className="rounded px-3 py-1 text-sm font-medium bg-white text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-4">
                  <SnapshotChart snapshot={snapshot} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
