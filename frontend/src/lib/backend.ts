import { logError } from "@/lib/cloudwatch";

// POSTs a GraphQL request to the backend. Returns null if the backend can't
// be reached at all (fetch throws), instead of an HTTP error response.
export async function postToBackend(headers: Record<string, string>, body: unknown): Promise<Response | null> {
  try {
    return await fetch(`${process.env.BACKEND_URL}/price`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    await logError("backend unreachable", String(error));
    return null;
  }
}
