"use server";

import { logError } from "@/lib/cloudwatch";
import { createClient } from "@/lib/supabase/server";

export type AlertSubscription = {
  id: number;
  webhookUrl: string;
  name: string;
  high: number | null;
  low: number | null;
};

const MY_ALERT_SUBSCRIPTIONS_QUERY = `
  query { myAlertSubscriptions { id webhookUrl name high low } }
`;

const CREATE_ALERT_SUBSCRIPTION_MUTATION = `
  mutation Create($webhookUrl: String!, $name: String!, $high: Float, $low: Float) {
    createAlertSubscription(webhookUrl: $webhookUrl, name: $name, high: $high, low: $low) {
      id webhookUrl name high low
    }
  }
`;

const UPDATE_ALERT_SUBSCRIPTION_MUTATION = `
  mutation Update($id: Int!, $name: String!, $high: Float, $low: Float) {
    updateAlertSubscription(id: $id, name: $name, high: $high, low: $low) {
      id webhookUrl name high low
    }
  }
`;

const DELETE_ALERT_SUBSCRIPTION_MUTATION = `
  mutation Delete($id: Int!) {
    deleteAlertSubscription(id: $id)
  }
`;

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

export async function fetchMyAlertSubscriptions(): Promise<AlertSubscription[]> {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ query: MY_ALERT_SUBSCRIPTIONS_QUERY }),
    cache: "no-store",
  });

  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return [];
  }

  const { data, errors } = await response.json();

  if (errors || !data?.myAlertSubscriptions) {
    await logError("GraphQL errors:", errors);
    return [];
  }

  return data.myAlertSubscriptions as AlertSubscription[];
}

export async function createAlertSubscription(
  webhookUrl: string,
  name: string,
  high: number | null,
  low: number | null,
): Promise<{ subscription: AlertSubscription | null; error: string | null }> {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      query: CREATE_ALERT_SUBSCRIPTION_MUTATION,
      variables: { webhookUrl, name, high, low },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return { subscription: null, error: "Something went wrong - try again." };
  }

  const { data, errors } = await response.json();

  if (errors || !data?.createAlertSubscription) {
    await logError("GraphQL errors:", errors);
    return { subscription: null, error: errors?.[0]?.message ?? "Something went wrong - try again." };
  }

  return { subscription: data.createAlertSubscription as AlertSubscription, error: null };
}

export async function updateAlertSubscription(
  id: number,
  name: string,
  high: number | null,
  low: number | null,
): Promise<{ subscription: AlertSubscription | null; error: string | null }> {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      query: UPDATE_ALERT_SUBSCRIPTION_MUTATION,
      variables: { id, name, high, low },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return { subscription: null, error: "Something went wrong - try again." };
  }

  const { data, errors } = await response.json();

  if (errors || !data?.updateAlertSubscription) {
    await logError("GraphQL errors:", errors);
    return { subscription: null, error: errors?.[0]?.message ?? "Something went wrong - try again." };
  }

  return { subscription: data.updateAlertSubscription as AlertSubscription, error: null };
}

export async function deleteAlertSubscription(id: number): Promise<boolean> {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ query: DELETE_ALERT_SUBSCRIPTION_MUTATION, variables: { id } }),
    cache: "no-store",
  });

  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return false;
  }

  const { data, errors } = await response.json();

  if (errors) {
    await logError("GraphQL errors:", errors);
    return false;
  }

  return Boolean(data?.deleteAlertSubscription);
}
