// date-fns' format() reads a Date's LOCAL fields - shifting by the running
// machine's own offset first makes it read the original UTC fields instead,
// so server and client (different local timezones) always render identical text.
export function toUtcDisplayDate(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000);
}
