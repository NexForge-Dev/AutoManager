import type { Metadata } from "next";
import Link from "next/link";
import LegalLayout, { Secao } from "@/components/landing/LegalLayout";
import { CanaisContato, IdentificacaoEmpresa } from "@/components/landing/ContatoEmpresa";
import { EMPRESA } from "@/lib/empresa";
import { ORDEM_PLANOS, PLANOS, brlPreco } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Termos de Uso · AutoManager",
  description: "Condições de uso do AutoManager, sistema de gestão para micronegócios.",
  alternates: { canonical: "/termos" },
};

export default function TermosPage() {
  const fornecedor = EMPRESA.razaoSocial || EMPRESA.nomeFantasia;
  return (
    <LegalLayout
      titulo="Termos de Uso"
      resumo="Em resumo: o AutoManager é um sistema online de gestão para a sua loja. O 1º mês é grátis; depois, a assinatura é mensal, cobrada pelo Mercado Pago, e você pode cancelar quando quiser. Os dados da sua loja são seus. Leia abaixo as regras completas."
    >
      <Secao n={1} titulo="Quem somos e o que é este documento">
        <p>
          Estes Termos de Uso regulam o acesso e o uso do <strong>AutoManager</strong>, software
          oferecido como serviço (SaaS) por <strong>{fornecedor}</strong> (&quot;AutoManager&quot;,
          &quot;nós&quot;).
        </p>
        <IdentificacaoEmpresa />
        <p>
          Ao criar uma conta ou usar o AutoManager você declara que leu e concorda com estes Termos e
          com a nossa <Link href="/privacidade">Política de Privacidade</Link>. Se não concordar, não
          use o serviço.
        </p>
      </Secao>

      <Secao n={2} titulo="Objeto do serviço">
        <p>
          O AutoManager é um sistema de gestão para micronegócios, acessado pelo navegador (com opção
          de instalar na tela inicial do celular). Conforme o plano contratado, ele permite:
        </p>
        <ul>
          <li>cadastro de produtos, variações e controle de estoque;</li>
          <li>registro de vendas, recebimentos, contas e relatórios de faturamento e lucro;</li>
          <li>gestão de revendedoras, vendedores internos e motoboys, com cálculo de comissões;</li>
          <li>
            uma <strong>vitrine pública</strong> da loja, com link próprio, na qual visitantes podem
            ver produtos e conversar com a loja por <strong>chat</strong>, sem precisar criar conta.
          </li>
        </ul>
        <p>
          O AutoManager é uma ferramenta de organização. Ele <strong>não</strong> é sistema emissor de
          nota fiscal, não substitui contador e não intermedeia as vendas que você faz aos seus
          clientes: a relação comercial entre a sua loja e os seus clientes é exclusivamente sua.
        </p>
      </Secao>

      <Secao n={3} titulo="Conta, acesso e equipe">
        <ul>
          <li>
            Para usar o sistema é preciso criar uma conta com e-mail e senha. Você deve ser maior de
            18 anos (ou emancipado) e informar dados verdadeiros.
          </li>
          <li>
            Você é responsável por manter sua senha em sigilo e por toda atividade feita na sua conta.
            Se suspeitar de uso indevido, troque a senha e nos avise.
          </li>
          <li>
            O titular da conta (&quot;lojista&quot;) pode convidar revendedoras, vendedores e motoboys.
            Esses membros acessam os dados da loja <strong>na medida das permissões</strong> que o
            sistema dá a cada papel. Cabe ao lojista escolher a quem dá acesso e remover quem não deve
            mais acessar.
          </li>
          <li>Cada loja é isolada das demais: usuários de uma loja não acessam dados de outra.</li>
        </ul>
      </Secao>

      <Secao n={4} titulo="Planos, teste grátis e pagamento">
        <p>
          <strong>Teste grátis:</strong> toda nova loja tem <strong>1 (um) mês grátis</strong>, sem
          necessidade de cartão, com acesso aos recursos do plano mais completo. Ao fim do teste, para
          continuar usando os recursos pagos é preciso assinar um plano.
        </p>
        <p>
          <strong>Planos atuais</strong> (valores mensais, em reais):
        </p>
        <ul>
          {ORDEM_PLANOS.map((id) => (
            <li key={id}>
              <strong>{PLANOS[id].nome}</strong> — {brlPreco(PLANOS[id].precoCentavos)}/mês (
              {PLANOS[id].publico.toLowerCase()})
            </li>
          ))}
        </ul>
        <p>
          <strong>Assinatura recorrente:</strong> a cobrança é <strong>mensal e automática</strong>,
          processada pelo <strong>Mercado Pago</strong> (cartão, Pix ou boleto, conforme opções
          disponíveis no Mercado Pago). Os dados de pagamento são informados diretamente no ambiente
          do Mercado Pago; o AutoManager não recebe nem armazena o número do seu cartão.
        </p>
        <ul>
          <li>
            Se um pagamento não for aprovado, a conta pode passar ao status de inadimplente e os
            recursos pagos ficam limitados até a regularização. Seus dados não são apagados por isso.
          </li>
          <li>
            Ao trocar de plano, a nova assinatura substitui a anterior, que é cancelada para não haver
            cobrança dupla.
          </li>
          <li>
            Podemos reajustar preços ou alterar a composição dos planos, avisando com pelo menos{" "}
            <strong>30 dias</strong> de antecedência. O novo valor só vale a partir do ciclo seguinte ao
            aviso, e você pode cancelar antes dele sem custo.
          </li>
        </ul>
      </Secao>

      <Secao n={5} titulo="Cancelamento e arrependimento">
        <p>
          Você pode cancelar a assinatura <strong>a qualquer momento</strong>, sem multa e sem
          fidelidade; a cobrança recorrente é interrompida e a conta passa a ter os recursos do plano
          básico, sem perda de dados. Na primeira contratação paga, vale o <strong>direito de arrependimento de 7
          dias</strong> (art. 49 do Código de Defesa do Consumidor), com reembolso integral. As regras
          completas e o passo a passo estão na{" "}
          <Link href="/cancelamento">Política de Cancelamento e Reembolso</Link>.
        </p>
      </Secao>

      <Secao n={6} titulo="Seus dados e a vitrine pública">
        <ul>
          <li>
            Os dados que você cadastra (produtos, vendas, clientes, equipe) são <strong>seus</strong>.
            Nós os tratamos apenas para prestar o serviço, conforme a{" "}
            <Link href="/privacidade">Política de Privacidade</Link>.
          </li>
          <li>
            Em relação aos dados pessoais dos <strong>seus clientes</strong> e da sua equipe, você é o{" "}
            <strong>controlador</strong> (LGPD) e o AutoManager atua como <strong>operador</strong>.
            Cabe a você ter base legal para cadastrá-los e atender aos pedidos desses titulares.
          </li>
          <li>
            Tudo o que você publica na vitrine (fotos, descrições, preços, contatos) fica visível para
            qualquer pessoa com o link. Publique só o que pode ser público e de que você tenha os
            direitos.
          </li>
        </ul>
      </Secao>

      <Secao n={7} titulo="Conduta: o que não é permitido">
        <ul>
          <li>vender ou anunciar produtos ilícitos, falsificados, roubados ou de venda proibida;</li>
          <li>publicar conteúdo ofensivo, discriminatório, enganoso ou que viole direitos de terceiros;</li>
          <li>usar o chat da vitrine para spam, golpes ou assédio;</li>
          <li>
            tentar acessar dados de outras lojas, burlar limites de plano, fazer engenharia reversa ou
            sobrecarregar a infraestrutura;
          </li>
          <li>revender ou sublicenciar o acesso ao sistema sem autorização por escrito.</li>
        </ul>
        <p>
          Em caso de violação, podemos remover conteúdo, suspender ou encerrar a conta, avisando o
          motivo sempre que possível, sem prejuízo de responsabilização.
        </p>
      </Secao>

      <Secao n={8} titulo="Disponibilidade e suporte">
        <p>
          Trabalhamos para manter o AutoManager disponível 24h por dia, mas podem ocorrer
          interrupções para manutenção, atualizações ou por falhas de terceiros (provedores de
          internet, hospedagem, banco de dados, meios de pagamento). Não garantimos funcionamento
          ininterrupto nem livre de erros. Podemos melhorar, alterar ou descontinuar funcionalidades,
          preservando o núcleo do serviço contratado.
        </p>
        <p>O suporte é prestado pelos canais abaixo, em dias úteis:</p>
        <CanaisContato assunto="Suporte AutoManager" />
      </Secao>

      <Secao n={9} titulo="Limitação de responsabilidade">
        <ul>
          <li>
            Os relatórios, cálculos de lucro, comissões e sugestões de reposição dependem dos dados
            que você e sua equipe informam. Confira os números antes de tomar decisões financeiras,
            fiscais ou de pagamento de comissão.
          </li>
          <li>
            Não respondemos por perdas decorrentes de dados informados incorretamente, de acessos
            feitos com a sua senha, das relações entre a sua loja e seus clientes ou equipe, nem por
            lucros cessantes ou danos indiretos.
          </li>
          <li>
            Quando houver responsabilidade nossa, ela fica limitada ao valor pago por você nos 12
            meses anteriores ao fato, salvo nos casos em que a lei não permita essa limitação
            (inclusive direitos do consumidor previstos no CDC).
          </li>
        </ul>
      </Secao>

      <Secao n={10} titulo="Propriedade intelectual">
        <p>
          O software, a marca AutoManager, o layout e os textos do sistema pertencem a {fornecedor}.
          A assinatura dá a você uma licença de uso pessoal, não exclusiva e intransferível, enquanto
          estiver ativa. O conteúdo que você cadastra continua sendo seu; você nos autoriza a
          armazená-lo e exibi-lo apenas para prestar o serviço (por exemplo, na sua vitrine).
        </p>
      </Secao>

      <Secao n={11} titulo="Alterações destes Termos">
        <p>
          Podemos atualizar estes Termos. Mudanças relevantes serão avisadas no app ou por e-mail com
          antecedência razoável. A data no topo indica a versão vigente. Continuar usando o serviço
          depois da vigência significa concordar com a nova versão.
        </p>
      </Secao>

      <Secao n={12} titulo="Lei aplicável e foro">
        <p>
          Estes Termos seguem as leis do Brasil. Fica eleito o foro da comarca{" "}
          {EMPRESA.cidadeUf ? (
            <>
              de <strong>{EMPRESA.cidadeUf}</strong>
            </>
          ) : (
            "da sede do fornecedor"
          )}{" "}
          para resolver eventuais conflitos, ressalvado ao consumidor o direito de propor a ação no
          foro do seu domicílio, nos termos do CDC.
        </p>
      </Secao>
    </LegalLayout>
  );
}
