type StatCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <article className="card p-4 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[.1em] text-[var(--muted)]">{label}</p>
      <p className="mt-2.5 text-2xl font-black tracking-[-.03em] text-[var(--ink)] sm:mt-4 sm:text-3xl">{value}</p>
      <p className="mt-1.5 text-xs text-[var(--muted)]">{detail}</p>
    </article>
  );
}
