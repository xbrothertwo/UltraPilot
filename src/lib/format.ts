export function formatDistance(meters: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(meters / 1000) + " km";
}

export function formatPace(speedKmh: number | null): string {
  if (speedKmh === null || !Number.isFinite(speedKmh) || speedKmh <= 0) return "–";
  const totalSecondsPerKilometer = Math.round(3600 / speedKmh);
  const minutes = Math.floor(totalSecondsPerKilometer / 60);
  const seconds = totalSecondsPerKilometer % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} min/km`;
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${minutes.toString().padStart(2, "0")} h`;
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(new Date(isoDate));
}

export function splitPlanReasons(summary: string, caution: string | null): string[] {
  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return caution ? [...sentences, caution.trim()] : sentences;
}
