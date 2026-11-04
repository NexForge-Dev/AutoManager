"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PLANOS, brlPreco } from "@/lib/plans";

// preços vêm de lib/plans.ts (fonte única): o FAQ não fica desatualizado quando o preço muda
const preco = (id: keyof typeof PLANOS) => brlPreco(PLANOS[id].precoCentavos);

// Cada resposta foi conferida com DOCUMENTACAO.md, lib/plans.ts e /cancelamento.
const PERGUNTAS: { q: string; a: string }[] = [
  {
    q: "Preciso colocar cartão para testar?",
    a: "Não. O 1º mês é grátis e começa sem cartão. Você só informa um meio de pagamento se decidir assinar.",
  },
  {
    q: "Quanto custa depois do mês grátis?",
    a: `São quatro planos: Ambulante por ${preco("ambulante")}, Solo por ${preco("solo")}, Equipe por ${preco("equipe")} e Expansão por ${preco("expansao")} por mês. O preço é fechado, sem taxa por venda.`,
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim, sem fidelidade e sem multa. Seus dados não são apagados por causa do cancelamento. E se desistir em até 7 dias depois da primeira cobrança, devolvemos 100% do valor.",
  },
  {
    q: "E se eu não assinar depois do teste?",
    a: "Sua conta continua existindo, com os recursos do plano básico, e seus dados ficam guardados. Você pode assinar quando quiser.",
  },
  {
    q: "Preciso instalar algum programa?",
    a: "Não. Abre no navegador do celular ou do computador. Se quiser, adicione à tela inicial do celular para abrir como um aplicativo.",
  },
  {
    q: "Funciona sem internet?",
    a: "Não. O AutoManager é online, então registrar e consultar precisa de conexão. Pode ser a internet do próprio celular.",
  },
  {
    q: "Preciso entender de tecnologia?",
    a: "Não. O cadastro é guiado por poucas perguntas e, em poucos minutos, você já registra a primeira venda.",
  },
  {
    q: "Serve para quem tem revendedoras?",
    a: "Sim, a partir do plano Solo. Cada revendedora tem acesso próprio, vê o catálogo e registra a venda pelo celular dela. A comissão sai calculada e ela não vê seu custo nem seu lucro.",
  },
  {
    q: "E se eu vendo sozinha ou na rua?",
    a: `Funciona igual. O plano Ambulante (${preco("ambulante")}/mês) tem controle de estoque, vendas, lojinha virtual, chat e relatórios básicos, sem revendedoras nem entregas.`,
  },
  {
    q: "Tenho meus produtos em uma planilha. Posso aproveitar?",
    a: "Pode. No Estoque, você importa uma planilha em CSV, que dá para salvar direto do Excel. Fotos e variações você completa depois em cada produto.",
  },
  {
    q: "A vitrine vende sozinha, com pagamento online?",
    a: "Não. A vitrine mostra seus produtos e o cliente fala com você pelo chat ou pelos seus contatos. A venda e o pagamento você combina e registra no sistema.",
  },
  {
    q: "O sistema se conecta com a minha conta do banco ou com o WhatsApp?",
    a: "Não. Hoje as vendas e os recebimentos são registrados por você ou pela sua equipe. O chat é o da vitrine, e o WhatsApp entra como canal para você marcar de onde veio a venda.",
  },
  {
    q: "Consigo ver quanto lucro em cada produto?",
    a: "Consegue. Com o custo e o preço cadastrados, você vê a margem de cada produto, e os relatórios mostram o lucro do período, já descontando custo e comissões.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Cada loja é isolada das outras no banco de dados: ninguém de outra loja enxerga seus números, e cada pessoa da equipe vê só o que faz parte do papel dela.",
  },
];

export default function Faq({ itens }: { itens?: { q: string; a: string }[] } = {}) {
  const lista = itens ?? PERGUNTAS;
  const [aberta, setAberta] = useState<number | null>(0);

  return (
    <div className="divide-y divide-[color:var(--border)] border-y border-default">
      {lista.map((item, i) => {
        const open = aberta === i;
        const idResposta = `faq-resposta-${i}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                onClick={() => setAberta(open ? null : i)}
                aria-expanded={open}
                aria-controls={idResposta}
                className="flex min-h-[56px] w-full items-center justify-between gap-4 py-3 text-left font-semibold"
              >
                {item.q}
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </h3>
            {open && (
              <p id={idResposta} className="max-w-2xl pb-5 leading-relaxed text-muted">
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
