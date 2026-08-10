import type { HTMLAttributes, ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-2xl">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="font-display mt-1 text-4xl leading-tight text-[var(--ink)] sm:text-5xl">{title}</h1>{description && <p className="mt-2 max-w-[62ch] text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p>}</div>{actions}</header>;
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-[var(--ink)]">{title}</h2>{description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}</div>{action}</div>;
}

export function Surface({ className = "", children, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`card p-5 sm:p-6 ${className}`} {...props}>{children}</section>;
}

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="min-w-0"><p className="text-xs font-medium text-[var(--muted)]">{label}</p><p className="font-data mt-1 break-words text-xl font-bold tabular-nums text-[var(--ink)]">{value}</p>{hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}</div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const styles = { neutral: "bg-[var(--surface-raised)] text-[var(--ink-soft)]", success: "bg-[var(--success-soft)] text-[var(--success)]", warning: "bg-[var(--warning-soft)] text-[var(--warning)]", danger: "bg-[var(--danger-soft)] text-[var(--danger)]" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>;
}

export function Progress({ value, label }: { value: number; label: string }) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return <div><div className="mb-2 flex justify-between text-xs text-[var(--muted)]"><span>{label}</span><span className="font-data tabular-nums">{Math.round(safe)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--accent-soft)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${safe}%` }} /></div></div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-5"><p className="font-bold text-[var(--ink)]">{title}</p><p className="mt-1 text-sm text-[var(--muted)]">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

export function InlineAlert({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const styles = { neutral: "border-[var(--line)] bg-[var(--surface)]", success: "border-[var(--success)]/25 bg-[var(--success-soft)]", warning: "border-[var(--warning)]/25 bg-[var(--warning-soft)]", danger: "border-[var(--danger)]/25 bg-[var(--danger-soft)]" };
  return <div role={tone === "danger" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm font-medium ${styles[tone]}`}>{children}</div>;
}
