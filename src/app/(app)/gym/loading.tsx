export default function GymLoading() {
  return <div role="status" aria-live="polite" className="space-y-5">
    <span className="sr-only">Gym-Bereich wird geladen</span>
    <div className="h-28 animate-pulse rounded-[1.5rem] bg-[var(--surface)] motion-reduce:animate-none" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-[1.5rem] bg-[var(--surface)] motion-reduce:animate-none" />)}
    </div>
  </div>;
}
