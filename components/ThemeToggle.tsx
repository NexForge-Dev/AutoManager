"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { aplicarAparencia, salvarTemaDoUsuario, temaBaseDef, temaDoUsuario } from "@/lib/aparencia";
import { Moon, Sun } from "lucide-react";

// Atalho rápido claro/escuro — preferência de cada usuário, salva no aparelho
// (vale ao navegar e ao recarregar). Compõe com a cor da marca e a fonte da
// loja. O tema base completo da loja fica em Configurações (dono).
export default function ThemeToggle() {
  const config = useStore((s) => s.config);
  const usuarioId = useStore((s) => s.usuarioId);
  const [claro, setClaro] = useState(false);

  useEffect(() => {
    setClaro(temaBaseDef(temaDoUsuario(usuarioId, config.temaBase)).claro);
  }, [usuarioId, config.temaBase]);

  function escolher(querClaro: boolean) {
    setClaro(querClaro);
    // se a escolha bate com o tema da loja, volta a seguir a loja (sem override)
    const daLoja = temaBaseDef(config.temaBase);
    const tema = daLoja.claro === querClaro ? daLoja.key : querClaro ? "claro" : "escuro";
    salvarTemaDoUsuario(usuarioId, tema, config.temaBase);
    aplicarAparencia({
      corMarca: config.corMarca,
      appFonte: config.appFonte,
      appRaio: config.appRaio,
      temaBase: tema,
    });
  }

  const opcoes = [
    { claro: false, label: "Escuro", icon: Moon },
    { claro: true, label: "Claro", icon: Sun },
  ];

  return (
    <div className="flex surface-alt rounded-xl p-1 gap-1">
      {opcoes.map((o) => {
        const Icon = o.icon;
        const ativo = claro === o.claro;
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={ativo}
            onClick={() => escolher(o.claro)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition active:scale-95 ${
              ativo ? "surface shadow text-strong" : "text-muted hover:text-strong hover:bg-[var(--hover)]"
            }`}
          >
            <Icon size={16} /> {o.label}
          </button>
        );
      })}
    </div>
  );
}
