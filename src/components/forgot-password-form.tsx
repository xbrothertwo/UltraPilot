"use client";

import { useActionState, useEffect, useRef, type FormEvent } from "react";
import { requestPasswordRecovery, type RecoveryActionState } from "@/app/auth/recovery-actions";

const initialState: RecoveryActionState = { status: "idle", message: "" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordRecovery, initialState);
  const submitLocked = useRef(false);
  useEffect(() => { if (!pending) submitLocked.current = false; }, [pending]);
  function preventDuplicateSubmit(event: FormEvent<HTMLFormElement>) {
    if (submitLocked.current) event.preventDefault();
    else submitLocked.current = true;
  }
  return <form action={formAction} onSubmit={preventDuplicateSubmit} aria-busy={pending} className="card p-5 sm:p-7" aria-describedby={state.message ? "recovery-message" : undefined}>
    <label htmlFor="recovery-email" className="block text-sm font-bold text-[var(--ink-soft)]">E-Mail-Adresse</label>
    <input id="recovery-email" type="email" name="email" required autoComplete="email" className="mt-1.5 w-full rounded-xl border px-4 py-3" />
    {state.message ? <p id="recovery-message" role={state.status === "error" ? "alert" : "status"} className={`mt-4 rounded-xl px-4 py-3 text-sm ${state.status === "error" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}>{state.message}</p> : null}
    <button type="submit" disabled={pending} className="primary-button mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Reset-Link wird versendet …" : "Reset-Link anfordern"}</button>
  </form>;
}
