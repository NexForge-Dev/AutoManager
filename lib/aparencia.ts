// ============================================================================
// Sistema de aparência personalizável por loja.
// O admin escolhe: cor da marca + tema base (paleta de fundo) + fonte do app.
// Tudo é aplicado em runtime (admin e vitrine) e cacheado no localStorage para
// reaplicar antes da pintura (sem flash) na próxima visita.
// ============================================================================

import { gerarTonsMarca } from "./brand";
import { carregarFonte } from "./fontes";

export interface TemaBase {
  key: string;
  label: string;
  claro: boolean; // true = esquema claro (texto escuro)
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
}

// Paletas de fundo do app/admin. O admin troca livremente; a cor da marca
// (botões/destaques) é aplicada por cima de qualquer uma delas.
export const TEMAS_BASE: TemaBase[] = [
  {
    key: "escuro",
    label: "Escuro (padrão)",
    claro: false,
    bg: "#141019",
    surface: "#1d1726",
    surfaceAlt: "#2a2235",
    text: "#f5f3f7",
    textMuted: "#b5adc1",
    border: "#322a3e",
  },
  {
    key: "grafite",
    label: "Grafite",
    claro: false,
    bg: "#0f1115",
    surface: "#1a1d23",
    surfaceAlt: "#262a32",
    text: "#f3f4f6",
    textMuted: "#9aa3b2",
    border: "#2c313a",
  },
  {
    key: "meianoite",
    label: "Meia-noite (azul)",
    claro: false,
    bg: "#0c1322",
    surface: "#14203a",
    surfaceAlt: "#1f2d4d",
    text: "#eef2fb",
    textMuted: "#93a1bf",
    border: "#243353",
  },
  {
    key: "floresta",
    label: "Floresta",
    claro: false,
    bg: "#0c1714",
    surface: "#132420",
    surfaceAlt: "#1d352e",
    text: "#eef6f2",
    textMuted: "#93b5a8",
    border: "#234037",
  },
  {
    key: "claro",
    label: "Claro",
    claro: true,
    bg: "#faf7f8",
    surface: "#ffffff",
    surfaceAlt: "#f3f4f6",
    text: "#1f2937",
    textMuted: "#565e6c",
    border: "#ececf1",
  },
  {
    key: "areia",
    label: "Areia",
    claro: true,
    bg: "#f7f3ec",
    surface: "#fffdf8",
    surfaceAlt: "#efe7d8",
    text: "#2b2620",
    textMuted: "#8a7f6d",
    border: "#e6dcc9",
  },
  {
    key: "rosado",
    label: "Rosado",
    claro: true,
    bg: "#fdf5f8",
    surface: "#ffffff",
    surfaceAlt: "#fbeaf1",
    text: "#2a1d24",
    textMuted: "#8a6f7c",
    border: "#f3dce6",
  },
  {
    key: "carvao",
    label: "Carvão (preto)",
    claro: false,
    bg: "#08090b",
    surface: "#121316",
    surfaceAlt: "#1c1e22",
    text: "#f4f5f7",
    textMuted: "#969aa3",
    border: "#26282d",
  },
  {
    key: "vinho",
    label: "Vinho",
    claro: false,
    bg: "#1a0e13",
    surface: "#26141c",
    surfaceAlt: "#341d28",
    text: "#f8eef2",
    textMuted: "#bd97a6",
    border: "#43222f",
  },
  {
    key: "oceano",
    label: "Oceano",
    claro: false,
    bg: "#06141a",
    surface: "#0c2129",
    surfaceAlt: "#143039",
    text: "#e9f6fa",
    textMuted: "#8fb3bf",
    border: "#1d404c",
  },
  {
    key: "lavanda",
    label: "Lavanda",
    claro: true,
    bg: "#f6f4fc",
    surface: "#ffffff",
    surfaceAlt: "#efeafb",
    text: "#241f33",
    textMuted: "#7a7194",
    border: "#e6def5",
  },
];

export function temaBaseDef(key: string | null | undefined): TemaBase {
  return TEMAS_BASE.find((t) => t.key === key) || TEMAS_BASE[0];
}

