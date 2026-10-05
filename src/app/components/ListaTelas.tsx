"use client";

import { useMemo, useState } from "react";
import FormularioVistoriaTela, { type ModoFormulario } from "./FormularioVistoriaTela";
import {
  OPCOES_VISTORIA,
  PERGUNTAS,
  rotuloOpcao,
  tomOpcao,
  type CampoOpcao,
  type DadosVistoria,
} from "@/lib/telas";

export type ItemVistoria = {
  id: number;
  dataVisita: string; // AAAA-MM-DD
  dataVisitaFmt: string;
  sala: string;
  funcionando: string;
  emailInstalado: string;
  internet: string;
  atualizada: string;
  som: string;
  apps: string[];
  medidasRealizadas: string | null;
  anotacoes: string | null;
  registro: string; // "dd/mm/aaaa hh:mm por fulano@..."
  outraEscola: string | null; // preenchido se a vistoria foi feita em outra escola
  edicoes: { quando: string; por: string; mudancas: { campo: string; de: string; para: string }[] }[];
};

export type ItemTela = {
  id: number;
  patrimonio: string;
  marca: string;
  ultimaAlteracao: string | null;
  vistorias: ItemVistoria[]; // mais recente primeiro
};

const TOM: Record<ReturnType<typeof tomOpcao>, string> = {
  ok: "border-teal bg-teal/10 text-teal-deep",
  parcial: "border-amber bg-amber/20 text-ink",
  problema: "border-terracotta bg-terracotta/10 text-terracotta",
  neutro: "border-line bg-paper-deep text-ink-soft",
};

const CAMPOS = Object.keys(OPCOES_VISTORIA) as CampoOpcao[];

const ROTULO_CURTO: Record<CampoOpcao, string> = {
  funcionando: "Funcionando",
  emailInstalado: "E-mail",
  internet: "Internet",
  atualizada: "Atualizada",
  som: "Som",
};

function paraFormulario(marca: string, v: ItemVistoria): DadosVistoria {
  return {
    dataVisita: v.dataVisita,
    marca,
    sala: v.sala,
    funcionando: v.funcionando,
    emailInstalado: v.emailInstalado,
    internet: v.internet,
    atualizada: v.atualizada,
    som: v.som,
    apps: v.apps,
    medidasRealizadas: v.medidasRealizadas ?? "",
    anotacoes: v.anotacoes ?? "",
  };
}

type Aberto = { onde: "topo" | number; modo: ModoFormulario; valores?: Partial<DadosVistoria> };

