import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPrices } from "./page";

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
});
