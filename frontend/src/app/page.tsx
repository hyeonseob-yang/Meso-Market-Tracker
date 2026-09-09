import AverageChart from "./components/averageChart";

const PRICES_QUERY = `
  query {
    prices {
      datetime
      average
    }
  }
`;

async function fetchPrices() {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: PRICES_QUERY }),
    cache: "no-store",
  });

  const { data, errors } = await response.json();

  if (errors) {
    console.error("GraphQL errors:", errors);
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
