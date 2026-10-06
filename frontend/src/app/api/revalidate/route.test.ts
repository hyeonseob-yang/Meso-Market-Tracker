import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.stubEnv("REVALIDATE_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    revalidatePath.mockClear();
  });

  function request(headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost/api/revalidate", {
      method: "POST",
      headers,
    });
  }

  it("rejects a request with no secret header", async () => {
    const { POST } = await import("./route");
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong secret", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ "x-revalidate-secret": "wrong" }));
    expect(response.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects every request when REVALIDATE_SECRET isn't configured", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");
    const { POST } = await import("./route");
    const response = await POST(request({ "x-revalidate-secret": "" }));
    expect(response.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates '/' when the secret matches", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ "x-revalidate-secret": "test-secret" }));
    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
