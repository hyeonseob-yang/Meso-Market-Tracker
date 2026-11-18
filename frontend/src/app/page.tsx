import { createClient } from "@/lib/supabase/server";
import AverageChart from "./components/averageChart";
import { DEFAULT_WINDOW_LABEL, windowStart } from "./components/chartWindows";
import { fetchPrices } from "./actions";

export default async function Page() {
  const until = new Date();
  const since = windowStart(DEFAULT_WINDOW_LABEL, until);
  const supabase = await createClient();
  const [
    prices,
    {
      data: { session },
    },
  ] = await Promise.all([fetchPrices(since?.toISOString(), until.toISOString()), supabase.auth.getSession()]);

  return <AverageChart initialPrices={prices} isLoggedIn={session !== null} />;
}
