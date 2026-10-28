import { EMPRESA, whatsappEmpresa } from "@/lib/empresa";

// Bloco de identificação/contato do fornecedor usado nas páginas legais.
// Mostra só os campos preenchidos em lib/empresa.ts.
export function IdentificacaoEmpresa() {
  const linhas: [string, string][] = [
    ["Nome", EMPRESA.nomeFantasia],
    ["Razão social", EMPRESA.razaoSocial],
    ["CNPJ", EMPRESA.cnpj],
    ["Sede", EMPRESA.cidadeUf],
  ];
  return (
    <ul>
      {linhas
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <li key={k}>
            <strong>{k}:</strong> {v}
          </li>
        ))}
    </ul>
  );
}

export function CanaisContato({ assunto }: { assunto?: string }) {
  const wa = whatsappEmpresa(assunto);
  const mail = EMPRESA.emailSuporte;
  return (
    <ul>
      {mail && (
        <li>
          <strong>E-mail:</strong>{" "}
          <a href={`mailto:${mail}${assunto ? `?subject=${encodeURIComponent(assunto)}` : ""}`}>{mail}</a>
        </li>
      )}
      {wa && (
        <li>
          <strong>WhatsApp:</strong>{" "}
          <a href={wa} target="_blank" rel="noopener noreferrer">
            falar com o suporte
          </a>
        </li>
      )}
      <li>
        <strong>Dentro do app:</strong> botão de suporte no Painel (abre um chamado registrado na sua
        conta).
      </li>
    </ul>
  );
}
