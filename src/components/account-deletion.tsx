"use client";

import { useActionState, useEffect, useRef, type FormEvent } from "react";
import {
  requestAccountDeletion,
  type AccountDeletionActionState,
} from "@/app/settings/account-deletion-actions";
import { ACCOUNT_DELETION_CONFIRMATION } from "@/lib/account-deletion-shared";

const initialState: AccountDeletionActionState = { status: "idle", message: "" };

export function AccountDeletion() {
  const [state, action, pending] = useActionState(requestAccountDeletion, initialState);
  const submitLocked = useRef(false);
  useEffect(() => { if (!pending) submitLocked.current = false; }, [pending]);
  function preventDuplicateSubmit(event: FormEvent<HTMLFormElement>) {
    if (submitLocked.current) event.preventDefault();
    else submitLocked.current = true;
  }
  return <section className="card mt-6 max-w-4xl border border-red-200 p-6">
    <h2 className="text-lg font-bold text-red-800">Gefahrenbereich</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
      Die Löschung ist dauerhaft und nicht wiederherstellbar. Lade vorher im Datenexport eine Kopie deiner Daten herunter, wenn du sie behalten möchtest.
    </p>
    <form action={action} onSubmit={preventDuplicateSubmit} aria-busy={pending} className="mt-5 max-w-xl space-y-4">
      <label className="block text-sm font-semibold">
        Aktuelles Passwort
        <input type="password" name="password" required autoComplete="current-password" className="mt-1.5 w-full rounded-xl border px-4 py-3" />
      </label>
      <label className="block text-sm font-semibold">
        Gib zur Bestätigung exakt <strong>{ACCOUNT_DELETION_CONFIRMATION}</strong> ein
        <input type="text" name="confirmation" required autoComplete="off" className="mt-1.5 w-full rounded-xl border px-4 py-3" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full rounded-xl bg-red-700 px-5 py-3 font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Kontolöschung wird gestartet …" : "Konto dauerhaft löschen"}
      </button>
    </form>
    {state.message ? <p role="alert" aria-live="polite" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">{state.message}</p> : null}
  </section>;
}
