import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/index";
import { escolas, chromebooks, tablets } from "@/db/schema";
import Header from "../../components/Header";
import ListaChromebooks from "../../components/ListaChromebooks";
import ListaTablets from "../../components/ListaTablets";
import AbasDispositivos from "../../components/AbasDispositivos";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function PaginaEscola({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const escolaId = Number(id);
  if (!Number.isInteger(escolaId)) notFound();

  const [escola] = await db.select().from(escolas).where(eq(escolas.id, escolaId));
  if (!escola) notFound();

  const [listaChromebooks, listaTablets, imeisDuplicadosRaw] = await Promise.all([
    db
      .select()
      .from(chromebooks)
      .where(eq(chromebooks.escolaId, escolaId))
      .orderBy(asc(sql`coalesce(${chromebooks.assetId}, '')`), asc(chromebooks.id)),
    db
      .select()
      .from(tablets)
      .where(eq(tablets.escolaId, escolaId))
      .orderBy(asc(tablets.patrimonio)),
    db.execute<{ imei: string }>(
      sql`select imei from tablets where imei is not null group by imei having count(*) > 1`,
    ),
  ]);

  const imeisDuplicados = imeisDuplicadosRaw.rows.map((r) => r.imei);

  const conferidosChromebooks = listaChromebooks.filter((c) => c.status).length;
  const conferidosTablets = listaTablets.filter((t) => t.status).length;

  const itensChromebooks = listaChromebooks.map((c) => ({
    id: c.id,
    assetId: c.assetId,
    model: c.model,
    notes: c.notes,
    status: c.status,
    atualizadoEm: c.statusAtualizadoEm ? fmt.format(c.statusAtualizadoEm) : null,
  }));

  const itensTablets = listaTablets.map((t) => ({
    id: t.id,
    patrimonio: t.patrimonio,
    imei: t.imei,
    status: t.status,
    observacoes: t.observacoes,
    atualizadoEm: t.statusAtualizadoEm ? fmt.format(t.statusAtualizadoEm) : null,
  }));

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/" className="text-sm font-semibold text-teal-deep hover:underline">
          ← Todas as escolas
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold text-teal-deep sm:text-4xl">
          {escola.nome}
        </h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-soft">
          {listaChromebooks.length > 0 && (
            <span>
              Chromebooks: {conferidosChromebooks} de {listaChromebooks.length} conferidos
            </span>
          )}
          {listaTablets.length > 0 && (
            <span>
              Tablets: {conferidosTablets} de {listaTablets.length} conferidos
            </span>
          )}
        </div>

        <AbasDispositivos
          temChromebooks={listaChromebooks.length > 0}
          totalTablets={listaTablets.length}
          conteudoChromebooks={<ListaChromebooks itens={itensChromebooks} />}
          conteudoTablets={<ListaTablets itens={itensTablets} imeisDuplicados={imeisDuplicados} />}
        />
      </main>
    </>
  );
}
