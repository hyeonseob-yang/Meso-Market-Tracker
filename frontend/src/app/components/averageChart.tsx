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
import type { ChartData } from "chart.js";

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

const options = {
  responsive: true,
  plugins: {
    legend: {
      position: "top" as const,
    },
  },
  scales: {
    x: {
      type: "time" as const,
      time: {
        tooltipFormat: "MMM d, yyyy HH:mm",
        displayFormats: {
          day: "MMM d",
          week: "MMM d",
          month: "MMM yyyy",
        },
      },
      title: {
        display: true,
        text: "Date",
      },
    },
    y: {
      title: {
        display: true,
        text: "Price",
      },
    },
  },
};

export default function AverageChart({
  data,
}: {
  data: ChartData<"line", { x: string; y: number }[]>;
}) {
  return <Line options={options} data={data} />;
}
