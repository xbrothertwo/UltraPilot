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
    <PageHeading eyebrow="Schneller Import" title="Dein Training. Egal auf welchem Gerät." description="Importiere Radfahrten und Läufe aus GPX oder FIT — dem geräteunabhängigen Standardweg für Garmin, Polar, Apple Watch und praktisch jede andere Sport-App. Enthaltene Herzfrequenzdaten werden automatisch erkannt und ausgewertet." />
    <div className="mb-4"><p className="eyebrow">Radfahren & Laufen</p><h2 className="mt-2 text-2xl font-black tracking-[-.03em]">GPX- und FIT-Dateien importieren</h2><p className="mt-1 text-sm text-[var(--muted)]">Jeder Nutzer sieht ausschließlich die Aktivitäten seines eigenen Kontos. Wähle beim Import einfach die passende Sportart.</p></div>
    <UploadForm />
    <p className="eyebrow mb-3 mt-10">Weitere Importwege</p>
    <AppleHealthWorkoutImport />
  </>;
}
