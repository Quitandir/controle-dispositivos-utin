import Link from "next/link";
import { sql } from "drizzle-orm";
import { chromebookNaConferencia } from "@/db/filtros";
import { db } from "@/db/index";
import { escolas, chromebooks, tablets, telas } from "@/db/schema";
import Header from "./components/Header";
import FiltroConferencia from "./components/FiltroConferencia";
import { CATEGORIA_EXTRAVIADOS, GRUPOS_ESCOLA, grupoDaEscola } from "@/lib/grupos-escolas";
import {
  COR_CONFERENCIA,
  FILTRO_CONFERENCIA_TODAS,
  STATUS_CONFERENCIA,
  rotuloConferencia,
  statusConferenciaDe,
  statusConferenciaValido,
  temStatusConferencia,
  type StatusConferencia,
} from "@/lib/conferencia";


export const dynamic = "force-dynamic";

function Barra({ conferidos, total }: { conferidos: number; total: number }) {
  const pct = total > 0 ? Math.round((conferidos / total) * 100) : 0;
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-paper-deep">
        <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 font-mono text-xs text-ink-soft">
        {conferidos} de {total} conferidos
      </p>
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string; conferencia?: string }>;
}) {
  const { grupo, conferencia } = await searchParams;
  // endereço sem grupo, ou com um valor desconhecido, abre em EMEF
  const grupoAtivo = GRUPOS_ESCOLA.find((g) => g.chave === grupo)?.chave ?? "emef";
  const filtroConferencia =
    conferencia && statusConferenciaValido(conferencia) ? conferencia : FILTRO_CONFERENCIA_TODAS;
  const [todasEscolas, statsChromebooks, statsTablets, statsTelas] = await Promise.all([
    db.select().from(escolas).orderBy(escolas.nome),
    db
      .select({
        escolaId: chromebooks.escolaId,
        total: sql<number>`count(*)`.mapWith(Number),
        conferidos: sql<number>`count(${chromebooks.status})`.mapWith(Number),
      })
      .from(chromebooks)
      .where(chromebookNaConferencia())
      .groupBy(chromebooks.escolaId),
    db
      .select({
        escolaId: tablets.escolaId,
        total: sql<number>`count(*)`.mapWith(Number),
        conferidos: sql<number>`count(${tablets.status})`.mapWith(Number),
      })
      .from(tablets)
      .groupBy(tablets.escolaId),
    db
      .select({
        escolaId: telas.escolaId,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(telas)
      .groupBy(telas.escolaId),
  ]);

  const chromebooksPorEscola = new Map(
    statsChromebooks.filter((s) => s.escolaId !== null).map((s) => [s.escolaId as number, s]),
  );
  const tabletsPorEscola = new Map(
    statsTablets.filter((s) => s.escolaId !== null).map((s) => [s.escolaId as number, s]),
  );
  const telasPorEscola = new Map(
    statsTelas.filter((s) => s.escolaId !== null).map((s) => [s.escolaId as number, s.total]),
  );
  const doGrupo = (chave: string) => todasEscolas.filter((e) => grupoDaEscola(e.categoria) === chave);
  const totalDoGrupo = (chave: string) => doGrupo(chave).length;

  // status da conferência: só nas escolas (EMEF e EMEI)
  const comStatus = (chave: string) => doGrupo(chave).filter((e) => temStatusConferencia(e.categoria));
  const finalizadasDoGrupo = (chave: string) =>
    comStatus(chave).filter((e) => statusConferenciaDe(e.statusConferencia) === "finalizado").length;
  const contagemConferencia = Object.fromEntries(
    STATUS_CONFERENCIA.map((o) => [
      o.valor,
      comStatus(grupoAtivo).filter((e) => statusConferenciaDe(e.statusConferencia) === o.valor).length,
    ]),
  ) as Record<StatusConferencia, number>;
  const grupoTemStatus = comStatus(grupoAtivo).length > 0;

  const escolasDoGrupo = doGrupo(grupoAtivo).filter(
    (e) =>
      filtroConferencia === FILTRO_CONFERENCIA_TODAS ||
      (temStatusConferencia(e.categoria) && statusConferenciaDe(e.statusConferencia) === filtroConferencia),
  );

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <span className="font-mono text-xs uppercase tracking-widest text-terracotta">
          Conferência de dispositivos
        </span>
        <h1 className="mt-2 font-display text-3xl font-semibold text-teal-deep sm:text-4xl">
          Escolha a escola
        </h1>
        <nav className="mt-6 inline-flex flex-wrap rounded-full border border-line bg-white p-1">
          {GRUPOS_ESCOLA.map((g) => (
            <Link
              key={g.chave}
              href={`/?grupo=${g.chave}`}
              aria-current={g.chave === grupoAtivo ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${g.chave === grupoAtivo ? "bg-teal text-white" : "text-ink-soft"
                }`}
            >
              {g.rotulo} ({totalDoGrupo(g.chave)})
              {comStatus(g.chave).length > 0 && (
                <span className="ml-1.5 font-mono text-xs font-normal opacity-80">
                  · {finalizadasDoGrupo(g.chave)}/{comStatus(g.chave).length} finalizadas
                </span>
              )}
            </Link>
          ))}
        </nav>

        {grupoTemStatus && (
          <div className="mt-4">
            <FiltroConferencia
              grupo={grupoAtivo}
              valor={filtroConferencia}
              contagem={contagemConferencia}
              total={comStatus(grupoAtivo).length}
            />
          </div>
        )}

        {escolasDoGrupo.length === 0 && (
          <p className="mt-8 text-ink-soft">Nenhuma escola com esse status da conferência.</p>
        )}

        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {escolasDoGrupo.map((e) => {
            const cb = chromebooksPorEscola.get(e.id);
            const tb = tabletsPorEscola.get(e.id);
            const tl = telasPorEscola.get(e.id);
            const statusConf = temStatusConferencia(e.categoria) ? statusConferenciaDe(e.statusConferencia) : null;
            return (
              <li key={e.id}>
                <Link
                  href={`/escola/${e.id}`}
                  className={`flex h-full flex-col gap-3 rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${
                    statusConf ? COR_CONFERENCIA[statusConf].card : "border-line bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-lg font-semibold leading-snug text-teal-deep">
                      {e.nome}
                    </h2>
                    {e.categoria && (
                      <span className="shrink-0 rounded-full bg-paper-deep px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">
                        {e.categoria}
                      </span>
                    )}
                  </div>
                  {statusConf && (
                    <span
                      className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR_CONFERENCIA[statusConf].etiqueta}`}
                    >
                      {rotuloConferencia(statusConf)}
                    </span>
                  )}

                  <div className="mt-auto flex flex-col gap-3">
                    {cb && e.categoria === CATEGORIA_EXTRAVIADOS && (
                      <p className="font-mono text-xs text-ink-soft">
                        <span className="uppercase tracking-widest">Chromebooks</span> · {cb.total}{" "}
                        {cb.total === 1 ? "extraviado" : "extraviados"}
                      </p>
                    )}
                    {cb && e.categoria !== CATEGORIA_EXTRAVIADOS && (
                      <div>
                        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">
                          Chromebooks
                        </p>
                        <Barra conferidos={cb.conferidos} total={cb.total} />
                      </div>
                    )}
                    {tb && (
                      <div>
                        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">
                          Tablets
                        </p>
                        <Barra conferidos={tb.conferidos} total={tb.total} />
                      </div>
                    )}
                    {tl && (
                      <p className="font-mono text-xs text-ink-soft">
                        <span className="uppercase tracking-widest">Telas</span> · {tl}{" "}
                        {tl === 1 ? "registrada" : "registradas"}
                      </p>
                    )}
                    {!cb && !tb && !tl && (
                      <p className="font-mono text-xs italic text-ink-soft">
                        Nenhum dispositivo registrado ainda
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}