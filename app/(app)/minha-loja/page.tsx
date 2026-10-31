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
  Eye,
  EyeOff,
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
} from "lucide-react";

export default function MinhaLojaPage() {
  return (
    <Guard>
      <MinhaLoja />
    </Guard>
  );
}

const CORES = ["#db2777", "#7c3aed", "#2563eb", "#0d9488", "#ea580c", "#dc2626", "#ca8a04", "#111827"];

function MinhaLoja() {
  const { config, orgId, produtos, setConfig, definirSlug } = useStore();
  const { alerta } = useDialog();
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
  const [salvandoSlug, setSalvandoSlug] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);

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
    setErro(null);
    const ativar = !config.lojaAtiva;
    if (ativar && !config.slug) {
      const s = slugSugerido(config.nomeLoja || "minha-loja");
      const r = await definirSlug(s);
      if (!r.ok) {
        setErro(r.erro || "Não foi possível gerar o link");
        return;
      }
      setSlug(s);
    }
    const r = await setConfig({ lojaAtiva: ativar });
    if (ativar && r?.ok !== false) registrarMetrica({ tipo: "recurso", recurso: "loja_online_publicada" });
  }

  async function salvarSlug() {
    setErro(null);
    const limpo = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
    if (!limpo) {
      setErro("Informe um link válido");
      return;
    }
    if (limpo === config.slug) return;
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
      setLogoUrl(u);
      await setConfig({ logoUrl: u });
    } catch (err: any) {
      alerta({ titulo: "Não foi possível enviar a logo", mensagem: err?.message || "erro" });
    } finally {
      setEnviandoLogo(false);
    }
  }

  async function onCapa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setEnviandoCapa(true);
    try {
      const u = await uploadCapa(orgId, file);
      setCapaUrl(u);
      await setConfig({ lojaCapaUrl: u });
    } catch (err: any) {
      alerta({ titulo: "Não foi possível enviar a capa", mensagem: err?.message || "erro" });
    } finally {
      setEnviandoCapa(false);
    }
  }

  async function removerCapa() {
    setCapaUrl(null);
    await setConfig({ lojaCapaUrl: null });
  }

  function copiar() {
    if (!url) return;
    navigator.clipboard?.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
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
      alerta({ titulo: "Não foi possível salvar", mensagem: res.erro || "Tente novamente." });
      return;
    }
    flashSalvo();
  }

  const salvar = (campo: string, valor: string) => persistir({ [campo]: valor || null });

  return (
    <div className="space-y-4 pb-10">
      {salvoVisivel && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 reveal pointer-events-none">
          <div className="surface shadow-pop border border-default rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2">
            <Check size={15} className="text-green-500" /> Salvo
          </div>
        </div>
      )}
      <header className="pt-1 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Minha Loja</h1>
          <p className="text-sm text-muted">Monte sua loja online: link, identidade, contato e vitrine.</p>
        </div>
        <button
          onClick={toggleAtiva}
          className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
            config.lojaAtiva ? "bg-brand-600 text-white" : "surface-alt text-muted"
          }`}
        >
          {config.lojaAtiva ? <Eye size={16} /> : <EyeOff size={16} />}
          {config.lojaAtiva ? "No ar" : "Fora do ar"}
        </button>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 lg:gap-10 items-start">
        {/* ---------------- edição ---------------- */}
        <div className="space-y-4">
          {/* Link */}
          <section className="card space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Globe size={18} className="text-brand-500" /> Link da loja
            </div>
            {!config.lojaAtiva && (
              <p className="text-sm text-muted">
                Sua loja está <b>fora do ar</b>. Ative em “No ar” para gerar o link e deixá-la visível.
              </p>
            )}
            <div>
              <label className="label">Endereço da loja</label>
              <div className="flex gap-2">
                <span className="input flex items-center text-sm text-muted truncate max-w-[45%]">{origin}/loja/</span>
                <input className="input flex-1" value={slug} placeholder="minha-loja" onChange={(e) => setSlug(e.target.value)} onBlur={salvarSlug} />
              </div>
              {salvandoSlug && <p className="text-xs text-muted mt-1">Salvando…</p>}
            </div>
            {url && (
              <div className="flex gap-2">
                <button onClick={copiar} className="btn-ghost flex-1 py-2 text-sm">
                  {copiado ? <Check size={15} /> : <Copy size={15} />} {copiado ? "Copiado!" : "Copiar link"}
                </button>
                <a href={url} target="_blank" rel="noreferrer" className="btn-ghost flex-1 py-2 text-sm">
                  <ExternalLink size={15} /> Abrir loja
                </a>
              </div>
            )}
            {erro && <p className="text-sm text-red-500">{erro}</p>}
          </section>

          {/* Identidade */}
          <section className="card space-y-4">
            <div className="flex items-center gap-2 font-semibold">
              <Palette size={18} className="text-brand-500" /> Identidade
            </div>
            <div>
              <label className="label">Nome da loja</label>
              <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => persistir({ nomeLoja: nome || "Minha Loja" })} />
            </div>
            <div>
              <label className="label">Chamada curta (subtítulo)</label>
              <textarea
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
              <label className="label">Imagem de capa (banner)</label>
              <div className="rounded-xl overflow-hidden border border-default surface-alt aspect-[16/6] relative grid place-items-center">
                {capaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={capaUrl} alt="capa" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-muted flex flex-col items-center gap-1 text-xs">
                    <ImagePlus size={22} />
                    Aparece no topo da sua vitrine
                  </div>
                )}
              </div>
              <input ref={capaRef} type="file" accept="image/*" hidden onChange={onCapa} />
              <div className="flex gap-2 mt-2">
                <button onClick={() => capaRef.current?.click()} disabled={enviandoCapa} className="btn-ghost py-2 px-3 text-sm">
                  {enviandoCapa ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                  {capaUrl ? "Trocar capa" : "Enviar capa"}
                </button>
                {capaUrl && (
                  <button onClick={removerCapa} className="btn-ghost py-2 px-3 text-sm text-red-500">
                    <Trash2 size={16} /> Remover
                  </button>
                )}
              </div>
              <p className="text-xs text-muted mt-1">Foto larga (paisagem). Fica atrás do nome no topo da loja.</p>
            </div>

            {/* logo */}
            <div>
              <label className="label">Logo</label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-xl surface-alt grid place-items-center overflow-hidden border border-default">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="logo" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon size={22} className="text-muted" />
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
                <button onClick={() => fileRef.current?.click()} disabled={enviandoLogo} className="btn-ghost py-2 px-3 text-sm">
                  {enviandoLogo ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                  {logoUrl ? "Trocar logo" : "Enviar logo"}
                </button>
              </div>
            </div>

            {/* cor */}
            <div>
              <label className="label">Cor da loja</label>
              <div className="flex flex-wrap items-center gap-2">
                {CORES.map((c) => (
                  <button
                    key={c}
                    onClick={() => escolherCor(c)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 ${cor === c ? "border-white ring-2 ring-brand-500" : "border-transparent"}`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
                <label className="h-8 w-8 rounded-full border border-default grid place-items-center cursor-pointer overflow-hidden">
                  <input type="color" className="h-10 w-10 cursor-pointer" value={cor || "#db2777"} onChange={(e) => escolherCor(e.target.value)} />
                </label>
                <button onClick={() => escolherCor(null)} className="text-xs text-muted ml-1 underline">
                  padrão
                </button>
              </div>
            </div>

            {/* fonte */}
            <div>
              <label className="label flex items-center gap-1">
                <Type size={14} /> Fonte das letras
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FONTES.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => escolherFonte(f.key)}
                    style={{ fontFamily: carregarFonte(f.key) || undefined }}
                    className={`rounded-xl border px-3 py-2 text-sm text-left transition ${
                      fonte === f.key ? "border-brand-500 bg-brand-500/5" : "border-default hover:surface-alt"
                    }`}
                  >
                    <div className="font-semibold truncate">Aa</div>
                    <div className="text-[11px] text-muted truncate">{f.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Aparência do painel */}
          <section className="card space-y-4">
            <div className="flex items-center gap-2 font-semibold">
              <Brush size={18} className="text-brand-500" /> Aparência do painel
            </div>
            <p className="text-xs text-muted -mt-2">
              Personalize as cores de fundo, a fonte e o arredondamento do painel (admin). Tudo aplica
              na hora, em todo o app.
            </p>

            {/* tema base (paleta de fundo) */}
            <div>
              <label className="label">Tema do painel</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TEMAS_BASE.map((t) => {
                  const ativo = (temaBase ?? "escuro") === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => escolherTema(t.key)}
                      className={`rounded-xl border p-2 text-left transition-all active:scale-[.97] hover:-translate-y-0.5 ${
                        ativo ? "border-brand-500 ring-2 ring-brand-500/40" : "border-default hover:border-brand-500/50"
                      }`}
                      style={{ background: t.bg }}
                    >
                      <div className="flex gap-1">
                        <span className="h-4 w-4 rounded-full" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                        <span className="h-4 w-4 rounded-full" style={{ background: t.surfaceAlt }} />
                        <span className="h-4 w-4 rounded-full bg-brand-500" />
                      </div>
                      <span className="mt-2 block text-xs font-medium" style={{ color: t.text }}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted mt-1">Muda as cores de fundo do painel (admin) e da vitrine.</p>
            </div>

            {/* fonte do app */}
            <div>
              <label className="label">Fonte do app</label>
              <select
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
              <p className="text-xs text-muted mt-1">Aplica a fonte em todo o painel. (A vitrine tem fonte própria, acima.)</p>
            </div>

            {/* arredondamento dos cantos */}
            <div>
              <label className="label">Arredondamento dos cantos</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {RAIOS.map((r) => {
                  const ativo = (appRaio ?? "padrao") === r.key;
                  return (
                    <button
                      key={r.key}
                      onClick={() => escolherRaio(r.key === "padrao" ? null : r.key)}
                      className={`border p-2 transition-all active:scale-[.97] flex flex-col items-center gap-2 ${
                        ativo ? "border-brand-500 ring-2 ring-brand-500/40" : "border-default hover:border-brand-500/50 hover:bg-[var(--hover)]"
                      }`}
                      style={{ borderRadius: r.card }}
                    >
                      <span className="h-8 w-12 surface-alt border border-default" style={{ borderRadius: r.btn }} />
                      <span className="text-xs font-medium">{r.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted mt-1">Deixa os cards e botões do painel mais retos ou mais arredondados.</p>
            </div>
          </section>

          {/* Sobre */}
          <section className="card space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Info size={18} className="text-brand-500" /> Sobre a loja
            </div>
            <textarea
              className="input"
              rows={4}
              value={sobre}
              onChange={(e) => setSobre(e.target.value)}
              onBlur={() => persistir({ lojaSobre: sobre || null })}
              placeholder="Conte a história da sua loja, diferenciais, garantia, prazos de entrega, formas de pagamento…"
            />
          </section>

          {/* Contato */}
          <section className="card space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Phone size={18} className="text-brand-500" /> Contato
            </div>
            <div>
              <label className="label flex items-center gap-1"><MessageCircle size={13} /> WhatsApp</label>
              <input className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} onBlur={() => salvar("lojaWhatsapp", whatsapp)} placeholder="Ex.: 11 99999-9999" />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Phone size={13} /> Telefone</label>
              <input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} onBlur={() => salvar("lojaTelefone", telefone)} placeholder="Ex.: (11) 3333-3333" />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Mail size={13} /> E-mail</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => salvar("lojaEmail", email)} placeholder="contato@sualoja.com" />
            </div>
          </section>

          {/* Redes sociais */}
          <section className="card space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <AtSign size={18} className="text-brand-500" /> Redes sociais
            </div>
            <div>
              <label className="label flex items-center gap-1"><Instagram size={13} /> Instagram</label>
              <input className="input" value={instagram} onChange={(e) => setInstagram(e.target.value)} onBlur={() => salvar("lojaInstagram", instagram)} placeholder="@sualoja" />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Facebook size={13} /> Facebook</label>
              <input className="input" value={facebook} onChange={(e) => setFacebook(e.target.value)} onBlur={() => salvar("lojaFacebook", facebook)} placeholder="sualoja ou link completo" />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Music2 size={13} /> TikTok</label>
              <input className="input" value={tiktok} onChange={(e) => setTiktok(e.target.value)} onBlur={() => salvar("lojaTiktok", tiktok)} placeholder="@sualoja" />
            </div>
          </section>

          {/* Resumo da vitrine */}
          <section className="card space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <Gem size={18} className="text-brand-500" /> Produtos na vitrine
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="surface-alt rounded-xl py-2">
                <div className="text-xl font-bold">{visiveis.length}</div>
                <div className="text-[11px] text-muted">aparecem</div>
              </div>
              <div className="surface-alt rounded-xl py-2">
                <div className="text-xl font-bold">{ocultos}</div>
                <div className="text-[11px] text-muted">ocultos (inativos)</div>
              </div>
              <div className="surface-alt rounded-xl py-2">
                <div className="text-xl font-bold">{semEstoque}</div>
                <div className="text-[11px] text-muted">sem estoque</div>
              </div>
            </div>
            {semEstoque > 0 && (
              <p className="text-xs text-amber-600 flex items-start gap-1">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                {semEstoque} produto(s) sem estoque aparecem como “Esgotado”. Desative-os em Produtos para ocultar.
              </p>
            )}
          </section>
        </div>

        {/* ---------------- preview ---------------- */}
        <div className="lg:sticky lg:top-8">
          <div className="flex items-center gap-2 text-sm text-muted mb-3">
            <Smartphone size={15} /> Pré-visualização - é assim que sua cliente vê
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
    <div className="mx-auto w-full max-w-md rounded-[2.2rem] border-4 border-default surface overflow-hidden shadow-2xl">
      <div className="h-7 surface-alt flex items-center justify-center">
        <div className="h-1.5 w-20 rounded-full bg-default/60" />
      </div>

      <div className="max-h-[74vh] min-h-[520px] overflow-auto bg-[var(--bg)]" style={fontStack ? { fontFamily: fontStack } : undefined}>
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
              <div className="h-12 w-12 rounded-2xl bg-brand-600 grid place-items-center text-white border-2 border-[var(--surface)]">
                <Gem size={22} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{nome}</h2>
            </div>
          </div>
          {/* navegação por abas */}
          <div className="flex gap-1 px-3 pb-2">
            {abas.map((a) => (
              <button
                key={a.key}
                onClick={() => setAba(a.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  atual === a.key ? "bg-brand-600 text-white" : "surface-alt text-muted"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </header>

        {atual === "inicio" && (
          <main className="px-3 py-3">
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
          </main>
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
              {contato.whatsapp && <Pill icon={<MessageCircle size={13} />} txt="WhatsApp" />}
              {contato.telefone && <Pill icon={<Phone size={13} />} txt={contato.telefone} />}
              {contato.email && <Pill icon={<Mail size={13} />} txt="E-mail" />}
              {contato.instagram && <Pill icon={<Instagram size={13} />} txt="Instagram" />}
              {contato.facebook && <Pill icon={<Facebook size={13} />} txt="Facebook" />}
              {contato.tiktok && <Pill icon={<Music2 size={13} />} txt="TikTok" />}
            </div>
          </section>
        )}

        <div className="sticky bottom-2 flex justify-end px-3 pb-2">
          <span className="bg-brand-600 text-white rounded-full shadow-lg flex items-center gap-1.5 px-3 py-2 text-xs font-semibold">
            <MessageCircle size={14} /> Falar com a loja
          </span>
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
            <Gem size={24} />
          </div>
        )}
        <span className={`absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${esgotado ? "bg-red-500 text-white" : "bg-black/55 text-white"}`}>
          {esgotado ? "Esgotado" : `${p.estoqueAtual} em estoque`}
        </span>
      </div>
      <div className="p-2.5 flex-1 flex flex-col">
        <div className="text-xs font-semibold leading-tight line-clamp-2">{p.nome}</div>
        {p.marca && <div className="text-[10px] text-muted">{p.marca}</div>}
        <div className="mt-auto pt-1.5">
          {temDesconto && <div className="text-[10px] text-muted line-through">{brl(p.precoComparativo!)}</div>}
          <div className="font-bold text-brand-500 text-sm">{brl(p.precoVenda)}</div>
          {p.variacoes.length > 0 && <div className="text-[10px] text-muted">{p.variacoes.length} opções</div>}
        </div>
      </div>
    </div>
  );
}
