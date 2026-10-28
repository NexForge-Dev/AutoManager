import type { Metadata } from "next";
import Link from "next/link";
import LegalLayout, { Secao } from "@/components/landing/LegalLayout";
import { CanaisContato } from "@/components/landing/ContatoEmpresa";

export const metadata: Metadata = {
  title: "Cancelamento e Reembolso · AutoManager",
  description:
    "Como cancelar a assinatura do AutoManager a qualquer momento e como funciona o direito de arrependimento de 7 dias.",
  alternates: { canonical: "/cancelamento" },
};

export default function CancelamentoPage() {
  return (
    <LegalLayout
      titulo="Política de Cancelamento e Reembolso"
      resumo="Em resumo: sem fidelidade e sem multa. Você cancela quando quiser e para de ser cobrado nas próximas mensalidades. Se desistir em até 7 dias depois da primeira cobrança, devolvemos 100% do valor."
    >
      <Secao n={1} titulo="Cancelamento a qualquer momento">
        <ul>
          <li>
            A assinatura do AutoManager é mensal, <strong>sem fidelidade e sem multa</strong>. Você
            pode cancelar quando quiser.
          </li>
          <li>
            Ao cancelar, a cobrança recorrente é interrompida e{" "}
            <strong>nenhuma nova mensalidade é cobrada</strong>. Fora do prazo de arrependimento
            (seção 2), o valor do mês em curso não é fracionado nem devolvido.
          </li>
          <li>
            Após o cancelamento, a conta continua existindo, com os recursos do plano básico.{" "}
            <strong>Seus dados não são apagados</strong> por causa do cancelamento: você pode consultar
            e exportar seus relatórios, e reativar um plano quando quiser.
          </li>
          <li>
            Se preferir que tudo seja apagado, peça a exclusão da conta (veja a{" "}
            <Link href="/privacidade">Política de Privacidade</Link>).
          </li>
          <li>
            Durante o <strong>teste grátis de 1 mês</strong> não há cobrança; não é preciso cancelar
            nada se você decidir não assinar.
          </li>
        </ul>
      </Secao>

      <Secao n={2} titulo="Direito de arrependimento (7 dias)">
        <p>
          Como a contratação é feita pela internet, você tem o direito de desistir em até{" "}
          <strong>7 (sete) dias corridos</strong> contados da <strong>primeira cobrança</strong> da
          assinatura, conforme o <strong>art. 49 do Código de Defesa do Consumidor</strong>, sem
          precisar explicar o motivo.
        </p>
        <ul>
          <li>
            O reembolso é <strong>integral</strong> (100% do valor pago), pelo mesmo meio de pagamento
            usado no Mercado Pago.
          </li>
          <li>
            Processamos o pedido em até <strong>5 dias úteis</strong>. O prazo para o valor aparecer
            depende do meio de pagamento: no Pix costuma ser imediato após o estorno; no cartão de
            crédito, o estorno pode aparecer em até duas faturas, conforme o emissor.
          </li>
          <li>Junto com o reembolso, a assinatura é cancelada e não há novas cobranças.</li>
        </ul>
        <p>
          Fora do prazo de 7 dias, o cancelamento interrompe as cobranças futuras, mas os meses já
          pagos não são reembolsados, salvo cobrança indevida ou falha nossa — que corrigimos sempre.
        </p>
      </Secao>

      <Secao n={3} titulo="Como cancelar ou pedir reembolso">
        <p>Use qualquer um destes caminhos:</p>
        <ul>
          <li>
            <strong>Pelo Mercado Pago:</strong> no app ou site do Mercado Pago, acesse{" "}
            <em>Assinaturas</em>, escolha a assinatura do AutoManager e toque em{" "}
            <em>Cancelar assinatura</em>. O cancelamento é refletido automaticamente na sua conta.
          </li>
          <li>
            <strong>Falando com a gente</strong>, a partir do e-mail da conta, informando o nome da
            loja e se deseja só cancelar ou também exercer o arrependimento com reembolso:
          </li>
        </ul>
        <CanaisContato assunto="Cancelamento da assinatura" />
        <p>
          Confirmamos o cancelamento por escrito (e-mail ou mensagem) assim que ele for processado,
          conforme o Decreto 7.962/2013.
        </p>
      </Secao>

      <Secao n={4} titulo="Cobranças indevidas">
        <p>
          Se você for cobrado depois de cancelar, ou em duplicidade, fale com a gente pelos canais
          acima: estornamos o valor indevido integralmente.
        </p>
      </Secao>

      <Secao n={5} titulo="Documentos relacionados">
        <p>
          <Link href="/termos">Termos de Uso</Link> · <Link href="/privacidade">Política de Privacidade</Link>
        </p>
      </Secao>
    </LegalLayout>
  );
}
