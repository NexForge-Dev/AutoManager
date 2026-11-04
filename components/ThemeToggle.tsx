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
    <div className="segmented flex [&>button]:min-h-[40px]" role="group" aria-label="Tema do aplicativo">
      {opcoes.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={claro === o.claro}
            onClick={() => escolher(o.claro)}
            className="flex flex-1 items-center justify-center gap-2"
          >
            <Icon size={16} aria-hidden /> {o.label}
          </button>
        );
      })}
    </div>
  );
}
