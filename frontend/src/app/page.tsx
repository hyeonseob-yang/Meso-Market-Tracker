import { subDays } from "date-fns";

import AverageChart from "./components/averageChart";
import { fetchPrices } from "./actions";

export default async function Page() {
  const until = new Date();
  const since = subDays(until, 30);
  const prices = await fetchPrices(since.toISOString(), until.toISOString());

  return <AverageChart initialPrices={prices} />;
}
