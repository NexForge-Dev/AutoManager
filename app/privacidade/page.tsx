import type { Metadata } from "next";
import Link from "next/link";
import LegalLayout, { Secao } from "@/components/landing/LegalLayout";
import { CanaisContato, IdentificacaoEmpresa } from "@/components/landing/ContatoEmpresa";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Política de Privacidade · AutoManager",
  description: "Como o AutoManager trata dados pessoais, em conformidade com a LGPD (Lei 13.709/2018).",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacidadePage() {
  const fornecedor = EMPRESA.razaoSocial || EMPRESA.nomeFantasia;
  return (
    <LegalLayout
      titulo="Política de Privacidade"
      resumo="Em resumo: usamos seus dados só para fazer o AutoManager funcionar e para cobrar a assinatura. Não vendemos dados. Os dados dos clientes da sua loja pertencem à sua loja — nós apenas os guardamos e processamos em seu nome. Você pode pedir acesso, correção ou exclusão a qualquer momento."
    >
      <Secao n={1} titulo="A quem se aplica">
        <p>
          Esta Política explica como {fornecedor} trata dados pessoais no AutoManager, em
          conformidade com a Lei Geral de Proteção de Dados (<strong>LGPD</strong>, Lei 13.709/2018).
          Ela vale para:
        </p>
        <ul>
          <li>
            <strong>Lojistas</strong>: quem cria a conta e assina o AutoManager;
          </li>
          <li>
            <strong>Membros da equipe</strong>: revendedoras, vendedores e motoboys convidados por uma
            loja;
          </li>
          <li>
            <strong>Clientes das lojas</strong> e <strong>visitantes da vitrine</strong>, inclusive
            quem conversa com a loja pelo chat sem criar conta.
          </li>
        </ul>
        <IdentificacaoEmpresa />
      </Secao>

      <Secao n={2} titulo="Controlador e operador: quem responde por cada dado">
        <ul>
          <li>
            <strong>Dados do lojista</strong> (conta, assinatura, uso do sistema): o AutoManager é o{" "}
            <strong>controlador</strong>.
          </li>
          <li>
            <strong>Dados que a loja cadastra ou recebe</strong> — clientes, pedidos, fiado, mensagens
            do chat da vitrine, dados de revendedoras, vendedores e motoboys: a{" "}
            <strong>loja (lojista) é a controladora</strong> e o AutoManager atua como{" "}
            <strong>operador</strong>, tratando esses dados apenas para prestar o serviço, conforme as
            instruções da loja e esta Política.
          </li>
        </ul>
        <p>
          Se você é cliente ou membro da equipe de uma loja e quer exercer seus direitos sobre esses
          dados, fale primeiro com a própria loja. Se não conseguir, fale com a gente (seção 9) que
          encaminharemos o pedido à loja e ajudaremos no que couber.
        </p>
      </Secao>

      <Secao n={3} titulo="Quais dados tratamos">
        <p>
          <strong>Do lojista e da equipe:</strong> e-mail, senha (armazenada de forma criptografada
          pelo provedor de autenticação, nunca em texto puro), nome, telefone/WhatsApp, nome e dados
          da loja (logo, cores, redes sociais, endereço se você informar), papel de cada membro e
          registros de uso (por exemplo, quem registrou uma venda e quando).
        </p>
        <p>
          <strong>Da assinatura:</strong> plano, status, datas e identificadores da assinatura no
          Mercado Pago. Os dados do cartão são digitados diretamente no Mercado Pago e{" "}
          <strong>não</strong> chegam ao AutoManager.
        </p>
        <p>
          <strong>Dados operacionais da loja:</strong> produtos, estoque, vendas, recebimentos,
          comissões, entregas e os dados de clientes que a loja decidir cadastrar (por exemplo, nome e
          telefone para fiado ou entrega).
        </p>
        <p>
          <strong>Da vitrine e do chat:</strong> visitantes podem conversar com a loja sem criar
          conta. Guardamos as mensagens enviadas, o nome/contato que o visitante decidir informar e um
          identificador técnico da conversa no próprio navegador, para que ele continue o mesmo
          atendimento. Não pedimos documento nem senha ao visitante.
        </p>
        <p>
          <strong>Dados técnicos:</strong> endereço IP, tipo de navegador e registros de acesso
          mantidos pelos nossos provedores de hospedagem para segurança e diagnóstico de erros, e os
          chamados de suporte que você abrir.
        </p>
      </Secao>

      <Secao n={4} titulo="Para que usamos e com qual base legal">
        <ul>
          <li>
            <strong>Prestar o serviço</strong> (criar a conta, salvar e exibir os dados da loja, operar
            a vitrine e o chat, permitir o acesso da equipe): execução de contrato (art. 7º, V).
          </li>
          <li>
            <strong>Cobrar a assinatura</strong> e manter registros fiscais e contábeis: execução de
            contrato e cumprimento de obrigação legal (art. 7º, II e V).
          </li>
          <li>
            <strong>Segurança, prevenção a fraudes e registros de acesso</strong> (o Marco Civil da
            Internet exige guardar registros de acesso a aplicações por 6 meses): obrigação legal e
            legítimo interesse (art. 7º, II e IX).
          </li>
          <li>
            <strong>Suporte e comunicações sobre o serviço</strong> (avisos de cobrança, mudanças nos
            termos, respostas a chamados): execução de contrato e legítimo interesse.
          </li>
          <li>
            <strong>Melhorar o produto</strong> com estatísticas agregadas de uso, sem identificar
            clientes das lojas: legítimo interesse.
          </li>
        </ul>
        <p>
          Não vendemos dados pessoais, não os usamos para publicidade de terceiros e não acessamos o
          conteúdo das lojas para outros fins, exceto quando necessário para suporte solicitado,
          segurança ou cumprimento de ordem legal.
        </p>
      </Secao>

      <Secao n={5} titulo="Com quem compartilhamos">
        <p>Só com os fornecedores necessários para o serviço funcionar:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — banco de dados, autenticação, armazenamento de imagens e
            mensagens em tempo real. É onde os dados ficam guardados. A infraestrutura pode estar
            localizada fora do Brasil; nesse caso a transferência internacional ocorre com base em
            cláusulas contratuais e garantias de segurança do provedor (art. 33 da LGPD).
          </li>
          <li>
            <strong>Mercado Pago</strong> — processamento das assinaturas e pagamentos. O Mercado Pago
            trata os dados de pagamento como controlador próprio, conforme a política de privacidade
            dele.
          </li>
          <li>
            <strong>Provedor de hospedagem do site</strong> — entrega das páginas e registros técnicos
            de acesso.
          </li>
          <li>
            <strong>Autoridades</strong>, quando houver obrigação legal ou ordem judicial.
          </li>
        </ul>
        <p>
          Dentro de uma loja, <strong>revendedoras, vendedores e motoboys</strong> acessam dados da
          loja conforme o papel de cada um (por exemplo, a revendedora vê as próprias vendas e
          comissões; o motoboy vê as entregas dele). O lojista controla quem faz parte da equipe.
        </p>
      </Secao>

      <Secao n={6} titulo="Por quanto tempo guardamos">
        <ul>
          <li>
            Enquanto a conta existir, os dados da loja ficam guardados para você usar o sistema. Ao
            cancelar a assinatura, <strong>não apagamos seus dados automaticamente</strong>: eles
            continuam disponíveis para consulta e exportação.
          </li>
          <li>
            Se você pedir a <strong>exclusão da conta</strong>, apagamos os dados da loja em até 30
            dias, salvo o que precisarmos manter por obrigação legal (por exemplo, registros de
            cobrança pelo prazo fiscal e registros de acesso por 6 meses). Cópias de segurança são
            sobrescritas no ciclo normal do provedor.
          </li>
          <li>
            Mensagens do chat da vitrine ficam guardadas enquanto a loja mantiver a conversa ou a
            conta, e podem ser excluídas a pedido da loja ou do próprio visitante.
          </li>
        </ul>
      </Secao>

      <Secao n={7} titulo="Segurança">
        <ul>
          <li>Toda comunicação é criptografada (HTTPS/TLS).</li>
          <li>
            Cada loja é isolada no banco de dados por regras de segurança em nível de linha (RLS):
            usuários de uma loja não conseguem ler dados de outra.
          </li>
          <li>Senhas são armazenadas com hash pelo provedor de autenticação.</li>
          <li>Chaves de acesso administrativas ficam apenas no servidor, nunca no navegador.</li>
        </ul>
        <p>
          Nenhum sistema é 100% invulnerável. Se ocorrer um incidente de segurança que possa causar
          risco ou dano relevante, avisaremos os afetados e a ANPD, conforme o art. 48 da LGPD.
        </p>
      </Secao>

      <Secao n={8} titulo="Cookies e armazenamento no navegador">
        <p>
          Usamos <strong>apenas cookies e armazenamento local essenciais</strong>: para manter você
          logado (cookies de sessão do Supabase), lembrar preferências como tema claro/escuro e
          manter a conversa do visitante no chat da vitrine. Não usamos cookies de publicidade nem de
          rastreamento de terceiros. Se você bloquear esses cookies, o login e o chat podem não
          funcionar.
        </p>
      </Secao>

      <Secao n={9} titulo="Seus direitos (art. 18 da LGPD) e o encarregado">
        <p>Você, como titular, pode pedir a qualquer momento:</p>
        <ul>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
          <li>portabilidade dos dados a outro fornecedor;</li>
          <li>eliminação dos dados tratados com base no consentimento;</li>
          <li>informação sobre com quem compartilhamos seus dados;</li>
          <li>informação sobre a possibilidade de não dar consentimento e suas consequências;</li>
          <li>revogação do consentimento, quando ele for a base legal;</li>
          <li>revisão de decisões tomadas unicamente com base em tratamento automatizado.</li>
        </ul>
        <p>
          <strong>Encarregado pelo tratamento de dados (DPO):</strong>{" "}
          {EMPRESA.encarregadoLgpd || "atendimento de privacidade do AutoManager"}, pelos canais
          abaixo. Respondemos em até 15 dias. Você também pode apresentar reclamação à Autoridade
          Nacional de Proteção de Dados (ANPD).
        </p>
        <CanaisContato assunto="LGPD - Pedido do titular" />
      </Secao>

      <Secao n={10} titulo="Crianças e adolescentes">
        <p>
          O AutoManager é destinado a maiores de 18 anos e não é direcionado a crianças. A loja não
          deve cadastrar dados de crianças sem o consentimento de um responsável.
        </p>
      </Secao>

      <Secao n={11} titulo="Mudanças nesta Política">
        <p>
          Podemos atualizar esta Política. Mudanças relevantes serão avisadas no app ou por e-mail. A
          data no topo indica a versão vigente. Veja também os{" "}
          <Link href="/termos">Termos de Uso</Link> e a{" "}
          <Link href="/cancelamento">Política de Cancelamento</Link>.
        </p>
      </Secao>
    </LegalLayout>
  );
}
