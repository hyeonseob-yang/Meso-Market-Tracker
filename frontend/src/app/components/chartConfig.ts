import type { ChartData } from "chart.js";

import type { ForecastPoint } from "../dummyForecast";

export type PriceRow = { datetime: string; average: number };

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

// Shared between the live chart (averageChart.tsx) and the saved-snapshot
// viewer (predictions/page.tsx), so both render a forecast identically.
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
