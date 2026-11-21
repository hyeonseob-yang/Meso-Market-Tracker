"use client";

import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";

import { toUtcDisplayDate } from "../dateDisplay";

const MS_PER_MINUTE = 60 * 1000;
// Same threshold as the watchdog's stale-data Health Alert: one missed hourly Collector post.
export const STALE_AFTER_MINUTES = 60;
const REFRESH_INTERVAL_MS = MS_PER_MINUTE;

export function isReadingStale(datetime: string, now: number): boolean {
  return now - new Date(datetime).getTime() >= STALE_AFTER_MINUTES * MS_PER_MINUTE;
}

// Rendered only in the browser (after mount) and refreshed every minute, so the
// relative time never mismatches the server render or goes out of date.
export default function LastReading({ datetime }: { datetime: string | undefined }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (now === null) return null;

  if (datetime === undefined) {
    return <p className="text-sm font-medium text-red-600">No readings in this window</p>;
  }

  const isStale = isReadingStale(datetime, now);
  return (
    <p
      title={format(toUtcDisplayDate(datetime), "MMM d, yyyy HH:mm 'UTC'")}
      className={isStale ? "text-sm font-medium text-red-600" : "text-sm text-gray-500"}
    >
      Last reading: {formatDistanceToNow(new Date(datetime), { addSuffix: true })}
    </p>
  );
}
