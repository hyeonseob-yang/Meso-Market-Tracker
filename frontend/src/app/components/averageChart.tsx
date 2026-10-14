"use client";

import { useEffect, useState, useTransition } from "react";
import { subDays, subMonths, subYears } from "date-fns";
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
import { fetchForecast, saveForecastSnapshot, type Forecast } from "../forecastActions";
import { buildChartData, buildChartOptions, computeSpanDays, type PriceRow } from "./chartConfig";

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

const WINDOWS = [
  { label: "1W", since: (now: Date) => subDays(now, 7) },
  { label: "1M", since: (now: Date) => subMonths(now, 1) },
  { label: "3M", since: (now: Date) => subMonths(now, 3) },
  { label: "1Y", since: (now: Date) => subYears(now, 1) },
  { label: "All", since: null },
] as const;

type WindowLabel = (typeof WINDOWS)[number]["label"];

export default function AverageChart({ initialPrices }: { initialPrices: PriceRow[] }) {
  const [selected, setSelected] = useState<WindowLabel>("1M");
  const [prices, setPrices] = useState(initialPrices);
  const [showForecast, setShowForecast] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Fetched once on mount, not gated on showForecast - it's a single small,
  // server-cached (5 min) row, so there's nothing to gain by deferring it
  // until the toggle is clicked, only a visible delay on first toggle.
  useEffect(() => {
    let cancelled = false;
    fetchForecast().then((result) => {
      if (!cancelled) {
        setForecast(result);
        setForecastLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePoints = showForecast ? forecast?.points ?? [] : [];

  function selectWindow(window: (typeof WINDOWS)[number]) {
    setSelected(window.label);
    const until = new Date();
    const since = window.since?.(until);
    startTransition(async () => {
      setPrices(await fetchPrices(since?.toISOString(), until.toISOString()));
    });
  }

  async function handleSaveSnapshot() {
    if (!forecast) return;
    setIsSaving(true);
    // forecast.historyCount is how many actual training records the model
    // was fit on (manual/test entries already excluded) - not `prices`,
    // which is whatever window is currently displayed and may include those.
    const saved = await saveForecastSnapshot(
      forecast.historyCount,
      forecast.points,
      forecast.model,
      forecast.modelParams,
    );
    setIsSaving(false);
    if (saved) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
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
          {showForecast && forecast && forecast.points.length > 0 && (
            <button
              type="button"
              onClick={handleSaveSnapshot}
              disabled={isSaving}
              className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? "Saving…" : justSaved ? "Saved ✓" : "Save Snapshot"}
            </button>
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
      <Line
        options={buildChartOptions(computeSpanDays(prices, visiblePoints))}
        data={buildChartData(prices, visiblePoints)}
      />
      {showForecast && forecastLoading && <p className="mt-2 text-xs text-gray-500">Loading forecast…</p>}
      {showForecast && forecast && (
        <p className="mt-2 text-xs text-gray-500">Model: {forecast.model}</p>
      )}
    </div>
  );
}
