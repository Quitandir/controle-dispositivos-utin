"use client";

import { useState, useTransition, type FormEvent } from "react";
import { buscarTabletParaReceber, transferirTablet, type TabletEncontrado } from "@/app/escola/[id]/actions";
import { STATUS_OPCOES_TABLET } from "@/lib/status";

const rotulo = (status: string | null) =>
  STATUS_OPCOES_TABLET.find((o) => o.valor === status)?.rotulo ?? "Não conferido";

// No topo da aba Tablets: traz para esta escola um tablet que está registrado em outra.
// O status não muda.
export default function ReceberTablet({ escolaId }: { escolaId: number }) {
  const [aberto, setAberto] = useState(false);
  const [patrimonio, setPatrimonio] = useState("");
  const [encontrado, setEncontrado] = useState<TabletEncontrado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function fechar() {
    setAberto(false);
    setPatrimonio("");
    setEncontrado(null);
    setErro(null);
  }

  function buscar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEncontrado(null);
    iniciar(async () => {
      const r = await buscarTabletParaReceber(escolaId, patrimonio);
      if (r.ok) setEncontrado(r.tablet);
      else setErro(r.erro);
    });
  }

  function confirmar() {
    if (!encontrado) return;
    const t = encontrado;
    setErro(null);
    iniciar(async () => {
      const r = await transferirTablet(t.id, escolaId, t.escolaId);
      if (r.ok) {
        fechar();
        setAviso(`Tablet ${t.patrimonio} transferido para esta escola.`);
      } else {
        setErro(r.erro);
      }
    });
  }

  return (
    <div className="mt-6">
      {!aberto ? (
        <button
          type="button"
          onClick={() => {
            setAberto(true);
            setAviso(null);
          }}
          className="min-h-11 rounded-xl border-2 border-teal bg-white px-4 font-semibold text-teal-deep hover:bg-teal/10"
        >
          Receber tablet de outra escola
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-line bg-white p-4">
          <form onSubmit={buscar} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              inputMode="numeric"
              value={patrimonio}
              onChange={(e) => {
                setPatrimonio(e.target.value);
                setEncontrado(null);
              }}
              placeholder="Patrimônio do tablet"
              aria-label="Patrimônio do tablet"
              autoFocus
              className="min-h-12 w-full rounded-xl border-2 border-line bg-white px-4 text-base outline-none focus:border-teal sm:max-w-xs"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pendente || !patrimonio.trim()}
                className="min-h-12 rounded-xl bg-teal px-5 font-semibold text-white disabled:opacity-60"
              >
                {pendente && !encontrado ? "Buscando…" : "Buscar"}
              </button>
              <button
                type="button"
                onClick={fechar}
                disabled={pendente}
                className="min-h-12 rounded-xl border border-line px-5 font-semibold text-ink-soft hover:bg-paper-deep"
              >
                Cancelar
              </button>
            </div>
          </form>

          {encontrado && (
            <div className="mt-3 rounded-xl border-2 border-amber bg-amber/15 p-4 text-sm">
              <p className="font-semibold text-ink">
                O tablet <span className="font-mono">{encontrado.patrimonio}</span> está em{" "}
                <strong>{encontrado.escolaNome ?? "nenhuma escola"}</strong>, com o status{" "}
                <strong>{rotulo(encontrado.status)}</strong>.
              </p>
              <p className="mt-1 text-ink-soft">
                Ao confirmar, ele passa para esta escola com o mesmo status. A transferência fica registrada
                nas observações do tablet.
              </p>
              <button
                type="button"
                onClick={confirmar}
                disabled={pendente}
                className="mt-3 min-h-11 rounded-xl bg-teal px-4 font-semibold text-white disabled:opacity-60"
              >
                {pendente ? "Transferindo…" : "Sim, transferir para esta escola"}
              </button>
            </div>
          )}

          {erro && <p className="mt-2 text-sm font-semibold text-terracotta">{erro}</p>}
        </div>
      )}
      {aviso && <p className="mt-2 text-sm font-semibold text-teal-deep">{aviso}</p>}
    </div>
  );
}
