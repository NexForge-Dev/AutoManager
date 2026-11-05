"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Users,
  TrendingUp,
  Gem,
  User,
  BarChart3,
  Settings,
  Truck,
  MessageCircle,
  PieChart,
  Store,
  Crown,
  ShieldCheck,
  Inbox,
  Wallet,
  Menu,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { usePlano } from "@/lib/usePlano";
import { useConversasNaoLidas } from "@/lib/useConversasNaoLidas";
import { useRecebimentosPendentes } from "@/lib/useRecebimentos";
import type { PlanoDef } from "@/lib/plans";
import PageTransition from "./PageTransition";
import { DialogProvider } from "./Dialog";
import BalaoFeedback from "./BalaoFeedback";
import Modal from "./Modal";

type Grupo = "operacao" | "clientes" | "gestao" | "conta";

type Item = {
  href: string;
  label: string;
  icon: any;
  roles: Role[];
  grupo: Grupo;
  cap?: keyof PlanoDef; // exige esta capacidade do plano (ex.: allowEntregas)
  primary?: boolean; // destaque no mobile
  mobile?: boolean; // aparece no bottom nav
  adminOnly?: boolean; // só o superadmin do AutoManager
  soComPendencia?: boolean; // some do menu quando o badge está zerado
};

const ITENS: Item[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard, roles: ["owner"], grupo: "operacao", mobile: true },
  { href: "/produtos", label: "Estoque", icon: Package, roles: ["owner", "vendedor"], grupo: "operacao", mobile: true },
  { href: "/vender", label: "Vender", icon: PlusCircle, roles: ["owner", "vendedor"], grupo: "operacao", primary: true, mobile: true },
  // caixa de recebimentos: só aparece quando há algo para confirmar (não há integração
  // bancária automática; sem pendências a aba ficava vazia para sempre)
  { href: "/recebimentos", label: "Recebimentos", icon: Inbox, roles: ["owner"], grupo: "operacao", soComPendencia: true },
  { href: "/entregas", label: "Entregas", icon: Truck, roles: ["owner", "motoboy"], grupo: "operacao", mobile: true },
  { href: "/reposicao", label: "Repor", icon: TrendingUp, roles: ["owner"], grupo: "operacao", mobile: true },
  { href: "/minha-loja", label: "Minha Loja", icon: Store, roles: ["owner"], grupo: "clientes" },
  { href: "/revendedoras", label: "Revendedoras", icon: Users, roles: ["owner"], grupo: "clientes" },
  { href: "/conversas", label: "Conversas", icon: MessageCircle, roles: ["owner"], grupo: "clientes" },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, roles: ["owner"], grupo: "gestao" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["owner"], grupo: "gestao" },
  { href: "/analytics", label: "Inteligência", icon: PieChart, roles: ["owner"], grupo: "gestao" },
  { href: "/planos", label: "Planos", icon: Crown, roles: ["owner"], grupo: "conta" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, roles: ["owner"], grupo: "conta" },
  { href: "/admin", label: "Admin", icon: ShieldCheck, roles: ["owner"], grupo: "conta", adminOnly: true },
  { href: "/perfil", label: "Perfil", icon: User, roles: ["owner", "vendedor", "motoboy"], grupo: "conta", mobile: true },
];

const GRUPOS: { id: Grupo; label: string }[] = [
  { id: "operacao", label: "Dia a dia" },
  { id: "clientes", label: "Loja e clientes" },
  { id: "gestao", label: "Gestão" },
  { id: "conta", label: "Conta" },
];

// telas de formulário ficam numa coluna confortável; as demais usam a largura toda
const COLUNA_ESTREITA = ["/perfil", "/configuracoes", "/configuracoes/plano"];

// filtra por papel, capacidade do plano (ex.: entregas só no Expansão) e superadmin
function visivel(it: Item, role: Role, caps: PlanoDef, admin: boolean) {
  if (it.adminOnly && !admin) return false;
  if (!it.roles.includes(role)) return false;
  if (it.cap && !caps[it.cap]) return false;
  return true;
}

