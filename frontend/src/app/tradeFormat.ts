// Trade Amounts are entered, shown and stored in 100M-meso units, as in the game.

// "25" -> 25; null unless a whole number of units above zero.
export function parseAmount100m(input: string): number | null {
  const units = Number(input);
  if (input.trim() === "" || !Number.isInteger(units) || units < 1) return null;
  return units;
}

// 25 -> "25 × 100M"
export function formatAmount(amount100m: number): string {
  return `${amount100m.toLocaleString("en-US")} × 100M`;
}

// 544 -> "+544", -530 -> "−530"
export function formatSigned(value: number): string {
  const magnitude = Math.abs(value).toLocaleString("en-US");
  if (value > 0) return `+${magnitude}`;
  if (value < 0) return `−${magnitude}`;
  return magnitude;
}
