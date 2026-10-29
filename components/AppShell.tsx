"use client";
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
} from "lucide-react";
import type { Role } from "@/lib/types";
import { usePlano } from "@/lib/usePlano";
import { useConversasNaoLidas } from "@/lib/useConversasNaoLidas";
import { useRecebimentosPendentes } from "@/lib/useRecebimentos";
import type { PlanoDef } from "@/lib/plans";
import PageTransition from "./PageTransition";
import { DialogProvider } from "./Dialog";

type Item = {
  href: string;
  label: string;
  icon: any;
  roles: Role[];
  cap?: keyof PlanoDef; // exige esta capacidade do plano (ex.: allowEntregas)
  primary?: boolean; // destaque no mobile
  mobile?: boolean; // aparece no bottom nav
  adminOnly?: boolean; // só o superadmin do AutoManager
};

const ITENS: Item[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard, roles: ["owner"], mobile: true },
  { href: "/produtos", label: "Estoque", icon: Package, roles: ["owner", "vendedor"], mobile: true },
  { href: "/vender", label: "Vender", icon: PlusCircle, roles: ["owner", "vendedor"], primary: true, mobile: true },
  // sem `cap`: a aba aparece sempre p/ o dono — sem o plano, a página mostra o pitch de upgrade
  { href: "/recebimentos", label: "Recebimentos", icon: Inbox, roles: ["owner"] },
  { href: "/entregas", label: "Entregas", icon: Truck, roles: ["owner", "motoboy"], mobile: true },
  { href: "/reposicao", label: "Repor", icon: TrendingUp, roles: ["owner"], mobile: true },
  { href: "/minha-loja", label: "Minha Loja", icon: Store, roles: ["owner"] },
  { href: "/revendedoras", label: "Equipe", icon: Users, roles: ["owner"] },
  { href: "/conversas", label: "Conversas", icon: MessageCircle, roles: ["owner"] },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["owner"] },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, roles: ["owner"] },
  { href: "/analytics", label: "Inteligência", icon: PieChart, roles: ["owner"] },
  { href: "/planos", label: "Planos", icon: Crown, roles: ["owner"] },
  { href: "/configuracoes", label: "Configurações", icon: Settings, roles: ["owner"] },
  { href: "/admin", label: "Admin", icon: ShieldCheck, roles: ["owner"], adminOnly: true },
  { href: "/perfil", label: "Perfil", icon: User, roles: ["owner", "vendedor", "motoboy"], mobile: true },
];

// filtra por papel, capacidade do plano (ex.: entregas só no Expansão) e superadmin
function visivel(it: Item, role: Role, caps: PlanoDef, admin: boolean) {
  if (it.adminOnly && !admin) return false;
  if (!it.roles.includes(role)) return false;
  if (it.cap && !caps[it.cap]) return false;
  return true;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const logoUrl = useStore((s) => s.config.logoUrl);
  const nomeLoja = useStore((s) => s.config.nomeLoja);
  const role = useStore((s) => s.role);
  const admin = useStore((s) => s.superadmin);
  const { caps } = usePlano();
  const conversasNaoLidas = useConversasNaoLidas();
  const recebimentosPendentes = useRecebimentosPendentes();

  const navDesktop = ITENS.filter((it) => visivel(it, role, caps, admin));
  const nav = ITENS.filter((it) => visivel(it, role, caps, admin) && it.mobile).slice(0, 5);

  return (
    <DialogProvider>
    <div className="min-h-screen md:flex">
      {/* -------- sidebar (desktop) -------- */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-60 surface border-r border-default p-4">
        <Link
          href="/painel"
          className="flex items-center gap-2 font-extrabold text-brand-500 px-2 py-3"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="logo" className="h-7 w-7 rounded-lg object-cover" />
          ) : (
            <Gem size={22} className="text-brand-600" />
          )}
          <span className="truncate">{nomeLoja || "AutoManager"}</span>
        </Link>
        <nav className="mt-4 flex flex-col gap-1">
          {navDesktop.map((n) => {
            const active = path === n.href;
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-all duration-200 active:scale-[.98] ${
                  active
                    ? "bg-brand-600 text-white shadow-card"
                    : "text-muted hover:text-strong hover:translate-x-0.5"
                }`}
              >
                {!active && (
                  <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--hover)]" />
                )}
                <Icon
                  size={20}
                  className={`relative transition-transform duration-200 ${
                    active ? "" : "group-hover:scale-110"
                  }`}
                />
                <span className="relative flex-1">{n.label}</span>
                {n.href === "/conversas" && conversasNaoLidas > 0 && (
                  <span
                    className={`relative text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 grid place-items-center ${
                      active ? "bg-white text-brand-600" : "bg-red-500 text-white"
                    }`}
                  >
                    {conversasNaoLidas > 99 ? "99+" : conversasNaoLidas}
                  </span>
                )}
                {n.href === "/recebimentos" && recebimentosPendentes > 0 && (
                  <span
                    className={`relative text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 grid place-items-center ${
                      active ? "bg-white text-brand-600" : "bg-red-500 text-white"
                    }`}
                  >
                    {recebimentosPendentes > 99 ? "99+" : recebimentosPendentes}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* -------- conteúdo -------- */}
      <div className="flex-1 md:pl-60">
        <main
          className={`${
            path === "/minha-loja" ? "max-w-7xl" : "max-w-3xl"
          } mx-auto px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12`}
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* -------- bottom nav (mobile) -------- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 surface border-t border-default flex justify-around items-center px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {nav.map((n) => {
          const active = path === n.href;
          const Icon = n.icon;
          if (n.primary) {
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center -mt-6 active:scale-95 transition-transform"
              >
                <span className="bg-brand-600 text-white rounded-full p-3 shadow-lg shadow-brand-600/30 transition-transform duration-200 hover:scale-105 active:scale-95">
                  <Icon size={26} />
                </span>
                <span className="text-[11px] mt-1 font-medium text-brand-500">{n.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-90 ${
                active ? "text-brand-500" : "text-muted"
              }`}
            >
              <Icon
                size={22}
                className={`transition-transform duration-200 ${active ? "scale-110" : ""}`}
              />
              <span className="text-[11px] font-medium">{n.label}</span>
              <span
                className={`h-1 w-1 rounded-full bg-brand-500 transition-opacity duration-200 ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
            </Link>
          );
        })}
      </nav>
    </div>
    </DialogProvider>
  );
}
