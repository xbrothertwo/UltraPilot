"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardTrend } from "@/lib/dashboard-analysis";

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00Z`));
}

export function DashboardCharts({ trend }: { trend: DashboardTrend[] }) {
  if (!trend.length) return null;
  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-2">
      <article className="card p-5"><h2 className="font-bold">Trainingsumfang</h2><p className="mt-1 text-xs text-[var(--muted)]">Bewegungsstunden und Distanz pro Tag</p><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}><CartesianGrid stroke="#e5ebe7" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="date" tickFormatter={dateLabel} tick={{ fill: "#66736b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis yAxisId="hours" tick={{ fill: "#66736b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis yAxisId="distance" orientation="right" tick={{ fill: "#66736b", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={(label) => dateLabel(String(label))} formatter={(value, name) => name === "Bewegung" ? [`${Number(value).toFixed(1)} h`, name] : [`${Number(value).toFixed(1)} km`, name]} contentStyle={{ border: "1px solid #dfe6e1", borderRadius: 12 }} /><Legend /><Bar yAxisId="hours" dataKey="movingHours" name="Bewegung" fill="#167a4a" radius={[5, 5, 0, 0]} /><Bar yAxisId="distance" dataKey="distanceKilometers" name="Distanz" fill="#80b99c" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></article>
      <article className="card p-5"><h2 className="font-bold">Versorgungstrend</h2><p className="mt-1 text-xs text-[var(--muted)]">Protokollierte Kohlenhydrate pro Bewegungsstunde</p><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}><CartesianGrid stroke="#e5ebe7" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="date" tickFormatter={dateLabel} tick={{ fill: "#66736b", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis unit=" g" tick={{ fill: "#66736b", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={(label) => dateLabel(String(label))} formatter={(value) => [`${Number(value).toFixed(1)} g/h`, "Kohlenhydrate"]} contentStyle={{ border: "1px solid #dfe6e1", borderRadius: 12 }} /><Line type="monotone" dataKey="carbohydratesPerHour" name="Kohlenhydrate" stroke="#d58b25" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></article>
    </section>
  );
}
