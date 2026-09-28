import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/index";
import { escolas, chromebooks } from "@/db/schema";
import Header from "@/app/components/Header";
import ListaChromebooks from "@/app/components/ListaChromebooks";

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

  const lista = await db
    .select()
    .from(chromebooks)
    .where(eq(chromebooks.escolaId, escolaId))
    .orderBy(asc(sql`coalesce(${chromebooks.assetId}, '')`), asc(chromebooks.id));

  const conferidos = lista.filter((c) => c.status).length;

  const itens = lista.map((c) => ({
    id: c.id,
    assetId: c.assetId,
    model: c.model,
    notes: c.notes,
    status: c.status,
    atualizadoEm: c.statusAtualizadoEm ? fmt.format(c.statusAtualizadoEm) : null,
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
        <p className="mt-1 font-mono text-xs text-ink-soft">
          {conferidos} de {lista.length} conferidos
        </p>

        <ListaChromebooks itens={itens} />
      </main>
    </>
  );
}