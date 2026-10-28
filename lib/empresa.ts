// ============================================================================
// DADOS DA EMPRESA (fornecedora do AutoManager)
//
// >>> PREENCHA ESTES CAMPOS antes de vender. <<<
// Eles aparecem no rodapé da landing, nos Termos de Uso, na Política de
// Privacidade e na Política de Cancelamento, e alimentam os botões de WhatsApp.
//
// Campo vazio ("") = a linha/botão correspondente simplesmente não aparece.
// NÃO coloque valores fictícios: CNPJ, e-mail e telefone são exibidos ao cliente
// e exigidos pelo CDC (Decreto 7.962/2013) e pela LGPD.
//
// - razaoSocial:     nome jurídico (ex.: "Fulano Tecnologia LTDA" ou seu MEI)
// - cnpj:            com máscara, ex.: "00.000.000/0001-00"
// - emailSuporte:    e-mail que recebe suporte, cancelamento e pedidos LGPD
// - whatsappSuporte: SÓ dígitos, com DDI 55 + DDD, ex.: "5511999999999"
// - cidadeUf:        ex.: "São Paulo/SP" (usado também como foro nos Termos)
// - encarregadoLgpd: nome do encarregado (DPO); se vazio, usa o e-mail de suporte
// ============================================================================

export interface DadosEmpresa {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  emailSuporte: string;
  whatsappSuporte: string;
  cidadeUf: string;
  encarregadoLgpd: string;
}

export const EMPRESA: DadosEmpresa = {
  nomeFantasia: "AutoManager",
  razaoSocial: "",
  cnpj: "",
  emailSuporte: "",
  whatsappSuporte: "5583993826429",
  cidadeUf: "",
  encarregadoLgpd: "",
};

/** Link wa.me com mensagem; "" se o número não estiver configurado. */
export function whatsappEmpresa(texto?: string): string {
  const d = EMPRESA.whatsappSuporte.replace(/\D/g, "");
  if (!d) return "";
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/** "Razão Social · CNPJ 00.000.000/0001-00 · email" só com o que estiver preenchido. */
export function linhaEmpresa(): string {
  return [
    EMPRESA.razaoSocial,
    EMPRESA.cnpj ? `CNPJ ${EMPRESA.cnpj}` : "",
    EMPRESA.emailSuporte,
  ]
    .filter(Boolean)
    .join(" · ");
}
