"use client";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { parseNumero } from "@/lib/csvProdutos";
import { SEGMENTOS, categoriasDaLoja } from "@/lib/seed";
import { aplicarAparencia, temaDoUsuario, TEMAS_BASE, RAIOS } from "@/lib/aparencia";
import { FONTES } from "@/lib/fontes";
import { uploadLogo } from "@/lib/uploadLogo";
import type { Canal } from "@/lib/types";
import { usePlano } from "@/lib/usePlano";
import { brlPreco } from "@/lib/plans";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import MembrosManager from "@/components/MembrosManager";
import { PageHeader, Painel, Selo } from "@/components/ui";
import {
  Store,
  Palette,
  ShoppingBag,
  CreditCard,
  Save,
  Upload,
  Loader2,
  Check,
  Image as ImageIcon,
  X,
  Globe,
  ChevronRight,
  Pipette,
  Tags,
  Plus,
} from "lucide-react";

export default function ConfiguracoesPage() {
  return (
    <Guard>
      <Configuracoes />
    </Guard>
  );
}

const CANAIS: { id: Canal; label: string }[] = [
  { id: "loja", label: "Loja física" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
];

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

function Configuracoes() {
  const { config, orgId, setConfig } = useStore();
  const { alerta } = useDialog();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nomeLoja, setNomeLoja] = useState(config.nomeLoja);
  const [segmento, setSegmento] = useState(config.segmento);
  const [canais, setCanais] = useState<Canal[]>(config.canais);
  const [usaRev, setUsaRev] = useState(config.usaRevendedoras);
  const [margem, setMargem] = useState(String(config.margemPadrao));
  const [comissao, setComissao] = useState(String(config.comissaoPadrao));
  const [cor, setCor] = useState<string | null>(config.corMarca);
  const [temaBase, setTemaBase] = useState<string | null>(config.temaBase);
  const [appFonte, setAppFonte] = useState<string | null>(config.appFonte);
  const [appRaio, setAppRaio] = useState<string | null>(config.appRaio);
  const [logoUrl, setLogoUrl] = useState<string | null>(config.logoUrl);

  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [erroNumeros, setErroNumeros] = useState<string | null>(null);

  // O preview de aparência é aplicado no app inteiro, mas só vira config no
  // "Salvar". Ao sair da tela, reaplica a aparência SALVA (a do store, que já
  // inclui o que foi salvo aqui) — igual ao Guard —, descartando o preview.
  useEffect(() => {
    return () => {
      const { config: c, usuarioId } = useStore.getState();
      aplicarAparencia({
        corMarca: c.corMarca,
        temaBase: temaDoUsuario(usuarioId, c.temaBase),
        appFonte: c.appFonte,
        appRaio: c.appRaio,
      });
    };
  }, []);

  function toggleCanal(c: Canal) {
    setCanais((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  // preview imediato de qualquer mudança de aparência
  function previewAparencia(over: { cor?: string | null; tema?: string | null; fonte?: string | null; raio?: string | null }) {
    aplicarAparencia({
      corMarca: over.cor !== undefined ? over.cor : cor,
      temaBase: over.tema !== undefined ? over.tema : temaBase,
      appFonte: over.fonte !== undefined ? over.fonte : appFonte,
      appRaio: over.raio !== undefined ? over.raio : appRaio,
    });
  }

  function escolherCor(hex: string | null) {
    setCor(hex);
    previewAparencia({ cor: hex });
  }
  function escolherTema(key: string | null) {
    setTemaBase(key);
    previewAparencia({ tema: key });
  }
  function escolherFonte(key: string | null) {
    setAppFonte(key);
    previewAparencia({ fonte: key });
  }
  function escolherRaio(key: string | null) {
    setAppRaio(key);
    previewAparencia({ raio: key });
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setEnviandoLogo(true);
    try {
      const url = await uploadLogo(orgId, file);
      const res = await setConfig({ logoUrl: url });
      if (!res.ok) throw new Error(res.erro);
      // só mostra a logo nova depois de salva (senão a prévia mentiria)
      setLogoUrl(url);
    } catch (err: any) {
      alerta({ titulo: "Não foi possível enviar a logo", mensagem: err?.message || "Tente novamente." });
    } finally {
      setEnviandoLogo(false);
      // permite reenviar o mesmo arquivo depois de um erro
      e.target.value = "";
    }
  }

  async function salvar() {
    if (salvando) return;
    // nome apagado sem querer não vira "Minha Loja" em silêncio
    if (!nomeLoja.trim()) {
      setErroNumeros("Informe o nome da loja.");
      return;
    }
    // número inválido não vira 0 em silêncio
    const margemNum = parseNumero(margem);
    const comissaoNum = parseNumero(comissao);
    if (!Number.isFinite(margemNum) || margemNum < 0) {
      setErroNumeros("Margem padrão inválida: informe um número igual ou maior que 0.");
      return;
    }
    if (!Number.isFinite(comissaoNum) || comissaoNum < 0 || comissaoNum > 100) {
      setErroNumeros("Comissão padrão inválida: informe um número de 0 a 100.");
      return;
    }
    setErroNumeros(null);
    setSalvando(true);
    const res = await setConfig({
      nomeLoja: nomeLoja.trim(),
      segmento,
      canais: canais.length ? canais : ["whatsapp"],
      usaRevendedoras: usaRev,
      margemPadrao: margemNum,
      comissaoPadrao: comissaoNum,
      corMarca: cor,
      temaBase,
      appFonte,
      appRaio,
    });
    setSalvando(false);
    if (!res.ok) {
      alerta({ titulo: "Não foi possível salvar", mensagem: res.erro || "Tente novamente." });
      return;
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        titulo="Configurações"
        descricao="Gerencie as configurações da sua loja"
        acoes={
          <button type="button" onClick={salvar} disabled={salvando} className="btn-primary btn-sm">
            {salvando ? (
              <Loader2 className="animate-spin" size={16} aria-hidden />
            ) : salvo ? (
              <Check size={16} aria-hidden />
            ) : (
              <Save size={16} aria-hidden />
            )}
            {salvo ? "Salvo" : "Salvar"}
          </button>
        }
      />

      {/* Loja */}
      <Painel titulo="Loja" icone={Store}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cfg-nome">Nome da loja</label>
            <input id="cfg-nome" maxLength={120} className="input" value={nomeLoja} onChange={(e) => setNomeLoja(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="cfg-segmento">Segmento</label>
            <select id="cfg-segmento" className="input" value={segmento} onChange={(e) => setSegmento(e.target.value)}>
              {SEGMENTOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Painel>

      {/* Identidade */}
      <Painel titulo="Identidade da loja" icone={Palette}>
        <div className="space-y-4">
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
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={enviandoLogo}
                className="btn-ghost btn-sm"
              >
                {enviandoLogo ? <Loader2 className="animate-spin" size={16} aria-hidden /> : <Upload size={16} aria-hidden />}
                {logoUrl ? "Trocar logo" : "Enviar logo"}
              </button>
            </div>
            <p className="hint">Aparece no app e no painel. PNG/JPG.</p>
          </div>

          {/* cor */}
          <div>
            <span className="label" id="cfg-cor">Cor da marca</span>
            <div className="flex flex-wrap items-center gap-0.5 -ml-1" role="group" aria-labelledby="cfg-cor">
              {CORES.map((c) => {
                const ativa = cor === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => escolherCor(c.hex)}
                    className="grid place-items-center h-11 w-11 rounded-full"
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
              <label className="relative grid place-items-center h-11 w-11 rounded-full cursor-pointer" title="Escolher outra cor">
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
              <button
                type="button"
                onClick={() => escolherCor(null)}
                className="text-sm text-muted hover:text-strong ml-1 px-1 min-h-[44px] underline underline-offset-2"
              >
                padrão
              </button>
            </div>
            <p className="hint">
              O app inteiro adota a cor da sua loja. As mudanças de aparência são uma prévia até você tocar em Salvar.
            </p>
          </div>

          {/* tema base (paleta de fundo) */}
          <div>
            <span className="label" id="cfg-tema">Tema do painel</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-labelledby="cfg-tema">
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
            <label className="label" htmlFor="cfg-fonte">Fonte do app</label>
            <select
              id="cfg-fonte"
              className="input"
              value={appFonte ?? "padrao"}
              onChange={(e) => escolherFonte(e.target.value === "padrao" ? null : e.target.value)}
              style={{ fontFamily: FONTES.find((f) => f.key === (appFonte ?? "padrao"))?.stack || undefined }}
            >
              {FONTES.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <p className="hint">Aplica a fonte em todo o painel. (A vitrine tem fonte própria.)</p>
          </div>

          {/* arredondamento dos cantos */}
          <div>
            <span className="label" id="cfg-raio">Arredondamento dos cantos</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-labelledby="cfg-raio">
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

      {/* Vendas */}
      <Painel titulo="Vendas" icone={ShoppingBag}>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 min-h-[40px]">
            <span className="text-sm font-medium" id="cfg-usa-rev">Trabalho com revendedoras</span>
            <button
              type="button"
              role="switch"
              aria-checked={usaRev}
              aria-labelledby="cfg-usa-rev"
              onClick={() => setUsaRev((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors before:absolute before:-inset-2 before:content-[''] ${
                usaRev ? "bg-brand-600" : "bg-[var(--border)]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                  usaRev ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          <div>
            <span className="label" id="cfg-canais">Canais de venda</span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="cfg-canais">
              {CANAIS.map((c) => {
                const on = canais.includes(c.id);
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => toggleCanal(c.id)} className="chip">
                    {c.label}
                  </button>
                );
              })}
            </div>
            {canais.length === 0 && <p className="hint">Nenhum canal marcado: ao salvar, fica só WhatsApp.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="cfg-margem">Margem padrão (%)</label>
              <input
                id="cfg-margem"
                className="input tnum"
                inputMode="decimal"
                value={margem}
                onChange={(e) => {
                  setMargem(e.target.value);
                  setErroNumeros(null);
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="cfg-comissao">Comissão padrão (%)</label>
              <input
                id="cfg-comissao"
                className="input tnum"
                inputMode="decimal"
                value={comissao}
                onChange={(e) => {
                  setComissao(e.target.value);
                  setErroNumeros(null);
                }}
              />
            </div>
          </div>
          {erroNumeros && (
            <p className="text-sm text-bad" role="alert">
              {erroNumeros}
            </p>
          )}
        </div>
      </Painel>

      {/* Categorias da loja */}
      <CategoriasSection />

      {/* Mini-loja pública + assinatura */}
      <div className="card-list">
        <MiniLojaSection />
        <PlanoPointer />
      </div>

      {/* Equipe de acesso (membros) */}
      <MembrosManager />
    </div>
  );
}

function CategoriasSection() {
  const { config, setConfig } = useStore();
  const { alerta } = useDialog();
  const [lista, setLista] = useState<string[]>(categoriasDaLoja(config));
  const [nova, setNova] = useState("");
  const [salvandoCat, setSalvandoCat] = useState(false);

  async function persistir(next: string[]) {
    if (salvandoCat) return;
    const anterior = lista;
    setLista(next);
    setSalvandoCat(true);
    const res = await setConfig({ categorias: next });
    setSalvandoCat(false);
    if (!res.ok) {
      // o store já desfez a config; volta a lista da tela também
      setLista(anterior);
      alerta({ titulo: "Não foi possível salvar as categorias", mensagem: res.erro || "Tente novamente." });
    }
  }
  function adicionar() {
    const n = nova.trim();
    if (!n) return;
    if (lista.some((c) => c.toLowerCase() === n.toLowerCase())) {
      setNova("");
      return;
    }
    persistir([...lista, n]);
    setNova("");
  }

  return (
    <Painel
      titulo="Categorias dos produtos"
      descricao="Cada loja tem as suas. Adicione ou remova quantas quiser - elas aparecem ao cadastrar produtos."
      icone={Tags}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {lista.map((c) => (
            <span key={c} className="chip cursor-default pr-1">
              {c}
              <button
                type="button"
                onClick={() => persistir(lista.filter((x) => x !== c))}
                disabled={salvandoCat}
                className="grid place-items-center h-10 w-8 -my-2 rounded-full text-muted hover:text-bad disabled:opacity-50"
                aria-label={`Remover categoria ${c}`}
              >
                <X size={14} aria-hidden />
              </button>
            </span>
          ))}
          {lista.length === 0 && <span className="text-sm text-muted">Nenhuma categoria ainda.</span>}
        </div>

        <div className="flex gap-2">
          <input
            className="input flex-1 min-w-0"
            aria-label="Nova categoria"
            maxLength={60}
            placeholder="Nova categoria (ex.: Relógios)"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
          />
          <button type="button" onClick={adicionar} disabled={salvandoCat} className="btn-ghost shrink-0">
            <Plus size={16} aria-hidden /> Adicionar
          </button>
        </div>
      </div>
    </Painel>
  );
}

function PlanoPointer() {
  const { defContratado, emTrial, diasTrial } = usePlano();
  return (
    <Link href="/configuracoes/plano" className="row">
      <span className="grid place-items-center h-10 w-10 shrink-0 rounded-lg tone-brand" aria-hidden>
        <CreditCard size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 font-semibold">
          Plano {defContratado.nome}
          {emTrial && <Selo tom="brand">Trial · {diasTrial}d</Selo>}
        </span>
        <span className="block text-sm text-muted">
          {brlPreco(defContratado.precoCentavos)}/mês · gerenciar assinatura e limites
        </span>
      </span>
      <ChevronRight size={17} className="text-muted shrink-0" aria-hidden />
    </Link>
  );
}

function MiniLojaSection() {
  const { config } = useStore();
  return (
    <Link href="/minha-loja" className="row">
      <span className="grid place-items-center h-10 w-10 shrink-0 rounded-lg tone-brand" aria-hidden>
        <Globe size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 font-semibold">
          Minha Loja online
          <Selo tom={config.lojaAtiva ? "ok" : "neutral"}>{config.lojaAtiva ? "No ar" : "Fora do ar"}</Selo>
        </span>
        <span className="block text-sm text-muted">Link, identidade e vitrine dos produtos com chat.</span>
      </span>
      <ChevronRight size={17} className="text-muted shrink-0" aria-hidden />
    </Link>
  );
}
