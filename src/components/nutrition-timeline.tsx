"use client";

import { useState } from "react";
import { addProductConsumption, updateNutritionTimelineEntry } from "@/app/activities/[id]/actions";
import type { NutritionEntry } from "@/lib/nutrition-analysis";
import type { NutritionProduct } from "@/lib/nutrition-planner";

const categoryStyle = { gel: "bg-amber-100 text-amber-950", bar: "bg-orange-100 text-orange-950", drink_mix: "bg-sky-100 text-sky-950", food: "bg-emerald-100 text-emerald-950", other: "bg-slate-100 text-slate-900" } as const;

function clock(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")} h`;
}

export function NutritionTimeline({ activityId, elapsedTimeSeconds, products, entries }: { activityId: string; elapsedTimeSeconds: number; products: NutritionProduct[]; entries: NutritionEntry[] }) {
  const [selectedSeconds, setSelectedSeconds] = useState(Math.min(3600, elapsedTimeSeconds));
  const [quantity, setQuantity] = useState("1");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const markers = entries.filter((entry) => entry.consumedAtSeconds !== null);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-slate-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-bold">Verpflegungs-Timeline</h3><p className="mt-1 text-xs text-[var(--muted)]">Zeitpunkt wählen und anschließend ein Produkt antippen.</p></div><div className="rounded-xl bg-white px-4 py-2 text-center shadow-sm"><span className="block text-xs text-[var(--muted)]">Ausgewählt</span><strong className="tabular-nums">{clock(selectedSeconds)}</strong></div></div>
      <div className="relative mt-8 pb-6">
        <div className="pointer-events-none absolute left-2 right-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-emerald-100" />
        {markers.map((entry) => <button key={entry.id} type="button" aria-label={`${entry.description} bei ${clock(entry.consumedAtSeconds!)}`} className={`absolute top-1/2 z-30 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${entry.entryMethod === "bottle_schedule" ? "bg-sky-500" : entry.productId ? "bg-amber-500" : "bg-slate-500"}`} style={{ left: `${Math.min(100, entry.consumedAtSeconds! / Math.max(1, elapsedTimeSeconds) * 100)}%` }} title={`${entry.description} · ${clock(entry.consumedAtSeconds!)}`} onClick={() => { setSelectedEntryId(entry.id); setSelectedSeconds(entry.consumedAtSeconds!); setQuantity(String(entry.quantity ?? 1)); }} />)}
        <input aria-label="Zeitpunkt auf der Aktivität" className="relative z-20 h-10 w-full cursor-pointer opacity-70 accent-[var(--accent)]" type="range" min="0" max={Math.max(1, elapsedTimeSeconds)} step="60" value={selectedSeconds} onChange={(event) => setSelectedSeconds(Number(event.target.value))} />
        <div className="absolute inset-x-0 bottom-0 flex justify-between text-xs text-[var(--muted)]"><span>Start</span><span>{clock(elapsedTimeSeconds)}</span></div>
      </div>
      {products.length ? <><label className="mt-5 block max-w-36 text-xs font-semibold">Menge / Portionen<input className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2" type="number" min="0.1" max="20" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <form key={product.id} action={addProductConsumption.bind(null, activityId)}><input type="hidden" name="productId" value={product.id} /><input type="hidden" name="consumedAtSeconds" value={selectedSeconds} /><input type="hidden" name="quantity" value={quantity} /><button type="submit" className={`w-full rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${categoryStyle[product.category]}`}><span className="font-bold">{product.name}</span><span className="mt-1 block text-xs opacity-75">{product.servingLabel} · {product.carbohydratesGrams} g KH · {product.sodiumMilligrams} mg Na</span></button></form>)}</div></> : <p className="mt-5 rounded-xl bg-white p-4 text-sm text-[var(--muted)]">Lege unten dein erstes Gel, einen Riegel oder ein anderes Produkt an.</p>}
      {selectedEntry && <div className="mt-5 rounded-xl border border-amber-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">Ausgewählt: {selectedEntry.description}</p><p className="mt-1 text-xs text-[var(--muted)]">Gelb: Produkt · Blau: abgeleiteter Flascheneintrag · Grau: freier Eintrag</p></div><button type="button" className="text-xs font-bold text-[var(--muted)]" onClick={() => setSelectedEntryId(null)}>Schließen</button></div>{selectedEntry.entryMethod === "bottle_schedule" ? <p className="mt-3 text-sm text-sky-900">Dieser Zeitpunkt wurde aus einem Flaschenplan abgeleitet. Ändere oder lösche deshalb den gesamten Flaschenplan.</p> : <form action={updateNutritionTimelineEntry.bind(null, activityId)} className="mt-3 flex flex-wrap items-end gap-3"><input type="hidden" name="entryId" value={selectedEntry.id} /><input type="hidden" name="consumedAtSeconds" value={selectedSeconds} /><label className="text-xs font-semibold">Neuer Zeitpunkt<span className="mt-1 block rounded-lg bg-slate-100 px-3 py-2 text-sm">{clock(selectedSeconds)}</span></label>{selectedEntry.productId && <label className="text-xs font-semibold">Portionen<input className="mt-1 w-24 rounded-lg border border-[var(--line)] px-3 py-2 text-sm" name="quantity" type="number" min="0.1" max="20" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>}<button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white" type="submit">Änderung speichern</button><button type="button" className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-bold" onClick={() => { setSelectedSeconds(selectedEntry.consumedAtSeconds ?? 0); setQuantity(String(selectedEntry.quantity ?? 1)); }}>Zurücksetzen</button></form>}</div>}
    </div>
  );
}
