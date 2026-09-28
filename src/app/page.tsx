import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/index";
import { escolas, chromebooks } from "@/db/schema";
import Header from "@/app/components/Header";

export const dynamic = "force-dynamic";

export default async function Home() {
  const lista = await db
    .select({
      id: escolas.id,
      nome: escolas.nome,
      total: sql<number>`count(${chromebooks.id})`.mapWith(Number),
      conferidos: sql<number>`count(${chromebooks.status})`.mapWith(Number),
    })
    .from(escolas)
    .leftJoin(chromebooks, eq(chromebooks.escolaId, escolas.id))
    .groupBy(escolas.id, escolas.nome)
    .orderBy(escolas.nome);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <span className="font-mono text-xs uppercase tracking-widest text-terracotta">
          Conferência de Chromebooks
        </span>
        <h1 className="mt-2 font-display text-3xl font-semibold text-teal-deep sm:text-4xl">
          Escolha a escola
        </h1>

        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((e) => {
            const pct = e.total > 0 ? Math.round((e.conferidos / e.total) * 100) : 0;
            return (
              <li key={e.id}>
                <Link
                  href={`/escola/${e.id}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <h2 className="font-display text-lg font-semibold leading-snug text-teal-deep">
                    {e.nome}
                  </h2>
                  <div className="mt-auto">
                    <div className="h-2 overflow-hidden rounded-full bg-paper-deep">
                      <div
                        className="h-full rounded-full bg-teal"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-2 font-mono text-xs text-ink-soft">
                      {e.conferidos} de {e.total} conferidos
                    </p>
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