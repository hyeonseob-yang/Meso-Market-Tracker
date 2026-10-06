import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// Called by the backend (schema.record_price) right after a successful
// insert, so the hour-long cache on fetchPrices gets busted the moment new
// data actually lands instead of waiting out its own timer. Secret-protected
// since this is an unauthenticated POST endpoint that busts the cache.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidate-secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidatePath("/");
  return NextResponse.json({ revalidated: true, now: Date.now() });
}
