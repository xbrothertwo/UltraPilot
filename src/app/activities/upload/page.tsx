import { PageHeading } from "@/components/page-heading";
import { UploadForm } from "@/components/upload-form";
import { isDemoMode } from "@/lib/demo-data";
import { requireUser } from "@/lib/supabase/auth";

export const metadata = { title: "Aktivitäten importieren" };
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  if (!isDemoMode) await requireUser();
  return <>
    <PageHeading eyebrow="Schneller Import" title="Eine Fahrt oder gleich zwanzig." description="Importiere mehrere Garmin-Aktivitäten gemeinsam und ergänze auf Wunsch die passenden Apple-Watch-Pulswerte aus einem einzigen Health-Export." />
    <UploadForm />
  </>;
}
