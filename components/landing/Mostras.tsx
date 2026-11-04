import { Check, ImageOff, Package, Plus, Send, TriangleAlert } from "lucide-react";

// Mostras da interface na landing. São desenhos em HTML, não telas reais: todo valor
// aqui é de exemplo e toda mostra leva o rótulo visível de "Exemplo ilustrativo".
// Valor de demonstração não pode aparecer fora deste arquivo.

function Exemplo({
  descricao,
  children,
  className = "",
}: {
  descricao: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div role="img" aria-label={descricao}>
        <div aria-hidden>{children}</div>
      </div>
      <figcaption className="mt-2.5 text-center text-xs text-muted">
        <span className="font-semibold">Exemplo ilustrativo.</span> Nomes e valores fictícios.
      </figcaption>
    </figure>
  );
}

function Quadro({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-default bg-[var(--bg)]">{children}</div>;
}

function Linha({ a, b, c }: { a: string; b?: string; c: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-default px-4 py-2.5 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-medium">{a}</span>
        {b && <span className="block truncate text-xs text-muted">{b}</span>}
      </span>
      <span className="shrink-0 font-semibold tnum">{c}</span>
    </div>
  );
}

export function MostraPainelCelular() {
  return (
    <Exemplo
      className="mx-auto w-full max-w-[20rem]"
      descricao="Painel no celular com o que foi vendido no dia, o lucro, as últimas vendas e um aviso de produto para repor"
    >
      <div className="rounded-[2rem] border border-default bg-[var(--surface)] p-2">
        <div className="overflow-hidden rounded-[1.5rem] bg-[var(--bg)]">
          <div className="px-4 pb-4 pt-5">
            <p className="text-xs text-muted">Hoje na sua loja</p>
            <p className="mt-1 text-[2rem] font-bold leading-none tracking-tight tnum">R$ 486,00</p>
            <p className="mt-1 text-xs text-muted">em 7 vendas</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[var(--surface)] p-3">
                <p className="text-xs text-muted">Lucro</p>
                <p className="mt-0.5 font-bold text-ok tnum">R$ 211,40</p>
              </div>
              <div className="rounded-xl bg-[var(--surface)] p-3">
                <p className="text-xs text-muted">A receber</p>
                <p className="mt-0.5 font-bold tnum">R$ 58,00</p>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 border-t border-default bg-warn/[.07] px-4 py-2.5 text-xs">
            <TriangleAlert size={14} className="mt-px shrink-0 text-warn" />
            <span>2 produtos para repor</span>
          </div>
          <Linha a="Colar Ponto de Luz" b="Pix · Revendedora Ana" c="R$ 79,00" />
          <Linha a="Bolo de pote (3)" b="Dinheiro · Balcão" c="R$ 36,00" />
          <Linha a="Kit batom e gloss" b="Fiado · WhatsApp" c="R$ 58,00" />
        </div>
      </div>
    </Exemplo>
  );
}

const ITENS_VENDA = [
  { nome: "Vestido Midi · M", estoque: "4 em estoque", preco: "R$ 129,00", qtd: 1 },
  { nome: "Brinco Argola", estoque: "12 em estoque", preco: "R$ 34,90", qtd: 2 },
];

export function MostraVenda() {
  return (
    <Exemplo descricao="Tela de nova venda com dois produtos, o total e o botão de registrar">
      <Quadro>
        <p className="px-4 py-3 text-sm font-semibold">Nova venda</p>
        {ITENS_VENDA.map((i) => (
          <div key={i.nome} className="flex items-center gap-3 border-t border-default px-4 py-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--surface-alt)] text-muted">
              <ImageOff size={15} />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="block truncate font-semibold">{i.nome}</span>
              <span className="block truncate text-xs text-muted">
                <span className="tnum">{i.preco}</span> · {i.estoque}
              </span>
            </span>
            <span className="w-5 text-center text-sm font-bold tnum">{i.qtd}</span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-white">
              <Plus size={15} />
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-default px-4 py-3">
          <div>
            <p className="text-xl font-bold leading-tight tnum">R$ 198,80</p>
            <p className="text-xs text-muted">Pix · WhatsApp</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white">
            <Check size={16} /> Registrar
          </span>
        </div>
      </Quadro>
    </Exemplo>
  );
}

export function MostraComissoes() {
  return (
    <Exemplo descricao="Lista de revendedoras com o total vendido e a comissão a pagar de cada uma">
      <Quadro>
        <p className="px-4 py-3 text-sm font-semibold">Comissões a pagar</p>
        <Linha a="Ana Souza" b="R$ 1.240,00 vendidos · 20%" c="R$ 248,00" />
        <Linha a="Bia Lima" b="R$ 860,00 vendidos · 20%" c="R$ 172,00" />
        <Linha a="Carla Dias" b="R$ 415,00 vendidos · 25%" c="R$ 103,75" />
      </Quadro>
    </Exemplo>
  );
}

const ITENS_VITRINE = [
  { nome: "Bolo de pote", preco: "R$ 12,00" },
  { nome: "Caixa de brigadeiros", preco: "R$ 45,00" },
];

export function MostraVitrine() {
  return (
    <Exemplo descricao="Vitrine de uma loja com dois produtos e uma conversa de chat com o cliente">
      <div className="overflow-hidden rounded-2xl border border-default bg-[#fafaf9] text-[#1c1917]">
        <div className="flex items-center gap-3 border-b border-[#e9e7e3] px-4 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
            DA
          </span>
          <p className="min-w-0 truncate font-bold">Doces da Ana</p>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4">
          {ITENS_VITRINE.map((i) => (
            <div key={i.nome}>
              <div className="grid aspect-[4/3] place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                <Package size={20} />
              </div>
              <p className="mt-1.5 truncate text-sm font-medium">{i.nome}</p>
              <p className="text-sm font-bold tnum">{i.preco}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-[#e9e7e3] p-4 text-sm">
          <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3 py-2 text-white">
            Tem bolo de pote para sábado?
          </p>
          <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-[#f1efec] px-3 py-2">
            Tem sim! Quantos você quer?
          </p>
          <div className="flex items-center gap-2 rounded-full border border-[#e9e7e3] bg-white py-1.5 pl-3 pr-1.5 text-[#6b6560]">
            <span className="flex-1 truncate">Escreva uma mensagem</span>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white">
              <Send size={13} />
            </span>
          </div>
        </div>
      </div>
    </Exemplo>
  );
}

export function MostraFinanceiro() {
  return (
    <Exemplo descricao="Resumo financeiro com valores a receber, a pagar, saldo previsto e lucro do mês">
      <Quadro>
        <div className="grid grid-cols-2">
          <div className="p-4">
            <p className="text-xs text-muted">A receber</p>
            <p className="mt-0.5 text-lg font-bold text-ok tnum">R$ 1.320,00</p>
          </div>
          <div className="border-l border-default p-4">
            <p className="text-xs text-muted">A pagar</p>
            <p className="mt-0.5 text-lg font-bold text-bad tnum">R$ 870,00</p>
          </div>
        </div>
        <Linha a="Saldo previsto" c="R$ 450,00" />
        <Linha a="Lucro do mês" b="Depois de custo e comissões" c="R$ 2.184,30" />
        <Linha a="Fornecedor" b="Vence em 5 dias" c="R$ 520,00" />
      </Quadro>
    </Exemplo>
  );
}
