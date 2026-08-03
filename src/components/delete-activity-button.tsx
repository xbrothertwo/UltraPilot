"use client";

import { deleteActivity } from "@/app/activities/actions";

export function DeleteActivityButton({ activityId, title }: { activityId: string; title: string }) {
  const action = deleteActivity.bind(null, activityId);
  return <form action={action} onSubmit={(event) => { if (!window.confirm(`„${title}“ wirklich dauerhaft löschen? Die Aktivitätsdateien, Messreihen, Ernährung und das Feedback werden ebenfalls gelöscht.`)) event.preventDefault(); }}><button type="submit" className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50">Aktivität löschen</button></form>;
}
