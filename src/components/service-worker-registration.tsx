"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Die App bleibt vollständig nutzbar, wenn ein Browser Service Worker blockiert.
    });
  }, []);
  return null;
}
