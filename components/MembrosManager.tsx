"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { usePlano } from "@/lib/usePlano";
import { useDialog } from "@/components/Dialog";
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
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Users size={18} className="text-brand-500" /> Equipe de acesso
        </div>
        {papeisDisponiveis.length > 0 && (
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="btn-ghost py-1.5 px-3 text-sm"
          >
            <UserPlus size={16} /> Adicionar
          </button>
        )}
      </div>

      <p className="text-sm text-muted -mt-1">
        Crie logins de vendedor e entregador. Cada um entra no app com o próprio e-mail e enxerga só o que o papel permite.
      </p>

      {papeisDisponiveis.length === 0 && (
        <p className="text-sm text-muted">
          Seu plano atual não inclui outros perfis.{" "}
          <Link href="/planos" className="text-brand-500 font-semibold">
            Faça upgrade
          </Link>{" "}
          para criar logins de vendedor e entregador.
        </p>
      )}

      {/* lista de membros */}
      {outros.length > 0 && (
        <div className="space-y-2">
          {outros.map((m) => {
            const Icon = ROLE_ICON[m.role] ?? Users;
            return (
              <div key={m.id} className="flex items-center justify-between rounded-xl surface-alt px-3 py-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-8 w-8 rounded-lg bg-brand-500/10 grid place-items-center shrink-0">
                    <Icon size={15} className="text-brand-500" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.nome || m.email}</div>
                    <div className="text-xs text-muted truncate">
                      {m.email} · {ROLE_LABEL[m.role]}
                    </div>
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
                  className="text-red-500 shrink-0 grid place-items-center h-9 w-9 rounded-lg hover:bg-[var(--hover)] disabled:opacity-50"
                  title="Remover acesso"
                  aria-label={`Remover acesso de ${m.nome || m.email}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* form criar membro */}
      {aberto && papeisDisponiveis.length > 0 && (
        <div className="rounded-xl border border-default p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Novo acesso</span>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-muted grid place-items-center h-8 w-8 rounded-lg hover:bg-[var(--hover)]"
              aria-label="Fechar formulário de novo acesso"
            >
              <X size={16} />
            </button>
          </div>
          <label htmlFor="membro-nome" className="sr-only">
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
          <label htmlFor="membro-email" className="sr-only">
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
          <label htmlFor="membro-senha" className="sr-only">
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
            <p className="text-xs text-muted">Papel: {ROLE_LABEL[papeisDisponiveis[0]]}</p>
          )}
          {erro && (
            <p className="text-sm text-red-500" role="alert">
              {erro}
            </p>
          )}
          <button type="button" onClick={salvar} disabled={salvando} className="btn-primary w-full disabled:opacity-60">
            {salvando ? "Criando…" : "Criar acesso"}
          </button>
          <p className="text-[11px] text-muted">
            O membro entra no app com este e-mail e senha. Para trocar a senha, remova e recrie o acesso.
          </p>
        </div>
      )}
    </section>
  );
}
