"use client";

import { useEffect, useState } from "react";

export function RestTimer({ defaultSeconds }: { defaultSeconds: number }) {
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = window.setTimeout(() => {
      setRemaining((value) => Math.max(0, value - 1));
      if (remaining <= 1) setRunning(false);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [running, remaining]);
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  return <div className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2" aria-live="polite"><strong className="min-w-14 tabular-nums">{minutes}:{seconds}</strong><button type="button" onClick={() => { if (remaining === 0) setRemaining(defaultSeconds); setRunning((value) => !value); }} className="min-h-11 rounded-lg px-3 text-xs font-black text-[var(--accent-dark)]">{running ? "Pause" : "Start"}</button><button type="button" onClick={() => setRemaining((value) => Math.min(3600, value + 30))} className="min-h-11 rounded-lg px-2 text-xs font-bold">+30 s</button><button type="button" onClick={() => { setRemaining(0); setRunning(false); }} className="min-h-11 rounded-lg px-2 text-xs font-bold text-[var(--muted)]">Skip</button></div>;
}
