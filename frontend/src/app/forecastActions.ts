"use server";

import { logError } from "@/lib/cloudwatch";
import type { ForecastPoint, PriceRow } from "./components/chartConfig";

const FORECAST_SNAPSHOT_SECRET_HEADER = "x-forecast-snapshot-secret";

// No `history` field - the model's prediction (`points`) doesn't depend on
// it, and nothing here displays it; fetching it would pay the same
// reconstruct-on-read cost as forecastSnapshots.history for no consumer.
export type Forecast = {
  model: string;
  modelParams: Record<string, unknown> | null;
  points: ForecastPoint[];
  historyCount: number;
};
// The list view - no `history`, which the backend reconstructs on read and
// which only grows larger over time (it mirrors however much training data
// existed at save time, up to MAX_TRAINING_DAYS). Fetched per snapshot via
// fetchForecastSnapshotHistory only when its chart is actually shown.
export type ForecastSnapshotSummary = {
  id: number;
  createdAt: string;
  model: string;
  modelParams: Record<string, unknown> | null;
  historyCount: number;
  points: ForecastPoint[];
};
export type ForecastSnapshot = ForecastSnapshotSummary & { history: PriceRow[] };

const FORECAST_QUERY = `
  query { forecast { model modelParams points historyCount } }
`;

const FORECAST_SNAPSHOTS_QUERY = `
  query ForecastSnapshots($limit: Int) {
    forecastSnapshots(limit: $limit) {
      id createdAt model modelParams historyCount points
    }
  }
`;

const FORECAST_SNAPSHOT_HISTORY_QUERY = `
  query ForecastSnapshotHistory($id: Int!) {
    forecastSnapshot(id: $id) { history }
  }
`;

const RECORD_FORECAST_SNAPSHOT_MUTATION = `
  mutation RecordForecastSnapshot($historyCount: Int!, $points: JSON!, $model: String!, $modelParams: JSON) {
    recordForecastSnapshot(historyCount: $historyCount, points: $points, model: $model, modelParams: $modelParams) {
      id createdAt model modelParams historyCount points
    }
  }
`;

const DELETE_FORECAST_SNAPSHOT_MUTATION = `
  mutation DeleteForecastSnapshot($id: Int!) {
    deleteForecastSnapshot(id: $id)
  }
`;

export async function fetchForecast(): Promise<Forecast | null> {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: FORECAST_QUERY }),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return null;
  }

  const { data, errors } = await response.json();

  if (errors || data?.forecast === undefined) {
    await logError("GraphQL errors:", errors);
    return null;
  }

  return data.forecast as Forecast | null;
}

export async function listForecastSnapshots(limit?: number): Promise<ForecastSnapshotSummary[]> {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: FORECAST_SNAPSHOTS_QUERY, variables: { limit } }),
    cache: "no-store",
  });

  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return [];
  }

  const { data, errors } = await response.json();

  if (errors || !data?.forecastSnapshots) {
    await logError("GraphQL errors:", errors);
    return [];
  }

  return data.forecastSnapshots as ForecastSnapshotSummary[];
}

export async function fetchForecastSnapshotHistory(id: number): Promise<PriceRow[] | null> {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: FORECAST_SNAPSHOT_HISTORY_QUERY, variables: { id } }),
    cache: "no-store",
  });

  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return null;
  }

  const { data, errors } = await response.json();

  if (errors || !data?.forecastSnapshot) {
    await logError("GraphQL errors:", errors);
    return null;
  }

  return data.forecastSnapshot.history as PriceRow[];
}

export async function saveForecastSnapshot(
  historyCount: number,
  points: ForecastPoint[],
  model: string,
  modelParams: Record<string, unknown> | null,
): Promise<ForecastSnapshotSummary | null> {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [FORECAST_SNAPSHOT_SECRET_HEADER]: process.env.FORECAST_SNAPSHOT_SECRET ?? "",
    },
    body: JSON.stringify({
      query: RECORD_FORECAST_SNAPSHOT_MUTATION,
      variables: { historyCount, points, model, modelParams },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    await logError("backend error", response.status, await response.text());
    return null;
  }

  const { data, errors } = await response.json();

  if (errors || !data?.recordForecastSnapshot) {
    await logError("GraphQL errors:", errors);
    return null;
  }

  return data.recordForecastSnapshot as ForecastSnapshotSummary;
}

export async function deleteForecastSnapshot(id: number): Promise<boolean> {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [FORECAST_SNAPSHOT_SECRET_HEADER]: process.env.FORECAST_SNAPSHOT_SECRET ?? "",
    },
    body: JSON.stringify({ query: DELETE_FORECAST_SNAPSHOT_MUTATION, variables: { id } }),
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

  return Boolean(data?.deleteForecastSnapshot);
}
