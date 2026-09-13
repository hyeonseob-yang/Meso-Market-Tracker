import AverageChart from "./components/averageChart";
import { logError } from "@/lib/cloudwatch";

const PRICES_QUERY = `
  query {
    prices {
      datetime
      average
    }
  }
`;

export async function fetchPrices() {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: PRICES_QUERY }),
    cache: "no-store",
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

export default async function Page() {
  const prices = await fetchPrices();

  const data = {
    datasets: [
      {
        label: "Average",
        data: prices.map((p) => ({ x: p.datetime, y: p.average })),
      },
    ],
  };

  return <AverageChart data={data} />;
}
