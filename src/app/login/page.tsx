import { redirect } from "next/navigation";
import { signIn, signUp } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type LoginPageProps = { searchParams: Promise<{ error?: string; message?: string }> };

export const metadata = { title: "Anmelden" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await getCurrentUser()) redirect("/dashboard");
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">UltraPilot Zugang</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Dein Training, dein Konto.</h1><p className="mt-2 text-[var(--muted)]">Melde dich an oder erstelle dein persönliches UltraPilot-Konto.</p></div>
      {params.error ? <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{params.error}</p> : null}
      {params.message ? <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{params.message}</p> : null}
      {!configured ? <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Supabase ist nicht konfiguriert. Die App läuft im Demo-Modus.</p> : null}
      <div className="grid gap-6 md:grid-cols-2">
        <AuthForm title="Anmelden" description="Mit einem vorhandenen Konto fortfahren." action={signIn} submitLabel="Anmelden" />
        <AuthForm title="Konto erstellen" description="Ein neues Konto für deine Aktivitäten anlegen." action={signUp} submitLabel="Registrieren" registration />
      </div>
    </div>
  );
}

function AuthForm({ title, description, action, submitLabel, registration = false }: { title: string; description: string; action: (formData: FormData) => Promise<void>; submitLabel: string; registration?: boolean }) {
  return (
    <form action={action} className="card p-6"><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-[var(--muted)]">{description}</p><div className="mt-5 space-y-4">
      {registration ? <label className="block text-sm font-medium">Name<input name="displayName" autoComplete="name" maxLength={100} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--accent)]" /></label> : null}
      <label className="block text-sm font-medium">E-Mail<input type="email" name="email" required autoComplete="email" className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--accent)]" /></label>
      <label className="block text-sm font-medium">Passwort<input type="password" name="password" required minLength={8} autoComplete={registration ? "new-password" : "current-password"} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--accent)]" /></label>
      <button type="submit" className="w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white hover:bg-[var(--accent-dark)]">{submitLabel}</button>
    </div></form>
  );
}
