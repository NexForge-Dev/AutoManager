"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { sugestoesReposicao } from "@/lib/analytics";
import Guard from "@/components/Guard";
import { useMetricaAoAbrir } from "@/lib/metricas/cliente";
import { useDialog } from "@/components/Dialog";
import { TrendingUp, PackagePlus, CheckCircle2, Loader2 } from "lucide-react";

export default function ReposicaoPage() {
  useMetricaAoAbrir({ tipo: "recurso", recurso: "reposicao_consultada" });
  return (
    <Guard>
      <Reposicao />
    </Guard>
  );
}

const MOTIVO_LABEL: Record<string, { txt: string; cls: string }> = {
  sem_estoque: { txt: "Sem estoque", cls: "bg-red-500/15 text-red-400" },
  estoque_baixo: { txt: "Estoque baixo", cls: "bg-amber-500/15 text-amber-400" },
  cobertura_curta: { txt: "Vai acabar logo", cls: "bg-yellow-500/15 text-yellow-500" },
};

function Reposicao() {
  const { produtos, vendas, entradaEstoque } = useStore();
  const sugestoes = sugestoesReposicao(produtos, vendas);
  const [processando, setProcessando] = useState<Set<string>>(new Set());
  const { alerta } = useDialog();

  async function darEntrada(id: string, qtd: number) {
    if (processando.has(id)) return; // trava duplo clique
    setProcessando((s) => new Set(s).add(id));
    try {
      const res = await entradaEstoque(id, qtd);
      if (!res.ok) alerta({ titulo: "Não foi possível dar entrada", mensagem: res.erro || "Tente novamente." });
    } finally {
      setProcessando((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-2 pt-1">
        <TrendingUp className="text-brand-600" />
        <h1 className="text-2xl font-bold">Reposição</h1>
      </header>
      <p className="text-sm text-muted">
        Sugestões baseadas no que você vendeu nos últimos 30 dias.
      </p>

      {sugestoes.length === 0 && (
        <div className="card text-center text-muted flex flex-col items-center gap-2 py-8">
          <CheckCircle2 className="text-green-500" size={36} />
          Tudo certo! Nenhum produto precisa de reposição agora.
        </div>
      )}

      <div className="space-y-2 stagger">
        {sugestoes.map((s) => {
          const m = MOTIVO_LABEL[s.motivo];
          const busy = processando.has(s.produto.id);
          return (
            <div key={s.produto.id} className="card space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{s.produto.nome}</div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${m.cls}`}>
                  {m.txt}
                </span>
              </div>
              <div className="text-xs text-muted grid grid-cols-3 gap-2">
                <div>
                  <div className="text-muted">Em estoque</div>
                  <div className="font-bold text-sm text-strong">{s.produto.estoqueAtual}</div>
                </div>
                <div>
                  <div className="text-muted">Vendeu 30d</div>
                  <div className="font-bold text-sm text-strong">{s.vendido30d}</div>
                </div>
                <div>
                  <div className="text-muted">Comprar</div>
                  <div className="font-bold text-sm text-brand-600">{s.qtdSugerida} un</div>
                </div>
              </div>
              <button
                onClick={() => darEntrada(s.produto.id, s.qtdSugerida)}
                disabled={busy}
                className="btn-primary w-full py-2 text-sm disabled:opacity-70"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <PackagePlus size={16} />}
                {busy ? "Dando entrada…" : `Comprei ${s.qtdSugerida} un · dar entrada`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
