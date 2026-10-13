import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteForecastSnapshot, fetchForecast, listForecastSnapshots, saveForecastSnapshot } from "./forecastActions";

describe("fetchForecast", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when the backend responds with an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      }),
    );

    await expect(fetchForecast()).resolves.toBeNull();
  });

  it("returns null when the response has GraphQL errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ errors: [{ message: "boom" }] }),
      }),
    );

    await expect(fetchForecast()).resolves.toBeNull();
  });

  it("returns null (the cache's own null) without treating it as an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { forecast: null } }),
      }),
    );

    await expect(fetchForecast()).resolves.toBeNull();
  });

  it("does not attach an auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { forecast: null } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchForecast();

    expect(fetchMock.mock.calls[0][1].headers["x-forecast-snapshot-secret"]).toBeUndefined();
  });
});

describe("listForecastSnapshots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty list when the backend responds with an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      }),
    );

    await expect(listForecastSnapshots()).resolves.toEqual([]);
  });

  it("does not cache (reflects a just-completed mutation immediately)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { forecastSnapshots: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listForecastSnapshots();

    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
  });
});

describe("saveForecastSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches the forecast-snapshot secret header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { recordForecastSnapshot: { id: 1 } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("FORECAST_SNAPSHOT_SECRET", "test-secret");

    await saveForecastSnapshot([], [], "AutoETS", null);

    expect(fetchMock.mock.calls[0][1].headers["x-forecast-snapshot-secret"]).toBe("test-secret");
  });

  it("returns null when the backend responds with an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      }),
    );

    await expect(saveForecastSnapshot([], [], "AutoETS", null)).resolves.toBeNull();
  });
});

describe("deleteForecastSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches the forecast-snapshot secret header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { deleteForecastSnapshot: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("FORECAST_SNAPSHOT_SECRET", "test-secret");

    await deleteForecastSnapshot(1);

    expect(fetchMock.mock.calls[0][1].headers["x-forecast-snapshot-secret"]).toBe("test-secret");
  });

  it("returns false when the backend responds with an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      }),
    );

    await expect(deleteForecastSnapshot(1)).resolves.toBe(false);
  });
});
