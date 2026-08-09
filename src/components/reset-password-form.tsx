"use client";

import { useActionState, useEffect, useRef, type FormEvent } from "react";
import { updateRecoveredPassword, type RecoveryActionState } from "@/app/auth/recovery-actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/recovery";

const initialState: RecoveryActionState = { status: "idle", message: "" };

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updateRecoveredPassword, initialState);
  const submitLocked = useRef(false);
  useEffect(() => { if (!pending) submitLocked.current = false; }, [pending]);
  function preventDuplicateSubmit(event: FormEvent<HTMLFormElement>) {
    if (submitLocked.current) event.preventDefault();
    else submitLocked.current = true;
  }
  const messageStyle = state.status === "warning" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-900";
  return <form action={formAction} onSubmit={preventDuplicateSubmit} aria-busy={pending} className="card p-5 sm:p-7" aria-describedby={state.message ? "password-message" : undefined}>
    <div className="space-y-4">
      <label htmlFor="new-password" className="block text-sm font-bold text-[var(--ink-soft)]">Neues Passwort
        <input id="new-password" type="password" name="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" className="mt-1.5 w-full rounded-xl border px-4 py-3" />
      </label>
      <label htmlFor="password-confirmation" className="block text-sm font-bold text-[var(--ink-soft)]">Passwort bestätigen
        <input id="password-confirmation" type="password" name="passwordConfirmation" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" className="mt-1.5 w-full rounded-xl border px-4 py-3" />
      </label>
    </div>
    {state.message ? <p id="password-message" role="alert" className={`mt-4 rounded-xl px-4 py-3 text-sm ${messageStyle}`}>{state.message}</p> : null}
    <button type="submit" disabled={pending} className="primary-button mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Passwort wird geändert …" : "Neues Passwort speichern"}</button>
  </form>;
}
