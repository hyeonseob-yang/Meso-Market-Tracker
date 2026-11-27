import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import TradeLog from "../components/tradeLog";
import { fetchMyTrades, fetchTradeProfit } from "../tradeActions";

export default async function TradesPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return (
      <div>
        <h2 className="text-lg font-medium text-gray-900">Trades</h2>
        <p className="mt-2 text-gray-600">
          <Link href="/login" className="text-blue-700 underline">
            Log in
          </Link>{" "}
          to log your Trades and see your Profit.
        </p>
      </div>
    );
  }

  const [trades, profit] = await Promise.all([fetchMyTrades(), fetchTradeProfit()]);

  return <TradeLog initialTrades={trades} initialProfit={profit} />;
}
