"use client";

import { useEffect, useState, useTransition } from "react";
import { salvarObservacoesEscola, type VersaoObservacoes } from "@/app/escola/[id]/actions";
import { LIMITE_OBSERVACOES } from "@/lib/relatorio";

// Observações da visita: uma caixa por escola, salva no botão e editável quantas vezes for preciso.
// O texto salvo entra no relatório quando ele é gerado.
export default function ObservacoesVisita({
  escolaId,
  salvoInicial,
  ultimoRelatorio,
}: {
  escolaId: number;
  salvoInicial: VersaoObservacoes | null;
  ultimoRelatorio: { codigo: string; geradoEm: string } | null; // geradoEm em ISO
}) {
  const [texto, setTexto] = useState(salvoInicial?.texto ?? "");
  const [salvo, setSalvo] = useState(salvoInicial);
  const [conflito, setConflito] = useState<VersaoObservacoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const alterado = texto.trim() !== (salvo?.texto ?? "");
  const alteradoDepoisDoRelatorio = !!(salvo && ultimoRelatorio && salvo.em > ultimoRelatorio.geradoEm);

  // recarregar ou fechar a página com texto não salvo pede confirmação ao navegador
  useEffect(() => {
    if (!alterado) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [alterado]);

  function salvar() {
    setErro(null);
    iniciar(async () => {
      try {
        const r = await salvarObservacoesEscola(escolaId, texto, salvo?.em ?? null);
        if (r.ok) {
          setSalvo(r.salvo);
          setConflito(null);
        } else if ("conflito" in r) {
          // o próximo Salvar passa a valer sobre a versão da outra pessoa
          setSalvo(r.conflito);
          setConflito(r.conflito);
        } else {
          setErro(r.erro);
        }
      } catch {
        setErro("Não foi possível salvar. Confira a conexão e tente de novo.");
      }
    });
  }

  function juntarTextos() {
    if (!conflito) return;
    setTexto([conflito.texto, texto.trim()].filter(Boolean).join("\n\n"));
    setConflito(null);
  }

  return (
    <section className="mt-6 flex flex-col gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold text-teal-deep">Observações da visita</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Entram no relatório e no e-mail enviado à escola. Salve antes de gerar o relatório.
        </p>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={LIMITE_OBSERVACOES}
        rows={8}
        placeholder="Anotações sobre casos específicos desta visita…"
        aria-label="Observações da visita"
        className="w-full rounded-xl border-2 border-line bg-white p-3 text-base outline-none focus:border-teal"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-xs text-ink-soft">
          {texto.length} / {LIMITE_OBSERVACOES} caracteres
        </span>
        <button
          type="button"
          onClick={salvar}
          disabled={pendente || !alterado}
          className="min-h-11 rounded-xl bg-teal px-5 font-semibold text-white disabled:opacity-60"
        >
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>

      {alterado ? (
        <p className="text-sm font-semibold text-terracotta">Alterações não salvas</p>
      ) : (
        salvo && (
          <p className="font-mono text-xs text-ink-soft">
            Salvo em {salvo.emFmt} por {salvo.por}
          </p>
        )
      )}

      {alteradoDepoisDoRelatorio && ultimoRelatorio && (
        <p className="rounded-xl border-2 border-amber bg-amber/20 p-3 text-sm">
          As observações foram alteradas depois do {ultimoRelatorio.codigo}. Para incluí-las, gere uma
          nova versão do relatório.
        </p>
      )}

      {erro && <p className="text-sm font-semibold text-terracotta">{erro}</p>}

      {conflito && (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-terracotta bg-terracotta/10 p-3 text-sm">
          <p className="font-semibold text-terracotta">
            {conflito.por} salvou as observações em {conflito.emFmt}, enquanto você escrevia. Seu texto
            não foi salvo e continua na caixa acima.
          </p>
          <p>Texto salvo pela outra pessoa:</p>
          <pre className="whitespace-pre-wrap rounded-lg bg-white p-2 font-sans text-sm">
            {conflito.texto || "(vazio)"}
          </pre>
          <p>Junte os dois textos, ajuste o que precisar e clique em Salvar.</p>
          <button
            type="button"
            onClick={juntarTextos}
            className="min-h-11 self-start rounded-xl border-2 border-teal px-4 font-semibold text-teal-deep"
          >
            Juntar os dois textos
          </button>
        </div>
      )}
    </section>
  );
}
