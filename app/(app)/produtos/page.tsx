"use client";
import { useState, useRef } from "react";
import { useStore } from "@/lib/store";
import { categoriasDaLoja } from "@/lib/seed";
import { brl } from "@/lib/analytics";
import { uploadProdutoImagem } from "@/lib/uploadProdutoImagem";
import { parseProdutosCSV, CSV_MODELO_HEADER, CSV_MODELO_EXEMPLO, type LinhaImport } from "@/lib/csvProdutos";
import { baixarCSV } from "@/lib/export";
import type { Produto, Variacao } from "@/lib/types";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import { Plus, X, PackagePlus, Pencil, ImagePlus, Trash2, Layers, SlidersHorizontal, Search, Upload, FileSpreadsheet, AlertTriangle } from "lucide-react";

export default function ProdutosPage() {
  return (
    <Guard>
      <Produtos />
    </Guard>
  );
}

function Produtos() {
  const { produtos, config, entradaEstoque, ajustarEstoque, role } = useStore();
  const { prompt, alerta } = useDialog();
  const podeEditar = role === "owner";

  async function reporEstoque(p: Produto) {
    const q = await prompt({
      titulo: `Repor estoque`,
      mensagem: `Quantas unidades de "${p.nome}" você comprou?`,
      valorInicial: "10",
      tipo: "number",
      inputMode: "numeric",
      confirmar: "Dar entrada",
    });
    const n = parseInt(q || "");
    if (!(n > 0)) return;
    const res = await entradaEstoque(p.id, n);
    if (!res.ok) alerta({ titulo: "Não foi possível dar entrada", mensagem: res.erro || "Tente novamente." });
  }

  async function ajustar(p: Produto) {
    const q = await prompt({
      titulo: `Ajustar estoque`,
      mensagem: `Defina o estoque atual de "${p.nome}":`,
      valorInicial: String(p.estoqueAtual),
      tipo: "number",
      inputMode: "numeric",
      confirmar: "Salvar",
    });
    const n = parseInt(q || "");
    if (isNaN(n) || n < 0) return;
    const res = await ajustarEstoque(p.id, n, "Ajuste manual");
    if (!res.ok) alerta({ titulo: "Não foi possível ajustar", mensagem: res.erro || "Tente novamente." });
  }
  const [form, setForm] = useState<{ open: boolean; editar: Produto | null }>({
    open: false,
    editar: null,
  });
  const [importar, setImportar] = useState(false);
  const [filtroCat, setFiltroCat] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const cats = categoriasDaLoja(config);

  // contagem de produtos por categoria (chips mostram quantos há em cada uma)
  const contagemPorCat = (() => {
    const m = new Map<string, number>();
    for (const p of produtos) if (p.categoria) m.set(p.categoria, (m.get(p.categoria) || 0) + 1);
    return m;
  })();

  // categorias realmente presentes nos produtos (na ordem da loja, sobras no fim)
  const catsPresentes = (() => {
    const usadas = new Set(produtos.map((p) => p.categoria).filter(Boolean));
    const ordenadas = cats.filter((c) => usadas.has(c));
    const extras = [...usadas].filter((c) => !cats.includes(c));
    return [...ordenadas, ...extras];
  })();

  // busca + filtro de categoria combinados
  const termo = busca.trim().toLowerCase();
  const produtosFiltrados = produtos.filter((p) => {
    if (filtroCat && p.categoria !== filtroCat) return false;
    if (!termo) return true;
    return (
      p.nome.toLowerCase().includes(termo) ||
      (p.marca ?? "").toLowerCase().includes(termo) ||
      (p.categoria ?? "").toLowerCase().includes(termo) ||
      (p.sku ?? "").toLowerCase().includes(termo) ||
      p.variacoes.some((v) => (v.sku ?? "").toLowerCase().includes(termo))
    );
  });

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between pt-1">
        <h1 className="text-2xl font-bold">Estoque</h1>
        {podeEditar && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportar(true)}
              className="btn-ghost py-2 px-3 text-sm"
              title="Importar de planilha (CSV)"
            >
              <Upload size={16} /> Importar
            </button>
            <button
              onClick={() => setForm({ open: true, editar: null })}
              className="btn-primary py-2 px-3 text-sm"
            >
              <Plus size={18} /> Produto
            </button>
          </div>
        )}
      </header>

      {produtos.length === 0 && (
        <div className="card text-center text-muted">
          Nenhum produto ainda. Toque em <b>+ Produto</b>.
        </div>
      )}

      {produtos.length > 0 &&
        (() => {
          const ativos = produtos.filter((p) => p.ativo);
          const semEstoque = ativos.filter((p) => p.estoqueAtual <= 0).length;
          const acabando = ativos.filter(
            (p) => p.estoqueAtual > 0 && p.estoqueAtual <= p.estoqueMinimo
          ).length;
          const ok = ativos.length - semEstoque - acabando;
          return (
            <div className="grid grid-cols-3 gap-2">
              <ResumoEstoque label="Em estoque" valor={ok} cor="text-green-500" />
              <ResumoEstoque label="Acabando" valor={acabando} cor="text-amber-500" />
              <ResumoEstoque label="Sem estoque" valor={semEstoque} cor="text-red-500" />
            </div>
          );
        })()}

      {/* busca */}
      {produtos.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="Buscar por nome, marca, categoria ou SKU…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted p-1"
              aria-label="Limpar busca"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {/* filtro por categoria (com contador) */}
      {catsPresentes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setFiltroCat(null)}
            className={`chip whitespace-nowrap ${
              filtroCat === null ? "bg-brand-600 text-white border-brand-600" : "border-default"
            }`}
          >
            Todas <span className="opacity-70">({produtos.length})</span>
          </button>
          {catsPresentes.map((c) => (
            <button
              key={c}
              onClick={() => setFiltroCat(c)}
              className={`chip whitespace-nowrap ${
                filtroCat === c ? "bg-brand-600 text-white border-brand-600" : "border-default"
              }`}
            >
              {c} <span className="opacity-70">({contagemPorCat.get(c) || 0})</span>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2 stagger">
        {produtosFiltrados.length === 0 && (filtroCat || termo) && (
          <div className="card text-center text-muted">
            {termo
              ? `Nenhum produto encontrado para “${busca.trim()}”${filtroCat ? ` em “${filtroCat}”` : ""}.`
              : `Nenhum produto em “${filtroCat}”.`}
          </div>
        )}
        {produtosFiltrados.map((p) => {
          const baixo = p.estoqueAtual <= p.estoqueMinimo;
          const temGrade = p.variacoes.length > 0;
          return (
            <div key={p.id} className="card flex items-center gap-3">
              {p.imagens[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imagens[0]}
                  alt={p.nome}
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 rounded-lg object-cover shrink-0 border border-default"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg surface-alt shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">
                  {p.nome}
                  {p.marca ? <span className="text-muted font-normal"> · {p.marca}</span> : null}
                </div>
                <div className="text-xs text-muted truncate">
                  {p.categoria} · {brl(p.precoVenda)} · margem{" "}
                  {p.custo > 0 ? (((p.precoVenda - p.custo) / p.custo) * 100).toFixed(0) : "-"}%
                  {temGrade && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-brand-500">
                      <Layers size={11} /> {p.variacoes.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-bold ${baixo ? "text-red-500" : ""}`}>{p.estoqueAtual} un</div>
                <div className="flex gap-1 mt-1 justify-end">
                  {podeEditar && (
                  <button
                    onClick={() => setForm({ open: true, editar: p })}
                    className="grid place-items-center h-9 w-9 rounded-lg text-brand-500 hover:bg-[var(--hover)] active:scale-90 transition"
                    title="Editar produto"
                    aria-label="Editar produto"
                  >
                    <Pencil size={16} />
                  </button>
                  )}
                  {podeEditar && !temGrade && (
                    <>
                      <button
                        onClick={() => reporEstoque(p)}
                        className="grid place-items-center h-9 w-9 rounded-lg text-brand-600 hover:bg-[var(--hover)] active:scale-90 transition"
                        title="Dar entrada (comprei)"
                        aria-label="Dar entrada no estoque"
                      >
                        <PackagePlus size={18} />
                      </button>
                      <button
                        onClick={() => ajustar(p)}
                        className="grid place-items-center h-9 w-9 rounded-lg text-muted hover:bg-[var(--hover)] active:scale-90 transition"
                        title="Ajustar estoque"
                        aria-label="Ajustar estoque"
                      >
                        <SlidersHorizontal size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {form.open && (
        <ProdutoForm
          editar={form.editar}
          categorias={cats}
          onClose={() => setForm({ open: false, editar: null })}
        />
      )}

      {importar && <ImportarProdutos onClose={() => setImportar(false)} />}
    </div>
  );
}

function ImportarProdutos({ onClose }: { onClose: () => void }) {
  const { importarProdutos } = useStore();
  const { alerta } = useDialog();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<LinhaImport[]>([]);
  const [erros, setErros] = useState<{ linha: number; motivo: string }[]>([]);
  const [nomeArq, setNomeArq] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function processar(texto: string, nome: string) {
    const r = parseProdutosCSV(texto);
    setLinhas(r.linhas);
    setErros(r.erros);
    setNomeArq(nome);
  }

  async function onArquivo(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const texto = await f.text();
    processar(texto, f.name);
    if (fileRef.current) fileRef.current.value = "";
  }

  function baixarModelo() {
    baixarCSV("modelo_produtos.csv", CSV_MODELO_HEADER, CSV_MODELO_EXEMPLO);
  }

  async function confirmar() {
    if (linhas.length === 0) return;
    setSalvando(true);
    // descarta os campos de controle (_linha) antes de gravar
    const res = await importarProdutos(linhas.map(({ _linha, ...rest }) => rest));
    setSalvando(false);
    if (!res.ok) {
      alerta({ titulo: "Falha ao importar", mensagem: res.erro || "Tente novamente." });
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center">
      <div className="surface w-full max-w-lg rounded-t-3xl md:rounded-3xl p-5 space-y-3 max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-brand-500" /> Importar produtos
          </h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <p className="text-sm text-muted">
          Envie uma planilha <b>.csv</b> com as colunas <b>nome</b> e <b>preço</b> (e, se quiser,
          categoria, custo, estoque, estoque mínimo, sku e marca).
        </p>

        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="btn-primary flex-1 py-2 text-sm">
            <Upload size={16} /> Escolher arquivo
          </button>
          <button onClick={baixarModelo} className="btn-ghost py-2 px-3 text-sm whitespace-nowrap">
            Baixar modelo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => onArquivo(e.target.files)}
          />
        </div>

        {nomeArq && (
          <div className="text-xs text-muted">
            Arquivo: <b>{nomeArq}</b> · {linhas.length} produto(s) prontos
            {erros.length > 0 ? ` · ${erros.length} com problema` : ""}
          </div>
        )}

        {erros.length > 0 && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
              <AlertTriangle size={15} /> Linhas ignoradas
            </div>
            {erros.slice(0, 6).map((e, i) => (
              <div key={i} className="text-xs text-muted">
                Linha {e.linha}: {e.motivo}
              </div>
            ))}
            {erros.length > 6 && <div className="text-xs text-muted">…e mais {erros.length - 6}.</div>}
          </div>
        )}

        {linhas.length > 0 && (
          <div className="rounded-xl border border-default overflow-hidden">
            <div className="surface-alt text-[11px] font-semibold text-muted grid grid-cols-12 px-3 py-2">
              <span className="col-span-5">Produto</span>
              <span className="col-span-3">Categoria</span>
              <span className="col-span-2 text-right">Preço</span>
              <span className="col-span-2 text-right">Estoque</span>
            </div>
            <div className="max-h-52 overflow-auto divide-y divide-[var(--border)]">
              {linhas.slice(0, 50).map((l) => (
                <div key={l._linha} className="grid grid-cols-12 px-3 py-1.5 text-sm">
                  <span className="col-span-5 truncate">{l.nome}</span>
                  <span className="col-span-3 truncate text-muted">{l.categoria}</span>
                  <span className="col-span-2 text-right">{brl(l.precoVenda)}</span>
                  <span className="col-span-2 text-right">{l.estoqueAtual}</span>
                </div>
              ))}
            </div>
            {linhas.length > 50 && (
              <div className="surface-alt text-[11px] text-muted px-3 py-1.5 text-center">
                Mostrando 50 de {linhas.length}. Todos serão importados.
              </div>
            )}
          </div>
        )}

        <button
          onClick={confirmar}
          disabled={salvando || linhas.length === 0}
          className="btn-primary w-full disabled:opacity-60"
        >
          {salvando
            ? "Importando…"
            : linhas.length > 0
            ? `Importar ${linhas.length} produto(s)`
            : "Escolha um arquivo"}
        </button>
      </div>
    </div>
  );
}

function ProdutoForm({
  editar,
  categorias,
  onClose,
}: {
  editar: Produto | null;
  categorias: string[];
  onClose: () => void;
}) {
  const { addProduto, updateProduto, config, orgId } = useStore();
  const { alerta } = useDialog();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(editar?.nome ?? "");
  const [categoria, setCategoria] = useState(editar?.categoria ?? categorias[0]);
  const [marca, setMarca] = useState(editar?.marca ?? "");
  const [descricao, setDescricao] = useState(editar?.descricao ?? "");
  const [custo, setCusto] = useState(editar ? String(editar.custo) : "");
  const [preco, setPreco] = useState(editar ? String(editar.precoVenda) : "");
  const [precoDe, setPrecoDe] = useState(
    editar?.precoComparativo != null ? String(editar.precoComparativo) : ""
  );
  const [imposto, setImposto] = useState(editar ? String(editar.impostoPercent) : "0");
  const [estoque, setEstoque] = useState(editar ? String(editar.estoqueAtual) : "");
  const [minimo, setMinimo] = useState(editar ? String(editar.estoqueMinimo) : "5");
  const [imagens, setImagens] = useState<string[]>(editar?.imagens ?? []);
  const [usaGrade, setUsaGrade] = useState((editar?.variacoes.length ?? 0) > 0);
  const [variacoes, setVariacoes] = useState<Variacao[]>(editar?.variacoes ?? []);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // sugere preço pela margem ao digitar custo (só no cadastro novo)
  function onCusto(v: string) {
    setCusto(v);
    const c = parseFloat(v);
    if (!isNaN(c) && !preco && !editar) {
      setPreco((c * (1 + config.margemPadrao / 100)).toFixed(2));
    }
  }

  async function onUpload(files: FileList | null) {
    if (!files || !orgId) return;
    setEnviando(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadProdutoImagem(orgId, f));
      setImagens((prev) => [...prev, ...urls]);
    } catch (e: any) {
      alerta({ titulo: "Falha ao enviar imagem", mensagem: e?.message || String(e) });
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addVariacao() {
    setVariacoes((v) => [
      ...v,
      { id: "", nome: "", sku: "", estoqueAtual: 0, precoAjuste: 0, ativo: true },
    ]);
  }
  function setVar(i: number, patch: Partial<Variacao>) {
    setVariacoes((v) => v.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function rmVar(i: number) {
    setVariacoes((v) => v.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    if (!nome || !custo || !preco) return;
    const vars = usaGrade
      ? variacoes
          .filter((v) => v.nome.trim())
          .map((v) => ({ ...v, nome: v.nome.trim() }))
      : [];
    const base = {
      nome,
      categoria,
      marca: marca || undefined,
      descricao: descricao || undefined,
      custo: parseFloat(custo),
      precoVenda: parseFloat(preco),
      precoComparativo: precoDe ? parseFloat(precoDe) : undefined,
      impostoPercent: parseFloat(imposto) || 0,
      estoqueMinimo: parseInt(minimo) || 5,
      imagens,
    };
    setSalvando(true);
    try {
      // estoque só é gravado se o número mudou (o store compara com o atual e
      // usa ajuste atômico no banco); com grade, vale o estoque das variações.
      const res = editar
        ? await updateProduto(editar.id, {
            ...base,
            estoqueAtual: usaGrade ? editar.estoqueAtual : parseInt(estoque) || 0,
            variacoes: vars,
          })
        : await addProduto({
            ...base,
            estoqueAtual: usaGrade ? 0 : parseInt(estoque) || 0,
            variacoes: vars.map(({ id, ...rest }) => rest),
          });
      if (!res.ok) {
        alerta({ titulo: "Não foi possível salvar o produto", mensagem: res.erro || "Tente novamente." });
        return;
      }
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center">
      <div className="surface w-full max-w-md rounded-t-3xl md:rounded-3xl p-5 space-y-3 max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{editar ? "Editar produto" : "Novo produto"}</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        {/* fotos */}
        <div>
          <label className="label">Fotos</label>
          <div className="flex gap-2 flex-wrap">
            {imagens.map((url, i) => (
              <div key={url} className="relative h-16 w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-default" />
                <button
                  onClick={() => setImagens((p) => p.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={enviando}
              className="h-16 w-16 rounded-lg border border-dashed border-default flex items-center justify-center text-muted disabled:opacity-50"
            >
              {enviando ? "…" : <ImagePlus size={20} />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onUpload(e.target.files)}
            />
          </div>
        </div>

        <div>
          <label className="label">Nome</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {(categoria && !categorias.includes(categoria) ? [categoria, ...categorias] : categorias).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Marca</label>
            <input className="input" value={marca} onChange={(e) => setMarca(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Descrição</label>
          <textarea
            className="input"
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes que aparecem na mini-loja"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Custo (R$)</label>
            <input className="input" inputMode="decimal" value={custo} onChange={(e) => onCusto(e.target.value)} />
          </div>
          <div>
            <label className="label">Preço venda (R$)</label>
            <input className="input" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
          </div>
          <div>
            <label className="label">Preço &quot;de&quot; (R$)</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="opcional"
              value={precoDe}
              onChange={(e) => setPrecoDe(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Imposto (%)</label>
            <input className="input" inputMode="decimal" value={imposto} onChange={(e) => setImposto(e.target.value)} />
          </div>
        </div>

        {/* grade / variações */}
        <div className="rounded-xl surface-alt p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={usaGrade} onChange={(e) => setUsaGrade(e.target.checked)} />
            <Layers size={15} className="text-brand-500" /> Usar variações / grade (tamanho, cor…)
          </label>
          {usaGrade && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted">
                O estoque do produto passa a ser a soma das variações.
              </p>
              {variacoes.map((v, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                  <input
                    className="input col-span-4 py-1.5 text-sm"
                    placeholder="Aro 16"
                    value={v.nome}
                    onChange={(e) => setVar(i, { nome: e.target.value })}
                  />
                  <input
                    className="input col-span-3 py-1.5 text-sm"
                    placeholder="SKU"
                    value={v.sku ?? ""}
                    onChange={(e) => setVar(i, { sku: e.target.value })}
                  />
                  <input
                    className="input col-span-2 py-1.5 text-sm"
                    inputMode="numeric"
                    placeholder="Qtd"
                    value={v.estoqueAtual || ""}
                    onChange={(e) => setVar(i, { estoqueAtual: parseInt(e.target.value) || 0 })}
                  />
                  <input
                    className="input col-span-2 py-1.5 text-sm"
                    inputMode="decimal"
                    placeholder="±R$"
                    value={v.precoAjuste || ""}
                    onChange={(e) => setVar(i, { precoAjuste: parseFloat(e.target.value) || 0 })}
                  />
                  <button onClick={() => rmVar(i)} className="col-span-1 text-red-500 flex justify-center">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button onClick={addVariacao} className="text-brand-500 text-sm flex items-center gap-1">
                <Plus size={14} /> Adicionar variação
              </button>
            </div>
          )}
        </div>

        {!usaGrade && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Estoque atual</label>
              <input className="input" inputMode="numeric" value={estoque} onChange={(e) => setEstoque(e.target.value)} />
            </div>
            <div>
              <label className="label">Estoque mínimo</label>
              <input className="input" inputMode="numeric" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
            </div>
          </div>
        )}
        {usaGrade && (
          <div>
            <label className="label">Estoque mínimo (alerta)</label>
            <input className="input" inputMode="numeric" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
          </div>
        )}

        <button onClick={salvar} disabled={salvando || enviando} className="btn-primary w-full disabled:opacity-60">
          {salvando ? "Salvando…" : editar ? "Salvar alterações" : "Salvar produto"}
        </button>
      </div>
    </div>
  );
}

function ResumoEstoque({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="card py-3 text-center">
      <div className={`text-2xl font-bold ${cor}`}>{valor}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
