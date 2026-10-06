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

// Cached for an hour - the Collector only posts hourly, so that's not a
// compromise, it's matched to how often fresh data can even exist. Confirmed
// (2026-10-06, via a throwaway route handler + Lambda invocation counts)
// that Next's fetch cache keys on the POST body, so different since/until
// windows get their own cache entries rather than colliding - one function
// serves both the page's default load and the window-selector buttons.
// Genuine freshness (a new price landing) is handled separately by
// revalidatePath, called from the backend right after a successful insert -
// see /api/revalidate - rather than by shortening this window.
export async function fetchPrices(since?: string, until?: string) {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: PRICES_QUERY, variables: { since, until } }),
    next: { revalidate: 3600 },
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
