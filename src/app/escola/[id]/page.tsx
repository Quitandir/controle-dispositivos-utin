import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/index";
import {
  escolas,
  chromebooks,
  tablets,
  telas,
  telaVistorias,
  telaVistoriaHistorico,
  visitas,
} from "@/db/schema";
import { CATEGORIAS_COM_TELAS, descreverAlteracoes, formatarData } from "@/lib/telas";
import { codigoRelatorio } from "@/lib/relatorio";
import PainelRelatorio from "../../components/PainelRelatorio";
import Header from "../../components/Header";
import ListaChromebooks from "../../components/ListaChromebooks";
import ListaTablets from "../../components/ListaTablets";
import ListaTelas, { type ItemTela } from "../../components/ListaTelas";
import AbasDispositivos, { type Aba } from "../../components/AbasDispositivos";

export const dynamic = "force-dynamic";
// gerar o PDF e salvar no Drive pode levar alguns segundos em escolas grandes
export const maxDuration = 60;

const fmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

async function carregarTelas(escolaId: number): Promise<ItemTela[]> {
  const listaTelas = await db
    .select()
    .from(telas)
    .where(eq(telas.escolaId, escolaId))
    .orderBy(asc(telas.patrimonio));
  if (listaTelas.length === 0) return [];

  // todas as vistorias dessas telas, inclusive as feitas quando estavam em outra escola
  const vistorias = await db
    .select({ v: telaVistorias, nomeEscola: escolas.nome })
    .from(telaVistorias)
    .leftJoin(escolas, eq(escolas.id, telaVistorias.escolaId))
    .where(
      inArray(
        telaVistorias.telaId,
        listaTelas.map((t) => t.id),
      ),
    )
    .orderBy(desc(telaVistorias.dataVisita), desc(telaVistorias.id));

  const historico = vistorias.length
    ? await db
        .select()
        .from(telaVistoriaHistorico)
        .where(
          inArray(
            telaVistoriaHistorico.vistoriaId,
            vistorias.map((r) => r.v.id),
          ),
        )
        .orderBy(asc(telaVistoriaHistorico.alteradoEm))
    : [];

  return listaTelas.map((t) => {
    const daTela = vistorias.filter((r) => r.v.telaId === t.id);

    // última alteração = registro ou edição mais recente entre todas as vistorias da tela
    let ultima: { em: Date; por: string } | null = null;
    for (const { v } of daTela) {
      const candidatos = [{ em: v.registradoEm, por: v.registradoPor }];
      if (v.atualizadoEm && v.atualizadoPor) candidatos.push({ em: v.atualizadoEm, por: v.atualizadoPor });
      for (const c of candidatos) if (!ultima || c.em > ultima.em) ultima = c;
    }

    return {
      id: t.id,
      patrimonio: t.patrimonio,
      marca: t.marca,
      ultimaAlteracao: ultima ? `${fmt.format(ultima.em)} por ${ultima.por}` : null,
      vistorias: daTela.map(({ v, nomeEscola }) => ({
        id: v.id,
        dataVisita: v.dataVisita,
        dataVisitaFmt: formatarData(v.dataVisita),
        sala: v.sala,
        funcionando: v.funcionando,
        emailInstalado: v.emailInstalado,
        internet: v.internet,
        atualizada: v.atualizada,
        som: v.som,
        apps: v.apps,
        medidasRealizadas: v.medidasRealizadas,
        anotacoes: v.anotacoes,
        registro: `${fmt.format(v.registradoEm)} por ${v.registradoPor}`,
        outraEscola: v.escolaId !== escolaId ? nomeEscola : null,
        edicoes: historico
          .filter((h) => h.vistoriaId === v.id)
          .map((h) => ({
            quando: fmt.format(h.alteradoEm),
            por: h.alteradoPor,
            mudancas: descreverAlteracoes(h.alteracoes),
          })),
      })),
    };
  });
}

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

  const temTelas = CATEGORIAS_COM_TELAS.includes(escola.categoria ?? "");

  const [listaChromebooks, listaTablets, imeisDuplicadosRaw, itensTelas, listaVisitas] = await Promise.all([
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
    temTelas ? carregarTelas(escolaId) : Promise.resolve([]),
    db
      .select({
        id: visitas.id,
        ano: visitas.ano,
        numero: visitas.numero,
        versao: visitas.versao,
        geradoEm: visitas.geradoEm,
        geradoPor: visitas.geradoPor,
        driveUrl: visitas.driveUrl,
        enviadoEm: visitas.enviadoEm,
        enviadoPor: visitas.enviadoPor,
      })
      .from(visitas)
      .where(eq(visitas.escolaId, escolaId))
      .orderBy(desc(visitas.geradoEm)),
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

  const abas: Aba[] = [];
  if (listaChromebooks.length > 0) {
    abas.push({
      chave: "chromebooks",
      rotulo: "Chromebooks",
      conteudo: <ListaChromebooks itens={itensChromebooks} />,
    });
  }
  if (listaTablets.length > 0) {
    abas.push({
      chave: "tablets",
      rotulo: "Tablets",
      conteudo: <ListaTablets itens={itensTablets} imeisDuplicados={imeisDuplicados} />,
    });
  }
  if (temTelas) {
    abas.push({
      chave: "telas",
      rotulo: "Telas interativas",
      conteudo: <ListaTelas escolaId={escolaId} itens={itensTelas} />,
    });
  }

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
          {temTelas && (
            <span>
              Telas: {itensTelas.length} {itensTelas.length === 1 ? "registrada" : "registradas"}
            </span>
          )}
        </div>

        {(listaChromebooks.length > 0 || listaTablets.length > 0 || itensTelas.length > 0) && (
          <PainelRelatorio
            escolaId={escolaId}
            pendentesChromebooks={listaChromebooks.length - conferidosChromebooks}
            pendentesTablets={listaTablets.length - conferidosTablets}
            diretorNomeInicial={escola.diretorNome ?? ""}
            emailEscola={escola.email}
            visitas={listaVisitas.map((v) => ({
              id: v.id,
              codigo: codigoRelatorio(v.ano, v.numero, v.versao),
              geradoEm: fmt.format(v.geradoEm),
              geradoPor: v.geradoPor,
              driveUrl: v.driveUrl,
              enviado: v.enviadoEm ? `${fmt.format(v.enviadoEm)} por ${v.enviadoPor}` : null,
            }))}
          />
        )}

        <AbasDispositivos abas={abas} />
      </main>
    </>
  );
}
