import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { chromebookNaConferencia } from "@/db/filtros";
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
import { codigoRelatorio, hojeBrasilia } from "@/lib/relatorio";
import { temStatusConferencia } from "@/lib/conferencia";
import AtualizarConsole from "../../components/AtualizarConsole";
import SeletorConferencia from "../../components/SeletorConferencia";
import PainelRelatorio from "../../components/PainelRelatorio";
import Header from "../../components/Header";
import ListaChromebooks from "../../components/ListaChromebooks";
import ListaTablets from "../../components/ListaTablets";
import ListaTelas, { type ItemTela } from "../../components/ListaTelas";
import AbasDispositivos, { type Aba } from "../../components/AbasDispositivos";
import ObservacoesVisita from "../../components/ObservacoesVisita";
import { CATEGORIA_EXTRAVIADOS, grupoDaEscola } from "@/lib/grupos-escolas";
import ListaExtraviados from "../../components/ListaExtraviados";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; foco?: string }>;
}) {
  const { id } = await params;
  // vindo da busca da home: abre nesta aba, mostrando só este dispositivo
  const { aba, foco } = await searchParams;
  const focoId = foco && /^\d+$/.test(foco) ? Number(foco) : null;
  const focoNa = (chave: string) => (aba === chave ? focoId : null);
  const escolaId = Number(id);
  if (!Number.isInteger(escolaId)) notFound();

  const [escola] = await db.select().from(escolas).where(eq(escolas.id, escolaId));
  if (!escola) notFound();

  const temTelas = CATEGORIAS_COM_TELAS.includes(escola.categoria ?? "");

  const [listaChromebooks, listaTablets, imeisDuplicadosRaw, itensTelas, listaVisitas, todasEscolas] = await Promise.all([
    db
      .select()
      .from(chromebooks)
      .where(and(eq(chromebooks.escolaId, escolaId), chromebookNaConferencia()))
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
    // destinos possíveis de uma transferência de tablet
    db
      .select({ id: escolas.id, nome: escolas.nome, categoria: escolas.categoria })
      .from(escolas)
      .where(sql`${escolas.categoria} is distinct from ${CATEGORIA_EXTRAVIADOS}`)
      .orderBy(asc(escolas.nome)),
  ]);

  const botaoConsole = escola.orgUnitPath ? (
    <AtualizarConsole
      escolaId={escolaId}
      atualizadoEmFmt={escola.consoleAtualizadoEm ? fmt.format(escola.consoleAtualizadoEm) : null}
    />
  ) : null;

  const linkVoltar = (
    <Link href={`/?grupo=${grupoDaEscola(escola.categoria)}`} className="text-sm font-semibold text-teal-deep hover:underline">
      ← Voltar
    </Link>
  );

  // Card dos extraviados: só a lista, sem status, abas nem relatório
  if (escola.categoria === CATEGORIA_EXTRAVIADOS) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-8">
          {linkVoltar}
          <h1 className="mt-3 font-display text-2xl font-semibold text-teal-deep sm:text-4xl">{escola.nome}</h1>
          <p className="mt-1 font-mono text-xs text-ink-soft">
            {listaChromebooks.length} na UO de extraviados do Admin Console
          </p>
          <p className="mt-3 max-w-2xl text-sm text-ink-soft">
            Busque o nome da escola visitada para ver os extraviados ligados a ela. Ao localizar um aparelho,
            mova-o para a UO da escola no Admin Console e clique no botão de atualizar do Console (⟳) na
            página da escola: ele passa para a lista dela e sai desta.
          </p>
          {botaoConsole && <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">{botaoConsole}</div>}
          <ListaExtraviados
            focoInicial={focoNa("chromebooks")}
            itens={listaChromebooks.map((c) => ({
              id: c.id,
              assetId: c.assetId,
              model: c.model,
              notes: c.notes,
              ultimoSync: c.ultimoSyncGoogle ? fmt.format(c.ultimoSyncGoogle) : null,
            }))}
          />
        </main>
      </>
    );
  }

  const imeisDuplicados = imeisDuplicadosRaw.rows.map((r) => r.imei);
  const anoAtual = Number(hojeBrasilia().slice(0, 4));

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
      conteudo: <ListaChromebooks itens={itensChromebooks} focoInicial={focoNa("chromebooks")} />,
    });
  }
  // sempre aparece, mesmo sem tablets: é por ela que a escola recebe um tablet transferido
  abas.push({
    chave: "tablets",
    rotulo: "Tablets",
    conteudo: (
      <ListaTablets
        escolaId={escolaId}
        itens={itensTablets}
        imeisDuplicados={imeisDuplicados}
        focoInicial={focoNa("tablets")}
        escolasDestino={todasEscolas.map((e) => ({ id: e.id, nome: e.nome, grupo: grupoDaEscola(e.categoria) }))}
      />
    ),
  });
  if (temTelas) {
    abas.push({
      chave: "telas",
      rotulo: "Telas interativas",
      conteudo: <ListaTelas escolaId={escolaId} itens={itensTelas} focoInicial={focoNa("telas")} />,
    });
  }
  // só onde há o que conferir (a aba Tablets agora existe em toda escola, mesmo vazia)
  const temOQueConferir = listaChromebooks.length > 0 || listaTablets.length > 0 || temTelas;
  if (temOQueConferir) {
    const ultimaVisita = listaVisitas[0];
    abas.push({
      chave: "observacoes",
      rotulo: "Observações",
      conteudo: (
        <ObservacoesVisita
          escolaId={escolaId}
          salvoInicial={
            escola.observacoesAtualizadasEm
              ? {
                  texto: escola.observacoes ?? "",
                  em: escola.observacoesAtualizadasEm.toISOString(),
                  emFmt: fmt.format(escola.observacoesAtualizadasEm),
                  por: escola.observacoesAtualizadasPor ?? "",
                }
              : null
          }
          ultimoRelatorio={
            ultimaVisita
              ? {
                  codigo: codigoRelatorio(ultimaVisita.ano, ultimaVisita.numero, ultimaVisita.versao),
                  geradoEm: ultimaVisita.geradoEm.toISOString(),
                }
              : null
          }
        />
      ),
    });
  }
  // última aba: contador de pendentes, gerar relatório, abrir no Drive e enviar à escola
  // (mesma regra de antes: só com algum dispositivo; ou se já houver relatório, para não escondê-lo)
  if (listaChromebooks.length > 0 || listaTablets.length > 0 || itensTelas.length > 0 || listaVisitas.length > 0) {
    abas.push({
      chave: "relatorios",
      rotulo: "Relatórios",
      conteudo: (
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
      ),
    });
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {linkVoltar}
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

        {/* status da conferência com o botão do Console ao lado; sem status (CEIA, setores), só o botão */}
        {temStatusConferencia(escola.categoria) ? (
          <SeletorConferencia
            escolaId={escolaId}
            valorInicial={escola.statusConferencia}
            alteracaoInicial={
              escola.statusConferenciaEm
                ? `${fmt.format(escola.statusConferenciaEm)} por ${escola.statusConferenciaPor}`
                : null
            }
            podeFinalizar={listaVisitas.some((v) => v.ano === anoAtual && v.enviadoEm)}
            acao={botaoConsole}
          />
        ) : (
          botaoConsole && <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">{botaoConsole}</div>
        )}

        <AbasDispositivos abas={abas} inicial={aba} />
      </main>
    </>
  );
}
