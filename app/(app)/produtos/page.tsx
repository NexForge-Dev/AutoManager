"use client";
import { useState, useRef } from "react";
import { useStore } from "@/lib/store";
import { categoriasDaLoja } from "@/lib/seed";
import { brl } from "@/lib/analytics";
import { uploadProdutoImagem } from "@/lib/uploadProdutoImagem";
import { parseProdutosCSV, parseNumero, CSV_MODELO_HEADER, CSV_MODELO_EXEMPLO, type LinhaImport } from "@/lib/csvProdutos";
import { baixarCSV } from "@/lib/export";
import { sugerirPreco } from "@/lib/precos";
import type { Produto, Variacao } from "@/lib/types";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import Modal from "@/components/Modal";
import { EstadoVazio, PageHeader, Selo, Stat } from "@/components/ui";
import {
  Plus,
  X,
  PackagePlus,
  Pencil,
  ImagePlus,
  Trash2,
  Layers,
  SlidersHorizontal,
  Search,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Package,
  PackageX,
  Boxes,
  ImageOff,
  Loader2,
} from "lucide-react";

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
    <div className="space-y-4">
      <PageHeader
        titulo="Estoque"
        descricao={podeEditar ? "Produtos, preços e quantidades da sua loja." : "Produtos e quantidades disponíveis."}
        acoes={
          podeEditar && (
            <>
              <button
                onClick={() => setImportar(true)}
                className="btn-ghost btn-sm"
                title="Importar de planilha (CSV)"
              >
                <Upload size={16} aria-hidden /> Importar
              </button>
              <button onClick={() => setForm({ open: true, editar: null })} className="btn-primary btn-sm">
                <Plus size={17} aria-hidden /> Produto
              </button>
            </>
          )
        }
      />

      {produtos.length === 0 && (
        <div className="card p-0">
          <EstadoVazio
            icone={Package}
            titulo="Nenhum produto ainda"
            acao={
              podeEditar ? (
                <button onClick={() => setForm({ open: true, editar: null })} className="btn-primary">
                  <Plus size={17} aria-hidden /> Cadastrar produto
                </button>
              ) : undefined
            }
          >
            {podeEditar
              ? "Cadastre o que você vende, ou importe de uma planilha."
              : "Peça ao dono da loja para cadastrar os produtos."}
          </EstadoVazio>
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
            <div className="grid-kpi-3 gap-3">
              <Stat rotulo="Em estoque" valor={ok} icone={Boxes} tom="ok" />
              <Stat rotulo="Acabando" valor={acabando} icone={AlertTriangle} tom="warn" valorTom={acabando > 0 ? "warn" : undefined} />
              <Stat rotulo="Sem estoque" valor={semEstoque} icone={PackageX} tom="bad" valorTom={semEstoque > 0 ? "bad" : undefined} />
            </div>
          );
        })()}

      {/* busca */}
      {produtos.length > 0 && (
        <div className="relative">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden />
          <input
            className="input pl-9 pr-10"
            placeholder="Buscar produto, marca ou SKU…"
            aria-label="Buscar produto"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="icon-btn absolute right-0.5 top-1/2 -translate-y-1/2"
              aria-label="Limpar busca"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
      )}

      {/* filtro por categoria (com contador) */}
      {catsPresentes.length > 1 && (
        <div tabIndex={0} role="group" aria-label="Filtrar por categoria" className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          <button onClick={() => setFiltroCat(null)} aria-pressed={filtroCat === null} className="chip">
            Todas <span className="tnum">({produtos.length})</span>
          </button>
          {catsPresentes.map((c) => (
            <button key={c} onClick={() => setFiltroCat(c)} aria-pressed={filtroCat === c} className="chip">
              {c} <span className="tnum">({contagemPorCat.get(c) || 0})</span>
            </button>
          ))}
        </div>
      )}

      {produtosFiltrados.length === 0 && (filtroCat || termo) && (
        <div className="card p-0">
          <EstadoVazio compacto icone={Search} titulo="Nada encontrado">
            {termo
              ? `Nenhum produto encontrado para “${busca.trim()}”${filtroCat ? ` em “${filtroCat}”` : ""}.`
              : `Nenhum produto em “${filtroCat}”.`}
          </EstadoVazio>
        </div>
      )}

      {/* desktop: tabela */}
      {produtosFiltrados.length > 0 && (
        <div className="hidden lg:block card p-0 overflow-hidden">
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Lista de produtos">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th className="num">Preço</th>
                  {podeEditar && <th className="num">Margem</th>}
                  <th className="num">Estoque</th>
                  {podeEditar && <th className="w-px"><span className="sr-only">Ações</span></th>}
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map((p) => (
                  <tr key={p.id} className={p.ativo ? "" : "opacity-60"}>
                    <td>
                      <div className="flex items-center gap-3 min-w-0">
                        <FotoProduto p={p} />
                        <NomeProduto p={p} />
                      </div>
                    </td>
                    <td className="text-muted whitespace-nowrap">{p.categoria}</td>
                    <td className="num">{brl(p.precoVenda)}</td>
                    {podeEditar && <td className="num text-muted">{margemTexto(p)}</td>}
                    <td className="num">
                      <EstoqueSelo p={p} />
                    </td>
                    {podeEditar && (
                      <td>
                        <div className="flex justify-end gap-0.5">
                          <AcoesProduto
                            p={p}
                            onEditar={() => setForm({ open: true, editar: p })}
                            onRepor={() => reporEstoque(p)}
                            onAjustar={() => ajustar(p)}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* celular e tablet: linhas com ações rotuladas */}
      {produtosFiltrados.length > 0 && (
        <div className="lg:hidden card-list">
          {produtosFiltrados.map((p) => (
            <div key={p.id} className={`px-4 py-3 ${p.ativo ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-3">
                <FotoProduto p={p} />
                <div className="min-w-0 flex-1">
                  <NomeProduto p={p} />
                  <div className="text-xs text-muted truncate tnum">
                    {p.categoria} · {brl(p.precoVenda)}
                    {podeEditar && !(p.custo > 0) && <> · sem custo</>}
                    {podeEditar && p.custo > 0 && p.precoVenda > 0 && <> · margem {margemTexto(p)}</>}
                  </div>
                </div>
                <EstoqueSelo p={p} />
              </div>
              {podeEditar && (
                <div className="flex gap-2 mt-2.5">
                  <AcoesProduto
                    rotulada
                    p={p}
                    onEditar={() => setForm({ open: true, editar: p })}
                    onRepor={() => reporEstoque(p)}
                    onAjustar={() => ajustar(p)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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

// margem exibida na lista: "—" quando o produto não tem custo cadastrado
function margemTexto(p: Produto): string {
  if (!(p.custo > 0)) return "—";
  if (!(p.precoVenda > 0)) return "—";
  return `${(((p.precoVenda - p.custo) / p.precoVenda) * 100).toFixed(0)}%`;
}

function FotoProduto({ p }: { p: Produto }) {
  if (p.imagens[0]) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={p.imagens[0]}
        alt={p.nome}
        loading="lazy"
        decoding="async"
        className="h-10 w-10 rounded-lg object-cover shrink-0 border border-default"
      />
    );
  }
  return (
    <span className="grid place-items-center h-10 w-10 rounded-lg surface-alt text-muted shrink-0" aria-hidden>
      <ImageOff size={16} />
    </span>
  );
}

function NomeProduto({ p }: { p: Produto }) {
  return (
    <div className="min-w-0">
      <div className="font-semibold truncate">
        {p.nome}
        {p.marca ? <span className="text-muted font-normal"> · {p.marca}</span> : null}
      </div>
      {(!p.ativo || p.variacoes.length > 0) && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {!p.ativo && <Selo>Inativo</Selo>}
          {p.variacoes.length > 0 && (
            <Selo tom="brand" icone={Layers}>
              {p.variacoes.length} {p.variacoes.length === 1 ? "variação" : "variações"}
            </Selo>
          )}
        </div>
      )}
    </div>
  );
}

function EstoqueSelo({ p }: { p: Produto }) {
  if (p.estoqueAtual <= 0) return <Selo tom="bad" className="tnum shrink-0">{p.estoqueAtual} un</Selo>;
  if (p.estoqueAtual <= p.estoqueMinimo) return <Selo tom="warn" className="tnum shrink-0">{p.estoqueAtual} un</Selo>;
  return <span className="font-semibold tnum shrink-0 text-sm">{p.estoqueAtual} un</span>;
}

// produto com grade: entrada/ajuste são por variação, então só edita
function AcoesProduto({
  p,
  rotulada = false,
  onEditar,
  onRepor,
  onAjustar,
}: {
  p: Produto;
  rotulada?: boolean;
  onEditar: () => void;
  onRepor: () => void;
  onAjustar: () => void;
}) {
  const temGrade = p.variacoes.length > 0;
  const estilo = rotulada ? "btn-ghost btn-sm flex-1 px-2" : "icon-btn";
  return (
    <>
      {!temGrade && (
        <>
          <button onClick={onRepor} className={estilo} title="Dar entrada (comprei)" aria-label={`Dar entrada no estoque de ${p.nome}`}>
            <PackagePlus size={16} aria-hidden /> {rotulada && "Entrada"}
          </button>
          <button onClick={onAjustar} className={estilo} title="Ajustar estoque" aria-label={`Ajustar estoque de ${p.nome}`}>
            <SlidersHorizontal size={15} aria-hidden /> {rotulada && "Ajustar"}
          </button>
        </>
      )}
      <button onClick={onEditar} className={estilo} title="Editar produto" aria-label={`Editar produto ${p.nome}`}>
        <Pencil size={15} aria-hidden /> {rotulada && "Editar"}
      </button>
    </>
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
    // Excel pt-BR salva "CSV (separado por ;)" em Windows-1252: lido como UTF-8,
    // "Coração" virava "Cora��o". Tenta UTF-8 estrito e cai no 1252.
    const bytes = await f.arrayBuffer();
    let texto: string;
    try {
      texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      texto = new TextDecoder("windows-1252").decode(bytes);
    }
    processar(texto.replace(/^\uFEFF/, ""), f.name);
    if (fileRef.current) fileRef.current.value = "";
  }

  function baixarModelo() {
    baixarCSV("modelo_produtos.csv", CSV_MODELO_HEADER, CSV_MODELO_EXEMPLO);
  }

  async function confirmar() {
    if (linhas.length === 0) return;
    if (salvando) return;
    setSalvando(true);
    // descarta os campos de controle (_linha) antes de gravar
    const res = await importarProdutos(linhas.map(({ _linha, ...rest }) => rest)).catch(() => ({
      ok: false as const,
      inseridos: 0,
      erro: "Sem conexão. Tente de novo.",
    }));
    setSalvando(false);
    if (!res.ok) {
      alerta({ titulo: "Falha ao importar", mensagem: res.erro || "Tente novamente." });
      return;
    }
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      largura="md:max-w-lg"
      icone={<FileSpreadsheet size={19} className="text-muted" aria-hidden />}
      titulo="Importar produtos"
    >

        <p className="text-sm text-muted">
          Envie uma planilha <b>.csv</b> com as colunas <b>nome</b> e <b>preço</b> (e, se quiser,
          categoria, custo, estoque, estoque mínimo, sku e marca).
        </p>

        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="btn-primary btn-sm flex-1">
            <Upload size={16} aria-hidden /> Escolher arquivo
          </button>
          <button onClick={baixarModelo} className="btn-ghost btn-sm whitespace-nowrap">
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
          <div className="rounded-xl bg-bad/[.06] border border-bad/30 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-bad">
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
                  <span className="col-span-2 text-right tnum">{brl(l.precoVenda)}</span>
                  <span className="col-span-2 text-right tnum">{l.estoqueAtual}</span>
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
          className="btn-primary w-full"
        >
          {salvando
            ? "Importando…"
            : linhas.length > 0
            ? `Importar ${linhas.length} produto(s)`
            : "Escolha um arquivo"}
        </button>
    </Modal>
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
  const { alerta, confirm } = useDialog();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(editar?.nome ?? "");
  const [categoria, setCategoria] = useState(editar?.categoria ?? categorias[0] ?? "");
  const [marca, setMarca] = useState(editar?.marca ?? "");
  const [descricao, setDescricao] = useState(editar?.descricao ?? "");
  // valores já gravados aparecem no formato pt-BR ("12,50"), como a pessoa digita
  const [custo, setCusto] = useState(editar ? numBR(editar.custo) : "");
  const [preco, setPreco] = useState(editar ? numBR(editar.precoVenda) : "");
  const [precoDe, setPrecoDe] = useState(
    editar?.precoComparativo != null ? numBR(editar.precoComparativo) : ""
  );
  const [imposto, setImposto] = useState(editar ? String(editar.impostoPercent).replace(".", ",") : "0");
  const [ativo, setAtivo] = useState(editar?.ativo ?? true);
  const [estoque, setEstoque] = useState(editar ? String(editar.estoqueAtual) : "");
  const [minimo, setMinimo] = useState(editar ? String(editar.estoqueMinimo) : "5");
  const [imagens, setImagens] = useState<string[]>(editar?.imagens ?? []);
  const [usaGrade, setUsaGrade] = useState((editar?.variacoes.length ?? 0) > 0);
  const [variacoes, setVariacoes] = useState<Variacao[]>(editar?.variacoes ?? []);
  // texto digitado no "±R$" de cada variação (deixa digitar "-", "1," etc.)
  const [ajustesTxt, setAjustesTxt] = useState<string[]>(
    (editar?.variacoes ?? []).map((v) => (v.precoAjuste ? String(v.precoAjuste).replace(".", ",") : ""))
  );
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // sugere preço pela margem ao digitar custo (só no cadastro novo). Recalcula a
  // cada tecla enquanto a pessoa não editar o preço à mão (antes congelava no 1º
  // dígito: custo "25" virava preço "4.00").
  const [precoEditado, setPrecoEditado] = useState(false);
  function onCusto(v: string) {
    setCusto(v);
    if (editar || precoEditado) return;
    const c = parseNumero(v);
    setPreco(!isNaN(c) && c > 0 ? sugerirPreco(c, config.margemPadrao) : "");
  }
  function onPreco(v: string) {
    setPreco(v);
    setPrecoEditado(v.trim() !== "");
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
    setAjustesTxt((a) => [...a, ""]);
  }
  function setVar(i: number, patch: Partial<Variacao>) {
    setVariacoes((v) => v.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function rmVar(i: number) {
    setVariacoes((v) => v.filter((_, idx) => idx !== i));
    setAjustesTxt((a) => a.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    // aceita vírgula decimal ("12,50") - parseFloat sozinho cortava para 12
    const custoNum = custo.trim() ? parseNumero(custo) : 0;
    const precoNum = parseNumero(preco);
    const precoDeNum = precoDe.trim() ? parseNumero(precoDe) : undefined;
    const impostoNum = imposto.trim() ? parseNumero(imposto) : 0;
    const faltando = [
      !nome.trim() && "nome",
      !(precoNum > 0) && "preço de venda",
      (isNaN(custoNum) || custoNum < 0) && "custo (número maior ou igual a zero)",
      precoDeNum != null && (isNaN(precoDeNum) || precoDeNum < 0) && "preço \"de\" (número maior ou igual a zero)",
      (isNaN(impostoNum) || impostoNum < 0 || impostoNum > 100) && "imposto (entre 0% e 100%)",
      !categoria && "categoria",
    ].filter(Boolean);
    if (faltando.length > 0) {
      alerta({ titulo: "Faltam dados do produto", mensagem: `Preencha: ${faltando.join(", ")}.` });
      return;
    }
    const vars = usaGrade
      ? variacoes
          .filter((v) => v.nome.trim())
          .map((v) => ({ ...v, nome: v.nome.trim(), estoqueAtual: Math.max(0, v.estoqueAtual || 0) }))
      : [];
    // variações que já existiam e vão sumir (grade desligada ou nome apagado):
    // excluir apaga o estoque delas, então pede confirmação
    if (editar) {
      const ficam = new Set(vars.map((v) => v.id).filter(Boolean));
      const somem = editar.variacoes.filter((v) => !ficam.has(v.id));
      if (somem.length > 0) {
        const ok = await confirm({
          titulo: `Excluir ${somem.length} variação(ões)?`,
          mensagem: `${somem.map((v) => v.nome).join(", ")} ${somem.length === 1 ? "será excluída" : "serão excluídas"} junto com o estoque. As vendas já registradas continuam no histórico.`,
          confirmar: "Excluir e salvar",
          perigo: true,
        });
        if (!ok) return;
      }
    }
    // estoque base: campo vazio na edição = não mexe (antes virava 0 sem aviso)
    const estoqueDigitado = parseInt(estoque);
    if (!usaGrade && estoque.trim() !== "" && (isNaN(estoqueDigitado) || estoqueDigitado < 0)) {
      alerta({ titulo: "Estoque inválido", mensagem: "Informe o estoque atual como um número inteiro (0 ou mais)." });
      return;
    }
    const base = {
      nome: nome.trim(),
      categoria,
      marca: marca || undefined,
      descricao: descricao || undefined,
      custo: custoNum,
      precoVenda: precoNum,
      precoComparativo: precoDeNum != null && !isNaN(precoDeNum) ? precoDeNum : undefined,
      impostoPercent: impostoNum,
      estoqueMinimo: (() => {
        const m = parseInt(minimo);
        return isNaN(m) || m < 0 ? 5 : m; // 0 é válido (sem alerta)
      })(),
      imagens,
      ...(editar ? { ativo } : {}),
    };
    setSalvando(true);
    try {
      // estoque só é gravado se o número mudou (o store compara com o atual e
      // usa ajuste atômico no banco); com grade, vale o estoque das variações.
      const res = editar
        ? await updateProduto(editar.id, {
            ...base,
            estoqueAtual: usaGrade || estoque.trim() === "" ? editar.estoqueAtual : estoqueDigitado,
            variacoes: vars,
          })
        : await addProduto({
            ...base,
            estoqueAtual: usaGrade || estoque.trim() === "" ? 0 : estoqueDigitado,
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
    <Modal onClose={onClose} titulo={editar ? "Editar produto" : "Novo produto"} largura="md:max-w-2xl" className="space-y-4">

        {/* fotos */}
        <div>
          <div className="label">Fotos</div>
          <div className="flex gap-2 flex-wrap">
            {imagens.map((url, i) => (
              <div key={url} className="relative h-16 w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-default" />
                <button
                  type="button"
                  onClick={() => setImagens((p) => p.filter((_, idx) => idx !== i))}
                  aria-label="Remover foto"
                  className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-1"
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={enviando}
              aria-label="Adicionar foto"
              className="h-16 w-16 rounded-lg border border-dashed border-default flex items-center justify-center text-muted hover:text-strong hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
            >
              {enviando ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <ImagePlus size={20} aria-hidden />}
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
          <label className="label" htmlFor="prod-nome">Nome</label>
          <input id="prod-nome" className="input" maxLength={200} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="prod-categoria">Categoria</label>
            <select id="prod-categoria" className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {(categoria && !categorias.includes(categoria) ? [categoria, ...categorias] : categorias).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="prod-marca">Marca</label>
            <input id="prod-marca" className="input" value={marca} onChange={(e) => setMarca(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="prod-descricao">Descrição</label>
          <textarea
            id="prod-descricao"
            className="input"
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes que aparecem na mini-loja"
          />
        </div>

        <fieldset className="border-t border-default pt-3">
          <legend className="section-title pr-2">Preços</legend>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
            <div>
              <label className="label" htmlFor="prod-custo">Custo (R$)</label>
              <input id="prod-custo" className="input" inputMode="decimal" value={custo} onChange={(e) => onCusto(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="prod-preco">Preço venda (R$)</label>
              <input id="prod-preco" className="input" inputMode="decimal" value={preco} onChange={(e) => onPreco(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="prod-preco-de">Preço &quot;de&quot; (R$)</label>
              <input
                id="prod-preco-de"
                className="input"
                inputMode="decimal"
                placeholder="opcional"
                value={precoDe}
                onChange={(e) => setPrecoDe(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="prod-imposto">Imposto (%)</label>
              <input id="prod-imposto" className="input" inputMode="decimal" value={imposto} onChange={(e) => setImposto(e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className="border-t border-default pt-3 space-y-3">
          <legend className="section-title pr-2">Estoque</legend>

          {/* grade / variações */}
          <div className="rounded-xl surface-alt p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium min-h-[28px]">
              <input type="checkbox" checked={usaGrade} onChange={(e) => setUsaGrade(e.target.checked)} />
              <Layers size={15} className="text-muted" aria-hidden /> Usar variações / grade (tamanho, cor…)
            </label>
            {usaGrade && (
              <div className="space-y-2">
                <p className="text-xs text-muted">
                  O estoque do produto passa a ser a soma das variações.
                </p>
                {variacoes.map((v, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_2.5rem] sm:grid-cols-[1.5fr_1fr_5rem_5rem_2.5rem] gap-1.5 items-center">
                    <input
                      className="input"
                      aria-label="Nome da variação"
                      placeholder="Aro 16"
                      value={v.nome}
                      onChange={(e) => setVar(i, { nome: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="SKU"
                      aria-label="SKU da variação"
                      value={v.sku ?? ""}
                      onChange={(e) => setVar(i, { sku: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => rmVar(i)}
                      aria-label="Remover variação"
                      className="icon-btn hover:!text-bad sm:order-last"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                    <input
                      className="input"
                      inputMode="numeric"
                      placeholder="Qtd"
                      aria-label="Estoque da variação"
                      value={v.estoqueAtual || ""}
                      onChange={(e) => setVar(i, { estoqueAtual: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                    <input
                      className="input"
                      inputMode="decimal"
                      placeholder="±R$"
                      aria-label="Ajuste de preço da variação (R$)"
                      value={ajustesTxt[i] ?? ""}
                      onChange={(e) => {
                        const t = e.target.value;
                        setAjustesTxt((a) => a.map((x, idx) => (idx === i ? t : x)));
                        setVar(i, { precoAjuste: parseNumero(t) || 0 });
                      }}
                    />
                  </div>
                ))}
                <button onClick={addVariacao} className="btn-ghost btn-sm">
                  <Plus size={15} aria-hidden /> Adicionar variação
                </button>
              </div>
            )}
          </div>

          {!usaGrade && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="prod-estoque">Estoque atual</label>
                <input id="prod-estoque" className="input" inputMode="numeric" value={estoque} onChange={(e) => setEstoque(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="prod-minimo">Estoque mínimo</label>
                <input id="prod-minimo" className="input" inputMode="numeric" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
              </div>
            </div>
          )}
          {usaGrade && (
            <div>
              <label className="label" htmlFor="prod-minimo-grade">Estoque mínimo (alerta)</label>
              <input id="prod-minimo-grade" className="input" inputMode="numeric" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
            </div>
          )}
        </fieldset>

        {editar && (
          <label className="flex items-start gap-2 text-sm rounded-xl surface-alt p-3">
            <input type="checkbox" className="mt-0.5" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            <span>
              <span className="font-medium">Produto ativo</span>
              <span className="block text-xs text-muted">
                Desmarque para tirar o produto da tela Vender, da vitrine e do catálogo das revendedoras, sem perder o histórico.
              </span>
            </span>
          </label>
        )}

        <button onClick={salvar} disabled={salvando || enviando} className="btn-primary w-full">
          {salvando ? "Salvando…" : editar ? "Salvar alterações" : "Salvar produto"}
        </button>
    </Modal>
  );
}

// número gravado -> texto pt-BR para o campo ("12.5" -> "12,50")
function numBR(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2).replace(".", ",") : "";
}
