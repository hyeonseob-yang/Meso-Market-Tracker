import type { ChartData } from "chart.js";

export type PriceRow = { datetime: string; average: number };

export type ForecastPoint = { datetime: string; predicted: number; lower: number; upper: number };

// Spans this short use bare weekday names, overriding Chart.js's unit auto-detection.
const WEEKDAY_LABEL_MAX_SPAN_DAYS = 9;

export function buildChartOptions(spanDays: number) {
  const useWeekdayNames = spanDays <= WEEKDAY_LABEL_MAX_SPAN_DAYS;
  return {
    responsive: true,
    // Without this, height is derived purely from width (default 2:1
    // aspect ratio) - on a wide-but-short screen that can be taller than
    // the actual available space. The container sets the real height instead.
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          // Upper/lower bound datasets only shade the confidence band - no legend entry.
          filter: (item: { text: string }) => item.text !== "Forecast range",
        },
      },
    },
    scales: {
      x: {
        type: "time" as const,
        time: {
          tooltipFormat: "MMM d, yyyy HH:mm",
          unit: useWeekdayNames ? ("day" as const) : undefined,
          displayFormats: {
            hour: "h a",
            day: useWeekdayNames ? "EEE" : "MMM d",
            week: "MMM d",
            month: "MMM yyyy",
          },
        },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 8,
          maxRotation: 0,
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
}

// Earliest-to-latest spread across whatever's actually plotted, in days.
export function computeSpanDays(
  history: PriceRow[],
  forecast: ForecastPoint[] = [],
  actual: PriceRow[] = [],
): number {
  const times = [...history, ...forecast, ...actual].map((p) => new Date(p.datetime).getTime());
  if (times.length < 2) return 0;
  return (Math.max(...times) - Math.min(...times)) / (24 * 60 * 60 * 1000);
}

// Shared by the live chart and the saved-snapshot viewer.
export function forecastDatasets(
  anchor: PriceRow | null,
  forecast: ForecastPoint[],
): NonNullable<ChartData<"line", { x: string; y: number }[]>["datasets"]> {
  if (forecast.length === 0) return [];

  const lead = anchor ? [{ x: anchor.datetime, y: anchor.average }] : [];

  return [
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
      // Orange - high-contrast against the blue "Average" line.
      label: "Forecast",
      data: [...lead, ...forecast.map((f) => ({ x: f.datetime, y: f.predicted }))],
      borderColor: "#ea580c",
      borderDash: [6, 6],
      pointRadius: 0,
    },
  ];
}

// History + forecast, optionally with the real data recorded over the same
// span as the forecast (for comparing a saved snapshot against what
// actually happened).
export function buildChartData(
  history: PriceRow[],
  forecast: ForecastPoint[],
  actual: PriceRow[] = [],
): ChartData<"line", { x: string; y: number }[]> {
  const anchor = history[history.length - 1] ?? null;
  return {
    datasets: [
      {
        label: "Average",
        data: history.map((p) => ({ x: p.datetime, y: p.average })),
        borderColor: "#1d4ed8",
      },
      ...forecastDatasets(anchor, forecast),
      ...(actual.length > 0
        ? [
            {
              label: "Actual",
              data: actual.map((p) => ({ x: p.datetime, y: p.average })),
              borderColor: "#16a34a",
              pointRadius: 2,
            },
          ]
        : []),
    ],
  };
}

export type AccuracyMetrics = { n: number; mae: number; mape: number };

// Matches each actual reading to its nearest predicted point (within half
// an hour, since predictions are hourly) and averages the error - only
// over whatever portion of the forecast horizon has actually elapsed.
export function computeAccuracy(points: ForecastPoint[], actual: PriceRow[]): AccuracyMetrics {
  const MAX_MATCH_MS = 30 * 60 * 1000;
  let sumAbsError = 0;
  let sumPctError = 0;
  let n = 0;

  for (const a of actual) {
    const t = new Date(a.datetime).getTime();
    let nearest: ForecastPoint | null = null;
    let nearestDist = Infinity;
    for (const p of points) {
      const dist = Math.abs(new Date(p.datetime).getTime() - t);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = p;
      }
    }
    if (nearest && nearestDist <= MAX_MATCH_MS) {
      const error = Math.abs(a.average - nearest.predicted);
      sumAbsError += error;
      sumPctError += (error / a.average) * 100;
      n += 1;
    }
  }

  return n > 0 ? { n, mae: sumAbsError / n, mape: sumPctError / n } : { n: 0, mae: 0, mape: 0 };
}
