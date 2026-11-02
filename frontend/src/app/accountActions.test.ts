import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { fetchMe } from "./accountActions";

function mockSupabaseSession(accessToken: string | null) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: accessToken ? { access_token: accessToken } : null } }),
    },
  });
}

describe("fetchMe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches the Authorization header when a session exists", async () => {
    mockSupabaseSession("test-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { me: { id: "1", email: "a@b.com" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchMe();

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-token");
  });

  it("omits the Authorization header when there is no session", async () => {
    mockSupabaseSession(null);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { me: null } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchMe();

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("returns null when the backend responds with an HTTP error", async () => {
    mockSupabaseSession(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      }),
    );

    await expect(fetchMe()).resolves.toBeNull();
  });

  it("returns null when the response has no me data", async () => {
    mockSupabaseSession(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      }),
    );

    await expect(fetchMe()).resolves.toBeNull();
  });
});
