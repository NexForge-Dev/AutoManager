"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

const COMECAR = "/login";

export default function StickyCta() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisivel(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-default bg-[var(--bg)]/95 p-3 backdrop-blur transition-transform duration-300 sm:hidden ${
        visivel ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <Link href={COMECAR} className="btn-primary w-full px-5 py-3.5 text-base">
        Começar Teste Grátis <ArrowRight size={18} />
      </Link>
      <p className="mt-1.5 text-center text-xs text-muted">
        Sem cartão · configuração em 2 minutos
      </p>
    </div>
  );
}
