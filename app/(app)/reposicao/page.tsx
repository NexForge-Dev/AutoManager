"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { sugestoesReposicao, type SugestaoReposicao } from "@/lib/analytics";
import Guard from "@/components/Guard";
import { useMetricaAoAbrir } from "@/lib/metricas/cliente";
import { useDialog } from "@/components/Dialog";
import { Aviso, EstadoVazio, PageHeader, Selo, Stat, type Tom } from "@/components/ui";
import { CircleAlert, CheckCircle2, Hourglass, Layers, Loader2, PackagePlus, PackageX } from "lucide-react";

export default function ReposicaoPage() {
  useMetricaAoAbrir({ tipo: "recurso", recurso: "reposicao_consultada" });
  return (
    <Guard>
      <Reposicao />
    </Guard>
  );
}

const MOTIVO_LABEL: Record<string, { txt: string; tom: Tom }> = {
  sem_estoque: { txt: "Sem estoque", tom: "bad" },
  estoque_baixo: { txt: "Estoque baixo", tom: "warn" },
  cobertura_curta: { txt: "Vai acabar logo", tom: "info" },
};

// mesma grade no cabeçalho e nas linhas (só em telas largas)
const COLUNAS_XL = "xl:grid xl:grid-cols-[minmax(0,1.1fr)_5rem_5rem_5rem_minmax(0,2.7fr)] xl:items-center xl:gap-x-4";

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
  const contar = (motivo: string) => sugestoes.filter((s) => s.motivo === motivo).length;

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        titulo="Reposição"
        descricao="Sugestões baseadas no que você vendeu nos últimos 30 dias. Ajuste a quantidade antes de dar entrada."
      />

      {temGrade && (
        <Aviso tom="info" icone={Layers}>
          Produtos com variações (grade) são analisados pelo estoque somado de todas as variações; escolha em qual
          variação entra a compra.
        </Aviso>
      )}

      {sugestoes.length === 0 ? (
        <div className="card p-0">
          <EstadoVazio icone={CheckCircle2} titulo="Tudo certo!">
            Nenhum produto precisa de reposição agora.
          </EstadoVazio>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Stat rotulo="Sem estoque" icone={PackageX} tom="bad" valor={contar("sem_estoque")} apoio="produtos zerados" />
            <Stat rotulo="Estoque baixo" icone={CircleAlert} tom="warn" valor={contar("estoque_baixo")} apoio="abaixo do mínimo" />
            <Stat
              className="col-span-2 lg:col-span-1"
              rotulo="Vai acabar logo"
              icone={Hourglass}
              tom="info"
              valor={contar("cobertura_curta")}
              apoio="pelo ritmo de vendas"
            />
          </div>

          <div className="card-list">
            <div className={`hidden ${COLUNAS_XL} surface-alt px-4 py-2.5 text-xs font-medium text-muted`}>
              <span>Produto</span>
              <span className="text-right">Em estoque</span>
              <span className="text-right">Vendeu 30d</span>
              <span className="text-right">Sugestão</span>
              <span>Entrada da compra</span>
            </div>
            {sugestoes.map((s) => (
              <CardSugestao
                key={s.produto.id}
                s={s}
                busy={processando.has(s.produto.id)}
                onEntrada={(qtd, variacaoId) => darEntrada(s.produto.id, qtd, variacaoId)}
              />
            ))}
          </div>
        </>
      )}
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
    <div className={`px-4 py-3.5 space-y-3 xl:space-y-0 ${COLUNAS_XL}`}>
      <div className="flex items-center justify-between gap-2 xl:block min-w-0">
        <div className="font-semibold min-w-0 truncate">{s.produto.nome}</div>
        <Selo tom={m.tom} className="shrink-0 xl:mt-1">
          {m.txt}
        </Selo>
      </div>

      <div className="grid grid-cols-3 gap-2 xl:contents">
        <div className="xl:text-right">
          <div className="eyebrow xl:hidden">Em estoque</div>
          <div className="font-bold tnum">{s.produto.estoqueAtual}</div>
        </div>
        <div className="xl:text-right">
          <div className="eyebrow xl:hidden">Vendeu 30d</div>
          <div className="font-bold tnum">{s.vendido30d}</div>
        </div>
        <div className="xl:text-right">
          <div className="eyebrow xl:hidden">Sugestão</div>
          <div className="font-bold tnum text-accent">{s.qtdSugerida} un</div>
        </div>
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="grid gap-2 lg:flex lg:items-end">
          <div className={`grid gap-2 min-w-0 lg:flex-1 ${precisaVariacao ? "grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : "grid-cols-1"}`}>
            {precisaVariacao && (
              <div className="min-w-0">
                <label htmlFor={idVar} className="label xl:sr-only">
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
              <label htmlFor={idQtd} className="label xl:sr-only">
                Quantidade comprada
              </label>
              <input
                id={idQtd}
                className="input tnum"
                inputMode="numeric"
                value={qtdTxt}
                onChange={(e) => setQtdTxt(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEntrada(qtd, precisaVariacao ? variacaoId : null)}
            disabled={!pode}
            className="btn-ghost w-full lg:w-auto shrink-0 whitespace-nowrap"
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <PackagePlus size={16} aria-hidden />}
            {busy ? "Dando entrada…" : qtdValida ? `Comprei ${qtd} un · dar entrada` : "Dar entrada"}
          </button>
        </div>
        {!qtdValida && <p className="text-xs text-bad">Informe uma quantidade inteira maior que zero.</p>}
      </div>
    </div>
  );
}
