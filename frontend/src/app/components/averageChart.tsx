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

import { fetchPrices } from "../actions";
import { generateDummyForecast } from "../dummyForecast";
import { saveSnapshot } from "../forecastSnapshots";
import { buildChartData, chartOptions, type PriceRow } from "./chartConfig";

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

export default function AverageChart({ initialPrices }: { initialPrices: PriceRow[] }) {
  const [selected, setSelected] = useState<WindowLabel>("1M");
  const [prices, setPrices] = useState(initialPrices);
  const [showForecast, setShowForecast] = useState(false);
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizonLabel>("1M");
  const [justSaved, setJustSaved] = useState(false);
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

  function handleSaveSnapshot() {
    // Includes the currently-displayed history, not just the forecast - a
    // prediction isn't meaningful without the data it was built from.
    saveSnapshot(horizonDays, prices, forecast);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
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
        <div className="flex items-center gap-4">
          {showForecast && (
            <div className="flex items-center gap-2">
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
              {forecast.length > 0 && (
                <button
                  type="button"
                  onClick={handleSaveSnapshot}
                  className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
                >
                  {justSaved ? "Saved ✓" : "Save Snapshot"}
                </button>
              )}
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
      <Line options={chartOptions} data={buildChartData(prices, forecast)} />
      {showForecast && (
        <p className="mt-2 text-xs text-gray-500">
          Forecast shown is placeholder data for preview only — not a real prediction yet.
        </p>
      )}
    </div>
  );
}
