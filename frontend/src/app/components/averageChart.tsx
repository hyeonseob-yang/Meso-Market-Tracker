"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  Colors,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  ChartData,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  Colors,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

export const options = {
  responsive: true,
  plugins: {
    legend: {
      position: "top" as const,
    },
  },
  title: {
    display: true,
    text: "Meso Tracker Averages",
  },
};

export default function AverageChart({ data }: { data: ChartData<"line"> }) {
  return <Line options={options} data={data} />;
}
