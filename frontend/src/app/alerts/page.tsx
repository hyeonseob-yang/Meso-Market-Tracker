import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { fetchMyAlertSubscriptions } from "../alertActions";
import AlertSubscriptionsList from "../components/alertSubscriptionsList";

export default async function AlertsPage() {
  const supabase = await createClient();
  // getSession() only - see layout.tsx for why getUser()'s extra network
  // round-trip isn't needed here either.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return (
      <div>
        <h2 className="text-lg font-medium text-gray-900">Price Alerts</h2>
        <p className="mt-2 text-gray-600">
          <Link href="/login" className="text-blue-700 underline">
            Log in
          </Link>{" "}
          to create and manage your own price alerts.
        </p>
      </div>
    );
  }

  const subscriptions = await fetchMyAlertSubscriptions();

  return <AlertSubscriptionsList initialSubscriptions={subscriptions} />;
}
