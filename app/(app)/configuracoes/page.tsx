"use client";
import Link from "next/link";
import { useState, useRef } from "react";
import { useStore } from "@/lib/store";
import { parseNumero } from "@/lib/csvProdutos";
import { SEGMENTOS, categoriasDaLoja } from "@/lib/seed";
import { aplicarAparencia, TEMAS_BASE, RAIOS } from "@/lib/aparencia";
import { FONTES } from "@/lib/fontes";
import { uploadLogo } from "@/lib/uploadLogo";
import type { Canal, Role } from "@/lib/types";
import { usePlano } from "@/lib/usePlano";
import { brlPreco } from "@/lib/plans";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import MembrosManager from "@/components/MembrosManager";
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
  Users,
  UserPlus,
  Trash2,
  X,
  Globe,
  Copy,
  ExternalLink,
  Tags,
  Plus,
} from "lucide-react";
import { slugSugerido } from "@/lib/slug";

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

const CORES = ["#db2777", "#7c3aed", "#2563eb", "#0d9488", "#ea580c", "#dc2626", "#ca8a04", "#111827"];

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
      setLogoUrl(url);
      const res = await setConfig({ logoUrl: url });
      if (!res.ok) throw new Error(res.erro);
    } catch (err: any) {
      alerta({ titulo: "Não foi possível enviar a logo", mensagem: err?.message || "erro" });
    } finally {
      setEnviandoLogo(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    const res = await setConfig({
      nomeLoja: nomeLoja || "Minha Loja",
      segmento,
      canais: canais.length ? canais : ["whatsapp"],
      usaRevendedoras: usaRev,
      margemPadrao: parseNumero(margem) || 0,
      comissaoPadrao: parseNumero(comissao) || 0,
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
    <div className="space-y-4 stagger">
      <header className="pt-1 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted">Gerencie as configurações da sua loja</p>
        </div>
        <button onClick={salvar} disabled={salvando} className="btn-primary py-2 px-4 text-sm">
          {salvando ? <Loader2 className="animate-spin" size={16} /> : salvo ? <Check size={16} /> : <Save size={16} />}
          {salvo ? "Salvo" : "Salvar"}
        </button>
      </header>

      {/* Loja */}
      <section className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Store size={18} className="text-brand-500" /> Loja
        </div>
        <div>
          <label className="label">Nome da loja</label>
          <input className="input" value={nomeLoja} onChange={(e) => setNomeLoja(e.target.value)} />
        </div>
        <div>
          <label className="label">Segmento</label>
          <select className="input" value={segmento} onChange={(e) => setSegmento(e.target.value)}>
            {SEGMENTOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Identidade */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2 font-semibold">
          <Palette size={18} className="text-brand-500" /> Identidade da loja
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
            <button
              onClick={() => fileRef.current?.click()}
              disabled={enviandoLogo}
              className="btn-ghost py-2 px-3 text-sm"
            >
              {enviandoLogo ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              {logoUrl ? "Trocar logo" : "Enviar logo"}
            </button>
          </div>
          <p className="text-xs text-muted mt-1">Aparece no app e no painel. PNG/JPG.</p>
        </div>

        {/* cor */}
        <div>
          <label className="label">Cor da marca</label>
          <div className="flex flex-wrap items-center gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                onClick={() => escolherCor(c)}
                className={`h-8 w-8 rounded-full border-2 ${
                  cor === c ? "border-white ring-2 ring-brand-500" : "border-transparent"
                }`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
            <label className="h-8 w-8 rounded-full border border-default grid place-items-center cursor-pointer overflow-hidden">
              <input
                type="color"
                className="h-10 w-10 cursor-pointer"
                value={cor || "#db2777"}
                onChange={(e) => escolherCor(e.target.value)}
              />
            </label>
            <button onClick={() => escolherCor(null)} className="text-xs text-muted ml-1 underline">
              padrão
            </button>
          </div>
          <p className="text-xs text-muted mt-1">O app inteiro adota a cor da sua loja.</p>
        </div>

        {/* tema base (paleta de fundo) */}
        <div>
          <label className="label">Tema do painel</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TEMAS_BASE.map((t) => {
              const ativo = (temaBase ?? "escuro") === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => escolherTema(t.key)}
                  className={`rounded-xl border p-2 text-left transition ${
                    ativo ? "border-brand-500 ring-2 ring-brand-500/40" : "border-default"
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
            onChange={(e) => escolherFonte(e.target.value === "padrao" ? null : e.target.value)}
            style={{ fontFamily: FONTES.find((f) => f.key === (appFonte ?? "padrao"))?.stack || undefined }}
          >
            {FONTES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mt-1">Aplica a fonte em todo o painel. (A vitrine tem fonte própria.)</p>
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
                  className={`border p-2 transition flex flex-col items-center gap-2 ${
                    ativo ? "border-brand-500 ring-2 ring-brand-500/40" : "border-default"
                  }`}
                  style={{ borderRadius: r.card }}
                >
                  <span
                    className="h-8 w-12 surface-alt border border-default"
                    style={{ borderRadius: r.btn }}
                  />
                  <span className="text-xs font-medium">{r.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted mt-1">Deixa os cards e botões do painel mais retos ou mais arredondados.</p>
        </div>
      </section>

      {/* Categorias da loja */}
      <CategoriasSection />

      {/* Mini-loja pública */}
      <MiniLojaSection />

      {/* Vendas */}
      <section className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <ShoppingBag size={18} className="text-brand-500" /> Vendas
        </div>
        <label className="flex items-center justify-between">
          <span className="text-sm">Trabalho com revendedoras</span>
          <button
            onClick={() => setUsaRev((v) => !v)}
            className={`h-6 w-11 rounded-full transition relative ${usaRev ? "bg-brand-600" : "surface-alt"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                usaRev ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </label>
        <div>
          <label className="label">Canais de venda</label>
          <div className="flex flex-wrap gap-2">
            {CANAIS.map((c) => {
              const on = canais.includes(c.id);
              return (
                <span
                  key={c.id}
                  onClick={() => toggleCanal(c.id)}
                  className={`chip ${on ? "bg-brand-600 text-white border-brand-600" : "border-default"}`}
                >
                  {c.label}
                </span>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Margem padrão (%)</label>
            <input className="input" inputMode="decimal" value={margem} onChange={(e) => setMargem(e.target.value)} />
          </div>
          <div>
            <label className="label">Comissão padrão (%)</label>
            <input
              className="input"
              inputMode="decimal"
              value={comissao}
              onChange={(e) => setComissao(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Assinatura / plano */}
      <PlanoPointer />

      {/* Equipe de acesso (membros) */}
      <MembrosManager />
    </div>
  );
}

function CategoriasSection() {
  const { config, setConfig } = useStore();
  const [lista, setLista] = useState<string[]>(categoriasDaLoja(config));
  const [nova, setNova] = useState("");

  function persistir(next: string[]) {
    setLista(next);
    setConfig({ categorias: next });
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
    <section className="card space-y-3">
      <div className="flex items-center gap-2 font-semibold">
        <Tags size={18} className="text-brand-500" /> Categorias dos produtos
      </div>
      <p className="text-sm text-muted">
        Cada loja tem as suas. Adicione ou remova quantas quiser - elas aparecem ao cadastrar produtos.
      </p>

      <div className="flex flex-wrap gap-2">
        {lista.map((c) => (
          <span key={c} className="chip border-default flex items-center gap-1.5">
            {c}
            <button
              onClick={() => persistir(lista.filter((x) => x !== c))}
              className="text-muted hover:text-red-500"
              aria-label={`Remover ${c}`}
            >
              <X size={13} />
            </button>
          </span>
        ))}
        {lista.length === 0 && <span className="text-sm text-muted">Nenhuma categoria ainda.</span>}
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
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
        <button onClick={adicionar} className="btn-primary px-4">
          <Plus size={16} /> Adicionar
        </button>
      </div>
    </section>
  );
}

function PlanoPointer() {
  const { defContratado, emTrial, diasTrial } = usePlano();
  return (
    <Link href="/configuracoes/plano" className="card flex items-center gap-3 hover:surface-alt transition">
      <div className="h-10 w-10 rounded-xl bg-brand-600/10 grid place-items-center shrink-0">
        <CreditCard size={20} className="text-brand-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold flex items-center gap-2">
          Plano {defContratado.nome}
          {emTrial && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-600 text-white">Trial · {diasTrial}d</span>
          )}
        </div>
        <p className="text-sm text-muted">
          {brlPreco(defContratado.precoCentavos)}/mês · gerenciar assinatura e limites
        </p>
      </div>
      <ExternalLink size={16} className="text-muted shrink-0" />
    </Link>
  );
}

function MiniLojaSection() {
  const { config } = useStore();
  return (
    <Link href="/minha-loja" className="card flex items-center gap-3 hover:surface-alt transition">
      <div className="h-10 w-10 rounded-xl bg-brand-600/10 grid place-items-center shrink-0">
        <Globe size={20} className="text-brand-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold flex items-center gap-2">
          Minha Loja online
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full ${
              config.lojaAtiva ? "bg-brand-600 text-white" : "surface-alt text-muted"
            }`}
          >
            {config.lojaAtiva ? "No ar" : "Fora do ar"}
          </span>
        </div>
        <p className="text-sm text-muted">Link, identidade e vitrine dos produtos com chat.</p>
      </div>
      <ExternalLink size={16} className="text-muted shrink-0" />
    </Link>
  );
}