// ----------------------------------------------------------------------------
// Arredondamento dos cantos do painel (cards, botões, inputs). Aplicado via
// variáveis CSS que as classes .card/.btn/.input consomem no globals.css.
// ----------------------------------------------------------------------------
export interface RaioPreset {
  key: string;
  label: string;
  card: string;
  btn: string;
  input: string;
}

export const RAIOS: RaioPreset[] = [
  { key: "reto", label: "Retos", card: "0.375rem", btn: "0.25rem", input: "0.25rem" },
  { key: "suave", label: "Suaves", card: "0.625rem", btn: "0.5rem", input: "0.5rem" },
  { key: "padrao", label: "Padrão", card: "0.875rem", btn: "0.625rem", input: "0.625rem" },
  { key: "redondo", label: "Bem arredondados", card: "1.5rem", btn: "1.25rem", input: "1.25rem" },
];

export function raioDef(key: string | null | undefined): RaioPreset {
  return RAIOS.find((r) => r.key === key) || RAIOS[2]; // padrão = atual
}

export interface Aparencia {
  corMarca: string | null;
  temaBase: string | null;
  appFonte: string | null;
  appRaio?: string | null;
}

const CHAVE_CACHE = "aparencia";

// Formato pré-computado que o script anti-flash aplica direto (sem cálculo).
interface AparenciaCache {
  light: boolean;
  tokens: Record<string, string>;
  brand: Record<number, string> | null;
  font: string;
}

function montarCache(a: Aparencia): AparenciaCache {
  const base = temaBaseDef(a.temaBase);
  const raio = raioDef(a.appRaio);
  return {
    light: base.claro,
    tokens: {
      "--bg": base.bg,
      "--surface": base.surface,
      "--surface-alt": base.surfaceAlt,
      "--text": base.text,
      "--text-muted": base.textMuted,
      "--border": base.border,
      "--r-card": raio.card,
      "--r-btn": raio.btn,
      "--r-input": raio.input,
    },
    brand: gerarTonsMarca(a.corMarca),
    font: a.appFonte ? carregarFonte(a.appFonte) : "",
  };
}

function aplicarCache(c: AparenciaCache) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", c.light);
  root.style.colorScheme = c.light ? "light" : "dark";
  for (const [k, v] of Object.entries(c.tokens)) root.style.setProperty(k, v);
  const tons = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  if (c.brand) {
    for (const t of tons) root.style.setProperty(`--brand-${t}`, c.brand[t]);
  } else {
    for (const t of tons) root.style.removeProperty(`--brand-${t}`);
  }
  root.style.fontFamily = c.font || "";
}

// Aplica a aparência ao vivo e atualiza o cache (chamado no Guard e nas telas
// de configuração para preview imediato).
export function aplicarAparencia(a: Aparencia) {
  const cache = montarCache(a);
  aplicarCache(cache);
  try {
    localStorage.setItem(CHAVE_CACHE, JSON.stringify(cache));
  } catch {
    /* ignora */
  }
}

// ----------------------------------------------------------------------------
// Preferência claro/escuro de cada usuário (atalho do Perfil). Fica no
// localStorage por usuário e vale por cima do tema base da loja — mas só
// enquanto o tema base for o mesmo de quando a pessoa escolheu: se o dono trocar
// o tema em Configurações, a escolha antiga deixa de valer.
// ----------------------------------------------------------------------------
const CHAVE_TEMA_USUARIO = "tema-usuario:";

type PrefTema = { tema: string; base: string };

// Pura (testável): dado o valor salvo e o tema base atual da loja, devolve o
// tema a aplicar.
export function resolverTemaUsuario(salvo: string | null, temaBaseLoja: string | null): string | null {
  const base = temaBaseDef(temaBaseLoja).key;
  if (!salvo) return temaBaseLoja;
  try {
    const p = JSON.parse(salvo) as PrefTema;
    if (p && typeof p.tema === "string" && p.base === base && TEMAS_BASE.some((t) => t.key === p.tema))
      return p.tema;
  } catch {
    /* valor inválido: ignora */
  }
  return temaBaseLoja;
}

export function temaDoUsuario(usuarioId: string | null, temaBaseLoja: string | null): string | null {
  if (!usuarioId || typeof window === "undefined") return temaBaseLoja;
  try {
    return resolverTemaUsuario(localStorage.getItem(CHAVE_TEMA_USUARIO + usuarioId), temaBaseLoja);
  } catch {
    return temaBaseLoja;
  }
}

