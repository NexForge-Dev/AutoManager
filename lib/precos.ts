// Preço de venda sugerido pela margem padrão, no formato que o campo aceita
// (pt-BR, vírgula decimal, sem separador de milhar): custo 25 + 60% -> "40,00".
export function sugerirPreco(custo: number, margemPercent: number): string {
  if (!isFinite(custo) || custo <= 0) return "";
  const margem = isFinite(margemPercent) ? margemPercent : 0;
  return (custo * (1 + margem / 100)).toFixed(2).replace(".", ",");
}
