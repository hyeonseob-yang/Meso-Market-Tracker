"use server";

import { logError } from "@/lib/cloudwatch";
import { createClient } from "@/lib/supabase/server";

export type Me = { id: string; email: string };

const ME_QUERY = `query { me { id email } }`;

export async function fetchMe(): Promise<Me | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: ME_QUERY }),
    cache: "no-store",
  });

  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return null;
  }

  const { data, errors } = await response.json();

  if (errors || data?.me === undefined) {
    await logError("GraphQL errors:", errors);
    return null;
  }

  return data.me as Me | null;
}
