"use client";
import { useEffect, useState } from "react";
import CountUp from "@/components/CountUp";
import { TrendingUp, Package, Wallet, ShoppingBag, Check } from "lucide-react";

const real = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const PRODUTOS = [
  "Anel Solitário",
  "Brinco Argola",
  "Colar Ponto de Luz",
  "Kit Skincare",
  "Vestido Midi",
  "Pulseira Riviera",
  "Batom Matte",
  "Caderno Premium",
];

type Toast = { id: number; tipo: "venda" | "comissao"; produto: string; valor: number };

// Demonstração viva do painel: a cada poucos segundos uma "venda" entra —
// faturamento sobe, estoque baixa, comissão é calculada e um aviso aparece.
export default function LiveDashboard() {
  const [faturamento, setFaturamento] = useState(14380);
  const [estoque, setEstoque] = useState(1247);
  const [comissao, setComissao] = useState(1120);
  const [ticket, setTicket] = useState(87);
  const [bars, setBars] = useState([40, 62, 55, 78, 70, 92, 84]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [piscando, setPiscando] = useState(false);

  useEffect(() => {
    let n = 0;
    let limparToast: ReturnType<typeof setTimeout>;

    const tick = () => {
      n += 1;
      const valor = 40 + Math.floor(Math.random() * 150);
      const qtd = 1 + Math.floor(Math.random() * 2);
      const produto = PRODUTOS[Math.floor(Math.random() * PRODUTOS.length)];
      const tipo: Toast["tipo"] = n % 3 === 0 ? "comissao" : "venda";

      setFaturamento((v) => v + valor);
      setEstoque((v) => Math.max(0, v - qtd));
      setComissao((v) => v + Math.round(valor * 0.3));
      setTicket(() => 70 + Math.floor(Math.random() * 60));
      setBars((b) => {
        const proximo = 45 + Math.floor(Math.random() * 55);
        return [...b.slice(1), proximo];
      });
      setPiscando(true);
      setTimeout(() => setPiscando(false), 600);

      setToast({ id: n, tipo, produto, valor: tipo === "comissao" ? Math.round(valor * 0.3) : valor });
      clearTimeout(limparToast);
      limparToast = setTimeout(() => setToast(null), 2800);
    };

    const iv = setInterval(tick, 3000);
    return () => {
      clearInterval(iv);
      clearTimeout(limparToast);
    };
  }, []);

  return (
    <div className="relative">
      {/* brilho atrás do card */}
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-brand-500/20 blur-3xl" />

      <div className="rounded-3xl border border-white/10 bg-[var(--surface)]/80 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 sm:p-5">
        {/* topo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
              <ShoppingBag size={16} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-strong">Minha Loja</p>
              <p className="text-[11px] text-muted">Painel · hoje</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-[11px] font-semibold text-green-500">
            <span className="lp-live-dot h-1.5 w-1.5 rounded-full bg-green-500" /> ao vivo
          </span>
        </div>

        {/* faturamento */}
        <div className="mt-5">
          <p className="text-xs text-muted">Faturamento do mês</p>
          <div className="flex items-end gap-2">
            <CountUp
              value={faturamento}
              format={real}
              duration={700}
              className={`text-3xl font-extrabold tracking-tight text-strong transition-colors sm:text-4xl ${
                piscando ? "text-brand-500" : ""
              }`}
            />
            <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-500">
              <TrendingUp size={12} /> +23%
            </span>
          </div>
        </div>

        {/* mini gráfico */}
        <div className="mt-4 flex h-24 items-end gap-1.5">
          {bars.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t-md transition-[height] duration-700 ease-out ${
                i === bars.length - 1 ? "bg-brand-500" : "bg-brand-500/25"
              }`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>

        {/* métricas */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Tile icon={Package} label="Em estoque">
            <CountUp value={estoque} duration={600} format={(n) => `${Math.round(n)}`} /> un
          </Tile>
          <Tile icon={Wallet} label="Comissão">
            <CountUp value={comissao} duration={600} format={real} />
          </Tile>
          <Tile icon={TrendingUp} label="Ticket médio">
            <CountUp value={ticket} duration={600} format={real} />
          </Tile>
        </div>
      </div>

      {/* aviso flutuante (venda registrada / comissão calculada) */}
      {toast && (
        <div
          key={toast.id}
          className="lp-toast absolute -right-2 -top-3 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2 shadow-xl backdrop-blur sm:-right-6"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-green-500/15 text-green-500">
            <Check size={15} />
          </span>
          <div className="leading-tight">
            <p className="text-xs font-bold text-strong">
              {toast.tipo === "venda" ? "Venda registrada" : "Comissão calculada"}
            </p>
            <p className="text-[11px] text-muted">
              {toast.tipo === "venda" ? `${toast.produto} · ${real(toast.valor)}` : `+${real(toast.valor)} a pagar`}
            </p>
          </div>
        </div>
      )}

      {/* chip flutuante fixo */}
      <div className="absolute -bottom-3 -left-2 z-10 hidden items-center gap-2 rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2 shadow-xl backdrop-blur sm:flex">
        <Package size={15} className="text-brand-500" />
        <span className="text-xs font-semibold text-strong">Estoque atualizado sozinho</span>
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface-alt)] p-2.5">
      <div className="flex items-center gap-1 text-brand-500">
        <Icon size={13} />
        <span className="truncate text-[10px] text-muted">{label}</span>
      </div>
      <p className="mt-0.5 text-sm font-bold text-strong">{children}</p>
    </div>
  );
}
