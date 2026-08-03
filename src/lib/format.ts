export function formatDistance(meters: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(meters / 1000) + " km";
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${minutes.toString().padStart(2, "0")} h`;
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(new Date(isoDate));
}
