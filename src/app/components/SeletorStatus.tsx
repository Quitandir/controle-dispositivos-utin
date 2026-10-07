"use client";

import { useState, useTransition } from "react";
import {
  atualizarStatus,
  atualizarStatusTablet,
  reverterLocalizado,
  reverterLocalizadoTablet,
} from "@/app/escola/[id]/actions";
import { STATUS_OPCOES, STATUS_OPCOES_TABLET } from "@/lib/status";

const COR: Record<string, string> = {
  localizado: "border-teal bg-teal/10 text-teal-deep",
  nao_localizado: "border-terracotta bg-terracotta/10 text-terracotta",
  recolhido: "border-amber bg-amber/20 text-ink",
  baixado: "border-ink-soft bg-ink-soft/10 text-ink-soft",
  "": "border-line bg-white text-ink-soft",
};

const ACOES = {
  chromebook: { opcoes: STATUS_OPCOES, atualizar: atualizarStatus, reverter: reverterLocalizado },
  tablet: { opcoes: STATUS_OPCOES_TABLET, atualizar: atualizarStatusTablet, reverter: reverterLocalizadoTablet },
};

// Lista suspensa de status + checkbox de atalho para "localizado".
// Desmarcar o checkbox volta ao status anterior (o servidor consulta o histórico).
export default function SeletorStatus({
  tipo,
  id,
  statusInicial,
}: {
  tipo: keyof typeof ACOES;
  id: number;
  statusInicial: string | null;
}) {
  const { opcoes, atualizar, reverter } = ACOES[tipo];
  const [valor, setValor] = useState(statusInicial ?? "");
  const [erro, setErro] = useState(false);
  const [pendente, iniciar] = useTransition();

  function aoMudar(novo: string) {
    const anterior = valor;
    setValor(novo);
    setErro(false);
    iniciar(async () => {
      try {
        await atualizar(id, novo);
      } catch {
        setValor(anterior);
        setErro(true);
      }
    });
  }

  function aoDesmarcar() {
    setErro(false);
    iniciar(async () => {
      try {
        setValor((await reverter(id)) ?? "");
      } catch {
        setErro(true);
      }
    });
  }

  const localizado = valor === "localizado";

  return (
    <div>
      <div className="flex gap-2">
        <label
          title="Marcar como localizado"
          className={`flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 ${
            localizado ? "border-teal bg-teal/10" : "border-line bg-white"
          } ${pendente ? "opacity-60" : ""}`}
        >
          <input
            type="checkbox"
            checked={localizado}
            disabled={pendente}
            onChange={(e) => (e.target.checked ? aoMudar("localizado") : aoDesmarcar())}
            aria-label="Localizado"
            className="h-6 w-6 cursor-pointer accent-teal"
          />
        </label>
        <select
          value={valor}
          disabled={pendente}
          onChange={(e) => aoMudar(e.target.value)}
          className={`min-h-12 w-full min-w-0 rounded-xl border-2 px-3 text-base font-semibold disabled:opacity-60 ${COR[valor]}`}
        >
          <option value="" disabled>
            — não conferido —
          </option>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </div>
      {pendente && <p className="mt-1 font-mono text-xs text-ink-soft">salvando…</p>}
      {erro && (
        <p className="mt-1 text-xs font-semibold text-terracotta">
          Não foi possível salvar. Tente de novo.
        </p>
      )}
    </div>
  );
}
