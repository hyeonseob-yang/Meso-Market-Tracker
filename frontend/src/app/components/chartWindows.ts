import { subDays, subMonths, subYears } from "date-fns";

export const WINDOWS = [
  { label: "1W", since: (now: Date) => subDays(now, 7) },
  { label: "1M", since: (now: Date) => subMonths(now, 1) },
  { label: "3M", since: (now: Date) => subMonths(now, 3) },
  { label: "1Y", since: (now: Date) => subYears(now, 1) },
  { label: "All", since: null },
] as const;

export type WindowLabel = (typeof WINDOWS)[number]["label"];

export const DEFAULT_WINDOW_LABEL: WindowLabel = "1M";

// Start of the window ending at `now`, or undefined for "All".
export function windowStart(label: WindowLabel, now: Date): Date | undefined {
  return WINDOWS.find((window) => window.label === label)?.since?.(now);
}
