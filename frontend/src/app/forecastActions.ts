"use server";

import { logError } from "@/lib/cloudwatch";
import type { ForecastPoint, PriceRow } from "./components/chartConfig";

const FORECAST_SNAPSHOT_SECRET_HEADER = "x-forecast-snapshot-secret";

export type Forecast = {
  model: string;
  modelParams: Record<string, unknown> | null;
  points: ForecastPoint[];
  history: PriceRow[];
};
export type ForecastSnapshot = {
  id: number;
  createdAt: string;
  model: string;
  modelParams: Record<string, unknown> | null;
  history: PriceRow[];
  points: ForecastPoint[];
};

const FORECAST_QUERY = `
  query { forecast { model modelParams points history } }
`;

const FORECAST_SNAPSHOTS_QUERY = `
  query ForecastSnapshots($limit: Int) {
    forecastSnapshots(limit: $limit) {
      id createdAt model modelParams history points
    }
  }
`;

const RECORD_FORECAST_SNAPSHOT_MUTATION = `
  mutation RecordForecastSnapshot($history: JSON!, $points: JSON!, $model: String!, $modelParams: JSON) {
    recordForecastSnapshot(history: $history, points: $points, model: $model, modelParams: $modelParams) {
      id createdAt model modelParams history points
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

export async function listForecastSnapshots(limit?: number): Promise<ForecastSnapshot[]> {
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

  return data.forecastSnapshots as ForecastSnapshot[];
}

export async function saveForecastSnapshot(
  history: PriceRow[],
  points: ForecastPoint[],
  model: string,
  modelParams: Record<string, unknown> | null,
): Promise<ForecastSnapshot | null> {
  const response = await fetch(`${process.env.BACKEND_URL}/price`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [FORECAST_SNAPSHOT_SECRET_HEADER]: process.env.FORECAST_SNAPSHOT_SECRET ?? "",
    },
    body: JSON.stringify({
      query: RECORD_FORECAST_SNAPSHOT_MUTATION,
      variables: { history, points, model, modelParams },
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

  return data.recordForecastSnapshot as ForecastSnapshot;
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
