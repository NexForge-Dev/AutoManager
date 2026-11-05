"use client";
import { usePathname } from "next/navigation";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { falhasDaRota, textoFalhas } from "@/lib/cargaLoja";
import { Aviso, EstadoVazio } from "./ui";

function BotaoTentar({ onClick, ocupado, primario = false }: { onClick: () => void; ocupado: boolean; primario?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={ocupado} className={primario ? "btn-primary" : "btn-ghost btn-sm"}>
      {ocupado ? <Loader2 className="animate-spin" size={16} aria-hidden /> : <RefreshCw size={16} aria-hidden />}
      Tentar de novo
    </button>
  );
}

/** Tela inteira: sem saber a loja, o papel ou o plano, nada do app pode abrir. */
export function TelaFalhaCarga({ onTentar }: { onTentar?: () => void }) {
  const recarregando = useStore((s) => s.recarregando);
  const tentarDeNovo = useStore((s) => s.tentarDeNovo);
  return (
    <main className="min-h-screen grid place-items-center px-4 bg-[var(--bg)]">
      <div role="alert">
        <EstadoVazio
          icone={WifiOff}
          titulo="Não foi possível carregar sua loja"
          acao={<BotaoTentar primario ocupado={recarregando} onClick={onTentar ?? (() => void tentarDeNovo())} />}
        >
          Seus dados não foram perdidos e você continua conectado. Confira a internet e tente de novo.
        </EstadoVazio>
      </div>
    </main>
  );
}

/**
 * Entre a shell e a tela. Se o que a tela mostra não carregou, ela dá lugar ao aviso:
 * lista vazia e "R$ 0,00" fariam o dono achar que perdeu tudo e cadastrar de novo.
 * Falha em algo que a tela não usa vira só uma faixa.
 */
export function ConteudoCarga({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const falhas = useStore((s) => s.falhasCarga);
  const recarregando = useStore((s) => s.recarregando);
  const tentarDeNovo = useStore((s) => s.tentarDeNovo);
  const daRota = falhasDaRota(path, falhas);

  if (daRota.length > 0)
    return (
      <div role="alert" className="card">
        <EstadoVazio
          icone={WifiOff}
          titulo="Não foi possível carregar esta tela"
          acao={<BotaoTentar primario ocupado={recarregando} onClick={() => void tentarDeNovo()} />}
        >
          Faltou carregar: {textoFalhas(daRota)}. Seus dados não foram perdidos. Confira a internet e tente de novo.
        </EstadoVazio>
      </div>
    );

  return (
    <>
      {falhas.length > 0 && (
        <div role="status" className="mb-4 print-hidden">
          <Aviso
            tom="warn"
            icone={WifiOff}
            titulo={`Faltou carregar: ${textoFalhas(falhas)}`}
            acao={<BotaoTentar ocupado={recarregando} onClick={() => void tentarDeNovo()} />}
          >
            O restante está certo, mas o que depende disso pode aparecer incompleto.
          </Aviso>
        </div>
      )}
      {children}
    </>
  );
}
