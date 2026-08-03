import type { SensorSample } from "@/lib/activity-files/types";

const HEART_RATE_TYPE = "HKQuantityTypeIdentifierHeartRate";

export function parseAppleDate(value: string): Date | null {
  const normalized = value.replace(" ", "T").replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w-]+)="([^"]*)"/g)) result[match[1]] = match[2];
  return result;
}

export class AppleHealthHeartRateParser {
  private readonly decoder = new TextDecoder();
  private readonly values = new Map<string, number>();
  private buffer = "";

  constructor(private readonly startMilliseconds: number, private readonly endMilliseconds: number) {}

  push(chunk: Uint8Array, final = false): void {
    this.buffer += this.decoder.decode(chunk, { stream: !final });
    const tagPattern = /<[^>]+>/g;
    let lastCompleteTagEnd = 0;
    for (const match of this.buffer.matchAll(tagPattern)) {
      lastCompleteTagEnd = (match.index ?? 0) + match[0].length;
      if (!match[0].startsWith("<Record")) continue;
      const fields = attributes(match[0]);
      if (fields.type !== HEART_RATE_TYPE || fields.unit !== "count/min") continue;
      const date = parseAppleDate(fields.startDate);
      const value = Number(fields.value);
      if (!date || !Number.isFinite(value) || value <= 0 || value > 300) continue;
      const timestamp = date.getTime();
      if (timestamp < this.startMilliseconds || timestamp > this.endMilliseconds) continue;
      this.values.set(date.toISOString(), value);
    }
    if (lastCompleteTagEnd > 0) this.buffer = this.buffer.slice(lastCompleteTagEnd);
    if (this.buffer.length > 65_536) this.buffer = this.buffer.slice(Math.max(0, this.buffer.lastIndexOf("<")));
  }

  result(): SensorSample[] {
    return [...this.values.entries()].map(([timestamp, value]) => ({ timestamp, value })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}

export class AppleHealthHeartRateMultiRangeParser {
  private readonly decoder = new TextDecoder();
  private readonly ranges: Array<{ startMilliseconds: number; endMilliseconds: number; originalIndex: number }>;
  private readonly values: Array<Map<string, number>>;
  private buffer = "";

  constructor(ranges: { startMilliseconds: number; endMilliseconds: number }[]) {
    this.ranges = ranges.map((range, originalIndex) => ({ ...range, originalIndex })).sort((a, b) => a.startMilliseconds - b.startMilliseconds);
    this.values = ranges.map(() => new Map());
  }

  push(chunk: Uint8Array, final = false): void {
    this.buffer += this.decoder.decode(chunk, { stream: !final });
    const tagPattern = /<[^>]+>/g;
    let lastCompleteTagEnd = 0;
    for (const match of this.buffer.matchAll(tagPattern)) {
      lastCompleteTagEnd = (match.index ?? 0) + match[0].length;
      if (!match[0].startsWith("<Record")) continue;
      const fields = attributes(match[0]);
      if (fields.type !== HEART_RATE_TYPE || fields.unit !== "count/min") continue;
      const date = parseAppleDate(fields.startDate);
      const value = Number(fields.value);
      if (!date || !Number.isFinite(value) || value <= 0 || value > 300) continue;
      const timestamp = date.getTime();
      for (const range of this.ranges) {
        if (range.startMilliseconds > timestamp) break;
        if (range.endMilliseconds < timestamp) continue;
        this.values[range.originalIndex].set(date.toISOString(), value);
      }
    }
    if (lastCompleteTagEnd > 0) this.buffer = this.buffer.slice(lastCompleteTagEnd);
    if (this.buffer.length > 65_536) this.buffer = this.buffer.slice(Math.max(0, this.buffer.lastIndexOf("<")));
  }

  results(): SensorSample[][] {
    return this.values.map((values) => [...values.entries()].map(([timestamp, value]) => ({ timestamp, value })).sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
  }
}
