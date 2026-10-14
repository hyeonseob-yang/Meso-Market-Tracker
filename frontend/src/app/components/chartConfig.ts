import type { ChartData } from "chart.js";

export type PriceRow = { datetime: string; average: number };

export type ForecastPoint = { datetime: string; predicted: number; lower: number; upper: number };

export const chartOptions = {
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
