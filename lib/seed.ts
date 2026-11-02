// Templates de catálogo por segmento - sugestões iniciais que o lojista pode editar.
// O AutoManager atende micronegócios em geral; estes são só pontos de partida.
export const CATEGORIAS_POR_SEGMENTO: Record<string, string[]> = {
  semijoias: ["Anéis", "Brincos", "Colares", "Pulseiras", "Conjuntos", "Tornozeleiras"],
  bijuteria: ["Brincos", "Colares", "Pulseiras", "Tiaras", "Pingentes"],
  joias: ["Anéis", "Brincos", "Colares", "Pulseiras", "Alianças"],
  cosmeticos: ["Maquiagem", "Skincare", "Perfumaria", "Cabelos", "Unhas"],
  doces: ["Doces", "Salgados", "Bolos & Tortas", "Kits", "Encomendas"],
  roupas: ["Blusas", "Calças", "Vestidos", "Calçados", "Acessórios"],
  papelaria: ["Material escolar", "Canetas", "Cadernos", "Presentes", "Festa"],
  petshop: ["Ração", "Petiscos", "Higiene", "Brinquedos", "Acessórios"],
  outro: ["Geral"],
};

export const SEGMENTOS = [
  { id: "doces", label: "Doces & comida caseira" },
  { id: "semijoias", label: "Semijoias" },
  { id: "bijuteria", label: "Bijuteria" },
  { id: "cosmeticos", label: "Cosméticos & perfumaria" },
  { id: "roupas", label: "Roupas & acessórios" },
  { id: "papelaria", label: "Papelaria & presentes" },
  { id: "petshop", label: "Pet shop" },
  { id: "joias", label: "Joias" },
  { id: "outro", label: "Outro" },
];

// Lista efetiva de categorias da loja: as personalizadas; senão, as sugestões do segmento.
export function categoriasDaLoja(config: { categorias?: string[]; segmento: string }): string[] {
  if (config.categorias && config.categorias.length) return config.categorias;
  return CATEGORIAS_POR_SEGMENTO[config.segmento] || ["Geral"];
}
