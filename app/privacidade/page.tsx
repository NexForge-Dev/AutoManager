import type { Metadata } from "next";
import Link from "next/link";
import LegalLayout, { Secao } from "@/components/landing/LegalLayout";
import { CanaisContato, IdentificacaoEmpresa } from "@/components/landing/ContatoEmpresa";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Política de Privacidade · AutoManager",
  description: "Como o AutoManager trata dados pessoais, nos termos da LGPD (Lei 13.709/2018).",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacidadePage() {
  const fornecedor = EMPRESA.razaoSocial || EMPRESA.nomeFantasia;
  const email = EMPRESA.emailSuporte;
  return (
    <LegalLayout
      titulo="Política de Privacidade"
      atualizadoEm="05/11/2026"
      resumo="Em resumo: usamos dados para fazer o AutoManager funcionar, cobrar a assinatura, dar suporte e proteger o serviço. Não vendemos dados pessoais. Os dados que a loja registra sobre clientes e equipe são da loja: ela decide o que fazer com eles e nós tratamos esses dados em nome dela. Os dados ficam em servidores nos Estados Unidos. Pedidos sobre seus dados, inclusive de exclusão da conta, são feitos pelo nosso e-mail."
    >
      <Secao n={1} titulo="A quem esta Política se aplica">
        <p>
          Esta Política explica como <strong>{fornecedor}</strong> trata dados pessoais no AutoManager,
          sistema de gestão para micronegócios e revendedoras no Brasil, com base na Lei Geral de
          Proteção de Dados (<strong>LGPD</strong>, Lei 13.709/2018). Ela vale para:
        </p>
        <ul>
          <li>
            <strong>Lojistas</strong>: quem cria a conta e assina o AutoManager;
          </li>
          <li>
            <strong>Equipe da loja</strong>: vendedores, motoboys e revendedoras cadastrados por uma
            loja;
          </li>
          <li>
            <strong>Clientes das lojas e visitantes da vitrine</strong>, inclusive quem conversa com a
            loja pelo chat sem criar conta.
          </li>
        </ul>
        <IdentificacaoEmpresa />
      </Secao>

      <Secao n={2} titulo="Controlador e operador: quem responde por cada dado">
        <ul>
          <li>
            <strong>Dados da conta do lojista</strong> (cadastro, assinatura, suporte, uso do sistema):
            o AutoManager é o <strong>controlador</strong>.
          </li>
          <li>
            <strong>Dados que a loja cadastra ou recebe</strong> (entregas, mensagens do chat da
            vitrine, dados de vendedores, motoboys e revendedoras, e o que ela escrever em campos
            livres): a <strong>loja é a controladora</strong> e o AutoManager atua como{" "}
            <strong>operador</strong>, tratando esses dados para prestar o serviço à loja.
          </li>
        </ul>
        <p>
          Se você é cliente, visitante ou membro da equipe de uma loja, fale primeiro com ela sobre os
          seus dados. Se não conseguir, escreva para o e-mail da seção 9: encaminhamos o pedido à loja
          e ajudamos no que couber a nós.
        </p>
      </Secao>

      <Secao n={3} titulo="Quais dados tratamos">
        <p>
          <strong>Conta de acesso:</strong> nome, e-mail, senha (guardada em forma de hash pelo serviço
          de autenticação, nunca em texto puro), papel na loja e loja vinculada. Vendedores e motoboys
          têm a conta criada pelo lojista; revendedoras ativam o acesso com um código enviado pela loja
          e têm ainda WhatsApp e percentual de comissão cadastrados.
        </p>
        <p>
          <strong>Dados da loja:</strong> nome, segmento, canais de venda, margem e comissão padrão,
          logo, capa, cores, descrição e os contatos que a loja decidir publicar (e-mail, WhatsApp,
          telefone, Instagram, Facebook e TikTok).
        </p>
        <p>
          <strong>Assinatura:</strong> plano, status, valor, datas e os identificadores de cliente e de
          assinatura no Stripe. O Stripe recebe de nós o e-mail da conta, o nome da loja e o
          identificador interno da loja. Os dados do cartão são digitados diretamente na página do
          Stripe e <strong>não</strong> chegam ao AutoManager.
        </p>
        <p>
          <strong>Dados operacionais da loja:</strong> produtos, estoque, vendas, recebimentos,
          comissões e contas a pagar (que podem citar o nome de um fornecedor). O AutoManager não tem
          cadastro de clientes: dados de clientes da loja aparecem nas <strong>entregas</strong> (nome,
          telefone, endereço e observações), no chat e no que a loja escrever em campos livres.
        </p>
        <p>
          <strong>Vitrine e chat:</strong> a vitrine pode ser visitada sem cadastro. Quem usa o chat
          recebe uma sessão anônima e um identificador guardado no próprio navegador, que permite
          retomar a conversa. Guardamos as mensagens, as datas e o nome, se a pessoa quiser informar.
          Não pedimos documento nem senha. Evite enviar dados sensíveis ou de pagamento pelo chat.
        </p>
        <p>
          <strong>Suporte, sugestões e problemas:</strong> o que você enviar por e-mail, WhatsApp, pelo
          botão de suporte do Painel ou pelo balão de sugestões e problemas do app. O botão e o balão
          registram nome da loja, e-mail de contato, assunto, mensagem e a página em que você estava.
          Uma cópia vai para o Painel NexForge, como descrito na seção 5.
        </p>
        <p>
          <strong>Dados técnicos:</strong> endereço IP, navegador, data e hora de acesso e registros de
          erro, mantidos pelos provedores de hospedagem e banco de dados. Na ativação de revendedora, IP
          e e-mail são guardados apenas como hash, por tempo curto, para limitar tentativas.
        </p>
        <p>
          <strong>Estatísticas de uso:</strong> eventos sobre o uso do produto, descritos na seção 5.
        </p>
      </Secao>

      <Secao n={4} titulo="Para que usamos e com qual base legal">
        <p>Quando somos controladores, as bases legais do art. 7º da LGPD são estas:</p>
        <ul>
          <li>
            <strong>Prestar o serviço</strong> (criar a conta, guardar e exibir os dados da loja,
            operar a vitrine e o chat, dar acesso à equipe, enviar e-mails de confirmação e de
            redefinição de senha): execução de contrato (art. 7º, V).
          </li>
          <li>
            <strong>Cobrar a assinatura</strong> e manter registros fiscais e contábeis: execução de
            contrato e cumprimento de obrigação legal (art. 7º, V e II).
          </li>
          <li>
            <strong>Atender ao suporte e avisar sobre o serviço</strong> (cobrança, mudanças,
            incidentes): execução de contrato e legítimo interesse (art. 7º, V e IX).
          </li>
          <li>
            <strong>Proteger o serviço</strong> (limitar tentativas, investigar erros e abusos, moderar
            contas e registrar essas ações): legítimo interesse, cumprimento de obrigação legal e
            exercício regular de direitos (art. 7º, IX, II e VI).
          </li>
          <li>
            <strong>Entender o uso do produto</strong> com estatísticas pseudônimas: legítimo interesse
            (art. 7º, IX). Você pode se opor pelo e-mail da seção 9.
          </li>
        </ul>
        <p>
          Quando atuamos como operador, é a loja que define a finalidade e a base legal do tratamento.
        </p>
        <p>
          Não vendemos dados pessoais e não os usamos para publicidade de terceiros. O banco de dados é
          administrado por nós, e esse acesso técnico é reservado a suporte solicitado, segurança e
          cumprimento da lei. O painel de administração mostra, por loja, nome, endereço da vitrine,
          e-mail do dono, plano, status, valor da assinatura e número de membros.
        </p>
      </Secao>

      <Secao n={5} titulo="Com quem compartilhamos">
        <p>Só com quem é necessário para o serviço funcionar:</p>
        <ul>
          <li>
            <strong>Supabase</strong>: banco de dados, autenticação, armazenamento de imagens e
            mensagens em tempo real. É onde os dados ficam guardados, em servidores nos{" "}
            <strong>Estados Unidos</strong> (região us-east-1). Os e-mails de confirmação de cadastro e
            de redefinição de senha saem pelo serviço de autenticação do Supabase, que pode usar um
            provedor de envio de e-mail.
          </li>
          <li>
            <strong>Stripe</strong>: checkout, cobrança das assinaturas e portal de pagamento. O Stripe
            trata dados de pagamento também segundo a política de privacidade dele.
          </li>
          <li>
            <strong>Vercel</strong>: hospedagem do site e das APIs. Recebe os dados das requisições
            (como IP, navegador, data e hora) e os registros técnicos.
          </li>
          <li>
            <strong>Google</strong>: quando uma loja escolhe uma fonte do Google Fonts para a vitrine ou
            para o app, o navegador de quem abre a página busca essa fonte no Google, que recebe o IP e
            os dados do navegador. A caixa de e-mail do suporte também é hospedada no Google (Gmail).
          </li>
          <li>
            <strong>Painel NexForge</strong>: nossa ferramenta interna de gestão e de estatísticas de
            produto, que funciona quando está configurada. Recebe eventos como &quot;cadastro concluído&quot;,
            &quot;recurso usado&quot; ou &quot;plano alterado&quot;, com data, plano, etapa, recurso,
            quantidade e o valor da assinatura. A loja é identificada só por um{" "}
            <strong>código pseudônimo</strong>, gerado no servidor do AutoManager. Os eventos não levam
            nomes, e-mails, telefones, produtos, clientes nem valores das vendas da loja. Dado
            pseudônimo continua sendo dado pessoal quando se refere a uma pessoa identificável, e por
            isso o tratamos conforme esta Política. O painel também recebe uma cópia das sugestões e
            dos relatos de problema enviados pelo balão ou pelo botão de suporte do Painel: o tipo, o
            texto escrito (com o assunto, quando houver), a página do app e a data. A cópia vai sem
            nome, e-mail ou identificador da conta, mas leva o texto exatamente como foi escrito. Por
            isso, não escreva dados pessoais nessas mensagens, nem seus nem de outras pessoas.
          </li>
          <li>
            <strong>Autoridades</strong>, quando houver obrigação legal ou ordem judicial.
          </li>
        </ul>
        <p>
          <strong>Dentro da loja:</strong> o lojista vê os dados da própria loja; vendedores, motoboys e
          revendedoras veem o que o papel de cada um permite. O lojista escolhe quem faz parte da
          equipe.
        </p>
        <p>
          <strong>Conteúdo público:</strong> o que a loja publica na vitrine ativa (nome, fotos,
          produtos, contatos) fica visível para qualquer pessoa e pode aparecer em buscadores.
        </p>
        <p>
          <strong>Serviços externos:</strong> links de WhatsApp, Instagram, Facebook e TikTok levam a
          esses serviços, que seguem políticas próprias.
        </p>
      </Secao>

      <Secao n={6} titulo="Transferência internacional">
        <p>
          O banco de dados fica nos Estados Unidos, e os demais fornecedores da seção 5 podem processar
          dados fora do Brasil. Por isso, os dados pessoais tratados no AutoManager são transferidos
          para outros países. Essa transferência é necessária para executar o contrato com você (art.
          33, IX, combinado com o art. 7º, V, da LGPD).
        </p>
      </Secao>

      <Secao n={7} titulo="Por quanto tempo guardamos e como excluir">
        <ul>
          <li>
            <strong>Enquanto a conta existir</strong>, os dados da loja ficam guardados. Não há exclusão
            automática por inatividade, pelo fim do teste grátis ou pelo cancelamento da assinatura: a
            loja continua acessível, e você pode consultar e exportar seus relatórios.
          </li>
          <li>
            <strong>Registros da loja:</strong> o lojista pode alterar ou excluir no próprio app itens
            como produtos, entregas, contas a pagar e membros da equipe.
          </li>
          <li>
            <strong>Mensagens do chat</strong> ficam guardadas enquanto a loja existir. Não há botão
            para excluí-las: a loja ou o visitante pode pedir pelo e-mail da seção 9.
          </li>
          <li>
            <strong>Exclusão da conta:</strong> não há exclusão pelo próprio app. Peça pelo e-mail da
            seção 9, a partir do e-mail da conta, informando o nome da loja. A exclusão é{" "}
            <strong>definitiva</strong>: cancela a assinatura e apaga a loja, os dados vinculados a ela
            (produtos, vendas, entregas, equipe, chat) e as contas de acesso. Exporte antes o que quiser
            manter. As imagens enviadas (logo, capa, produtos) ficam em armazenamento à parte e são
            removidas no atendimento do pedido.
          </li>
        </ul>
        <p>Depois da exclusão, podem permanecer:</p>
        <ul>
          <li>registros de cobrança no Stripe e o que a lei fiscal, contábil ou civil exigir guardar;</li>
          <li>
            a trilha de auditoria das ações administrativas, com o nome da loja e o e-mail do dono, para
            comprovar o que foi feito;
          </li>
          <li>chamados e conversas de suporte, que podem conter e-mail, WhatsApp e mensagens;</li>
          <li>eventos pseudônimos no Painel NexForge, sem ligação com a conta apagada;</li>
          <li>
            cópias de sugestões e relatos de problema no Painel NexForge, que não são apagadas junto com
            a conta. Para pedir a exclusão de uma cópia, escreva para o e-mail da seção 9 informando a
            data e o assunto da mensagem;
          </li>
          <li>identificadores técnicos de sessões anônimas do chat, sem nome nem mensagens;</li>
          <li>registros técnicos e cópias de segurança dos provedores, conforme o ciclo de cada um.</li>
        </ul>
      </Secao>

      <Secao n={8} titulo="Seus direitos (art. 18 da LGPD)">
        <p>Como titular, você pode pedir:</p>
        <ul>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;</li>
          <li>portabilidade dos dados a outro fornecedor;</li>
          <li>eliminação dos dados tratados com base no consentimento;</li>
          <li>informação sobre com quem compartilhamos seus dados;</li>
          <li>informação sobre a possibilidade de não dar consentimento e suas consequências;</li>
          <li>revogação do consentimento, quando ele for a base legal;</li>
          <li>oposição a tratamento feito em desconformidade com a lei;</li>
          <li>revisão de decisões tomadas unicamente com base em tratamento automatizado.</li>
        </ul>
        <p>
          Para exercer esses direitos, escreva para{" "}
          {email ? <a href={`mailto:${email}?subject=${encodeURIComponent("LGPD - Pedido do titular")}`}>{email}</a> : "os canais abaixo"}
          . Podemos pedir informações para confirmar que o pedido é seu. Nos pedidos de acesso, a
          declaração completa é dada em até 15 dias, como prevê o art. 19 da LGPD. Alguns dados podem
          ser mantidos quando a lei permitir (seção 7). Você também pode apresentar reclamação à
          Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </Secao>

      <Secao n={9} titulo="Encarregado pelo tratamento de dados (DPO)">
        <p>
          <strong>Encarregado:</strong> {EMPRESA.encarregadoLgpd || "atendimento de privacidade do AutoManager"}
          {email ? (
            <>
              {" "}
              · <strong>E-mail:</strong> <a href={`mailto:${email}`}>{email}</a>
            </>
          ) : null}
        </p>
        <p>Outros canais de atendimento:</p>
        <CanaisContato assunto="LGPD - Pedido do titular" />
      </Secao>

      <Secao n={10} titulo="Cookies e armazenamento no navegador">
        <p>
          Usamos apenas recursos necessários ao funcionamento do serviço. Não usamos cookies de
          publicidade nem ferramentas de rastreamento de terceiros no navegador.
        </p>
        <ul>
          <li>
            <strong>Cookies de sessão do Supabase:</strong> mantêm você conectado e guardam a sessão
            anônima de quem usa o chat.
          </li>
          <li>
            <strong>Armazenamento local (localStorage):</strong> tema claro ou escuro, aparência da
            loja, identificador da conversa no chat da vitrine e marcação de conversas já vistas no
            app.
          </li>
          <li>
            <strong>Armazenamento de sessão (sessionStorage):</strong> plano escolhido na página inicial
            antes do cadastro e controle para contar uma sessão de uso por vez.
          </li>
        </ul>
        <p>
          Se você bloquear esses recursos, o login deixa de funcionar e o chat pode não retomar a
          conversa anterior. As fontes do Google citadas na seção 5 são carregadas do Google quando a
          loja as escolhe.
        </p>
      </Secao>

      <Secao n={11} titulo="Crianças e adolescentes">
        <p>
          A conta no AutoManager é destinada a maiores de 18 anos (ou emancipados), e o serviço não é
          direcionado a crianças. A vitrine e o chat são abertos e não verificam idade. A loja não deve
          cadastrar dados de crianças e adolescentes fora das condições do art. 14 da LGPD. Se
          identificar um caso assim, escreva para o e-mail da seção 9.
        </p>
      </Secao>

      <Secao n={12} titulo="Segurança e incidentes">
        <ul>
          <li>O site e as APIs são servidos por HTTPS.</li>
          <li>
            As regras de segurança em nível de linha (RLS) do banco de dados limitam cada usuário aos
            dados da própria loja.
          </li>
          <li>Senhas são guardadas em forma de hash pelo serviço de autenticação.</li>
          <li>Chaves administrativas ficam apenas no servidor, nunca no navegador.</li>
          <li>Ações administrativas de moderação ficam registradas em uma trilha de auditoria.</li>
        </ul>
        <p>
          Nenhum sistema é totalmente seguro, e estas medidas reduzem riscos, mas não os eliminam. Se
          ocorrer um incidente de segurança que possa causar risco ou dano relevante, comunicaremos a
          ANPD e os titulares afetados, como prevê o art. 48 da LGPD. Nos dados em que atuamos como
          operador, avisaremos a loja controladora.
        </p>
      </Secao>

      <Secao n={13} titulo="Mudanças nesta Política">
        <p>
          Podemos atualizar esta Política para refletir mudanças no serviço ou na lei. A nova versão é
          publicada nesta página, com a data no topo, e mudanças relevantes serão avisadas no app ou por
          e-mail. Veja também os <Link href="/termos">Termos de Uso</Link> e a{" "}
          <Link href="/cancelamento">Política de Cancelamento</Link>.
        </p>
      </Secao>
    </LegalLayout>
  );
}
