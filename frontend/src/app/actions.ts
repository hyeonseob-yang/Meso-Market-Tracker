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

async function runPricesQuery(
  since: string | undefined,
  until: string | undefined,
  cacheOptions: Pick<RequestInit, "cache" | "next">,
) {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: PRICES_QUERY, variables: { since, until } }),
    ...cacheOptions,
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

// For the page's default load. The Collector only posts hourly, so caching
// any more aggressively than that just adds backend load for no freshness
// benefit - an hour-aligned cache is actually *correct* here, not a
// compromise.
export async function fetchPrices(since?: string, until?: string) {
  return runPricesQuery(since, until, { next: { revalidate: 3600 } });
}

// For the window-selector buttons: a deliberate, infrequent user action, not
// a per-visit hot path - always fresh, and sidesteps ever having to reason
// about whether the cache correctly keys on since/until.
export async function fetchPricesFresh(since?: string, until?: string) {
  return runPricesQuery(since, until, { cache: "no-store" });
}
