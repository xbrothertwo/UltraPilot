type StatCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <article className="card relative overflow-hidden p-4 sm:p-6">
      <span aria-hidden className="absolute -right-8 -top-8 size-20 rounded-full bg-blue-100/60" />
      <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-[.1em] text-[var(--muted)]"><span className="size-1.5 rounded-full bg-cyan-400" />{label}</p>
      <p className="mt-2.5 text-2xl font-black tracking-[-.03em] text-[var(--ink)] sm:mt-4 sm:text-3xl">{value}</p>
      <p className="mt-1.5 text-xs text-[var(--muted)]">{detail}</p>
    </article>
  );
}
