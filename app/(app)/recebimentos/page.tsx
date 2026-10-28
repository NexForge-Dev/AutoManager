"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { brl } from "@/lib/analytics";
import type { EntradaPendente, OrigemRecebimento } from "@/lib/types";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import { pedirPermissaoNotificacao } from "@/lib/useRecebimentos";
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
  const { alerta } = useDialog();
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
    <div className="space-y-3">
      <header className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Inbox className="text-brand-600" />
          <h1 className="text-2xl font-bold">Recebimentos</h1>
        </div>
        {permissao !== "granted" && permissao !== "indisponivel" && (
          <button
            onClick={async () => setPermissao(await pedirPermissaoNotificacao())}
            className="btn-ghost py-2 px-3 text-sm"
          >
            <Bell size={16} /> Ativar avisos
          </button>
        )}
        {permissao === "granted" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-500">
            <BellRing size={14} /> Avisos ligados
          </span>
        )}
      </header>

      <p className="text-sm text-muted">
        Quando cai dinheiro numa conta conectada, ele aparece aqui. Confirme se foi venda da
        loja — aí entra automaticamente no seu caixa.
      </p>

      {entradasPendentes.length > 0 && (
        <div className="card flex items-center justify-between">
          <span className="text-sm text-muted flex items-center gap-1.5">
            <Wallet size={15} /> Aguardando confirmação
          </span>
          <span className="font-bold">{brl(total)}</span>
        </div>
      )}

      {entradasPendentes.length === 0 && (
        <div className="card text-center text-muted space-y-1">
          <div className="font-medium text-default">Nenhum recebimento aguardando</div>
          <p className="text-sm">
            Assim que entrar um pagamento numa conta conectada, ele aparece aqui pra você
            confirmar.
          </p>
        </div>
      )}

      <div className="space-y-2 stagger">
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
              setOcupado(e.id);
              await recusarEntrada(e.id);
              setOcupado(null);
            }}
          />
        ))}
      </div>

      {/* Dev only: simula um recebimento pra ver o fluxo sem banco conectado. */}
      {DEV && (
      <section className="card space-y-2 border-dashed">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted">
          <FlaskConical size={15} /> Testar o fluxo
        </div>
        <p className="text-xs text-muted">
          Simule um recebimento pra ver como fica. Em produção, quem cria essas entradas é o
          webhook do provedor (Mercado Pago, Inter…).
        </p>
        <div className="flex gap-2">
          <input
            className="input"
            inputMode="decimal"
            placeholder="Valor (ex.: 50,00)"
            value={valorTeste}
            onChange={(ev) => setValorTeste(ev.target.value)}
          />
          <button
            onClick={async () => {
              const v = parseFloat(valorTeste.replace(",", "."));
              const r = await simularRecebimento({ valor: v });
              if (r.ok) setValorTeste("");
            }}
            className="btn-ghost px-4 text-sm whitespace-nowrap"
          >
            Simular
          </button>
        </div>
      </section>
      )}
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
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xl font-bold">{brl(e.valor)}</div>
          <div className="text-sm text-default truncate">
            {e.descricao || "Pagamento recebido"}
          </div>
          <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center gap-1">
              <Store size={11} /> {ORIGEM_LABEL[e.origem]}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> {tempoRelativo(e.recebidoEm)}
            </span>
          </div>
          {e.pagador && <div className="text-xs text-muted">de {e.pagador}</div>}
        </div>
      </div>

      <div className="text-sm font-medium">Foi venda da sua loja?</div>
      <div className="flex gap-2">
        <button
          disabled={ocupado}
          onClick={onRecusar}
          className="btn-ghost flex-1 py-2 text-sm disabled:opacity-60"
        >
          <X size={16} /> Não
        </button>
        <button
          disabled={ocupado}
          onClick={onConfirmar}
          className="btn-primary flex-1 py-2 text-sm disabled:opacity-60"
        >
          <Check size={16} /> {ocupado ? "Lançando…" : "Sim, foi venda"}
        </button>
      </div>
    </div>
  );
}
