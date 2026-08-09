import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { hasRecoveryAuthentication } from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Neues Passwort festlegen" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const claimsResult = supabase ? await supabase.auth.getClaims() : null;
  const hasRecoverySession = Boolean(
    claimsResult
    && !claimsResult.error
    && claimsResult.data?.claims?.sub
    && hasRecoveryAuthentication(claimsResult.data.claims),
  );
  return <div className="mx-auto max-w-lg py-8 sm:py-14">
    <p className="eyebrow">Konto wiederherstellen</p>
    <h1 className="mt-2 text-3xl font-black tracking-tight">Neues Passwort festlegen</h1>
    {hasRecoverySession ? <>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Wähle ein neues Passwort mit mindestens acht Zeichen.</p>
      <div className="mt-6"><ResetPasswordForm /></div>
    </> : <div className="card mt-6 p-5 sm:p-7">
      <p role="alert" className="text-sm leading-6 text-red-900">Dieser Link ist ungültig oder abgelaufen. Bitte fordere eine neue Reset-Mail an.</p>
      <Link href="/auth/forgot-password" className="primary-button mt-5 inline-flex">Neue Reset-Mail anfordern</Link>
    </div>}
  </div>;
}
