"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { registrarMetrica } from "@/lib/metricas/cliente";
import { aplicarAparencia, TEMAS_BASE, RAIOS } from "@/lib/aparencia";
import { uploadLogo, uploadCapa } from "@/lib/uploadLogo";
import { brl } from "@/lib/analytics";
import { slugSugerido } from "@/lib/slug";
import { FONTES, carregarFonte } from "@/lib/fontes";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import { Aviso, EstadoVazio, LinkAcao, PageHeader, Painel, Segmentado } from "@/components/ui";
import type { Produto } from "@/lib/types";
import {
  Globe,
  Palette,
  Type,
  Image as ImageIcon,
  Upload,
  Loader2,
  Copy,
  ExternalLink,
  Check,
  Gem,
  AlertTriangle,
  Smartphone,
  MessageCircle,
  Phone,
  Mail,
  Instagram,
  Facebook,
  Music2,
  Info,
  AtSign,
  ImagePlus,
  Trash2,
  Brush,
  Pipette,
} from "lucide-react";

export default function MinhaLojaPage() {
  return (
    <Guard>
      <MinhaLoja />
    </Guard>
  );
}

// no celular e no tablet a edição e a prévia não cabem lado a lado
const VISTAS = [
  ["editar", "Editar"],
  ["previa", "Ver prévia"],
] as const;

const CORES: { hex: string; nome: string }[] = [
  { hex: "#db2777", nome: "Rosa" },
  { hex: "#7c3aed", nome: "Roxo" },
  { hex: "#2563eb", nome: "Azul" },
  { hex: "#0d9488", nome: "Verde-azulado" },
  { hex: "#ea580c", nome: "Laranja" },
  { hex: "#dc2626", nome: "Vermelho" },
  { hex: "#ca8a04", nome: "Mostarda" },
  { hex: "#111827", nome: "Grafite" },
];

// mesmo formato que o banco aceita para org.slug (<= 60, minúsculas/números, hífens entre partes)
const SLUG_MAX = 60;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Normaliza o que o usuário digitou: sem acento, minúsculo, hífen único entre partes, até 60. */
function limparSlug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

