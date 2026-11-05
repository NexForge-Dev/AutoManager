"use client";
import { useEffect } from "react";

// Registra o service worker da tela offline (public/sw.js). Só em produção: no `next dev`
// ele atrapalharia o recarregamento.
export default function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
