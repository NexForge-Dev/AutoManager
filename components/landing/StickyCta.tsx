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
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-default bg-[var(--bg)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 transition-transform duration-300 sm:hidden ${
        visivel ? "translate-y-0" : "invisible translate-y-full"
      }`}
    >
      <Link href={COMECAR} className="btn-primary w-full">
        Criar minha loja grátis <ArrowRight size={18} aria-hidden />
      </Link>
    </div>
  );
}
