import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db/index";
import { escolas, chromebooks, tablets, telas } from "@/db/schema";
import Header from "./components/Header";

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

export default async function Home() {
  const [todasEscolas, statsChromebooks, statsTablets, statsTelas] = await Promise.all([
    db.select().from(escolas).orderBy(escolas.nome),
    db
      .select({
        escolaId: chromebooks.escolaId,
        total: sql<number>`count(*)`.mapWith(Number),
        conferidos: sql<number>`count(${chromebooks.status})`.mapWith(Number),
      })
      .from(chromebooks)
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

        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {todasEscolas.map((e) => {
            const cb = chromebooksPorEscola.get(e.id);
            const tb = tabletsPorEscola.get(e.id);
            const tl = telasPorEscola.get(e.id);
            return (
              <li key={e.id}>
                <Link
                  href={`/escola/${e.id}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
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

                  <div className="mt-auto flex flex-col gap-3">
                    {cb && (
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