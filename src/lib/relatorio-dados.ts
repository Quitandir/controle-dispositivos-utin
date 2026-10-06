import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/index";
import { chromebooks, escolas, tablets, telas, telaVistorias } from "@/db/schema";
import { hojeBrasilia, type RetratoVisita } from "./relatorio";

// Quantos dispositivos da escola ainda estão sem status. O relatório só pode
// ser gerado quando os dois chegam a zero.
export async function contarPendentes(escolaId: number) {
  const [c] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chromebooks)
    .where(sql`${chromebooks.escolaId} = ${escolaId} and ${chromebooks.status} is null`);
  const [t] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tablets)
    .where(sql`${tablets.escolaId} = ${escolaId} and ${tablets.status} is null`);
  return { chromebooks: c.n, tablets: t.n };
}

export async function montarRetrato(escolaId: number): Promise<RetratoVisita> {
  const [escola] = await db.select().from(escolas).where(eq(escolas.id, escolaId));
  if (!escola) throw new Error("Escola não encontrada");

  const [listaChromebooks, listaTablets, listaTelas] = await Promise.all([
    db
      .select()
      .from(chromebooks)
      .where(eq(chromebooks.escolaId, escolaId))
      .orderBy(asc(sql`coalesce(${chromebooks.assetId}, '')`), asc(chromebooks.serialNumber)),
    db.select().from(tablets).where(eq(tablets.escolaId, escolaId)).orderBy(asc(tablets.patrimonio)),
    db.select().from(telas).where(eq(telas.escolaId, escolaId)).orderBy(asc(telas.patrimonio)),
  ]);

  // última vistoria de cada tela
  const vistorias = listaTelas.length
    ? await db
        .select()
        .from(telaVistorias)
        .where(
          inArray(
            telaVistorias.telaId,
            listaTelas.map((t) => t.id),
          ),
        )
        .orderBy(desc(telaVistorias.dataVisita), desc(telaVistorias.id))
    : [];
  const ultimaPorTela = new Map<number, (typeof vistorias)[number]>();
  for (const v of vistorias) if (!ultimaPorTela.has(v.telaId)) ultimaPorTela.set(v.telaId, v);

  return {
    escola: { nome: escola.nome, categoria: escola.categoria },
    dataVisita: hojeBrasilia(),
    chromebooks: listaChromebooks.map((c) => ({
      patrimonio: c.assetId,
      serie: c.serialNumber,
      modelo: c.model,
      status: c.status ?? "",
      ultimoSyncGoogle: c.ultimoSyncGoogle?.toISOString() ?? null,
      ultimoUsuario: c.ultimoUsuario,
    })),
    tablets: listaTablets.map((t) => ({ patrimonio: t.patrimonio, imei: t.imei, status: t.status ?? "" })),
    telas: listaTelas.flatMap((t) => {
      const v = ultimaPorTela.get(t.id);
      if (!v) return [];
      return [
        {
          patrimonio: t.patrimonio,
          marca: t.marca,
          sala: v.sala,
          dataVistoria: v.dataVisita,
          funcionando: v.funcionando,
          internet: v.internet,
          som: v.som,
          atualizada: v.atualizada,
          emailInstalado: v.emailInstalado,
        },
      ];
    }),
  };
}
