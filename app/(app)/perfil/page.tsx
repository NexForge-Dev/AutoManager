"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { usePlano } from "@/lib/usePlano";
import Guard from "@/components/Guard";
import { useDialog } from "@/components/Dialog";
import MembrosManager from "@/components/MembrosManager";
import ThemeToggle from "@/components/ThemeToggle";
import CountUp from "@/components/CountUp";
import { PageHeader, Painel, Selo, Stat } from "@/components/ui";
import { Skeleton } from "@/components/Skeleton";
import { brl, centavos } from "@/lib/analytics";
import { Store, Mail, Palette, LogOut, BadgeCheck, ChevronRight } from "lucide-react";

export default function PerfilPage() {
  return (
    <Guard>
      <Perfil />
    </Guard>
  );
}

function Perfil() {
  const router = useRouter();
  const { config, produtos, vendas, role } = useStore();
  const { confirm } = useDialog();
  const [email, setEmail] = useState("");

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function sair() {
    const ok = await confirm({
      titulo: "Sair da conta?",
      mensagem: "Você precisará entrar de novo com seu e-mail e senha.",
      confirmar: "Sair",
      perigo: true,
    });
    if (!ok) return;
    await createClient().auth.signOut();
    // não deixa os dados desta loja na memória para a próxima conta do navegador
    useStore.getState().limpar();
    router.replace("/login?modo=entrar");
  }

  // canceladas não são faturamento nem venda
  const validas = vendas.filter((v) => v.statusPagamento !== "cancelada");
  const faturamento = centavos(validas.reduce((a, v) => a + v.total, 0));
  const ehDono = role === "owner";

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader titulo="Perfil" descricao="Conta e preferências" />

      {/* conta */}
      <section className="card flex items-center gap-3">
        <span className="grid place-items-center h-11 w-11 shrink-0 rounded-lg tone-brand" aria-hidden>
          <Store size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{config.nomeLoja || "Minha Loja"}</div>
          <div className="text-xs text-muted capitalize">{config.segmento}</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted min-w-0">
            <Mail size={14} className="shrink-0" aria-hidden />
            {email ? <span className="truncate">{email}</span> : <Skeleton className="h-4 w-40" />}
          </div>
        </div>
      </section>

      {/* números da loja (produtos, vendas, faturado) são informação do dono — vendedor/entregador não vê */}
      {/* no celular o faturado ocupa a linha inteira: valor em reais não cabe num terço */}
      {ehDono && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 stagger">
          <Stat rotulo="Produtos" valor={<CountUp value={produtos.length} />} />
          <Stat rotulo="Vendas" valor={<CountUp value={validas.length} />} />
          <Stat
            rotulo="Faturado"
            className="col-span-2 sm:col-span-1"
            valor={<CountUp value={faturamento} format={brl} />}
          />
        </div>
      )}

      {/* tema */}
      <Painel titulo="Aparência" descricao="Escolha o tema do aplicativo." icone={Palette}>
        <ThemeToggle />
      </Painel>

      {/* plano */}
      <PlanoLinha />

      {/* equipe (vendedor / entregador) — só o dono, papéis conforme o plano */}
      {ehDono && <MembrosManager />}

      <button onClick={sair} className="btn-danger w-full">
        <LogOut size={18} aria-hidden /> Sair da conta
      </button>
    </div>
  );
}

function PlanoLinha() {
  const role = useStore((s) => s.role);
  const { defContratado, emTrial, diasTrial } = usePlano();
  const conteudo = (
    <>
      <span className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
        <BadgeCheck size={18} className="text-accent shrink-0" aria-hidden />
        <span className="font-semibold">Plano {defContratado.nome}</span>
        {emTrial && <Selo tom="brand">Teste grátis · {diasTrial}d</Selo>}
      </span>
      {role === "owner" ? (
        <ChevronRight size={18} className="text-muted shrink-0" aria-hidden />
      ) : (
        <Selo className="shrink-0">Ativo</Selo>
      )}
    </>
  );
  return (
    <div className="card-list">
      {role === "owner" ? (
        <Link href="/configuracoes/plano" className="row">
          {conteudo}
        </Link>
      ) : (
        <div className="row">{conteudo}</div>
      )}
    </div>
  );
}
