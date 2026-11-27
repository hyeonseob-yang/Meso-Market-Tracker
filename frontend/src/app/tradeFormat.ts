// Trade Amounts travel as a count of 100M-meso units (see GLOSSARY.md: Amount).
const MILLIONS_PER_UNIT = 100;
const UNITS_PER_BILLION = 10;
// Tolerance for float error when checking a typed amount is a whole number of units.
const UNIT_EPSILON = 1e-9;

// "2.5" (billions) -> 25 units; null unless a positive multiple of 0.1B (100M).
export function parseAmountInBillions(input: string): number | null {
  const billions = Number(input);
  if (input.trim() === "" || !Number.isFinite(billions) || billions <= 0) return null;
  const exactUnits = billions * UNITS_PER_BILLION;
  const units = Math.round(exactUnits);
  return Math.abs(units - exactUnits) < UNIT_EPSILON ? units : null;
}

// 25 -> "2.5B", 5 -> "500M"
export function formatAmount(amount100m: number): string {
  if (amount100m < UNITS_PER_BILLION) return `${amount100m * MILLIONS_PER_UNIT}M`;
  return `${amount100m / UNITS_PER_BILLION}B`;
}

// 544 -> "+544", -530 -> "−530"
export function formatSigned(value: number): string {
  const magnitude = Math.abs(value).toLocaleString("en-US");
  if (value > 0) return `+${magnitude}`;
  if (value < 0) return `−${magnitude}`;
  return magnitude;
}
