"use client";

import { useState, useTransition } from "react";
import { subDays, subMonths, subYears } from "date-fns";
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

import { fetchPrices } from "../actions";

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

type PriceRow = { datetime: string; average: number };

const WINDOWS = [
  { label: "1W", since: (now: Date) => subDays(now, 7) },
  { label: "1M", since: (now: Date) => subMonths(now, 1) },
  { label: "3M", since: (now: Date) => subMonths(now, 3) },
  { label: "1Y", since: (now: Date) => subYears(now, 1) },
  { label: "All", since: null },
] as const;

type WindowLabel = (typeof WINDOWS)[number]["label"];

function toChartData(prices: PriceRow[]): ChartData<"line", { x: string; y: number }[]> {
  return {
    datasets: [
      {
        label: "Average",
        data: prices.map((p) => ({ x: p.datetime, y: p.average })),
      },
    ],
  };
}

export default function AverageChart({ initialPrices }: { initialPrices: PriceRow[] }) {
  const [selected, setSelected] = useState<WindowLabel>("1M");
  const [prices, setPrices] = useState(initialPrices);
  const [isPending, startTransition] = useTransition();

  function selectWindow(window: (typeof WINDOWS)[number]) {
    setSelected(window.label);
    const until = new Date();
    const since = window.since?.(until);
    startTransition(async () => {
      setPrices(await fetchPrices(since?.toISOString(), until.toISOString()));
    });
  }

  return (
    <div>
      <div role="group" aria-label="Time window" className="mb-4 flex gap-2">
        {WINDOWS.map((window) => (
          <button
            key={window.label}
            type="button"
            onClick={() => selectWindow(window)}
            disabled={isPending}
            aria-pressed={selected === window.label}
            className={`rounded px-3 py-1 text-sm font-medium disabled:opacity-50 ${
              selected === window.label
                ? "bg-blue-700 text-white"
                : "bg-white text-gray-700 hover:bg-gray-200"
            }`}
          >
            {window.label}
          </button>
        ))}
      </div>
      <Line options={options} data={toChartData(prices)} />
    </div>
  );
}
