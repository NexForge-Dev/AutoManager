"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { usePlano } from "@/lib/usePlano";
import { useDialog } from "@/components/Dialog";
import { Painel } from "@/components/ui";
import type { Role } from "@/lib/types";
import { Users, UserPlus, Trash2, X, Store, Bike, ShoppingBag } from "lucide-react";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Dono",
  vendedor: "Vendedor",
  motoboy: "Entregador",
};

const ROLE_ICON: Record<Role, any> = {
  owner: Store,
  vendedor: ShoppingBag,
  motoboy: Bike,
};

// Gestão de equipe (vendedor / entregador). O dono cria logins com e-mail e senha;
// os papéis disponíveis dependem do plano (allowVendedores / allowMotoboys).
// Reaproveitado em /configuracoes e /perfil.
export default function MembrosManager() {
  const { membros, usuarioId, criarMembro, removerMembro } = useStore();
  const { caps } = usePlano();
  const { confirm, alerta } = useDialog();

  const papeisDisponiveis: Role[] = [
    ...(caps.allowVendedores ? ["vendedor" as Role] : []),
    ...(caps.allowMotoboys ? ["motoboy" as Role] : []),
  ];
  const outros = membros.filter((m) => m.id !== usuarioId);

  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Role>(papeisDisponiveis[0] || "vendedor");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  // o plano pode carregar depois do 1º render: nunca envia um papel que o plano não libera
  const papelEfetivo: Role = papeisDisponiveis.includes(papel) ? papel : papeisDisponiveis[0] || "vendedor";

  async function salvar() {
    if (salvando) return;
    setErro(null);
    if (!email.trim() || senha.length < 8) {
      setErro("Informe e-mail e senha de pelo menos 8 caracteres.");
      return;
    }
    setSalvando(true);
    const r = await criarMembro({ nome, email: email.trim(), senha, role: papelEfetivo });
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro || "Falha ao criar acesso");
      return;
    }
    setNome("");
    setEmail("");
    setSenha("");
    setAberto(false);
  }

  return (
    <Painel
      titulo="Equipe de acesso"
      descricao="Crie logins de vendedor e entregador. Cada um entra no app com o próprio e-mail e enxerga só o que o papel permite."
      icone={Users}
      lista
      acao={
        papeisDisponiveis.length > 0 && (
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="btn-ghost btn-sm"
          >
            <UserPlus size={16} aria-hidden /> Adicionar
          </button>
        )
      }
    >
      {papeisDisponiveis.length === 0 && (
        <p className="px-4 py-3 text-sm text-muted">
          Seu plano atual não inclui outros perfis.{" "}
          <Link href="/planos" className="text-accent font-semibold hover:underline">
            Faça upgrade
          </Link>{" "}
          para criar logins de vendedor e entregador.
        </p>
      )}

      {/* lista de membros */}
      {outros.map((m) => {
        const Icon = ROLE_ICON[m.role] ?? Users;
        return (
          <div key={m.id} className="row">
            <span className="grid place-items-center h-9 w-9 shrink-0 rounded-lg tone-brand" aria-hidden>
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{m.nome || m.email}</div>
              <div className="text-xs text-muted truncate">
                {m.email} · {ROLE_LABEL[m.role]}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (removendo) return;
                const ok = await confirm({
                  titulo: "Remover acesso?",
                  mensagem: `${m.nome || m.email} perderá o login deste painel.`,
                  confirmar: "Remover",
                  perigo: true,
                });
                if (!ok) return;
                setRemovendo(m.id);
                const r = await removerMembro(m.id);
                setRemovendo(null);
                if (!r.ok)
                  alerta({ titulo: "Não foi possível remover o acesso", mensagem: r.erro || "Tente novamente." });
              }}
              disabled={removendo === m.id}
              className="icon-btn hover:!text-bad"
              title="Remover acesso"
              aria-label={`Remover acesso de ${m.nome || m.email}`}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        );
      })}

      {papeisDisponiveis.length > 0 && outros.length === 0 && !aberto && (
        <p className="px-4 py-3 text-sm text-muted">Nenhum acesso criado ainda.</p>
      )}

      {/* form criar membro */}
      {aberto && papeisDisponiveis.length > 0 && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="section-title">Novo acesso</span>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="icon-btn -my-2 -mr-2"
              aria-label="Fechar formulário de novo acesso"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="membro-nome" className="label">
                Nome
              </label>
              <input
                id="membro-nome"
                className="input"
                placeholder="Nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div>
              <label htmlFor="membro-email" className="label">
                E-mail de login
              </label>
              <input
                id="membro-email"
                className="input"
                type="email"
                autoComplete="off"
                placeholder="E-mail de login"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div>
              <label htmlFor="membro-senha" className="label">
                Senha (mínimo 8 caracteres)
              </label>
              <input
                id="membro-senha"
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder="Senha (mín. 8)"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div>
              <span className="label">Papel</span>
              {papeisDisponiveis.length > 1 ? (
                <select
                  className="input"
                  aria-label="Papel"
                  value={papelEfetivo}
                  onChange={(e) => setPapel(e.target.value as Role)}
                  disabled={salvando}
                >
                  {papeisDisponiveis.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="input flex items-center surface-alt text-muted">{ROLE_LABEL[papeisDisponiveis[0]]}</p>
              )}
            </div>
          </div>
          {erro && (
            <p className="text-sm text-bad" role="alert">
              {erro}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button type="button" onClick={salvar} disabled={salvando} className="btn-primary btn-sm">
              {salvando ? "Criando…" : "Criar acesso"}
            </button>
            <p className="text-xs text-muted min-w-0 flex-1 basis-52">
              O membro entra no app com este e-mail e senha. Para trocar a senha, remova e recrie o acesso.
            </p>
          </div>
        </div>
      )}
    </Painel>
  );
}
