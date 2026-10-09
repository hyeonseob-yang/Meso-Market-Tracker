// TEMPORARY. This fabricates a plausible-looking forecast purely so the
// chart UI can be previewed before the real sktime-backed GraphQL field
// exists. Delete this file and swap its one call site (averageChart.tsx)
// for a real server action once that's built.

type PriceRow = { datetime: string; average: number };

export type ForecastPoint = {
  datetime: string;
  predicted: number;
  lower: number;
  upper: number;
};

export function generateDummyForecast(prices: PriceRow[], steps = 10): ForecastPoint[] {
  if (prices.length < 2) return [];

  // Recent trend + volatility, so the dummy line at least looks connected
  // to the real data instead of being pure noise.
  const recent = prices.slice(-10);
  const values = recent.map((p) => p.average);
  const deltas = values.slice(1).map((v, i) => v - values[i]);
  const drift = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  const volatility =
    Math.sqrt(deltas.reduce((sum, d) => sum + (d - drift) ** 2, 0) / deltas.length) ||
    Math.abs(values[values.length - 1]) * 0.01 ||
    1;

  // Step forward using the data's own average spacing, so "steps" lands at
  // a sensible point in time regardless of which window is selected.
  const times = prices.map((p) => new Date(p.datetime).getTime());
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const stepMs = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 24 * 60 * 60 * 1000;

  const lastTime = times[times.length - 1];
  const lastValue = values[values.length - 1];

  const points: ForecastPoint[] = [];
  for (let step = 1; step <= steps; step++) {
    // A deterministic (not random) wiggle - re-rendering the same prices
    // shouldn't jump to a different-looking forecast shape each time.
    const wiggle = Math.sin(step * 0.8) * volatility * 0.5;
    const predicted = lastValue + drift * step + wiggle;
    const spread = volatility * Math.sqrt(step) * 1.5; // widening cone of uncertainty

    points.push({
      datetime: new Date(lastTime + stepMs * step).toISOString(),
      predicted,
      lower: predicted - spread,
      upper: predicted + spread,
    });
  }

  return points;
}
