"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { sugestoesReposicao, type SugestaoReposicao } from "@/lib/analytics";
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
  const sugestoes = useMemo(() => sugestoesReposicao(produtos, vendas), [produtos, vendas]);
  const [processando, setProcessando] = useState<Set<string>>(new Set());
  const { alerta } = useDialog();

  async function darEntrada(id: string, qtd: number, variacaoId: string | null) {
    if (processando.has(id)) return; // trava duplo clique
    setProcessando((s) => new Set(s).add(id));
    try {
      const res = await entradaEstoque(id, qtd, variacaoId);
      if (!res.ok) alerta({ titulo: "Não foi possível dar entrada", mensagem: res.erro || "Tente novamente." });
    } finally {
      setProcessando((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  const temGrade = sugestoes.some((s) => s.variacoes.length > 0);

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-2 pt-1">
        <TrendingUp className="text-brand-600" />
        <h1 className="text-2xl font-bold">Reposição</h1>
      </header>
      <p className="text-sm text-muted">
        Sugestões baseadas no que você vendeu nos últimos 30 dias. Ajuste a quantidade antes de dar entrada.
      </p>
      {temGrade && (
        <p className="text-xs text-muted">
          Produtos com variações (grade) são analisados pelo estoque somado de todas as variações; escolha em qual
          variação entra a compra.
        </p>
      )}

      {sugestoes.length === 0 && (
        <div className="card text-center text-muted flex flex-col items-center gap-2 py-8">
          <CheckCircle2 className="text-green-500" size={36} />
          Tudo certo! Nenhum produto precisa de reposição agora.
        </div>
      )}

      <div className="space-y-2 stagger">
        {sugestoes.map((s) => (
          <CardSugestao
            key={s.produto.id}
            s={s}
            busy={processando.has(s.produto.id)}
            onEntrada={(qtd, variacaoId) => darEntrada(s.produto.id, qtd, variacaoId)}
          />
        ))}
      </div>
    </div>
  );
}

function CardSugestao({
  s,
  busy,
  onEntrada,
}: {
  s: SugestaoReposicao;
  busy: boolean;
  onEntrada: (qtd: number, variacaoId: string | null) => void;
}) {
  const m = MOTIVO_LABEL[s.motivo];
  const [qtdTxt, setQtdTxt] = useState(String(s.qtdSugerida));
  const [variacaoId, setVariacaoId] = useState<string>(s.variacoes[0]?.id ?? "");
  const qtd = Number(qtdTxt);
  const qtdValida = /^\d+$/.test(qtdTxt.trim()) && qtd >= 1 && qtd <= 100000;
  const precisaVariacao = s.variacoes.length > 0;
  const pode = qtdValida && (!precisaVariacao || !!variacaoId) && !busy;
  const idQtd = `qtd-${s.produto.id}`;
  const idVar = `var-${s.produto.id}`;

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold min-w-0 truncate">{s.produto.nome}</div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${m.cls}`}>{m.txt}</span>
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
          <div className="text-muted">Sugestão</div>
          <div className="font-bold text-sm text-brand-600">{s.qtdSugerida} un</div>
        </div>
      </div>
      <div className={`grid gap-2 ${precisaVariacao ? "grid-cols-2" : "grid-cols-1"}`}>
        {precisaVariacao && (
          <div className="min-w-0">
            <label htmlFor={idVar} className="label">
              Variação
            </label>
            <select
              id={idVar}
              className="input"
              value={variacaoId}
              onChange={(e) => setVariacaoId(e.target.value)}
              disabled={busy}
            >
              {s.variacoes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome} ({v.estoqueAtual} un)
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="min-w-0">
          <label htmlFor={idQtd} className="label">
            Quantidade comprada
          </label>
          <input
            id={idQtd}
            className="input"
            inputMode="numeric"
            value={qtdTxt}
            onChange={(e) => setQtdTxt(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>
      {!qtdValida && <p className="text-xs text-red-500">Informe uma quantidade inteira maior que zero.</p>}
      <button
        type="button"
        onClick={() => onEntrada(qtd, precisaVariacao ? variacaoId : null)}
        disabled={!pode}
        className="btn-primary w-full py-2 text-sm disabled:opacity-70"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <PackagePlus size={16} />}
        {busy ? "Dando entrada…" : qtdValida ? `Comprei ${qtd} un · dar entrada` : "Dar entrada"}
      </button>
    </div>
  );
}
