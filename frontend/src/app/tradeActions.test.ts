import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { deleteTrade, fetchMyTrades, fetchTradeProfit, recordTrade, type Trade } from "./tradeActions";

const GENERIC_ERROR = "Something went wrong - try again.";
const TRADE: Trade = {
  id: 7,
  side: "SELL",
  amount100m: 10,
  price: 60,
  tradedAt: "2026-11-20T12:00:00+00:00",
  note: "",
  total: 600,
  fee: 6,
  net: 594,
};

function mockSupabaseSession(accessToken: string | null) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: accessToken ? { access_token: accessToken } : null } }),
    },
  });
}

function respondWith(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function failToConnect() {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
}

beforeEach(() => mockSupabaseSession(null));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchMyTrades", () => {
  it("returns the Trades on success", async () => {
    respondWith({ data: { myTrades: [TRADE] } });
    await expect(fetchMyTrades()).resolves.toEqual([TRADE]);
  });

  it("returns an empty list when the backend is unreachable", async () => {
    failToConnect();
    await expect(fetchMyTrades()).resolves.toEqual([]);
  });

  it("attaches the Authorization header when a session exists", async () => {
    mockSupabaseSession("test-token");
    const fetchMock = respondWith({ data: { myTrades: [] } });
    await fetchMyTrades();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-token");
  });
});

describe("fetchTradeProfit", () => {
  it("returns Profit with the Average it was valued at", async () => {
    const profit = { profit: 544, average: 55, averageAt: "2026-11-20T12:01:00+00:00" };
    respondWith({ data: { myTradeProfit: profit } });
    await expect(fetchTradeProfit()).resolves.toEqual(profit);
  });

  it("returns null when no Average is available", async () => {
    respondWith({ data: { myTradeProfit: null } });
    await expect(fetchTradeProfit()).resolves.toBeNull();
  });

  it("returns null when the backend is unreachable", async () => {
    failToConnect();
    await expect(fetchTradeProfit()).resolves.toBeNull();
  });
});

describe("recordTrade", () => {
  it("returns the logged Trade on success", async () => {
    respondWith({ data: { recordTrade: TRADE } });
    await expect(recordTrade("SELL", 10, 60, TRADE.tradedAt, "")).resolves.toEqual({ trade: TRADE, error: null });
  });

  it("returns the backend's validation message", async () => {
    respondWith({ data: null, errors: [{ message: "A Trade can't be in the future." }] });
    await expect(recordTrade("SELL", 10, 60, TRADE.tradedAt, "")).resolves.toEqual({
      trade: null,
      error: "A Trade can't be in the future.",
    });
  });

  it("returns a generic error when the backend is unreachable", async () => {
    failToConnect();
    await expect(recordTrade("SELL", 10, 60, TRADE.tradedAt, "")).resolves.toEqual({
      trade: null,
      error: GENERIC_ERROR,
    });
  });
});

describe("deleteTrade", () => {
  it("returns ok on success", async () => {
    respondWith({ data: { deleteTrade: true } });
    await expect(deleteTrade(7)).resolves.toEqual({ ok: true, error: null });
  });

  it("reports a missing Trade when nothing was deleted", async () => {
    respondWith({ data: { deleteTrade: false } });
    await expect(deleteTrade(7)).resolves.toEqual({ ok: false, error: "That Trade no longer exists." });
  });

  it("returns a generic error when the backend is unreachable", async () => {
    failToConnect();
    await expect(deleteTrade(7)).resolves.toEqual({ ok: false, error: GENERIC_ERROR });
  });
});
