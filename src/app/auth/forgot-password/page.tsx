import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

type ForgotPasswordPageProps = { searchParams: Promise<{ error?: string }> };

export const metadata = { title: "Passwort zurücksetzen" };

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  return <div className="mx-auto max-w-lg py-8 sm:py-14">
    <p className="eyebrow">Konto wiederherstellen</p>
    <h1 className="mt-2 text-3xl font-black tracking-tight">Passwort zurücksetzen</h1>
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Gib deine E-Mail-Adresse ein. Wenn ein Konto existiert, erhältst du einen Link zum Festlegen eines neuen Passworts.</p>
    {params.error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{params.error}</p> : null}
    <div className="mt-6"><ForgotPasswordForm /></div>
    <p className="mt-5 text-center text-sm"><Link href="/login" className="font-bold text-blue-700 hover:underline">Zurück zur Anmeldung</Link></p>
  </div>;
}
