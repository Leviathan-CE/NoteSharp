export type TimestampValue =
  | string
  | number
  | Date
  | null
  | undefined
  | {
      seconds?: number;
      nanoseconds?: number;
      _seconds?: number;
      _nanoseconds?: number;
    };

export function formatTimestamp(value: TimestampValue, fallback = "Unknown"): string {
  if (!value && value !== 0) {
    return fallback;
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString();
  }

  if (typeof value === "object") {
    const seconds = (value as Record<string, number | undefined>).seconds ?? (value as Record<string, number | undefined>)._seconds;
    const nanoseconds =
      (value as Record<string, number | undefined>).nanoseconds ?? (value as Record<string, number | undefined>)._nanoseconds ?? 0;

    if (typeof seconds === "number") {
      const millis = seconds * 1000 + Math.floor((nanoseconds || 0) / 1_000_000);
      return new Date(millis).toLocaleString();
    }
  }

  return fallback;
}
