"use client";

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

import type { ForecastSnapshot } from "../forecastActions";
import { buildChartData, buildChartOptions, computeAccuracy, computeSpanDays, type PriceRow } from "./chartConfig";

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

export default function SnapshotChart({
  snapshot,
  actual,
}: {
  snapshot: ForecastSnapshot;
  actual: PriceRow[] | null;
}) {
  const accuracy = actual ? computeAccuracy(snapshot.points, actual) : null;

  return (
    <div>
      <div className="relative h-96">
        <Line
          options={buildChartOptions(computeSpanDays(snapshot.history, snapshot.points, actual ?? []))}
          data={buildChartData(snapshot.history, snapshot.points, actual ?? [])}
        />
      </div>
      {accuracy && accuracy.n > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          vs. actual ({accuracy.n} matched points): avg error {accuracy.mae.toFixed(1)} ({accuracy.mape.toFixed(1)}%)
        </p>
      )}
    </div>
  );
}
