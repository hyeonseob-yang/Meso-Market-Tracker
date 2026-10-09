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

// Registering again here is harmless (Chart.js dedups by component) and
// keeps this self-contained - a visitor could land on /predictions without
// ever rendering averageChart.tsx first in this session.
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
