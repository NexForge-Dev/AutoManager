"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { SUPORTE_WHATSAPP_LABEL, linkWhatsappSuporte } from "@/lib/admin";
import type { TipoChamado } from "@/lib/types";
import Modal from "./Modal";
import { Aviso, Segmentado } from "./ui";
import { LifeBuoy, Send, MessageCircle, CheckCircle2, Zap, Loader2 } from "lucide-react";

const TIPOS: { id: TipoChamado; label: string }[] = [
  { id: "erro", label: "Erro / bug" },
  { id: "duvida", label: "Dúvida" },
  { id: "sugestao", label: "Sugestão" },
];

const OPCOES_TIPO = TIPOS.map((t) => [t.id, t.label] as const);

export default function Reporte() {
  const abrirChamado = useStore((s) => s.abrirChamado);
  const nomeLoja = useStore((s) => s.config.nomeLoja);
  const emailSessao = useStore((s) => s.email);

  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoChamado>("erro");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  function fechar() {
    setAberto(false);
    // reseta depois da animação de saída
    setTimeout(() => {
      setTipo("erro");
      setAssunto("");
      setMensagem("");
      setEmailContato("");
      setErro(null);
      setEnviado(false);
      setEnviando(false);
    }, 150);
  }

  async function enviar() {
    setErro(null);
    if (!assunto.trim() || !mensagem.trim()) {
      setErro("Preencha o assunto e a mensagem.");
      return;
    }
    setEnviando(true);
    const r = await abrirChamado({
      tipo,
      assunto,
      mensagem,
      emailContato: emailContato || emailSessao || undefined,
    });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro || "Não foi possível registrar. Tente pelo WhatsApp.");
      return;
    }
    setEnviado(true);
  }

  const textoWhats = `Olá! Sou da loja "${nomeLoja || "(sem nome)"}" no AutoManager e preciso de ajuda.`;

  return (
    <>
      {/* card de acesso no painel */}
      <button onClick={() => setAberto(true)} className="card w-full text-left flex items-center gap-3">
        <span className="grid place-items-center h-10 w-10 shrink-0 rounded-lg tone-brand" aria-hidden>
          <LifeBuoy size={19} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">Reportar um problema</span>
          <span className="block text-sm text-muted">
            Fale com o suporte ou registre um ticket de erro.
          </span>
        </span>
      </button>

      {/* modal */}
      {aberto && (
        <Modal
          onClose={fechar}
          largura="md:max-w-lg"
          icone={<LifeBuoy size={18} className="text-accent" aria-hidden />}
          titulo="Suporte AutoManager"
          className="space-y-4"
        >
            {enviado ? (
              <div className="py-2 text-center space-y-3">
                <span className="mx-auto grid place-items-center h-12 w-12 rounded-xl tone-ok" aria-hidden>
                  <CheckCircle2 size={24} />
                </span>
                <div className="font-semibold text-lg">Ticket registrado!</div>
                <p className="text-sm text-muted">
                  Recebemos seu chamado e vamos analisar. Se for urgente, chame também no
                  WhatsApp.
                </p>
                <a
                  href={linkWhatsappSuporte(textoWhats)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                >
                  <MessageCircle size={16} aria-hidden /> Falar no WhatsApp
                </a>
                <div>
                  <button onClick={fechar} className="text-sm text-muted hover:text-strong underline underline-offset-2 min-h-[40px]">
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* WhatsApp */}
                <a
                  href={linkWhatsappSuporte(textoWhats)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 border border-ok/30 bg-ok/[.06] hover:bg-ok/10 p-3 transition-colors"
                  style={{ borderRadius: "var(--r-card)" }}
                >
                  <span className="grid place-items-center h-9 w-9 shrink-0 rounded-lg tone-ok" aria-hidden>
                    <MessageCircle size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">WhatsApp do suporte</span>
                    <span className="block text-sm text-muted tnum">{SUPORTE_WHATSAPP_LABEL}</span>
                  </span>
                </a>

                {/* aviso: ticket é mais rápido */}
                <Aviso tom="brand" icone={Zap} titulo="Registrar um ticket é mais rápido.">
                  Descreva o problema abaixo que conseguimos resolver com mais detalhes e histórico.
                </Aviso>

                {/* formulário de ticket */}
                <div className="space-y-3">
                  <div>
                    <span className="label">Tipo</span>
                    <Segmentado
                      className="flex [&>button]:flex-1"
                      rotulo="Tipo do chamado"
                      opcoes={OPCOES_TIPO}
                      valor={tipo}
                      onChange={setTipo}
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="reporte-assunto">Assunto</label>
                    <input
                      id="reporte-assunto"
                      value={assunto}
                      onChange={(e) => setAssunto(e.target.value)}
                      placeholder="Ex.: Não consigo registrar venda fiado"
                      className="input"
                      maxLength={120}
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="reporte-mensagem">O que aconteceu?</label>
                    <textarea
                      id="reporte-mensagem"
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder="Conte o que você estava fazendo e o que deu errado."
                      className="input min-h-[110px] resize-y"
                      maxLength={2000}
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="reporte-email">
                      E-mail para retorno{" "}
                      <span className="text-muted font-normal">(opcional)</span>
                    </label>
                    <input
                      id="reporte-email"
                      value={emailContato}
                      onChange={(e) => setEmailContato(e.target.value)}
                      placeholder={emailSessao || "voce@email.com"}
                      className="input"
                      type="email"
                    />
                  </div>

                  {erro && (
                    <p className="text-sm text-bad" role="alert">
                      {erro}
                    </p>
                  )}

                  <button onClick={enviar} disabled={enviando} className="btn-primary w-full">
                    {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
                    {enviando ? "Enviando…" : "Registrar ticket"}
                  </button>
                </div>
              </div>
            )}
        </Modal>
      )}
    </>
  );
}
