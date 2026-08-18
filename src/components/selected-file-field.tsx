"use client";

import { useId, useRef, useState } from "react";
import { activityFileType, formatFileSize } from "@/lib/activity-import";

type Props = {
  name: string;
  title: string;
  hint: string;
  accept: string;
  required?: boolean;
  multiple?: boolean;
  onFilesChange?: (files: File[]) => void;
};

export function SelectedFileField({ name, title, hint, accept, required = false, multiple = false, onFilesChange }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  const publish = (nextFiles: File[]) => {
    setFiles(nextFiles);
    onFilesChange?.(nextFiles);
  };
  const remove = (index: number) => {
    const nextFiles = files.filter((_, fileIndex) => fileIndex !== index);
    if (inputRef.current) {
      const transfer = new DataTransfer();
      for (const file of nextFiles) transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }
    publish(nextFiles);
  };

  return <div className="mt-5 min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><label htmlFor={id} className="font-black">{title}</label><p id={`${id}-hint`} className="mt-1 text-xs leading-5 text-[var(--muted)]">{hint}</p></div><button type="button" onClick={() => inputRef.current?.click()} className="secondary-button shrink-0">{files.length ? "Ersetzen" : multiple ? "Dateien auswählen" : "Datei auswählen"}</button></div>
    <input ref={inputRef} id={id} name={name} type="file" accept={accept} required={required} multiple={multiple} aria-describedby={`${id}-hint`} onChange={(event) => publish(Array.from(event.currentTarget.files ?? []))} className="sr-only" />
    {files.length > 0 && <ul aria-label={`Ausgewählte Dateien für ${title}`} className="mt-4 space-y-2">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-400/20 dark:bg-emerald-400/10"><span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-black text-white">✓</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{file.name}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{activityFileType(file.name)} · {formatFileSize(file.size)} · bereit zum Import</p></div><button type="button" onClick={() => remove(index)} aria-label={`${file.name} entfernen`} className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-black text-[var(--muted)] outline-none hover:bg-[var(--surface-strong)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Entfernen</button></li>)}</ul>}
  </div>;
}
