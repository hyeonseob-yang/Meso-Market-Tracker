"use server";

import { postToBackend } from "@/lib/backend";
import { logError } from "@/lib/cloudwatch";
import { createClient } from "@/lib/supabase/server";

export type TradeSide = "BUY" | "SELL";

export type Trade = {
  id: number;
  side: TradeSide;
  amount100m: number;
  price: number;
  tradedAt: string;
  note: string;
  total: number;
  fee: number | null;
  net: number | null;
};

export type TradeProfit = { profit: number; average: number; averageAt: string };

const GENERIC_ERROR = "Something went wrong - try again.";
const TRADE_FIELDS = "id side amount100m price tradedAt note total fee net";

const MY_TRADES_QUERY = `query { myTrades { ${TRADE_FIELDS} } }`;
const MY_TRADE_PROFIT_QUERY = `query { myTradeProfit { profit average averageAt } }`;
const RECORD_TRADE_MUTATION = `
  mutation Record($side: TradeSide!, $amount100m: Int!, $price: Int!, $tradedAt: String!, $note: String!) {
    recordTrade(side: $side, amount100m: $amount100m, price: $price, tradedAt: $tradedAt, note: $note) {
      ${TRADE_FIELDS}
    }
  }
`;
const DELETE_TRADE_MUTATION = `mutation Delete($id: Int!) { deleteTrade(id: $id) }`;

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export async function fetchMyTrades(): Promise<Trade[]> {
  const response = await postToBackend(await authHeaders(), { query: MY_TRADES_QUERY });
  if (!response) return [];
  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return [];
  }

  const { data, errors } = await response.json();
  if (errors || !data?.myTrades) {
    await logError("GraphQL errors:", errors);
    return [];
  }
  return data.myTrades as Trade[];
}

// null when unavailable: no Price Reading has an Average yet, or the request failed.
export async function fetchTradeProfit(): Promise<TradeProfit | null> {
  const response = await postToBackend(await authHeaders(), { query: MY_TRADE_PROFIT_QUERY });
  if (!response) return null;
  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return null;
  }

  const { data, errors } = await response.json();
  if (errors) {
    await logError("GraphQL errors:", errors);
    return null;
  }
  return (data?.myTradeProfit ?? null) as TradeProfit | null;
}

export async function recordTrade(
  side: TradeSide,
  amount100m: number,
  price: number,
  tradedAt: string,
  note: string,
): Promise<{ trade: Trade | null; error: string | null }> {
  const response = await postToBackend(await authHeaders(), {
    query: RECORD_TRADE_MUTATION,
    variables: { side, amount100m, price, tradedAt, note },
  });

  if (!response) return { trade: null, error: GENERIC_ERROR };
  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return { trade: null, error: GENERIC_ERROR };
  }

  const { data, errors } = await response.json();
  if (errors || !data?.recordTrade) {
    await logError("GraphQL errors:", errors);
    return { trade: null, error: errors?.[0]?.message ?? GENERIC_ERROR };
  }
  return { trade: data.recordTrade as Trade, error: null };
}

export async function deleteTrade(id: number): Promise<{ ok: boolean; error: string | null }> {
  const response = await postToBackend(await authHeaders(), { query: DELETE_TRADE_MUTATION, variables: { id } });

  if (!response) return { ok: false, error: GENERIC_ERROR };
  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return { ok: false, error: GENERIC_ERROR };
  }

  const { data, errors } = await response.json();
  if (errors) {
    await logError("GraphQL errors:", errors);
    return { ok: false, error: errors[0]?.message ?? GENERIC_ERROR };
  }
  if (!data?.deleteTrade) {
    return { ok: false, error: "That Trade no longer exists." };
  }
  return { ok: true, error: null };
}
