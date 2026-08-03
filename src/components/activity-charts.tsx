"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActivityChartStream } from "@/lib/activity-streams";
import type { NutritionEntry } from "@/lib/nutrition-analysis";

const chartConfig = {
  heart_rate: { label: "Herzfrequenz", color: "#dc5a52", decimals: 0 },
  power: { label: "Leistung", color: "#7b61c9", decimals: 0 },
  cadence: { label: "Kadenz", color: "#d58b25", decimals: 0 },
  speed: { label: "Geschwindigkeit", color: "#2878a8", decimals: 1 },
  altitude: { label: "Höhe", color: "#25875a", decimals: 0 },
} as const;

const sourceLabels = { garmin_edge: "Garmin Edge", apple_watch: "Apple Watch", gpx: "GPX" } as const;

function elapsedLabel(minutes: number): string {
  const totalMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return hours ? `${hours}:${remainder.toString().padStart(2, "0")} h` : `${remainder} min`;
}

function chartValue(value: number, unit: ActivityChartStream["unit"], decimals: number): string {
  if (unit !== "min/km") return Number(value).toFixed(decimals);
  const totalSeconds = Math.round(Number(value) * 60);
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

export function ActivityCharts({ streams, nutritionEntries = [], elapsedTimeSeconds = 0 }: { streams: ActivityChartStream[]; nutritionEntries?: NutritionEntry[]; elapsedTimeSeconds?: number }) {
  if (!streams.length) return (
    <section className="card mt-6 p-8 text-center">
      <h2 className="text-lg font-bold">Noch keine Zeitreihen verfügbar</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Ältere Demo- oder GPX-Aktivitäten besitzen möglicherweise nur zusammengefasste Kennzahlen.</p>
    </section>
  );

  return (
    <section className="mt-6">
      <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">Synchronisierte Zeitachse</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Verlauf der Aktivität</h2><p className="mt-1 text-sm text-[var(--muted)]">Bewege den Mauszeiger über ein Diagramm, um denselben Zeitpunkt in den anderen Ansichten zu verfolgen.</p></div>
      <div className="grid gap-5 lg:grid-cols-2">
        {streams.map((stream) => <StreamChart key={`${stream.type}-${stream.source}`} stream={stream} />)}
      </div>
      {nutritionEntries.some((entry) => entry.consumedAtSeconds !== null) && <div className="card mt-5 p-5"><div className="flex items-baseline justify-between gap-3"><h3 className="font-bold">Verpflegung auf der Zeitachse</h3><span className="text-xs text-[var(--muted)]">Gelb: Produkt · Blau: Flasche · Grau: frei</span></div><div className="relative mt-6 h-12"><div className="absolute inset-x-0 top-4 h-1 rounded-full bg-slate-200" />{nutritionEntries.filter((entry) => entry.consumedAtSeconds !== null).map((entry) => <span key={entry.id} className={`absolute top-1 size-7 -translate-x-1/2 rounded-full border-2 border-white shadow ${entry.entryMethod === "bottle_schedule" ? "bg-sky-500" : entry.productId ? "bg-amber-500" : "bg-blue-50/450"}`} style={{ left: `${Math.min(100, entry.consumedAtSeconds! / Math.max(1, elapsedTimeSeconds) * 100)}%` }} title={`${entry.description} · ${elapsedLabel(entry.consumedAtSeconds! / 60)}`} />)}<span className="absolute bottom-0 left-0 text-xs text-[var(--muted)]">Start</span><span className="absolute bottom-0 right-0 text-xs text-[var(--muted)]">{elapsedLabel(elapsedTimeSeconds / 60)}</span></div></div>}
    </section>
  );
}

function StreamChart({ stream }: { stream: ActivityChartStream }) {
  const config = chartConfig[stream.type];
  const gradientId = `gradient-${stream.type}-${stream.source}`;
  return (
    <article className={`card overflow-hidden p-5 ${stream.type === "heart_rate" || stream.type === "altitude" ? "lg:col-span-2" : ""}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-bold">{config.label}</h3><p className="mt-1 text-xs text-[var(--muted)]">{stream.originalSampleCount.toLocaleString("de-DE")} Samples · {Math.round(stream.coveragePercent)} % Zeitabdeckung</p></div>
        <span className="rounded-full bg-[#e9f0fb] px-3 py-1 text-xs font-semibold text-[var(--accent-dark)]">{sourceLabels[stream.source]}</span>
      </div>
      <div className="h-56 w-full" role="img" aria-label={`${config.label} über die verstrichene Zeit, Quelle ${sourceLabels[stream.source]}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stream.points} syncId="activity-timeline" syncMethod="value" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={config.color} stopOpacity={0.28} /><stop offset="95%" stopColor={config.color} stopOpacity={0.02} /></linearGradient></defs>
            <CartesianGrid stroke="#e3ebf6" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="elapsedMinutes" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value) => elapsedLabel(Number(value))} tick={{ fill: "#65758b", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis width={48} domain={["auto", "auto"]} tick={{ fill: "#65758b", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => chartValue(Number(value), stream.unit, config.decimals)} />
            <Tooltip labelFormatter={(value) => elapsedLabel(Number(value))} formatter={(value) => [`${chartValue(Number(value), stream.unit, config.decimals)} ${stream.unit}`, config.label]} contentStyle={{ border: "1px solid #dce6f2", borderRadius: "12px", boxShadow: "0 8px 24px rgba(35,62,45,.1)" }} />
            <Area type="monotone" dataKey="value" name={config.label} stroke={config.color} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
