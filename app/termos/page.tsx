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
      resumo="Em resumo: o AutoManager é um sistema online de gestão para a sua loja. O 1º mês é grátis; depois, a assinatura é mensal, cobrada pelo Stripe, e você pode cancelar quando quiser. Sem assinatura, a loja não é cobrada e fica com os recursos do plano Ambulante. Os dados da sua loja são seus. Leia abaixo as regras completas."
    >
      <Secao n={1} titulo="Quem somos e o que é este documento">
        <p>
          Estes Termos de Uso regulam o acesso e o uso do <strong>AutoManager</strong>, software
          oferecido como serviço (SaaS)
          {EMPRESA.razaoSocial ? (
            <>
              {" "}
              por <strong>{EMPRESA.razaoSocial}</strong>
            </>
          ) : null}{" "}
          (&quot;AutoManager&quot;, &quot;nós&quot;).
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
          <li>
            O sistema é construído para separar as lojas: as regras do banco de dados limitam cada
            usuário aos dados da própria loja.
          </li>
        </ul>
      </Secao>

      <Secao n={4} titulo="Planos, teste grátis e pagamento">
        <p>
          <strong>Teste grátis:</strong> toda nova loja tem <strong>1 (um) mês grátis</strong>, sem
          necessidade de cartão, com acesso aos recursos do plano {PLANOS.expansao.nome}, o mais
          completo. Se você assinar durante o teste, a primeira cobrança acontece quando ele terminar;
          se faltarem menos de 48 horas para o fim do teste, a cobrança acontece no ato da assinatura.
        </p>
        <p>
          <strong>Planos atuais</strong> (valores mensais, em reais; o que cada um inclui aparece na
          tela de planos antes da contratação):
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
          processada pelo <strong>Stripe</strong> (cartão e demais meios exibidos no checkout). Os
          dados de pagamento são informados diretamente no ambiente do Stripe; o AutoManager não
          recebe nem armazena o número do seu cartão. Ao trocar de plano no meio do ciclo, a diferença
          proporcional é cobrada na hora (no upgrade) ou vira crédito para as próximas faturas (no
          downgrade), e o novo plano passa a valer assim que a cobrança é aprovada.
        </p>
        <p>
          <strong>Sem assinatura ativa:</strong> se o teste terminar sem assinatura, se a assinatura
          for cancelada ou se o pagamento ficar em aberto, a loja não é cobrada por isso e continua
          acessível com os recursos do plano <strong>{PLANOS.ambulante.nome}</strong> (
          {PLANOS.ambulante.beneficios.join(", ").toLowerCase()}). Os demais recursos, como
          revendedoras, vendedores internos, motoboys, entregas, analytics e ranking, ficam
          bloqueados ou limitados até você assinar um plano que os inclua. Seus dados não são apagados
          por isso.
        </p>
        <ul>
          <li>
            Se um pagamento não for aprovado, o Stripe pode tentar a cobrança novamente. O plano é
            mantido por até 3 dias depois do vencimento; sem a regularização, a loja passa à situação
            descrita acima.
          </li>
          <li>A troca de plano é feita na mesma assinatura, sem criar uma segunda assinatura.</li>
          <li>
            Podemos reajustar preços ou alterar a composição dos planos, avisando com pelo menos{" "}
            <strong>30 dias</strong> de antecedência. O novo valor só vale a partir do ciclo seguinte ao
            aviso, e você pode cancelar antes dele sem custo. O mesmo vale para mudanças nos recursos
            disponíveis sem assinatura.
          </li>
        </ul>
      </Secao>

      <Secao n={5} titulo="Cancelamento e arrependimento">
        <p>
          Você pode cancelar a assinatura <strong>a qualquer momento</strong>, sem multa e sem
          fidelidade. A cobrança recorrente é interrompida e, quando a assinatura termina, a conta fica
          como descrito na seção 4, sem perda de dados. Como a contratação é feita pela internet, vale
          o <strong>direito de arrependimento de 7 dias</strong> (art. 49 do Código de Defesa do
          Consumidor), contados da primeira cobrança de cada nova assinatura, com reembolso integral.
          Fora desse prazo, os valores já pagos não são devolvidos, salvo cobrança indevida ou falha
          nossa. As regras
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
            direitos. A vitrine ativa pode aparecer em buscadores.
          </li>
          <li>
            Não há botão para excluir a conta no app: a exclusão é feita a pedido, pelos canais da
            seção 8. Ela é definitiva e está descrita na{" "}
            <Link href="/privacidade">Política de Privacidade</Link>.
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
          Em caso de violação, podemos remover conteúdo, suspender ou encerrar a conta, o que também
          pode pausar ou cancelar a assinatura. Informamos o motivo pelos canais cadastrados; o aviso
          só deixa de ser prévio quando houver risco a terceiros, à segurança do serviço ou ordem de
          autoridade. Você pode contestar a medida pelos canais da seção 8.
        </p>
      </Secao>

      <Secao n={8} titulo="Disponibilidade e suporte">
        <p>
          Trabalhamos para manter o AutoManager disponível 24h por dia, mas podem ocorrer
          interrupções para manutenção, atualizações ou por falhas de terceiros (provedores de
          internet, hospedagem, banco de dados, meios de pagamento). Não garantimos funcionamento
          ininterrupto nem livre de erros. Podemos melhorar ou alterar funcionalidades, preservando o
          núcleo do serviço contratado; se uma mudança retirar algo relevante do seu plano, avisamos
          antes e você pode cancelar sem multa.
        </p>
        <p>
          O suporte é prestado pelos canais abaixo, em dias úteis, e as manifestações são respondidas
          no prazo do Decreto 7.962/2013:
        </p>
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
            O AutoManager não participa das relações entre a sua loja e seus clientes ou equipe, e
            não responde por dados informados incorretamente por você ou sua equipe nem por acessos
            feitos com a sua senha por falta de cuidado com ela.
          </li>
          <li>
            Nada nestes Termos exclui ou reduz direitos que a lei garante a você. Se você contrata
            como consumidor, valem integralmente as regras de responsabilidade do Código de Defesa do
            Consumidor.
          </li>
          <li>
            Quando a contratação for entre empresas e não houver relação de consumo, a responsabilidade
            do AutoManager fica limitada ao valor pago nos 12 meses anteriores ao fato, salvo dolo,
            culpa grave ou hipótese em que a lei não admita a limitação.
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
          Podemos atualizar estes Termos. Mudanças relevantes serão avisadas no app ou por e-mail antes
          de valer, e a data no topo indica a versão vigente. Se não concordar com uma mudança, você
          pode cancelar a assinatura sem multa antes que ela entre em vigor. Mudanças não alcançam o
          período que você já pagou.
        </p>
      </Secao>

      <Secao n={12} titulo="Lei aplicável e foro">
        <p>
          Estes Termos seguem as leis do Brasil.{" "}
          {EMPRESA.cidadeUf ? (
            <>
              Fica eleito o foro da comarca de <strong>{EMPRESA.cidadeUf}</strong> para resolver
              eventuais conflitos, ressalvado ao consumidor o direito de propor a ação no foro do seu
              domicílio, nos termos do CDC.
            </>
          ) : (
            "Eventuais conflitos serão resolvidos no foro competente pela lei brasileira, e o consumidor pode propor a ação no foro do seu domicílio, nos termos do CDC."
          )}
        </p>
      </Secao>
    </LegalLayout>
  );
}
