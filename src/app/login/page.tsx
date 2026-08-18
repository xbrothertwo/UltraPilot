import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, signUp } from "@/app/auth/actions";
import { getLoginFeedback } from "@/lib/auth/login-feedback";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/recovery";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ThemeToggle } from "@/components/theme-toggle";

type LoginPageProps = { searchParams: Promise<{ error?: string; notice?: string; message?: string }> };

export const metadata = { title: "Anmelden" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await getCurrentUser()) redirect("/dashboard");
  const params = await searchParams;
  const feedback = getLoginFeedback(params.error, params.notice);
  const configured = isSupabaseConfigured();
  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-5 sm:px-6 sm:py-7 lg:px-10 lg:py-10">
    <div className="mb-3 flex justify-end"><ThemeToggle showLabel className="secondary-button !min-h-10 !px-3 !py-2 text-xs" /></div>
    <section className="relative mb-5 overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-[var(--card-glass)] p-6 shadow-[0_24px_60px_var(--shadow-color)] sm:p-10">
      <div className="absolute -right-24 -top-28 size-80 rounded-full bg-[var(--accent-soft)] opacity-70" />
      <div className="relative max-w-2xl"><p className="eyebrow">Dein persönliches Trainingssystem</p><h1 className="mt-3 text-4xl font-black leading-[1.02] tracking-[-.05em] text-[var(--ink)] sm:text-6xl">
  Dein Training.<br/>
  <span className="text-[var(--accent)]">Dein echtes Leben.</span>
</h1>
<p className="mt-5 max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
  Laufen, Radfahren und Krafttraining in einem Plan – angepasst an Alltag, Erholung und tatsächliche Leistung.
</p> <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-[var(--ink-soft)]"><span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">Regelbasiert</span><span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">Nachvollziehbar</span><span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">Nur für dich</span></div></div>
    </section>
    {feedback?.kind === "error" ? <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{feedback.text}</p> : null}
    {feedback?.kind === "notice" ? <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{feedback.text}</p> : null}
    {!configured ? <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Supabase ist nicht konfiguriert. Die App läuft im Demo-Modus.</p> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <AuthForm title="Konto erstellen" description="In wenigen Minuten zu deinem ersten persönlichen Plan." action={signUp} submitLabel="Kostenlos starten" registration primary />
      <AuthForm title="Willkommen zurück" description="Du hast bereits ein Konto? Hier geht es weiter." action={signIn} submitLabel="Anmelden" />
    </div>
  </main>;
}

function AuthForm({ title, description, action, submitLabel, registration = false, primary = false }: { title: string; description: string; action: (formData: FormData) => Promise<void>; submitLabel: string; registration?: boolean; primary?: boolean }) {
  return <form action={action} className={`card p-5 sm:p-7 ${primary ? "ring-1 ring-[var(--accent)]/30" : ""}`}><div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl text-sm font-black ${primary ? "bg-[var(--accent)] text-[var(--button-primary-text)]" : "bg-[var(--surface-raised)] text-[var(--accent)]"}`}>{primary ? "+" : "→"}</span><div><h2 className="text-xl font-black">{title}</h2><p className="mt-0.5 text-sm text-[var(--muted)]">{description}</p></div></div><div className="mt-6 space-y-4">
    {registration ? <label className="block text-sm font-bold text-[var(--ink-soft)]">Name<input name="displayName" autoComplete="name" maxLength={100} className="mt-1.5 w-full rounded-xl border px-4 py-3" /></label> : null}
    <label className="block text-sm font-bold text-[var(--ink-soft)]">E-Mail<input type="email" name="email" required autoComplete="email" className="mt-1.5 w-full rounded-xl border px-4 py-3" /></label>
    <label className="block text-sm font-bold text-[var(--ink-soft)]">Passwort<input type="password" name="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete={registration ? "new-password" : "current-password"} className="mt-1.5 w-full rounded-xl border px-4 py-3" /></label>
    {!registration ? <div className="text-right"><Link href="/auth/forgot-password" className="text-sm font-bold text-[var(--accent)] hover:underline">Passwort vergessen?</Link></div> : null}
    <button type="submit" className={primary ? "primary-button w-full" : "secondary-button w-full"}>{submitLabel}</button>
  </div></form>;
}
