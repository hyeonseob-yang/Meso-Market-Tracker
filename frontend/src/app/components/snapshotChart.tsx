"use client";

import {
  Chart as ChartJS,
  Colors,
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

import type { ForecastSnapshot } from "../forecastSnapshots";
import { buildChartData, chartOptions } from "./chartConfig";

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
);

export default function SnapshotChart({ snapshot }: { snapshot: ForecastSnapshot }) {
  return <Line options={chartOptions} data={buildChartData(snapshot.history, snapshot.points)} />;
}