// tema=null (ou igual ao da loja) apaga a preferência
export function salvarTemaDoUsuario(usuarioId: string | null, tema: string | null, temaBaseLoja: string | null) {
  if (!usuarioId || typeof window === "undefined") return;
  const base = temaBaseDef(temaBaseLoja).key;
  try {
    const k = CHAVE_TEMA_USUARIO + usuarioId;
    if (!tema || tema === base) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify({ tema, base } satisfies PrefTema));
  } catch {
    /* ignora */
  }
}

// ----------------------------------------------------------------------------
// Favicon dinâmico: o ícone da aba do navegador vira a logo da loja. Troca
// sozinho quando o dono muda a logo (chamado no Guard) e na vitrine pública
// usa a logo daquela loja. Sem logo, cai no /icon.svg padrão.
// ----------------------------------------------------------------------------
const CHAVE_FAVICON = "favicon";

// Atributo que marca os <link> de ícone que NÓS criamos. Os <link rel="icon">
// gerados pelo `metadata.icons` do Next pertencem ao React: removê-los ou
// mutá-los quebra a navegação client-side ("Cannot read properties of null
// (reading 'removeChild')" quando o React tenta desmontá-los). Por isso só
// mexemos no nosso próprio link — criado uma vez e depois só com o href trocado.
export const ATTR_FAVICON = "data-am-favicon";

// Garante um único <link rel={rel} data-am-favicon> e atualiza o href. Fica por
// último no <head> para ter precedência sobre os ícones padrão do Next.
// `doc` é injetável para teste.
export function definirIconLink(rel: string, href: string, doc?: Document) {
  const d = doc ?? (typeof document === "undefined" ? undefined : document);
  if (!d) return;
  const head = d.head;
  let link = head.querySelector<HTMLLinkElement>(`link[${ATTR_FAVICON}="${rel}"]`);
  if (!link) {
    link = d.createElement("link");
    link.setAttribute(ATTR_FAVICON, rel);
    link.rel = rel;
  }
  if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  // reanexa no fim (move só o nosso nó; os do React ficam intactos)
  if (head.lastElementChild !== link) head.appendChild(link);
}

// Aplica a logo como favicon (e, opcionalmente, o nome da loja como título da aba).
// persistir=true cacheia p/ reaplicar antes da pintura na próxima visita (app do dono).
// A vitrine pública passa persistir=false p/ não vazar o ícone de uma loja visitada
// para a landing (o script anti-flash é global ao site).
export function aplicarFavicon(
  logoUrl: string | null | undefined,
  titulo?: string | null,
  persistir = true
) {
  if (typeof document === "undefined") return;
  const href = logoUrl || "/icon.svg";
  definirIconLink("icon", href);
  definirIconLink("apple-touch-icon", href);
  if (titulo) document.title = titulo;
  if (!persistir) return;
  try {
    localStorage.setItem(CHAVE_FAVICON, href);
  } catch {
    /* ignora */
  }
}

// Script injetado no <head> - reaplica a aparência cacheada antes da pintura.
export const APARENCIA_NO_FLASH = `(function(){try{
var c=JSON.parse(localStorage.getItem('${CHAVE_CACHE}')||'null');
var r=document.documentElement;
if(c){
r.classList.toggle('light',!!c.light);
r.style.colorScheme=c.light?'light':'dark';
if(c.tokens)for(var k in c.tokens)r.style.setProperty(k,c.tokens[k]);
var T=[50,100,200,300,400,500,600,700,800,900],i;
if(c.brand){for(i=0;i<T.length;i++)r.style.setProperty('--brand-'+T[i],c.brand[T[i]]);}
if(c.font)r.style.fontFamily=c.font;
}
var lg=localStorage.getItem('${CHAVE_FAVICON}');
if(lg){['icon','apple-touch-icon'].forEach(function(rel){
var l=document.createElement('link');l.rel=rel;l.href=lg;l.setAttribute('${ATTR_FAVICON}',rel);document.head.appendChild(l);
});}
}catch(e){}})();`;
