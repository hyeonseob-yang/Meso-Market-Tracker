import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import {
  createAlertSubscription,
  deleteAlertSubscription,
  fetchMyAlertSubscriptions,
  updateAlertSubscription,
} from "./alertActions";

function mockSupabaseSession(accessToken: string | null) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: accessToken ? { access_token: accessToken } : null } }),
    },
  });
}

// Default to logged-out for tests that don't care about auth state.
beforeEach(() => mockSupabaseSession(null));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchMyAlertSubscriptions", () => {
  it("returns an empty list when the backend responds with an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      }),
    );

    await expect(fetchMyAlertSubscriptions()).resolves.toEqual([]);
  });

  it("attaches the Authorization header when a session exists", async () => {
    mockSupabaseSession("test-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { myAlertSubscriptions: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchMyAlertSubscriptions();

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-token");
  });

  it("omits the Authorization header when there is no session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { myAlertSubscriptions: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchMyAlertSubscriptions();

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});

describe("createAlertSubscription", () => {
  it("returns the subscription on success", async () => {
    const subscription = { id: 1, webhookUrl: "https://discord.com/api/webhooks/1/a", name: "Test", high: null, low: null };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { createAlertSubscription: subscription } }),
      }),
    );

    await expect(createAlertSubscription("https://discord.com/api/webhooks/1/a", "Test", null, null)).resolves.toEqual({
      subscription,
      error: null,
    });
  });

  it("surfaces the GraphQL error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            errors: [{ message: "You already have an alert on that webhook - edit it instead." }],
          }),
      }),
    );

    const result = await createAlertSubscription("https://discord.com/api/webhooks/1/a", "Test", null, null);
    expect(result.subscription).toBeNull();
    expect(result.error).toBe("You already have an alert on that webhook - edit it instead.");
  });

  it("returns a generic error when the backend responds with an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      }),
    );

    const result = await createAlertSubscription("https://discord.com/api/webhooks/1/a", "Test", null, null);
    expect(result.subscription).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it("attaches the Authorization header when a session exists", async () => {
    mockSupabaseSession("test-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { createAlertSubscription: null }, errors: [{ message: "x" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createAlertSubscription("https://discord.com/api/webhooks/1/a", "Test", null, null);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-token");
  });
});

describe("updateAlertSubscription", () => {
  it("returns the updated subscription on success", async () => {
    const subscription = { id: 1, webhookUrl: "https://discord.com/api/webhooks/1/a", name: "New name", high: 500, low: null };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { updateAlertSubscription: subscription } }),
      }),
    );

    await expect(updateAlertSubscription(1, "New name", 500, null)).resolves.toEqual({ subscription, error: null });
  });

  it("surfaces the GraphQL error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ errors: [{ message: "No alert subscription with that id." }] }),
      }),
    );

    const result = await updateAlertSubscription(999, "Test", null, null);
    expect(result.subscription).toBeNull();
    expect(result.error).toBe("No alert subscription with that id.");
  });
});

describe("deleteAlertSubscription", () => {
  it("returns true on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { deleteAlertSubscription: true } }),
      }),
    );

    await expect(deleteAlertSubscription(1)).resolves.toBe(true);
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

    await expect(deleteAlertSubscription(1)).resolves.toBe(false);
  });

  it("attaches the Authorization header when a session exists", async () => {
    mockSupabaseSession("test-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { deleteAlertSubscription: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await deleteAlertSubscription(1);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-token");
  });
});