function MinhaLoja() {
  const { config, orgId, produtos, setConfig, definirSlug } = useStore();
  const { alerta, confirm } = useDialog();
  const fileRef = useRef<HTMLInputElement>(null);
  const capaRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(config.nomeLoja);
  const [descricao, setDescricao] = useState(config.lojaDescricao ?? "");
  const [slug, setSlug] = useState(config.slug ?? "");
  const [cor, setCor] = useState<string | null>(config.corMarca);
  const [temaBase, setTemaBase] = useState<string | null>(config.temaBase);
  const [appFonte, setAppFonte] = useState<string | null>(config.appFonte);
  const [appRaio, setAppRaio] = useState<string | null>(config.appRaio);
  const [logoUrl, setLogoUrl] = useState<string | null>(config.logoUrl);
  const [capaUrl, setCapaUrl] = useState<string | null>(config.lojaCapaUrl);
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  const [fonte, setFonte] = useState(config.lojaFonte ?? "padrao");
  const [sobre, setSobre] = useState(config.lojaSobre ?? "");

  // contato + redes
  const [whatsapp, setWhatsapp] = useState(config.lojaWhatsapp ?? "");
  const [telefone, setTelefone] = useState(config.lojaTelefone ?? "");
  const [email, setEmail] = useState(config.lojaEmail ?? "");
  const [instagram, setInstagram] = useState(config.lojaInstagram ?? "");
  const [facebook, setFacebook] = useState(config.lojaFacebook ?? "");
  const [tiktok, setTiktok] = useState(config.lojaTiktok ?? "");

  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  // área de transferência indisponível/negada: mostra o link para copiar à mão
  const [copiaManual, setCopiaManual] = useState(false);
  const [alternando, setAlternando] = useState(false);
  const [salvandoSlug, setSalvandoSlug] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);

  const [vista, setVista] = useState<"editar" | "previa">("editar");

  const [fontStack, setFontStack] = useState("");
  useEffect(() => {
    setFontStack(carregarFonte(fonte));
  }, [fonte]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = config.slug ? `${origin}/loja/${config.slug}` : "";

  const visiveis = produtos.filter((p) => p.ativo);
  const ocultos = produtos.length - visiveis.length;
  const semEstoque = visiveis.filter((p) => p.estoqueAtual <= 0).length;

  async function toggleAtiva() {
    if (alternando) return; // trava toque duplo
    setErro(null);
    const ativar = !config.lojaAtiva;
    setAlternando(true);
    try {
      if (ativar && !config.slug) {
        const s = limparSlug(slugSugerido(config.nomeLoja || "minha-loja")) || "minha-loja";
        const r = await definirSlug(s);
        if (!r.ok) {
          setErro(r.erro || "Não foi possível gerar o link");
          return;
        }
        setSlug(s);
      }
      const r = await setConfig({ lojaAtiva: ativar });
      if (!r.ok) {
        setErro(r.erro || (ativar ? "Não foi possível colocar a loja no ar." : "Não foi possível tirar a loja do ar."));
        return;
      }
      if (ativar) registrarMetrica({ tipo: "recurso", recurso: "loja_online_publicada" });
    } finally {
      setAlternando(false);
    }
  }

  async function salvarSlug() {
    setErro(null);
    const limpo = limparSlug(slug);
    if (!limpo || !SLUG_RE.test(limpo)) {
      setErro("Link inválido: use letras, números e hífen (até 60 caracteres).");
      return;
    }
    if (limpo !== slug) setSlug(limpo); // mostra como ficou (sem acento, espaços ou "--")
    if (limpo === config.slug) return;
    // trocar o link de uma loja já publicada quebra o link antigo (WhatsApp, Instagram...):
    // confirma antes, mostrando como o endereço ficou depois da limpeza
    if (config.slug) {
      const ok = await confirm({
        titulo: "Trocar o link da loja?",
        mensagem: `O novo endereço será /loja/${limpo}. O link antigo (/loja/${config.slug}) deixa de funcionar para quem já recebeu.`,
        confirmar: "Trocar link",
        perigo: true,
      });
      if (!ok) {
        setSlug(config.slug);
        return;
      }
    }
    setSalvandoSlug(true);
    const r = await definirSlug(limpo);
    setSalvandoSlug(false);
    if (!r.ok) setErro(r.erro || "Erro ao salvar o link");
    else setSlug(limpo);
  }

  // Pré-visualização ao vivo da aparência do painel (cor + tema + fonte + raio).
  function previewAparencia(over: { cor?: string | null; tema?: string | null; fonte?: string | null; raio?: string | null }) {
    aplicarAparencia({
      corMarca: over.cor !== undefined ? over.cor : cor,
      temaBase: over.tema !== undefined ? over.tema : temaBase,
      appFonte: over.fonte !== undefined ? over.fonte : appFonte,
      appRaio: over.raio !== undefined ? over.raio : appRaio,
    });
  }

  // o seletor de cor dispara a cada movimento: só grava quando o usuário para
  const corTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function escolherCor(hex: string | null) {
    setCor(hex);
    previewAparencia({ cor: hex });
    if (corTimer.current) clearTimeout(corTimer.current);
    corTimer.current = setTimeout(() => persistir({ corMarca: hex }), 400);
  }

  function escolherTema(key: string | null) {
    setTemaBase(key);
    previewAparencia({ tema: key });
    persistir({ temaBase: key });
  }

  function escolherFonteApp(key: string | null) {
    setAppFonte(key);
    previewAparencia({ fonte: key });
    persistir({ appFonte: key });
  }

  function escolherRaio(key: string | null) {
    setAppRaio(key);
    previewAparencia({ raio: key });
    persistir({ appRaio: key });
  }

  function escolherFonte(k: string) {
    setFonte(k);
    persistir({ lojaFonte: k === "padrao" ? null : k });
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setEnviandoLogo(true);
    try {
      const u = await uploadLogo(orgId, file);
      const res = await setConfig({ logoUrl: u });
      if (!res.ok) throw new Error(res.erro || "A imagem foi enviada, mas não foi salva na loja.");
      // só mostra a logo nova depois de salva (senão a prévia mostraria algo que não está na loja)
      setLogoUrl(u);
    } catch (err: any) {
      alerta({ titulo: "Não foi possível enviar a logo", mensagem: err?.message || "Tente novamente." });
    } finally {
      setEnviandoLogo(false);
      e.target.value = ""; // permite reenviar o mesmo arquivo
    }
  }

  async function onCapa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setEnviandoCapa(true);
    try {
      const u = await uploadCapa(orgId, file);
      const res = await setConfig({ lojaCapaUrl: u });
      if (!res.ok) throw new Error(res.erro || "A imagem foi enviada, mas não foi salva na loja.");
      setCapaUrl(u);
    } catch (err: any) {
      alerta({ titulo: "Não foi possível enviar a capa", mensagem: err?.message || "Tente novamente." });
    } finally {
      setEnviandoCapa(false);
      e.target.value = "";
    }
  }

  async function removerCapa() {
    if (enviandoCapa) return;
    const anterior = capaUrl;
    setEnviandoCapa(true);
    setCapaUrl(null);
    const res = await setConfig({ lojaCapaUrl: null });
    setEnviandoCapa(false);
    if (!res.ok) {
      setCapaUrl(anterior);
      alerta({ titulo: "Não foi possível remover a capa", mensagem: res.erro || "Tente novamente." });
    }
  }

  async function copiar() {
    if (!url) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("sem clipboard");
      await navigator.clipboard.writeText(url);
      setCopiaManual(false);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // http sem HTTPS, navegador antigo ou permissão negada
      setCopiado(false);
      setCopiaManual(true);
    }
  }

  // feedback "Salvo ✓" — minha-loja persiste no onBlur, então confirmamos visualmente
  const [salvoVisivel, setSalvoVisivel] = useState(false);
  const salvoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashSalvo() {
    setSalvoVisivel(true);
    if (salvoTimer.current) clearTimeout(salvoTimer.current);
    salvoTimer.current = setTimeout(() => setSalvoVisivel(false), 1600);
  }
  async function persistir(patch: Record<string, any>) {
    // onBlur sem alteração não grava nem mostra "Salvo"
    const atual = useStore.getState().config as Record<string, any>;
    if (Object.keys(patch).every((k) => (atual[k] ?? null) === (patch[k] ?? null))) return;
    const res = await setConfig(patch as any);
    if (!res.ok) {
      // o store desfez a config; a aparência na tela volta para a salva
      const c = useStore.getState().config;
      if ("corMarca" in patch) setCor(c.corMarca);
      if ("temaBase" in patch) setTemaBase(c.temaBase);
      if ("appFonte" in patch) setAppFonte(c.appFonte);
      if ("appRaio" in patch) setAppRaio(c.appRaio);
      if ("lojaFonte" in patch) setFonte(c.lojaFonte ?? "padrao");
      alerta({ titulo: "Não foi possível salvar", mensagem: res.erro || "Tente novamente." });
      return;
    }
    flashSalvo();
  }

  const salvar = (campo: string, valor: string) => persistir({ [campo]: valor || null });

  return (
    <div className="space-y-4 md:space-y-5">
      {salvoVisivel && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 reveal pointer-events-none">
          <div role="status" className="surface shadow-pop border border-default rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2">
            <Check size={15} className="text-ok" aria-hidden /> Salvo
          </div>
        </div>
      )}

      <PageHeader
        titulo="Minha Loja"
        descricao="Monte sua loja online: link, identidade, contato e vitrine."
        acoes={
          <button
            type="button"
            onClick={toggleAtiva}
            disabled={alternando}
            aria-pressed={config.lojaAtiva}
            title={config.lojaAtiva ? "Tirar a loja do ar" : "Colocar a loja no ar"}
            className="btn-ghost btn-sm"
          >
            {alternando ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <span
                aria-hidden
                className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                  config.lojaAtiva ? "bg-ok" : "bg-[var(--border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                    config.lojaAtiva ? "left-[14px]" : "left-0.5"
                  }`}
                />
              </span>
            )}
            {config.lojaAtiva ? "No ar" : "Fora do ar"}
          </button>
        }
      />

      {!config.lojaAtiva && (
        <Aviso
          tom="warn"
          icone={Globe}
          titulo="Sua loja está fora do ar"
          acao={
            <button type="button" onClick={toggleAtiva} disabled={alternando} className="btn-primary btn-sm">
              Colocar no ar
            </button>
          }
        >
          Ative para gerar o link e deixá-la visível.
        </Aviso>
      )}

      {/* abaixo de lg não cabem as duas colunas: edição e prévia viram duas vistas */}
      <Segmentado
        className="flex lg:hidden [&>button]:flex-1"
        rotulo="Alternar entre edição e prévia"
        opcoes={VISTAS}
        valor={vista}
        onChange={setVista}
      />

      <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 items-start">
        {/* ---------------- edição ---------------- */}
        <div className={`min-w-0 space-y-4 md:space-y-5 ${vista === "previa" ? "hidden lg:block" : ""}`}>
          {/* Link */}
          <Painel titulo="Link da loja" icone={Globe}>
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="loja-slug">Endereço da loja</label>
                <div className="flex min-w-0">
                  <span className="input surface-alt flex w-auto max-w-[58%] shrink items-center rounded-r-none border-r-0 text-sm md:text-sm text-muted">
                    <span className="truncate">{origin.replace(/^https?:\/\//, "")}/loja/</span>
                  </span>
                  <input
                    id="loja-slug"
                    className="input flex-1 min-w-0 rounded-l-none"
                    value={slug}
                    placeholder="minha-loja"
                    maxLength={80}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => setSlug(e.target.value)}
                    onBlur={salvarSlug}
                  />
                </div>
                <p className="hint">
                  {salvandoSlug ? "Salvando…" : "Letras minúsculas, números e hífen, até 60 caracteres."}
                </p>
              </div>
              {url && (
                <div className="flex gap-2">
                  <button type="button" onClick={copiar} className="btn-ghost btn-sm flex-1 sm:flex-none">
                    {copiado ? <Check size={15} className="text-ok" aria-hidden /> : <Copy size={15} aria-hidden />}{" "}
                    {copiado ? "Copiado!" : "Copiar link"}
                  </button>
                  <a href={url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm flex-1 sm:flex-none">
                    <ExternalLink size={15} aria-hidden /> Abrir loja
                  </a>
                </div>
              )}
              {url && copiaManual && (
                <div>
                  <p className="hint mt-0 mb-1">Não deu para copiar automaticamente. Copie o link abaixo:</p>
                  <input
                    className="input text-sm md:text-sm"
                    readOnly
                    value={url}
                    aria-label="Link da loja"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </div>
              )}
              {erro && (
                <p className="text-sm text-bad" role="alert">
                  {erro}
                </p>
              )}
            </div>
          </Painel>

          {/* Identidade */}
          <Painel titulo="Identidade" descricao="Como a loja aparece para a sua cliente." icone={Palette}>
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="loja-nome">Nome da loja</label>
                <input
                  id="loja-nome"
                  maxLength={120}
                  className="input"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  // apagou o nome e saiu: volta o salvo, em vez de virar "Minha Loja" sem avisar
                  onBlur={() =>
                    nome.trim() ? persistir({ nomeLoja: nome.trim() }) : setNome(useStore.getState().config.nomeLoja)
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="loja-descricao">Chamada curta (subtítulo)</label>
                <textarea
                  id="loja-descricao"
                  maxLength={300}
                  className="input"
                  rows={2}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  onBlur={() => persistir({ lojaDescricao: descricao || null })}
                  placeholder="Ex.: Semijoias folheadas com garantia. Entrega para toda a cidade."
                />
              </div>

              {/* capa / banner */}
              <div>
                <span className="label">Imagem de capa (banner)</span>
                <div
                  className="overflow-hidden border border-default surface-alt h-28 sm:h-36 w-full grid place-items-center"
                  style={{ borderRadius: "var(--r-input)" }}
                >
                  {capaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={capaUrl} alt="Imagem de capa da loja" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-muted flex flex-col items-center gap-1 text-xs">
                      <ImagePlus size={20} aria-hidden />
                      Aparece no topo da sua vitrine
                    </div>
                  )}
                </div>
                <input ref={capaRef} type="file" accept="image/*" hidden onChange={onCapa} />
                <div className="flex flex-wrap gap-2 mt-2">
                  <button type="button" onClick={() => capaRef.current?.click()} disabled={enviandoCapa} className="btn-ghost btn-sm">
                    {enviandoCapa ? <Loader2 className="animate-spin" size={16} aria-hidden /> : <Upload size={16} aria-hidden />}
                    {capaUrl ? "Trocar capa" : "Enviar capa"}
                  </button>
                  {capaUrl && (
                    <button type="button" onClick={removerCapa} disabled={enviandoCapa} className="btn-danger btn-sm">
                      <Trash2 size={16} aria-hidden /> Remover
                    </button>
                  )}
                </div>
                <p className="hint">Foto larga (paisagem). Fica atrás do nome no topo da loja.</p>
              </div>

              {/* logo */}
              <div>
                <span className="label">Logo</span>
                <div className="flex items-center gap-3">
                  <div
                    className="h-14 w-14 shrink-0 surface-alt grid place-items-center overflow-hidden border border-default"
                    style={{ borderRadius: "var(--r-input)" }}
                  >
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logo da loja" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon size={20} className="text-muted" aria-hidden />
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={enviandoLogo} className="btn-ghost btn-sm">
                    {enviandoLogo ? <Loader2 className="animate-spin" size={16} aria-hidden /> : <Upload size={16} aria-hidden />}
                    {logoUrl ? "Trocar logo" : "Enviar logo"}
                  </button>
                </div>
              </div>

              {/* cor */}
              <div>
                <span className="label" id="loja-cor">Cor da loja</span>
                <div className="flex flex-wrap items-center gap-0.5 -ml-1" role="group" aria-labelledby="loja-cor">
                  {CORES.map((c) => {
                    const ativa = cor === c.hex;
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => escolherCor(c.hex)}
                        className="grid place-items-center h-10 w-10 rounded-full"
                        aria-label={`Cor ${c.nome}`}
                        aria-pressed={ativa}
                        title={c.nome}
                      >
                        <span
                          className={`grid place-items-center h-7 w-7 rounded-full transition-transform active:scale-95 ${
                            ativa
                              ? "ring-2 ring-brand-500 ring-offset-2 ring-offset-[color:var(--surface)]"
                              : "ring-1 ring-inset ring-[color:var(--border)]"
                          }`}
                          style={{ background: c.hex }}
                        >
                          {ativa && <Check size={14} className="text-white" aria-hidden />}
                        </span>
                      </button>
                    );
                  })}
                  <label className="relative grid place-items-center h-10 w-10 rounded-full cursor-pointer" title="Escolher outra cor">
                    <span
                      className={`grid place-items-center h-7 w-7 rounded-full ${
                        cor && !CORES.some((c) => c.hex === cor)
                          ? "text-white ring-2 ring-brand-500 ring-offset-2 ring-offset-[color:var(--surface)]"
                          : "text-muted border border-dashed border-[color:var(--text-muted)]"
                      }`}
                      style={cor && !CORES.some((c) => c.hex === cor) ? { background: cor } : undefined}
                    >
                      <Pipette size={13} aria-hidden />
                    </span>
                    <input
                      type="color"
                      aria-label="Escolher outra cor"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      value={cor || "#db2777"}
                      onChange={(e) => escolherCor(e.target.value)}
                    />
                  </label>
                  <button type="button" onClick={() => escolherCor(null)} className="text-sm text-muted hover:text-strong ml-1 px-1 min-h-[40px] underline underline-offset-2">
                    padrão
                  </button>
                </div>
              </div>

              {/* fonte */}
              <div>
                <span className="label flex items-center gap-1.5" id="loja-fonte">
                  <Type size={14} className="text-muted" aria-hidden /> Fonte das letras
                </span>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2" role="group" aria-labelledby="loja-fonte">
                  {FONTES.map((f) => {
                    const ativa = fonte === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        aria-pressed={ativa}
                        onClick={() => escolherFonte(f.key)}
                        title={f.label}
                        style={{ fontFamily: carregarFonte(f.key) || undefined, borderRadius: "var(--r-btn)" }}
                        className={`flex items-center gap-2.5 min-h-[44px] border px-3 text-sm text-left transition-colors ${
                          ativa ? "border-brand-500 bg-brand-500/10" : "border-default hover:border-[color:var(--text-muted)]"
                        }`}
                      >
                        <span className="font-semibold shrink-0">Aa</span>
                        <span className="text-xs text-muted truncate min-w-0 flex-1">{f.label}</span>
                        {ativa && <Check size={14} className="text-accent shrink-0" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Painel>

          {/* Sobre */}
          <Painel titulo="Sobre a loja" icone={Info}>
            <textarea
              className="input"
              rows={4}
              aria-label="Sobre a loja"
              maxLength={2000}
              value={sobre}
              onChange={(e) => setSobre(e.target.value)}
              onBlur={() => persistir({ lojaSobre: sobre || null })}
              placeholder="Conte a história da sua loja, diferenciais, garantia, prazos de entrega, formas de pagamento…"
            />
          </Painel>

          {/* Contato */}
          <Painel titulo="Contato" icone={Phone}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="label flex items-center gap-1.5" htmlFor="loja-whatsapp">
                  <MessageCircle size={13} className="text-muted" aria-hidden /> WhatsApp
                </label>
                <input id="loja-whatsapp" maxLength={30} className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} onBlur={() => salvar("lojaWhatsapp", whatsapp)} placeholder="Ex.: 11 99999-9999" />
              </div>
              <div>
                <label className="label flex items-center gap-1.5" htmlFor="loja-telefone">
                  <Phone size={13} className="text-muted" aria-hidden /> Telefone
                </label>
                <input id="loja-telefone" maxLength={30} className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} onBlur={() => salvar("lojaTelefone", telefone)} placeholder="Ex.: (11) 3333-3333" />
              </div>
              <div className="sm:col-span-2 xl:col-span-1">
                <label className="label flex items-center gap-1.5" htmlFor="loja-email">
                  <Mail size={13} className="text-muted" aria-hidden /> E-mail
                </label>
                <input id="loja-email" maxLength={254} className="input" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => salvar("lojaEmail", email)} placeholder="contato@sualoja.com" />
              </div>
            </div>
          </Painel>

          {/* Redes sociais */}
          <Painel titulo="Redes sociais" icone={AtSign}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="label flex items-center gap-1.5" htmlFor="loja-instagram">
                  <Instagram size={13} className="text-muted" aria-hidden /> Instagram
                </label>
                <input id="loja-instagram" maxLength={200} className="input" value={instagram} onChange={(e) => setInstagram(e.target.value)} onBlur={() => salvar("lojaInstagram", instagram)} placeholder="@sualoja" />
              </div>
              <div>
                <label className="label flex items-center gap-1.5" htmlFor="loja-facebook">
                  <Facebook size={13} className="text-muted" aria-hidden /> Facebook
                </label>
                <input id="loja-facebook" maxLength={200} className="input" value={facebook} onChange={(e) => setFacebook(e.target.value)} onBlur={() => salvar("lojaFacebook", facebook)} placeholder="sualoja ou link completo" />
              </div>
              <div className="sm:col-span-2 xl:col-span-1">
                <label className="label flex items-center gap-1.5" htmlFor="loja-tiktok">
                  <Music2 size={13} className="text-muted" aria-hidden /> TikTok
                </label>
                <input id="loja-tiktok" maxLength={200} className="input" value={tiktok} onChange={(e) => setTiktok(e.target.value)} onBlur={() => salvar("lojaTiktok", tiktok)} placeholder="@sualoja" />
              </div>
            </div>
          </Painel>

          {/* Resumo da vitrine */}
          <Painel titulo="Produtos na vitrine" icone={Gem}>
            {produtos.length === 0 ? (
              <EstadoVazio compacto titulo="Nenhum produto cadastrado" acao={<LinkAcao href="/produtos">Ir para Produtos</LinkAcao>}>
                Cadastre produtos para preencher sua vitrine.
              </EstadoVazio>
            ) : (
              <div className="space-y-3">
                <dl className="grid grid-cols-3 text-center">
                  <div className="min-w-0 px-1 flex flex-col-reverse">
                    <dt className="text-xs text-muted mt-0.5">aparecem</dt>
                    <dd className="figure">{visiveis.length}</dd>
                  </div>
                  <div className="min-w-0 px-1 border-x border-default flex flex-col-reverse">
                    <dt className="text-xs text-muted mt-0.5">ocultos (inativos)</dt>
                    <dd className="figure">{ocultos}</dd>
                  </div>
                  <div className="min-w-0 px-1 flex flex-col-reverse">
                    <dt className="text-xs text-muted mt-0.5">sem estoque</dt>
                    <dd className={`figure ${semEstoque > 0 ? "text-warn" : ""}`}>{semEstoque}</dd>
                  </div>
                </dl>
                {semEstoque > 0 && (
                  <Aviso tom="warn" icone={AlertTriangle}>
                    {semEstoque} produto(s) sem estoque aparecem como “Esgotado”. Para ocultá-los, abra o produto em
                    Produtos e desmarque “Produto ativo”.
                  </Aviso>
                )}
              </div>
            )}
          </Painel>

          {/* Aparência do painel */}
          <Painel
            titulo="Aparência do painel"
            descricao="Personalize as cores de fundo, a fonte e o arredondamento do painel (admin). Tudo aplica na hora, em todo o app."
            icone={Brush}
          >
            <div className="space-y-4">
              {/* tema base (paleta de fundo) */}
              <div>
                <span className="label" id="loja-tema">Tema do painel</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2" role="group" aria-labelledby="loja-tema">
                  {TEMAS_BASE.map((t) => {
                    const ativo = (temaBase ?? "escuro") === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => escolherTema(t.key)}
                        className={`border p-2.5 text-left transition-shadow ${
                          ativo ? "border-brand-500 ring-2 ring-brand-500/40" : "border-default hover:border-[color:var(--text-muted)]"
                        }`}
                        style={{ background: t.bg, borderRadius: "var(--r-btn)" }}
                      >
                        <span className="flex items-center gap-1">
                          <span className="h-4 w-4 rounded-full" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                          <span className="h-4 w-4 rounded-full" style={{ background: t.surfaceAlt }} />
                          <span className="h-4 w-4 rounded-full bg-brand-500" />
                          {ativo && <Check size={14} className="ml-auto" style={{ color: t.text }} aria-hidden />}
                        </span>
                        <span className="mt-2 block text-xs font-medium" style={{ color: t.text }}>
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="hint">Muda as cores de fundo do painel (admin) e da vitrine.</p>
              </div>

              {/* fonte do app */}
              <div>
                <label className="label" htmlFor="loja-fonte-app">Fonte do app</label>
                <select
                  id="loja-fonte-app"
                  className="input"
                  value={appFonte ?? "padrao"}
                  onChange={(e) => escolherFonteApp(e.target.value === "padrao" ? null : e.target.value)}
                  style={{ fontFamily: FONTES.find((f) => f.key === (appFonte ?? "padrao"))?.stack || undefined }}
                >
                  {FONTES.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <p className="hint">Aplica a fonte em todo o painel. (A vitrine tem fonte própria, acima.)</p>
              </div>

              {/* arredondamento dos cantos */}
              <div>
                <span className="label" id="loja-raio">Arredondamento dos cantos</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-labelledby="loja-raio">
                  {RAIOS.map((r) => {
                    const ativo = (appRaio ?? "padrao") === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => escolherRaio(r.key === "padrao" ? null : r.key)}
                        className={`border p-2.5 flex flex-col items-center gap-2 transition-shadow ${
                          ativo ? "border-brand-500 ring-2 ring-brand-500/40" : "border-default hover:border-[color:var(--text-muted)]"
                        }`}
                        style={{ borderRadius: r.card }}
                      >
                        <span className="h-7 w-12 surface-alt border border-default" style={{ borderRadius: r.btn }} />
                        <span className="text-xs font-medium text-center">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="hint">Deixa os cards e botões do painel mais retos ou mais arredondados.</p>
              </div>
            </div>
          </Painel>
        </div>

        {/* ---------------- preview ---------------- */}
        <aside className={`min-w-0 lg:sticky lg:top-7 ${vista === "editar" ? "hidden lg:block" : ""}`}>
          <div className="mx-auto w-full max-w-[320px]">
            <div className="flex items-start gap-2 mb-2.5">
              <Smartphone size={16} className="text-muted shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0">
                <h2 className="section-title">Pré-visualização</h2>
                <p className="text-xs text-muted">É assim que sua cliente vê</p>
              </div>
            </div>
            <PreviewLoja
              nome={nome || "Minha Loja"}
              descricao={descricao}
              sobre={sobre}
              logoUrl={logoUrl}
              capaUrl={capaUrl}
              produtos={visiveis}
              fontStack={fontStack}
              contato={{ whatsapp, telefone, email, instagram, facebook, tiktok }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

type Contato = { whatsapp: string; telefone: string; email: string; instagram: string; facebook: string; tiktok: string };

function PreviewLoja({
  nome,
  descricao,
  sobre,
  logoUrl,
  capaUrl,
  produtos,
  fontStack,
  contato,
}: {
  nome: string;
  descricao: string;
  sobre: string;
  logoUrl: string | null;
  capaUrl: string | null;
  produtos: Produto[];
  fontStack: string;
  contato: Contato;
}) {
  const temContato = !!(contato.whatsapp || contato.telefone || contato.email || contato.instagram || contato.facebook || contato.tiktok);
  const abas: { key: string; label: string }[] = [
    { key: "inicio", label: "Início" },
    ...(sobre ? [{ key: "sobre", label: "Sobre" }] : []),
    ...(temContato ? [{ key: "contato", label: "Contato" }] : []),
  ];
  const [aba, setAba] = useState("inicio");
  const atual = abas.some((a) => a.key === aba) ? aba : "inicio";

  return (
    // moldura de celular: altura presa à janela para caber inteira na coluna fixa
    <div className="rounded-[2.25rem] border border-default surface-alt p-1.5 shadow-card">
      <div className="rounded-[1.875rem] overflow-hidden">
        <div className="h-6 surface flex items-center justify-center" aria-hidden>
          <div className="h-1 w-14 rounded-full bg-[var(--border)]" />
        </div>

        <div
          className="h-[calc(100dvh-13rem)] max-h-[640px] min-h-[440px] overflow-y-auto bg-[var(--bg)] [scrollbar-width:thin]"
          style={fontStack ? { fontFamily: fontStack } : undefined}
        >
          <div className="flex min-h-full flex-col">
            <header className="surface border-b border-default">
              {capaUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={capaUrl} alt="" className="h-24 w-full object-cover" />
              )}
              <div className={`px-4 flex items-center gap-3 ${capaUrl ? "-mt-6 pb-3" : "py-4"}`}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={nome} className="h-12 w-12 rounded-2xl object-cover border-2 border-[var(--surface)]" />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-2xl bg-brand-600 grid place-items-center text-white border-2 border-[var(--surface)]">
                    <Gem size={22} aria-hidden />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-lg font-bold truncate">{nome}</h3>
                </div>
              </div>
              {/* navegação por abas */}
              <div className="flex gap-1 px-3 pb-2">
                {abas.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    aria-pressed={atual === a.key}
                    onClick={() => setAba(a.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      atual === a.key ? "bg-brand-600 text-white" : "surface-alt text-muted"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </header>

            {atual === "inicio" && (
              <div className="px-3 py-3">
                {descricao && <p className="text-xs text-muted mb-3 px-1">{descricao}</p>}
                {produtos.length === 0 ? (
                  <div className="card text-center text-muted text-sm">Cadastre produtos para preencher sua vitrine.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {produtos.map((p) => (
                      <PreviewCard key={p.id} p={p} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {atual === "sobre" && sobre && (
              <section className="px-4 py-4">
                <div className="text-sm font-semibold mb-1">Sobre a loja</div>
                <p className="text-xs text-muted whitespace-pre-line">{sobre}</p>
              </section>
            )}

            {atual === "contato" && temContato && (
              <section className="px-4 py-4 space-y-2">
                <div className="text-sm font-semibold">Fale com a gente</div>
                <div className="flex flex-wrap gap-2">
                  {contato.whatsapp && <Pill icon={<MessageCircle size={13} aria-hidden />} txt="WhatsApp" />}
                  {contato.telefone && <Pill icon={<Phone size={13} aria-hidden />} txt={contato.telefone} />}
                  {contato.email && <Pill icon={<Mail size={13} aria-hidden />} txt="E-mail" />}
                  {contato.instagram && <Pill icon={<Instagram size={13} aria-hidden />} txt="Instagram" />}
                  {contato.facebook && <Pill icon={<Facebook size={13} aria-hidden />} txt="Facebook" />}
                  {contato.tiktok && <Pill icon={<Music2 size={13} aria-hidden />} txt="TikTok" />}
                </div>
              </section>
            )}

            <div className="sticky bottom-2 mt-auto flex justify-end px-3 pb-2 pointer-events-none">
              <span className="bg-brand-600 text-white rounded-full shadow-card flex items-center gap-1.5 px-3 py-2 text-xs font-semibold">
                <MessageCircle size={14} aria-hidden /> Falar com a loja
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ icon, txt }: { icon: React.ReactNode; txt: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full surface-alt px-3 py-1.5 text-xs">
      {icon} {txt}
    </span>
  );
}

function PreviewCard({ p }: { p: Produto }) {
  const temDesconto = p.precoComparativo != null && p.precoComparativo > p.precoVenda;
  const esgotado = p.estoqueAtual <= 0;
  return (
    <div className="surface rounded-2xl border border-default overflow-hidden flex flex-col">
      <div className="aspect-square surface-alt relative">
        {p.imagens[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imagens[0]} alt={p.nome} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted">
            <Gem size={24} aria-hidden />
          </div>
        )}
        <span className={`absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${esgotado ? "bg-red-600 text-white" : "bg-black/55 text-white"}`}>
          {esgotado ? "Esgotado" : `${p.estoqueAtual} em estoque`}
        </span>
      </div>
      <div className="p-2.5 flex-1 flex flex-col">
        <div className="text-xs font-semibold leading-tight line-clamp-2">{p.nome}</div>
        {p.marca && <div className="text-[10px] text-muted">{p.marca}</div>}
        <div className="mt-auto pt-1.5">
          {temDesconto && <div className="text-[10px] text-muted line-through tnum">{brl(p.precoComparativo!)}</div>}
          <div className="font-bold text-accent text-sm tnum">{brl(p.precoVenda)}</div>
          {p.variacoes.length > 0 && <div className="text-[10px] text-muted">{p.variacoes.length} opções</div>}
        </div>
      </div>
    </div>
  );
}
