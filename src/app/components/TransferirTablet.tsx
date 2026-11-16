"use client";

import { useState, useTransition } from "react";
import { transferirTablet } from "@/app/escola/[id]/actions";
import { GRUPOS_ESCOLA, type GrupoEscola } from "@/lib/grupos-escolas";

export type EscolaDestino = { id: number; nome: string; grupo: GrupoEscola };

// Lista de escolas agrupada como as abas da home (EMEF, EMEI, Outras Instituições)
export function OpcoesEscolas({ escolas, exceto }: { escolas: EscolaDestino[]; exceto: number }) {
  return GRUPOS_ESCOLA.map((g) => (
    <optgroup key={g.chave} label={g.rotulo}>
      {escolas
        .filter((e) => e.grupo === g.chave && e.id !== exceto)
        .map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
    </optgroup>
  ));
}

// Na linha do tablet: manda o tablet para outra escola. O status não muda.
export default function TransferirTablet({
  tabletId,
  patrimonio,
  escolaAtualId,
  escolas,
}: {
  tabletId: number;
  patrimonio: string;
  escolaAtualId: number;
  escolas: EscolaDestino[];
}) {
  const [aberto, setAberto] = useState(false);
  const [destino, setDestino] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function fechar() {
    setAberto(false);
    setDestino("");
    setErro(null);
  }

  function confirmar() {
    const escolaDestinoId = Number(destino);
    if (!escolaDestinoId) return;
    const nome = escolas.find((e) => e.id === escolaDestinoId)?.nome;
    if (!window.confirm(`Transferir o tablet ${patrimonio} para ${nome}?`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await transferirTablet(tabletId, escolaDestinoId, escolaAtualId);
      // em caso de sucesso, a página recarrega os dados e o tablet sai desta lista
      if (!r.ok) setErro(r.erro);
    });
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="self-start text-sm font-semibold text-teal-deep hover:underline"
      >
        Transferir para outra escola
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-line bg-paper p-3 text-sm">
      <label className="font-semibold text-ink" htmlFor={`destino-${tabletId}`}>
        Transferir para
      </label>
      <select
        id={`destino-${tabletId}`}
        value={destino}
        disabled={pendente}
        onChange={(e) => setDestino(e.target.value)}
        className="min-h-11 w-full min-w-0 rounded-xl border-2 border-line bg-white px-3 text-base"
      >
        <option value="" disabled>
          — escolha a escola —
        </option>
        <OpcoesEscolas escolas={escolas} exceto={escolaAtualId} />
      </select>
      <p className="text-xs text-ink-soft">O status do tablet é mantido.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={pendente || !destino}
          className="min-h-11 rounded-xl bg-teal px-4 font-semibold text-white disabled:opacity-60"
        >
          {pendente ? "Transferindo…" : "Transferir"}
        </button>
        <button
          type="button"
          onClick={fechar}
          disabled={pendente}
          className="min-h-11 rounded-xl border border-line bg-white px-4 font-semibold text-ink-soft"
        >
          Cancelar
        </button>
      </div>
      {erro && <p className="text-xs font-semibold text-terracotta">{erro}</p>}
    </div>
  );
}