export default function ListaTelas({ escolaId, itens }: { escolaId: number; itens: ItemTela[] }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<Set<number>>(new Set());
  const termo = busca.trim().toLowerCase();

  const filtrados = useMemo(
    () => (termo ? itens.filter((i) => i.patrimonio.toLowerCase().includes(termo)) : itens),
    [itens, termo],
  );

  function alternarHistorico(id: number) {
    setHistoricoAberto((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function formulario(a: Aberto) {
    return (
      <FormularioVistoriaTela
        key={JSON.stringify(a.modo)}
        modo={a.modo}
        valoresIniciais={a.valores}
        aoConcluir={() => setAberto(null)}
        aoCancelar={() => setAberto(null)}
      />
    );
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 mt-6 flex flex-col gap-3 bg-paper px-4 py-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por patrimônio"
            aria-label="Buscar por patrimônio"
            className="min-h-12 w-full rounded-xl border-2 border-line bg-white px-4 text-base outline-none focus:border-teal md:max-w-sm"
          />
          {termo && (
            <p className="mt-2 font-mono text-xs text-ink-soft">
              {filtrados.length} de {itens.length} encontradas
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAberto({ onde: "topo", modo: { tipo: "novo", escolaId } })}
          className="min-h-12 rounded-xl bg-teal px-5 font-semibold text-white hover:bg-teal-deep"
        >
          + Registrar vistoria
        </button>
      </div>

      {aberto?.onde === "topo" && <div className="mt-3">{formulario(aberto)}</div>}

      <ul className="mt-3 flex flex-col gap-3">
        {filtrados.map((t) => {
          const ultima = t.vistorias[0];
          const mostrarHistorico = historicoAberto.has(t.id);
          return (
            <li key={t.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 md:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-xs uppercase text-ink-soft">Patrimônio </span>
                  <span className="font-mono text-base font-medium">{t.patrimonio}</span>
                  <p className="mt-1 text-sm text-ink-soft">
                    {t.marca}
                    {ultima && <> · {ultima.sala}</>}
                  </p>
                </div>
                {ultima && (
                  <span
                    className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${TOM[tomOpcao(ultima.funcionando)]}`}
                  >
                    {rotuloOpcao("funcionando", ultima.funcionando)}
                  </span>
                )}
              </div>

              {ultima && (
                <>
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {CAMPOS.filter((c) => c !== "funcionando").map((c) => (
                      <div key={c} className={`rounded-xl border px-3 py-2 ${TOM[tomOpcao(ultima[c])]}`}>
                        <dt className="font-mono text-[0.65rem] uppercase tracking-widest opacity-80">
                          {ROTULO_CURTO[c]}
                        </dt>
                        <dd className="text-sm font-semibold">{rotuloOpcao(c, ultima[c])}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="flex flex-col gap-2 text-sm">
                    <p>
                      <span className="font-mono text-xs uppercase text-ink-soft">Apps </span>
                      {ultima.apps.length ? ultima.apps.join(", ") : <span className="text-ink-soft">nenhum registrado</span>}
                    </p>
                    {ultima.medidasRealizadas && (
                      <p>
                        <span className="font-mono text-xs uppercase text-ink-soft">Medidas </span>
                        {ultima.medidasRealizadas}
                      </p>
                    )}
                    {ultima.anotacoes && (
                      <p>
                        <span className="font-mono text-xs uppercase text-ink-soft">Anotações </span>
                        {ultima.anotacoes}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-mono text-xs text-ink-soft">
                  {ultima && <>Vistoria de {ultima.dataVisitaFmt}</>}
                  {t.ultimaAlteracao && (
                    <>
                      <br />
                      Última alteração: {t.ultimaAlteracao}
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ultima && (
                    <button
                      type="button"
                      onClick={() =>
                        setAberto({
                          onde: t.id,
                          modo: { tipo: "editar", vistoriaId: ultima.id, patrimonio: t.patrimonio },
                          valores: paraFormulario(t.marca, ultima),
                        })
                      }
                      className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-teal-deep hover:bg-paper-deep"
                    >
                      Editar vistoria
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setAberto({
                        onde: t.id,
                        modo: { tipo: "novo", escolaId, patrimonio: t.patrimonio },
                        valores: { marca: t.marca, sala: ultima?.sala ?? "" },
                      })
                    }
                    className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-teal-deep hover:bg-paper-deep"
                  >
                    Nova vistoria
                  </button>
                  <button
                    type="button"
                    onClick={() => alternarHistorico(t.id)}
                    className="min-h-11 rounded-xl px-3 text-sm font-semibold text-teal-deep hover:underline"
                  >
                    {mostrarHistorico ? "Ocultar histórico" : `Histórico (${t.vistorias.length})`}
                  </button>
                </div>
              </div>

              {aberto?.onde === t.id && formulario(aberto)}

              {mostrarHistorico && (
                <ol className="flex flex-col gap-3 rounded-xl bg-paper-deep p-3">
                  {t.vistorias.map((v) => (
                    <li key={v.id} className="rounded-lg bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">
                          {v.dataVisitaFmt} · {v.sala}
                          {v.outraEscola && (
                            <span className="ml-1 font-normal text-ink-soft">(em {v.outraEscola})</span>
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setAberto({
                              onde: t.id,
                              modo: { tipo: "editar", vistoriaId: v.id, patrimonio: t.patrimonio },
                              valores: paraFormulario(t.marca, v),
                            })
                          }
                          className="min-h-11 rounded-lg px-3 font-semibold text-teal-deep hover:underline"
                        >
                          Editar
                        </button>
                      </div>
                      <p className="mt-1 text-ink-soft">
                        {CAMPOS.map((c) => `${PERGUNTAS[c].replace(/\?$/, "")}: ${rotuloOpcao(c, v[c])}`).join(" · ")}
                      </p>
                      <p className="mt-1 font-mono text-xs text-ink-soft">Registrada em {v.registro}</p>
                      {v.edicoes.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1 border-l-2 border-amber pl-3 text-xs text-ink-soft">
                          {v.edicoes.map((ed, i) => (
                            <li key={i}>
                              <span className="font-mono">
                                {ed.quando} — {ed.por}
                              </span>
                              {ed.mudancas.map((m) => (
                                <span key={m.campo} className="block">
                                  {m.campo}: {m.de} → {m.para}
                                </span>
                              ))}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>

      {itens.length === 0 && !aberto && (
        <p className="mt-8 text-ink-soft">
          Nenhuma tela registrada nesta escola ainda. Use “Registrar vistoria” na primeira visita.
        </p>
      )}
      {itens.length > 0 && filtrados.length === 0 && (
        <p className="mt-8 text-ink-soft">Nenhum patrimônio encontrado para “{busca.trim()}”.</p>
      )}
    </>
  );
}
