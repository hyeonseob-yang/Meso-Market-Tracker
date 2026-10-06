import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPrices, fetchPricesFresh } from "./actions";

describe("fetchPrices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty list when the backend responds with an HTTP error", async () => {
    // A 500 with a plain-text body, e.g. an API Gateway/Lambda failure.
    // The old code called response.json() unconditionally, which throws on
    // a non-JSON body and rejects the whole page render.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
        json: () => Promise.reject(new SyntaxError("Unexpected token I in JSON")),
      }),
    );

    await expect(fetchPrices()).resolves.toEqual([]);
  });

  it("returns an empty list when the response has no prices data", async () => {
    // A 200 with valid JSON but no `errors` and no `data.prices` (e.g. a
    // misrouted request hitting something that returns `{ data: {} }`).
    // The old code only checked `errors`, so this fell through to
    // `data.prices`, returning `undefined` instead of an array.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      }),
    );

    await expect(fetchPrices()).resolves.toEqual([]);
  });

  it("sends since/until as GraphQL variables when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { prices: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchPrices("2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.variables).toEqual({
      since: "2026-09-01T00:00:00.000Z",
      until: "2026-10-01T00:00:00.000Z",
    });
  });

  it("caches for an hour, matching the Collector's hourly post cadence", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { prices: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchPrices();

    expect(fetchMock.mock.calls[0][1].next).toEqual({ revalidate: 3600 });
    expect(fetchMock.mock.calls[0][1].cache).toBeUndefined();
  });
});

describe("fetchPricesFresh", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never caches - for the explicit, infrequent window-button re-fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { prices: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchPricesFresh();

    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
    expect(fetchMock.mock.calls[0][1].next).toBeUndefined();
  });
});
