"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const PERGUNTAS: { q: string; a: string }[] = [
  {
    q: "Preciso instalar algum programa?",
    a: "Não. O AutoManager funciona direto no navegador do celular ou do computador. Você abre o link, entra com seu e-mail e já começa a usar. Nada para baixar, nada para atualizar.",
  },
  {
    q: "Funciona no celular?",
    a: "Funciona - e foi feito pensando primeiro no celular. Você pode adicionar à tela inicial e ele abre como se fosse um aplicativo, inclusive para registrar venda no balcão ou na mão da revendedora.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Sem fidelidade, sem multa e sem ligação para 'segurar' você. Cancelou, parou de cobrar no fim do período. Seus dados continuam disponíveis para exportar.",
  },
  {
    q: "Preciso entender de tecnologia para usar?",
    a: "Não. Se você usa WhatsApp, você usa o AutoManager. O cadastro inicial é guiado por 4 perguntas e o sistema monta sua loja sozinho. Dá pra registrar a primeira venda em poucos minutos.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Ficam. Cada loja é isolada das outras por segurança no banco de dados (RLS), tudo trafega criptografado e o backup é automático. Ninguém de outra loja - nem outra revendedora - enxerga seus números.",
  },
  {
    q: "Posso importar meus produtos que já estão na planilha?",
    a: "Pode. Você cadastra rápido pela tela ou nos ajuda a importar sua lista. Marca, preço de custo, preço de venda, fotos e variações (cor, tamanho, grade) entram sem retrabalho.",
  },
  {
    q: "E se eu vendo no caderno hoje, perco meu histórico?",
    a: "Não. Você lança o estoque atual e segue daqui pra frente. O que já vendeu fica no caderno; o que importa - o que você ainda tem e o que vai vender - passa a ficar organizado no sistema.",
  },
  {
    q: "Serve para quem tem revendedoras?",
    a: "Esse é justamente o diferencial. Cada revendedora ganha um acesso próprio, vê o catálogo, registra a própria venda pelo celular e a comissão é calculada automaticamente. Você acompanha quem vende, quanto deve e o ranking.",
  },
  {
    q: "E se eu não tenho revendedora, só vendo sozinha ou na rua?",
    a: "Funciona igual. Quem vende na rua usa o plano AMBULANTE (R$20/mês): controle de estoque, lojinha virtual, chat e relatórios, sem revendedoras nem entregas. Quer crescer com equipe? Sobe para SOLO ou EQUIPE em um clique.",
  },
  {
    q: "A comissão é calculada sozinha mesmo?",
    a: "Sim. Você define o percentual (ou meta) de cada revendedora uma vez. A cada venda registrada, o sistema calcula a comissão e mostra quanto você deve pagar no fechamento. Acabou a calculadora e o 'achismo'.",
  },
  {
    q: "Consigo ver quanto realmente lucro em cada produto?",
    a: "Consegue. Como você cadastra o preço de custo e o de venda, o relatório mostra a margem real - por produto, por canal e por período. Você descobre o que dá lucro e o que só ocupa espaço.",
  },
  {
    q: "Tem loja online / vitrine para os clientes?",
    a: "Tem. Cada loja ganha uma vitrine pública com link próprio para mandar no WhatsApp e no Instagram. O cliente navega, vê os produtos e fala com você pelo chat integrado.",
  },
  {
    q: "O controle de estoque atualiza sozinho quando eu vendo?",
    a: "Sim. Cada venda baixa o estoque automaticamente. Você define o estoque mínimo e o sistema avisa o que está acabando, para você não perder venda por falta de reposição.",
  },
  {
    q: "Quantos produtos posso cadastrar?",
    a: "Você cadastra o seu catálogo completo em qualquer plano. A diferença entre os planos está na equipe (vendedores, motoboys e revendedoras), não no tamanho do estoque.",
  },
  {
    q: "Funciona para mais de uma pessoa usando ao mesmo tempo?",
    a: "Funciona. Cada pessoa tem o próprio login e o próprio papel: dono vê tudo, vendedor registra venda, motoboy vê só as entregas dele, revendedora vê só o que é dela. Tudo ao mesmo tempo, sem se atrapalhar.",
  },
  {
    q: "Preciso de internet o tempo todo?",
    a: "Para registrar e sincronizar, sim - é online. Mas é leve e funciona bem até em 3G/4G de loja. Você não precisa de computador potente nem de internet rápida.",
  },
  {
    q: "Quanto custa? Tem taxa escondida?",
    a: "Os planos são AMBULANTE R$20, SOLO R$49, EQUIPE R$99 e EXPANSÃO R$199 por mês. Preço fechado, sem taxa por venda e sem surpresa na fatura. Você começa com teste grátis antes de pagar qualquer coisa.",
  },
  {
    q: "Preciso colocar cartão para testar?",
    a: "Não. O teste grátis começa sem cartão. Você só decide pagar se gostar - e aí escolhe o plano que faz sentido para o tamanho da sua loja.",
  },
  {
    q: "E se eu travar ou tiver dúvida no começo?",
    a: "Você tem suporte pelo WhatsApp. A ideia é simples: você não fica sozinha. Qualquer dúvida no cadastro ou no dia a dia, a gente responde rápido.",
  },
  {
    q: "Vou conseguir controlar entregas / motoboy?",
    a: "Sim. Você cria a entrega, atribui ao motoboy e ele atualiza o status pelo celular. Você acompanha o que saiu, o que foi entregue e o que está pendente, sem ligar para ninguém.",
  },
  {
    q: "Serve para qualquer tipo de micronegócio?",
    a: "Sim. O AutoManager foi feito para micronegócios em geral: doces e comida caseira, bijuterias, semijoias, cosméticos, perfumaria, roupas, papelaria, pet shop, artesanato, loja de festa e por aí vai. Você cria as suas próprias categorias e configura o sistema com a cara do seu negócio - não é fechado para um único ramo.",
  },
  {
    q: "Dá para deixar o sistema com a cara da minha loja?",
    a: "Dá. Você define o nome, a logo, as cores da marca, as categorias dos produtos, as comissões e os canais de venda. Quase tudo é editável - o AutoManager se adapta a você, e não o contrário.",
  },
  {
    q: "É caro? Cabe no bolso de quem está começando?",
    a: "Foi pensado justamente para quem não pode pagar caro por um sistema. Começa grátis e o plano de entrada é R$20/mês (AMBULANTE) - bem menos do que você perde por mês com produto parado e venda esquecida.",
  },
  {
    q: "E se eu crescer? O sistema acompanha?",
    a: "Acompanha. Começou vendendo na rua no AMBULANTE? Sobe para SOLO. Contratou ajuda e revendedoras? EQUIPE. Virou várias revendedoras e entregas? EXPANSÃO. Você muda de plano em um clique, sem perder nada do que já cadastrou.",
  },
];

export default function Faq({ itens }: { itens?: { q: string; a: string }[] } = {}) {
  const lista = itens ?? PERGUNTAS;
  const [aberta, setAberta] = useState<number | null>(0);

  return (
    <div className="mx-auto mt-10 max-w-3xl divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-default surface">
      {lista.map((item, i) => {
        const open = aberta === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setAberta(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-semibold text-strong">{item.q}</span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
                {open ? <Minus size={16} /> : <Plus size={16} />}
              </span>
            </button>
            {open && (
              <p className="px-5 pb-5 -mt-1 text-sm leading-relaxed text-muted">{item.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
