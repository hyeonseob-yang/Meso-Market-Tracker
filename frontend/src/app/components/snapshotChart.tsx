"use client";

import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  Colors,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { Line } from "react-chartjs-2";

import { fetchPrices } from "../actions";
import type { ForecastSnapshot } from "../forecastActions";
import { buildChartData, chartOptions, computeAccuracy, type PriceRow } from "./chartConfig";

// Re-registering is harmless (Chart.js dedups) and keeps this self-contained.
ChartJS.register(
  Colors,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export default function SnapshotChart({ snapshot }: { snapshot: ForecastSnapshot }) {
  const [actual, setActual] = useState<PriceRow[] | null>(null);

  useEffect(() => {
    const first = snapshot.points[0];
    const last = snapshot.points[snapshot.points.length - 1];
    if (!first || !last) {
      setActual([]);
      return;
    }
    let cancelled = false;
    fetchPrices(first.datetime, last.datetime).then((result) => {
      if (!cancelled) setActual(result);
    });
    return () => {
      cancelled = true;
    };
  }, [snapshot.id]);

  const accuracy = actual ? computeAccuracy(snapshot.points, actual) : null;

  return (
    <div>
      <Line options={chartOptions} data={buildChartData(snapshot.history, snapshot.points, actual ?? [])} />
      {accuracy && accuracy.n > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          vs. actual ({accuracy.n} matched points): avg error {accuracy.mae.toFixed(1)} ({accuracy.mape.toFixed(1)}%)
        </p>
      )}
    </div>
  );
}
