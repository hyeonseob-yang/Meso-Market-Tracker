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
import { generateDummyForecast, type ForecastPoint } from "../dummyForecast";

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
      labels: {
        // The upper/lower bound datasets exist only to shade the
        // confidence band - don't give them their own legend entries.
        filter: (item: { text: string }) => item.text !== "Forecast range",
      },
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

const FORECAST_HORIZONS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
] as const;

type ForecastHorizonLabel = (typeof FORECAST_HORIZONS)[number]["label"];

function toChartData(
  prices: PriceRow[],
  forecast: ForecastPoint[],
): ChartData<"line", { x: string; y: number }[]> {
  const datasets: ChartData<"line", { x: string; y: number }[]>["datasets"] = [
    {
      label: "Average",
      data: prices.map((p) => ({ x: p.datetime, y: p.average })),
      borderColor: "#1d4ed8",
    },
  ];

  if (forecast.length > 0) {
    const anchor = prices[prices.length - 1];
    const lead = anchor ? [{ x: anchor.datetime, y: anchor.average }] : [];

    datasets.push(
      // Upper bound first, then lower bound filling back to it (Chart.js's
      // `fill: "-1"` means "fill to the dataset defined just before this
      // one") - together they shade the confidence band between them.
      {
        label: "Forecast range",
        data: [...lead, ...forecast.map((f) => ({ x: f.datetime, y: f.upper }))],
        borderWidth: 0,
        pointRadius: 0,
        fill: false,
      },
      {
        label: "Forecast range",
        data: [...lead, ...forecast.map((f) => ({ x: f.datetime, y: f.lower }))],
        borderWidth: 0,
        pointRadius: 0,
        backgroundColor: "rgba(234, 88, 12, 0.15)",
        fill: "-1",
      },
      {
        // Orange, matching the "Show Forecast" toggle below, so it's
        // visually obvious the button and this layer are the same thing -
        // high-contrast against the blue "Average" line rather than just
        // dashed (indigo was tried first and was too close to the blue).
        label: "Forecast",
        data: [...lead, ...forecast.map((f) => ({ x: f.datetime, y: f.predicted }))],
        borderColor: "#ea580c",
        borderDash: [6, 6],
        pointRadius: 0,
      },
    );
  }

  return { datasets };
}

export default function AverageChart({ initialPrices }: { initialPrices: PriceRow[] }) {
  const [selected, setSelected] = useState<WindowLabel>("1M");
  const [prices, setPrices] = useState(initialPrices);
  const [showForecast, setShowForecast] = useState(false);
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizonLabel>("1M");
  const [isPending, startTransition] = useTransition();

  // TEMPORARY: dummy data until the real sktime-backed forecast exists.
  const horizonDays = FORECAST_HORIZONS.find((h) => h.label === forecastHorizon)!.days;
  const forecast = showForecast ? generateDummyForecast(prices, horizonDays) : [];

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
      <div className="mb-4 flex items-center justify-between">
        <div role="group" aria-label="Time window" className="flex gap-2">
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
        <div className="flex items-center gap-2">
          {showForecast && (
            <div role="group" aria-label="Forecast horizon" className="flex gap-2">
              {FORECAST_HORIZONS.map((horizon) => (
                <button
                  key={horizon.label}
                  type="button"
                  onClick={() => setForecastHorizon(horizon.label)}
                  aria-pressed={forecastHorizon === horizon.label}
                  className={`rounded px-3 py-1 text-sm font-medium ${
                    forecastHorizon === horizon.label
                      ? "bg-orange-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  +{horizon.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowForecast((v) => !v)}
            aria-pressed={showForecast}
            className={`rounded px-3 py-1 text-sm font-medium ${
              showForecast ? "bg-orange-600 text-white" : "bg-white text-gray-700 hover:bg-gray-200"
            }`}
          >
            {showForecast ? "Hide Forecast" : "Show Forecast"}
          </button>
        </div>
      </div>
      <Line options={options} data={toChartData(prices, forecast)} />
      {showForecast && (
        <p className="mt-2 text-xs text-gray-500">
          Forecast shown is placeholder data for preview only — not a real prediction yet.
        </p>
      )}
    </div>
  );
}
