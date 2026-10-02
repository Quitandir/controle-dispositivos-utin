"use client";

import { useState, useTransition } from "react";
import { atualizarStatusTablet } from "@/app/escola/[id]/actions";
import { STATUS_OPCOES_TABLET } from "@/lib/status";

const COR: Record<string, string> = {
  localizado: "border-teal bg-teal/10 text-teal-deep",
  nao_localizado: "border-terracotta bg-terracotta/10 text-terracotta",
  recolhido: "border-amber bg-amber/20 text-ink",
  baixado: "border-ink-soft bg-ink-soft/10 text-ink-soft",
  "": "border-line bg-white text-ink-soft",
};

export default function SeletorStatusTablet({
  tabletId,
  statusInicial,
}: {
  tabletId: number;
  statusInicial: string | null;
}) {
  const [valor, setValor] = useState(statusInicial ?? "");
  const [erro, setErro] = useState(false);
  const [pendente, iniciar] = useTransition();

  function aoMudar(novo: string) {
    const anterior = valor;
    setValor(novo);
    setErro(false);
    iniciar(async () => {
      try {
        await atualizarStatusTablet(tabletId, novo);
      } catch {
        setValor(anterior);
        setErro(true);
      }
    });
  }

  return (
    <div>
      <select
        value={valor}
        disabled={pendente}
        onChange={(e) => aoMudar(e.target.value)}
        className={`min-h-12 w-full rounded-xl border-2 px-3 text-base font-semibold disabled:opacity-60 ${COR[valor]}`}
      >
        <option value="" disabled>
          — não conferido —
        </option>
        {STATUS_OPCOES_TABLET.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {pendente && <p className="mt-1 font-mono text-xs text-ink-soft">salvando…</p>}
      {erro && (
        <p className="mt-1 text-xs font-semibold text-terracotta">
          Não foi possível salvar. Tente de novo.
        </p>
      )}
    </div>
  );
}