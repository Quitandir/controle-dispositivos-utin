"use client";

import { useState, useTransition, type ReactNode } from "react";
import { alterarStatusConferencia } from "@/app/escola/[id]/actions";
import { COR_CONFERENCIA, STATUS_CONFERENCIA, statusConferenciaDe } from "@/lib/conferencia";

// Andamento da conferência da escola, marcado à mão. "Finalizado" só fica disponível depois
// de o relatório deste ano ser enviado à escola (o servidor confere de novo).
// `acao`: vai na mesma linha do dropdown (o botão "Atualizar do Console").
export default function SeletorConferencia({
  escolaId,
  valorInicial,
  alteracaoInicial,
  podeFinalizar,
  acao,
}: {
  escolaId: number;
  valorInicial: string | null;
  alteracaoInicial: string | null; // "26/11/2026, 14:30 por fulano@"
  podeFinalizar: boolean;
  acao?: ReactNode;
}) {
  const [valor, setValor] = useState(statusConferenciaDe(valorInicial));
  const [alteracao, setAlteracao] = useState(alteracaoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function aoMudar(novo: string) {
    const anterior = valor;
    setValor(statusConferenciaDe(novo));
    setErro(null);
    iniciar(async () => {
      const r = await alterarStatusConferencia(escolaId, novo);
      if (r.ok) {
        setAlteracao(`${r.emFmt} por ${r.por}`);
      } else {
        setValor(anterior);
        setErro(r.erro);
      }
    });
  }

  return (
    <div className="mt-4">
      <label htmlFor="status-conferencia" className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">
        Status da conferência
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <select
          id="status-conferencia"
          value={valor}
          disabled={pendente}
          onChange={(e) => aoMudar(e.target.value)}
          className={`h-9 rounded-lg border-2 px-2.5 text-sm font-semibold disabled:opacity-60 ${COR_CONFERENCIA[valor].card} ${
            valor === "finalizado" ? "text-teal-deep" : "text-ink"
          }`}
        >
          {STATUS_CONFERENCIA.map((o) => (
            <option key={o.valor} value={o.valor} disabled={o.valor === "finalizado" && !podeFinalizar && valor !== "finalizado"}>
              {o.valor === "finalizado" && !podeFinalizar ? `${o.rotulo} (envie o relatório antes)` : o.rotulo}
            </option>
          ))}
        </select>
        {acao}
        {/* textos em linhas próprias; a do Console (order-last) fica por último */}
        <p className="basis-full font-mono text-[0.7rem] text-ink-soft">
          {pendente ? "Salvando…" : alteracao ? `Status alterado em ${alteracao}` : "Status ainda não alterado"}
        </p>
        {erro && <p className="basis-full text-xs font-semibold text-terracotta">{erro}</p>}
      </div>
    </div>
  );
}
