import type { ZoneTime } from "@/lib/training-zones";
import { formatDuration } from "@/lib/format";

type ZoneDistributionProps = {
  title: string;
  unit: string;
  zones: ZoneTime[];
};

function rangeLabel(zone: ZoneTime, unit: string): string {
  if (zone.lower === null) return `bis ${zone.upper} ${unit}`;
  if (zone.upper === null) return `ab ${zone.lower} ${unit}`;
  return `${zone.lower}–${zone.upper} ${unit}`;
}

export function ZoneDistribution({ title, unit, zones }: ZoneDistributionProps) {
  const recordedSeconds = zones.reduce((sum, zone) => sum + zone.seconds, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-bold">{title}</h3>
        <span className="text-xs text-[var(--muted)]">{formatDuration(recordedSeconds)} erfasst</span>
      </div>
      <div className="mt-4 space-y-3">
        {zones.map((zone) => (
          <div key={zone.name} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 text-sm">
            <span className="font-bold">{zone.name}</span>
            <div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ backgroundColor: zone.color, width: `${Math.max(0, Math.min(100, zone.percentage))}%` }} />
              </div>
              <span className="mt-1 block text-xs text-[var(--muted)]">{rangeLabel(zone, unit)}</span>
            </div>
            <span className="min-w-24 text-right tabular-nums">{Math.round(zone.percentage)} % · {formatDuration(zone.seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
