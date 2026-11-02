"use client";
import { createContext, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { aplicarAparencia, aplicarFavicon, temaDoUsuario } from "@/lib/aparencia";
import { homeDe, podeAcessar } from "@/lib/permissoes";
import { destinoPosLogin } from "@/lib/destinoPosLogin";
import { registrarSessao } from "@/lib/metricas/cliente";
import AppShell from "./AppShell";
import { DialogProvider } from "./Dialog";
import { Skeleton, SkeletonMetrics, SkeletonList } from "./Skeleton";

// Sinaliza que já existe um Guard/AppShell montado acima (layout persistente).
// Assim o <Guard> que cada página ainda usa vira passthrough e não remonta a shell.
const GuardMontado = createContext(false);

export default function Guard({ children }: { children: React.ReactNode }) {
  const jaMontado = useContext(GuardMontado);
  const router = useRouter();
  const path = usePathname();
  const ready = useStore((s) => s.ready);
  const hydrate = useStore((s) => s.hydrate);
  const completo = useStore((s) => s.config.onboardingCompleto);
  const corMarca = useStore((s) => s.config.corMarca);
  const temaBase = useStore((s) => s.config.temaBase);
  const appFonte = useStore((s) => s.config.appFonte);
  const appRaio = useStore((s) => s.config.appRaio);
  const logoUrl = useStore((s) => s.config.logoUrl);
  const nomeLoja = useStore((s) => s.config.nomeLoja);
  const role = useStore((s) => s.role);
  const semOrg = useStore((s) => s.semOrg);
  const usuarioId = useStore((s) => s.usuarioId);
  const superadmin = useStore((s) => s.superadmin);
  // super-admin sem loja própria abre o /admin sem a shell da loja (não há loja para mostrar)
  const adminSemLoja = superadmin && semOrg && (path === "/admin" || path.startsWith("/admin/"));

  useEffect(() => {
    if (jaMontado) return;
    if (!ready) hydrate();
  }, [jaMontado, ready, hydrate]);

  // volta ao app já logado (sem passar pelo /login): também é session_started
  // (uma vez por sessão do navegador; o login já marca, então não duplica)
  useEffect(() => {
    if (jaMontado || !ready || semOrg || !usuarioId) return;
    registrarSessao(usuarioId);
  }, [jaMontado, ready, semOrg, usuarioId]);

  useEffect(() => {
    if (jaMontado) return;
    if (!ready) return; // antes de hidratar vale o cache anti-flash (já com a escolha do usuário)
    // claro/escuro escolhido pelo usuário no Perfil vale por cima do tema da loja
    aplicarAparencia({ corMarca, temaBase: temaDoUsuario(usuarioId, temaBase), appFonte, appRaio });
  }, [jaMontado, ready, usuarioId, corMarca, temaBase, appFonte, appRaio]);

  // ícone da aba (favicon) = logo da loja; troca sozinho quando o dono muda a logo.
  // E de novo (só o ícone) a cada rota: o Next reinsere os ícones do metadata no <head> ao navegar,
  // e o nosso link (só ele é movido) volta para o fim para continuar valendo.
  useEffect(() => {
    if (jaMontado) return;
    aplicarFavicon(logoUrl, nomeLoja || null);
  }, [jaMontado, logoUrl, nomeLoja]);
  useEffect(() => {
    if (jaMontado) return;
    aplicarFavicon(logoUrl, null);
  }, [jaMontado, logoUrl, path]);

  useEffect(() => {
    if (jaMontado || !ready) return;
    // autenticado mas sem loja própria (revendedora/visitante que caiu no painel):
    // não pertence ao painel do dono — manda para o acesso da revendedora.
    // Revendedora ativa vai para /revenda; suspensa ou sem loja vai para /acesso com o
    // motivo (?motivo=suspenso|sem_loja). Usa a mesma regra de destinoPosLogin.
    if (adminSemLoja) return;
    if (semOrg) {
      let cancelado = false;
      destinoPosLogin().then(
        (destino) => {
          if (!cancelado) router.replace(destino);
        },
        () => {
          if (!cancelado) router.replace("/acesso");
        }
      );
      return () => {
        cancelado = true;
      };
    }
    // só o dono passa pelo onboarding; membros já entram numa loja pronta
    if (!completo && role === "owner") {
      router.replace("/onboarding");
      return;
    }
    // bloqueia rota fora do papel
    if (!podeAcessar(role, path)) router.replace(homeDe(role));
  }, [jaMontado, ready, completo, role, path, router, semOrg, adminSemLoja]);

  // Já há um Guard/AppShell acima (no layout) -> não duplica, só repassa.
  if (jaMontado) return <>{children}</>;

  // continua abaixo: estados de loading / shell

  if (!ready) return <AppLoadingSkeleton />;

  if (adminSemLoja)
    return (
      <GuardMontado.Provider value={true}>
        <DialogProvider>
          <main className="max-w-3xl mx-auto px-4 pt-4 pb-12 md:px-8 md:pt-8">{children}</main>
        </DialogProvider>
      </GuardMontado.Provider>
    );

  // Enquanto o redirecionamento acima não acontece, NUNCA renderiza a tela de
  // uma rota que o papel não pode ver (vendedor/motoboy veriam telas do dono).
  const redirecionando =
    semOrg || (!completo && role === "owner") || !podeAcessar(role, path);
  if (redirecionando) return <AppLoadingSkeleton />;

  return (
    <GuardMontado.Provider value={true}>
      <AppShell>{children}</AppShell>
    </GuardMontado.Provider>
  );
}

// Skeleton da aplicação inteira (sidebar + conteúdo) enquanto hidrata — mantém
// o layout estável e transmite carregamento premium, sem spinner solto.
function AppLoadingSkeleton() {
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-60 surface border-r border-default p-4 gap-2">
        <div className="flex items-center gap-2 px-2 py-3">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="mt-2 space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      </aside>
      <div className="flex-1 md:pl-60">
        <main className="max-w-3xl mx-auto px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          <SkeletonMetrics count={4} />
          <SkeletonList count={3} />
        </main>
      </div>
    </div>
  );
}
