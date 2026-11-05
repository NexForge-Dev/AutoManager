"use client";
import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { parseNumero } from "@/lib/csvProdutos";
import { brl } from "@/lib/analytics";
import type { EntradaPendente, OrigemRecebimento } from "@/lib/types";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import { pedirPermissaoNotificacao } from "@/lib/useRecebimentos";
import { EstadoVazio, PageHeader, Selo, Stat } from "@/components/ui";
import {
  Inbox,
  Check,
  X,
  Bell,
  BellRing,
  Store,
  Wallet,
  FlaskConical,
  Clock,
  PlusCircle,
} from "lucide-react";

export default function RecebimentosPage() {
  return (
    <Guard>
      <Recebimentos />
    </Guard>
  );
}

// ferramenta de simulação só aparece em desenvolvimento (nunca para o cliente)
const DEV = process.env.NODE_ENV === "development";

const ORIGEM_LABEL: Record<OrigemRecebimento, string> = {
  mercadopago: "Mercado Pago",
  inter: "Banco Inter",
  manual: DEV ? "Teste" : "Manual",
};

function tempoRelativo(ms: number): string {
  const seg = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (seg < 60) return "agora há pouco";
  const min = Math.round(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} d`;
}

function Recebimentos() {
  const { entradasPendentes, role, confirmarEntrada, recusarEntrada, simularRecebimento } =
    useStore();
  const { alerta, confirm } = useDialog();
  const [permissao, setPermissao] = useState<string>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "indisponivel"
  );
  const [valorTeste, setValorTeste] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  if (role !== "owner") {
    return (
      <div className="card text-center text-muted">
        A caixa de recebimentos é exclusiva do dono da loja.
      </div>
    );
  }

  const total = entradasPendentes.reduce((a, e) => a + e.valor, 0);

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        titulo="Recebimentos"
        descricao="Pagamentos recebidos que ainda não viraram venda aparecem aqui. Confirme se foi venda da loja — aí ela entra no seu caixa. A importação automática de bancos e maquininhas ainda não está disponível."
        acoes={
          <>
            {permissao !== "granted" && permissao !== "indisponivel" && (
              <button
                onClick={async () => setPermissao(await pedirPermissaoNotificacao())}
                className="btn-ghost btn-sm"
              >
                <Bell size={15} aria-hidden /> Ativar avisos
              </button>
            )}
            {permissao === "granted" && (
              <Selo tom="ok" icone={BellRing}>
                Avisos ligados
              </Selo>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:gap-5 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 min-w-0 order-2 lg:order-1">
          {entradasPendentes.length === 0 ? (
            <div className="card p-0">
              <EstadoVazio
                icone={Inbox}
                titulo="Nenhum recebimento aguardando"
                acao={
                  <Link href="/vender" className="btn-primary">
                    <PlusCircle size={17} aria-hidden /> Ir para Vender
                  </Link>
                }
              >
                Quando houver um pagamento aguardando confirmação, ele aparece aqui. Para registrar
                uma venda agora, use a tela Vender.
              </EstadoVazio>
            </div>
          ) : (
            <div className="card-list stagger">
              {entradasPendentes.map((e) => (
                <EntradaCard
                  key={e.id}
                  e={e}
                  ocupado={ocupado === e.id}
                  onConfirmar={async () => {
                    setOcupado(e.id);
                    const v = await confirmarEntrada(e.id);
                    setOcupado(null);
                    if (!v) alerta({ titulo: "Não foi possível lançar agora", mensagem: "Tente de novo." });
                  }}
                  onRecusar={async () => {
                    const ok = await confirm({
                      titulo: "Não foi venda da loja?",
                      mensagem: "Este recebimento sai da caixa de entrada e não entra no faturamento.",
                      confirmar: "Sim, descartar",
                      perigo: true,
                    });
                    if (!ok) return;
                    setOcupado(e.id);
                    const res = await recusarEntrada(e.id);
                    setOcupado(null);
                    if (!res.ok) alerta({ titulo: "Não foi possível descartar", mensagem: res.erro || "Tente novamente." });
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4 order-1 lg:order-2">
          {entradasPendentes.length > 0 && (
            <Stat
              rotulo="Aguardando confirmação"
              icone={Wallet}
              tom="warn"
              valor={brl(total)}
              apoio={`${entradasPendentes.length} recebimento(s)`}
            />
          )}

          {/* Dev only: simula um recebimento pra ver o fluxo sem banco conectado. */}
          {DEV && (
            <section className="card space-y-2 border-dashed">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted">
                <FlaskConical size={15} aria-hidden /> Testar o fluxo
              </div>
              <p className="text-xs text-muted">
                Simule um recebimento pra ver como fica (só em desenvolvimento).
              </p>
              <div className="flex gap-2">
                <input
                  className="input min-w-0"
                  inputMode="decimal"
                  placeholder="Valor (ex.: 50,00)"
                  aria-label="Valor do recebimento simulado"
                  value={valorTeste}
                  onChange={(ev) => setValorTeste(ev.target.value)}
                />
                <button
                  onClick={async () => {
                    const v = parseNumero(valorTeste);
                    const r = await simularRecebimento({ valor: v });
                    if (r.ok) setValorTeste("");
                  }}
                  className="btn-ghost whitespace-nowrap"
                >
                  Simular
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function EntradaCard({
  e,
  ocupado,
  onConfirmar,
  onRecusar,
}: {
  e: EntradaPendente;
  ocupado: boolean;
  onConfirmar: () => void;
  onRecusar: () => void;
}) {
  return (
    <div className="px-4 py-3.5 sm:flex sm:items-center sm:justify-between sm:gap-4 space-y-3 sm:space-y-0">
      <div className="min-w-0">
        <div className="figure">{brl(e.valor)}</div>
        <div className="text-sm truncate mt-0.5">{e.descricao || "Pagamento recebido"}</div>
        <div className="text-xs text-muted flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1">
          <span className="inline-flex items-center gap-1">
            <Store size={12} aria-hidden /> {ORIGEM_LABEL[e.origem]}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={12} aria-hidden /> {tempoRelativo(e.recebidoEm)}
          </span>
          {e.pagador && <span>de {e.pagador}</span>}
        </div>
      </div>

      <div className="shrink-0">
        <div className="text-sm font-medium mb-1.5 sm:text-right">Foi venda da sua loja?</div>
        <div className="flex gap-2">
          <button disabled={ocupado} onClick={onRecusar} className="btn-ghost btn-sm !min-h-[44px] flex-1">
            <X size={15} aria-hidden /> Não
          </button>
          <button disabled={ocupado} onClick={onConfirmar} className="btn-primary btn-sm !min-h-[44px] flex-1 whitespace-nowrap">
            <Check size={15} aria-hidden /> {ocupado ? "Lançando…" : "Sim, foi venda"}
          </button>
        </div>
      </div>
    </div>
  );
}
