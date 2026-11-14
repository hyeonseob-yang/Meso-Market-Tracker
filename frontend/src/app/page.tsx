import { subDays } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import AverageChart from "./components/averageChart";
import { fetchPrices } from "./actions";

export default async function Page() {
  const until = new Date();
  const since = subDays(until, 30);
  const supabase = await createClient();
  const [
    prices,
    {
      data: { session },
    },
  ] = await Promise.all([fetchPrices(since.toISOString(), until.toISOString()), supabase.auth.getSession()]);

  return <AverageChart initialPrices={prices} isLoggedIn={session !== null} />;
}
