import { renameActivity } from "@/app/activities/actions";

export function RenameActivityForm({ activityId, title }: { activityId: string; title: string }) {
  const action = renameActivity.bind(null, activityId);
  return <details className="relative">
    <summary className="cursor-pointer list-none rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-bold hover:border-[var(--accent)]">Umbenennen</summary>
    <form action={action} className="absolute right-0 top-12 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[var(--line)] bg-white p-4 shadow-2xl">
      <label htmlFor="activity-title" className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Name der Aktivität</label>
      <input id="activity-title" name="title" type="text" required maxLength={200} defaultValue={title} autoFocus className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 focus:border-[var(--accent)]" />
      <button type="submit" className="mt-3 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--accent-dark)]">Namen speichern</button>
    </form>
  </details>;
}
