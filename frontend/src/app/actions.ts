"use server";

import { logError } from "@/lib/cloudwatch";

const PRICES_QUERY = `
  query Prices($since: String, $until: String) {
    prices(since: $since, until: $until) {
      datetime
      average
    }
  }
`;

// Cached for 5 minutes. Confirmed (2026-10-06, via a throwaway route handler
// + Lambda invocation counts) that Next's fetch cache keys on the POST body,
// so different since/until windows get their own cache entries rather than
// colliding - one function serves both the page's default load and the
// window-selector buttons. A short TTL rather than an hour-long one + an
// on-demand-revalidation webhook: at this traffic level the webhook's
// freshness benefit wasn't worth its cost/complexity (new secret, a new
// silent failure mode, added latency on every recordPrice) - see the
// 2026-10 "Is having the backend send requests to the frontend server
// normal" discussion for the full reasoning.
export async function fetchPrices(since?: string, until?: string) {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: PRICES_QUERY, variables: { since, until } }),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return [];
  }

  const { data, errors } = await response.json();

  if (errors || !data?.prices) {
    await logError("GraphQL errors:", errors);
    return [];
  }

  return data.prices as { datetime: string; average: number }[];
}
