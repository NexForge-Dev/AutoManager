import type { NovoProduto } from "./store";

// Parser de planilha (CSV) para importação de produtos. Pensado para o lojista
// que está saindo da planilha do Excel/Sheets: aceita separador ";" (padrão
// pt-BR), "," ou tab, números em formato brasileiro ("1.234,56") e nomes de
// coluna flexíveis (acento/maiúsculas ignorados).

export interface LinhaImport extends NovoProduto {
  _linha: number; // nº da linha no arquivo (p/ apontar erros)
}

export interface ResultadoImport {
  linhas: LinhaImport[];
  erros: { linha: number; motivo: string }[];
  total: number; // linhas de dados lidas (com ou sem erro)
}

// remove acentos, espaços extras e caixa, p/ casar cabeçalhos
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

// sinônimos aceitos para cada campo
const COLUNAS: Record<string, string[]> = {
  nome: ["nome", "produto", "descricao do produto", "item"],
  categoria: ["categoria", "tipo", "grupo"],
  custo: ["custo", "preco de custo", "custo unitario", "valor de custo"],
  precoVenda: ["preco", "preco venda", "preco de venda", "valor", "preco unitario", "venda"],
  precoComparativo: ["preco de", "preco comparativo", "de", "preco antigo"],
  estoqueAtual: ["estoque", "estoque atual", "quantidade", "qtd", "qtde"],
  estoqueMinimo: ["estoque minimo", "minimo", "min", "estoque min"],
  sku: ["sku", "codigo", "cod"],
  marca: ["marca", "fabricante"],
};

function detectarSeparador(linha: string): string {
  const candidatos = [";", "\t", ","];
  let melhor = ";";
  let max = -1;
  for (const c of candidatos) {
    const n = linha.split(c).length;
    if (n > max) {
      max = n;
      melhor = c;
    }
  }
  return melhor;
}

// divide uma linha respeitando aspas (RFC4180 simplificado)
function dividir(linha: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (aspas && linha[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        aspas = !aspas;
      }
    } else if (ch === sep && !aspas) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// "1.234,56" / "1234,5" / "12.50" / "R$ 10" -> number (NaN se vazio/inválido)
function parseNumero(bruto: string): number {
  let s = bruto.replace(/[^\d.,-]/g, "").trim();
  if (!s) return NaN;
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    // assume ponto = milhar, vírgula = decimal (pt-BR)
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    s = s.replace(",", ".");
  } else if (temPonto) {
    // só ponto: "1.500" / "1.234.567" = milhar pt-BR (todo grupo após o 1º com
    // exatamente 3 dígitos); "12.90" / "12.5" = decimal.
    const grupos = s.replace(/^-/, "").split(".");
    // 1º grupo com 1-3 dígitos e sem zero à esquerda ("0.500" segue decimal)
    if (
      grupos.length > 1 &&
      /^[1-9]\d{0,2}$/.test(grupos[0]) &&
      grupos.slice(1).every((g) => /^\d{3}$/.test(g))
    )
      s = s.replace(/\./g, "");
  }
  return parseFloat(s);
}

export function parseProdutosCSV(texto: string): ResultadoImport {
  const linhasBrutas = texto
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l, i) => l.trim() !== "" || i === 0);

  const erros: ResultadoImport["erros"] = [];
  const linhas: LinhaImport[] = [];

  if (linhasBrutas.length < 2) return { linhas, erros, total: 0 };

  const sep = detectarSeparador(linhasBrutas[0]);
  const cabecalho = dividir(linhasBrutas[0], sep).map(normalizar);

  // mapeia cada campo -> índice da coluna
  const idx: Partial<Record<keyof typeof COLUNAS, number>> = {};
  for (const campo of Object.keys(COLUNAS) as (keyof typeof COLUNAS)[]) {
    const i = cabecalho.findIndex((c) => COLUNAS[campo].includes(c));
    if (i >= 0) idx[campo] = i;
  }

  if (idx.nome === undefined || idx.precoVenda === undefined) {
    return {
      linhas,
      erros: [
        {
          linha: 1,
          motivo: 'O arquivo precisa ter pelo menos as colunas "nome" e "preço" no cabeçalho.',
        },
      ],
      total: 0,
    };
  }

  let total = 0;
  for (let i = 1; i < linhasBrutas.length; i++) {
    const campos = dividir(linhasBrutas[i], sep);
    const get = (k: keyof typeof COLUNAS) => (idx[k] !== undefined ? campos[idx[k]!] ?? "" : "");
    const nome = get("nome").trim();
    if (!nome) continue; // pula linha sem nome (linha vazia/separadora)
    total++;
    const nLinha = i + 1;

    const precoVenda = parseNumero(get("precoVenda"));
    if (isNaN(precoVenda) || precoVenda < 0) {
      erros.push({ linha: nLinha, motivo: `"${nome}": preço inválido.` });
      continue;
    }
    const custoBruto = get("custo");
    const custo = custoBruto ? parseNumero(custoBruto) : 0;
    const estoqueBruto = get("estoqueAtual");
    const estoqueAtual = estoqueBruto ? Math.max(0, Math.round(parseNumero(estoqueBruto)) || 0) : 0;
    const minimoBruto = get("estoqueMinimo");
    const estoqueMinimo = minimoBruto ? Math.max(0, Math.round(parseNumero(minimoBruto)) || 0) : 0;
    const precoDe = get("precoComparativo") ? parseNumero(get("precoComparativo")) : NaN;

    linhas.push({
      _linha: nLinha,
      nome,
      categoria: get("categoria").trim() || "Geral",
      custo: isNaN(custo) ? 0 : custo,
      precoVenda,
      precoComparativo: !isNaN(precoDe) && precoDe > 0 ? precoDe : undefined,
      estoqueAtual,
      estoqueMinimo,
      sku: get("sku").trim() || undefined,
      marca: get("marca").trim() || undefined,
    });
  }

  return { linhas, erros, total };
}

// cabeçalho de exemplo p/ o lojista baixar e preencher
export const CSV_MODELO_HEADER = [
  "nome",
  "categoria",
  "custo",
  "preco",
  "estoque",
  "estoque minimo",
  "sku",
  "marca",
];
export const CSV_MODELO_EXEMPLO: (string | number)[][] = [
  ["Brinco Argola", "Semijoias", "8,00", "25,00", "12", "3", "BR-001", "Própria"],
  ["Colar Coração", "Semijoias", "15,00", "49,90", "5", "2", "CL-002", "Própria"],
];
