import { PageHeading } from "@/components/page-heading";
import { UploadForm } from "@/components/upload-form";
import { AppleHealthWorkoutImport } from "@/components/apple-health-workout-import";
import { isDemoMode } from "@/lib/demo-data";
import { requireUser } from "@/lib/supabase/auth";

export const metadata = { title: "Aktivitäten importieren" };
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  if (!isDemoMode) await requireUser();
  return <>
    <PageHeading eyebrow="Schneller Import" title="Dein Training. Egal auf welchem Gerät." description="Übernimm Watch-Workouts automatisch oder importiere deine Garmin-Radfahrten mit den passenden Apple-Watch-Pulswerten." />
    <AppleHealthWorkoutImport />
    <div className="mb-4 mt-8"><p className="eyebrow">Radfahren · Garmin bleibt führend</p><h2 className="mt-2 text-2xl font-black tracking-[-.03em]">FIT- und GPX-Dateien importieren</h2><p className="mt-1 text-sm text-[var(--muted)]">Dieser Bereich bleibt für deine selbst gepflegten Radfahrten. Der Health-Workout-Import darüber legt niemals Radaktivitäten an.</p></div>
    <UploadForm />
  </>;
}
