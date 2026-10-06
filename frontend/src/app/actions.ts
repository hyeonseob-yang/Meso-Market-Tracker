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

export async function fetchPrices(since?: string, until?: string) {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: PRICES_QUERY, variables: { since, until } }),
    next: { revalidate: 60 },
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