function Contador({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`tnum text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 grid place-items-center bg-red-600 text-white ${className}`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

// logo da loja; sem logo, um selo com a inicial na cor da marca
function MarcaLoja({ logoUrl, nome }: { logoUrl: string | null; nome: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />;
  }
  const inicial = nome.trim()[0]?.toUpperCase();
  return (
    <span className="grid place-items-center h-8 w-8 rounded-lg bg-brand-600 text-white text-sm font-bold shrink-0">
      {inicial || <Gem size={17} aria-hidden />}
    </span>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const logoUrl = useStore((s) => s.config.logoUrl);
  const nomeLoja = useStore((s) => s.config.nomeLoja);
  const role = useStore((s) => s.role);
  const admin = useStore((s) => s.superadmin);
  const { caps, defContratado, emTrial, diasTrial, bloqueado } = usePlano();
  const conversasNaoLidas = useConversasNaoLidas();
  const recebimentosPendentes = useRecebimentosPendentes();

  const navDesktop = ITENS.filter(
    (it) => visivel(it, role, caps, admin) && (!it.soComPendencia || recebimentosPendentes > 0 || path === it.href)
  );
  // bottom nav tem 5 vagas: se o papel tem mais telas que isso, 4 fixas + "Mais"
  // (senão Perfil/sair, Financeiro, Conversas etc. ficam inacessíveis no celular)
  const mobileFixos = navDesktop.filter((it) => it.mobile);
  const precisaMais = navDesktop.length > 5;
  const nav = precisaMais ? mobileFixos.slice(0, 4) : navDesktop.slice(0, 5);
  const resto = navDesktop.filter((it) => !nav.includes(it));
  const badgeDe = (href: string) =>
    href === "/conversas" ? conversasNaoLidas : href === "/recebimentos" ? recebimentosPendentes : 0;
  const badgeMais = resto.reduce((t, it) => t + badgeDe(it.href), 0);
  const [maisAberto, setMaisAberto] = useState(false);
  useEffect(() => setMaisAberto(false), [path]);

  // /configuracoes/plano mantém "Configurações" marcado no menu
  const ativoEm = (href: string) => path === href || path.startsWith(href + "/");
  const nome = nomeLoja || "AutoManager";
  const donoLogado = role === "owner";
  const rotuloPlano = bloqueado
    ? "Plano inativo"
    : emTrial
      ? `Teste grátis · ${diasTrial} dia${diasTrial === 1 ? "" : "s"}`
      : `Plano ${defContratado.nome}`;

  return (
    <DialogProvider>
    <div className="min-h-screen md:flex">
      {/* -------- sidebar (desktop) -------- */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-60 surface border-r border-default">
        <Link href="/painel" className="shrink-0 flex items-center gap-2.5 px-4 h-16 min-w-0">
          <MarcaLoja logoUrl={logoUrl} nome={nomeLoja} />
          <span className="min-w-0">
            <span className="block truncate font-bold leading-tight">{nome}</span>
            {donoLogado && (
              <span className="block truncate text-xs text-muted leading-tight mt-0.5">{rotuloPlano}</span>
            )}
          </span>
        </Link>

        {/* muitos itens não cabem em telas baixas: a lista rola (min-h-0 no flex) */}
        <nav className="px-3 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-3" aria-label="Menu principal">
          {navDesktop.some((n) => n.primary) && (
            <Link
              href="/vender"
              className="btn-primary w-full mb-3"
              aria-current={path === "/vender" ? "page" : undefined}
            >
              <PlusCircle size={18} aria-hidden /> Nova venda
            </Link>
          )}
          {GRUPOS.map((g) => {
            const itens = navDesktop.filter((n) => n.grupo === g.id && !n.primary);
            if (itens.length === 0) return null;
            return (
              <div key={g.id} className="mt-4 first:mt-0">
                <div className="px-2.5 pb-1 text-[11px] font-medium text-muted">{g.label}</div>
                <div className="flex flex-col gap-px">
                  {itens.map((n) => {
                    const active = ativoEm(n.href);
                    const Icon = n.icon;
                    const badge = badgeDe(n.href);
                    return (
                      <Link
                        key={n.href}
                        href={n.href}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex items-center gap-2.5 rounded-lg px-2.5 h-9 text-sm font-medium transition-colors ${
                          active
                            ? "bg-brand-500/[.12] text-accent"
                            : "text-muted hover:text-strong hover:bg-[var(--hover)]"
                        }`}
                      >
                        <Icon size={17} aria-hidden className="shrink-0" />
                        <span className="flex-1 truncate">{n.label}</span>
                        {badge > 0 && <Contador n={badge} />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* -------- conteúdo -------- */}
      <div className="flex-1 min-w-0 md:pl-60">
        {/* barra superior (celular): identidade da loja e atalho do chat */}
        <header className="md:hidden sticky top-0 z-20 surface border-b border-default print-hidden pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2.5 h-14 px-4">
            <MarcaLoja logoUrl={logoUrl} nome={nomeLoja} />
            <span className="flex-1 min-w-0 truncate font-bold">{nome}</span>
            {donoLogado && (
              <Link
                href="/conversas"
                className="icon-btn relative -mr-2"
                aria-label={
                  conversasNaoLidas > 0
                    ? `${conversasNaoLidas} ${conversasNaoLidas === 1 ? "conversa não lida" : "conversas não lidas"}`
                    : "Conversas"
                }
              >
                <MessageCircle size={21} aria-hidden />
                {conversasNaoLidas > 0 && (
                  <Contador n={conversasNaoLidas} className="absolute -top-0.5 -right-0.5 scale-90" />
                )}
              </Link>
            )}
          </div>
        </header>

        <main
          className={`${
            COLUNA_ESTREITA.includes(path) ? "max-w-3xl" : "max-w-6xl"
          } mx-auto px-4 pt-4 pb-32 md:px-8 md:pt-7 md:pb-20`}
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* -------- bottom nav (mobile) -------- */}
      <nav
        aria-label="Menu do celular"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 overflow-x-clip surface border-t border-default grid grid-flow-col auto-cols-fr items-end px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        {nav.map((n) => {
          const active = ativoEm(n.href);
          const Icon = n.icon;
          if (n.primary) {
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-0.5"
              >
                <span className="grid place-items-center h-9 w-12 rounded-xl bg-brand-600 text-white shadow-soft active:scale-95 transition-transform">
                  <Icon size={22} aria-hidden />
                </span>
                <span className="text-[11px] font-semibold text-accent">{n.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-end gap-0.5 min-h-[50px] pb-px transition-colors ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon size={22} aria-hidden />
              <span className={`text-[11px] ${active ? "font-semibold" : "font-medium"}`}>{n.label}</span>
            </Link>
          );
        })}
        {precisaMais && (
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            aria-expanded={maisAberto}
            className={`relative flex flex-col items-center justify-end gap-0.5 min-h-[50px] pb-px transition-colors ${
              resto.some((it) => ativoEm(it.href)) ? "text-accent" : "text-muted"
            }`}
          >
            <Menu size={22} aria-hidden />
            <span className="text-[11px] font-medium">Mais</span>
            {badgeMais > 0 && <Contador n={badgeMais} className="absolute top-0 left-1/2 ml-1.5 scale-90" />}
          </button>
        )}
      </nav>

      {/* na tela de venda o carrinho fixo ocupa esse canto e tem o botão de concluir */}
      {path !== "/vender" && <BalaoFeedback />}

      {/* -------- "Mais" (mobile): demais telas -------- */}
      {maisAberto && (
        <Modal
          onClose={() => setMaisAberto(false)}
          titulo="Menu"
          fecharLabel="Fechar menu"
          voltarFecha={false}
          backdropClassName="md:hidden"
          className="space-y-4"
        >
          {GRUPOS.map((g) => {
            const itens = resto.filter((n) => n.grupo === g.id);
            if (itens.length === 0) return null;
            return (
              <div key={g.id}>
                <div className="pb-1.5 text-xs font-medium text-muted">{g.label}</div>
                <div className="card-list">
                  {itens.map((n) => {
                    const Icon = n.icon;
                    const active = ativoEm(n.href);
                    const badge = badgeDe(n.href);
                    return (
                      <Link
                        key={n.href}
                        href={n.href}
                        onClick={() => setMaisAberto(false)}
                        aria-current={active ? "page" : undefined}
                        className={`row min-h-[48px] py-2.5 font-medium ${active ? "text-accent" : ""}`}
                      >
                        <Icon size={19} aria-hidden className={active ? "" : "text-muted"} />
                        <span className="flex-1">{n.label}</span>
                        {badge > 0 && <Contador n={badge} />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Modal>
      )}
    </div>
    </DialogProvider>
  );
}
