"use server";

import * as Sentry from "@sentry/nextjs";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/index";
import { escolas, visitas } from "@/db/schema";
import { baixarArquivoDoDrive, salvarPdfNoDrive } from "@/lib/drive";
import { enviarEmail } from "@/lib/gmail";
import { codigoRelatorio, htmlEmailRelatorio, nomeArquivoRelatorio, textoEmailRelatorio } from "@/lib/relatorio";
import { contarPendentes, montarRetrato } from "@/lib/relatorio-dados";
import { gerarPdfRelatorio } from "@/lib/relatorio-pdf";
import { exigirUsuario, type UsuarioSessao } from "@/lib/usuario";

const EMAIL_TIME = "time.google@canoasedu.rs.gov.br";

// Como nas actions de telas: devolve o erro em vez de lançar, porque em produção
// o Next esconde a mensagem das exceções.
export type ResultadoRelatorio = { ok: true } | { ok: false; erro: string };

function mensagem(e: unknown) {
  return e instanceof Error ? e.message : "Erro inesperado";
}

export async function gerarRelatorio(escolaId: number, diretorNomeBruto: string): Promise<ResultadoRelatorio> {
  let usuario: UsuarioSessao;
  try {
    usuario = await exigirUsuario();
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }
  const { email, nome } = usuario;

  const diretorNome = diretorNomeBruto.trim();
  if (!diretorNome) return { ok: false, erro: "Informe o nome do(a) diretor(a)" };

  const pendentes = await contarPendentes(escolaId);
  if (pendentes.chromebooks + pendentes.tablets > 0) {
    return { ok: false, erro: "Ainda há dispositivos sem status. Confira todos antes de gerar o relatório." };
  }

  let visitaId: number | null = null;
  try {
    const retrato = await montarRetrato(escolaId);
    const ano = Number(retrato.dataVisita.slice(0, 4));

    // Reserva número e versão. A mesma escola no mesmo ano mantém o número e sobe a versão.
    const visita = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('visitas'))`);
      const [anterior] = await tx
        .select({ numero: visitas.numero, versao: sql<number>`max(${visitas.versao})::int` })
        .from(visitas)
        .where(and(eq(visitas.escolaId, escolaId), eq(visitas.ano, ano)))
        .groupBy(visitas.numero);
      let numero = anterior?.numero;
      if (!numero) {
        const [{ ultimo }] = await tx
          .select({ ultimo: sql<number>`coalesce(max(${visitas.numero}), 0)::int` })
          .from(visitas)
          .where(eq(visitas.ano, ano));
        numero = ultimo + 1;
      }
      const [nova] = await tx
        .insert(visitas)
        .values({
          escolaId,
          ano,
          numero,
          versao: (anterior?.versao ?? 0) + 1,
          retrato,
          diretorNome,
          geradoPor: email,
          geradoPorNome: nome,
        })
        .returning();
      await tx.update(escolas).set({ diretorNome }).where(eq(escolas.id, escolaId));
      return nova;
    });
    visitaId = visita.id;

    const codigo = codigoRelatorio(visita.ano, visita.numero, visita.versao);
    const pdf = await gerarPdfRelatorio(retrato, {
      codigo,
      diretorNome,
      responsavelNome: nome,
      responsavelEmail: email,
    });
    const arquivo = await salvarPdfNoDrive(nomeArquivoRelatorio(retrato.escola.nome, codigo), pdf, ano);

    await db
      .update(visitas)
      .set({ driveFileId: arquivo.id, driveUrl: arquivo.url })
      .where(eq(visitas.id, visita.id));
  } catch (e) {
    // sem arquivo no Drive o relatório não serve: desfaz a reserva do número
    if (visitaId) await db.delete(visitas).where(eq(visitas.id, visitaId));
    console.error("Falha ao gerar relatório", e);
    Sentry.captureException(e, { tags: { area: "relatorio", etapa: "gerar" }, extra: { escolaId } });
    return { ok: false, erro: `Não foi possível gerar o relatório: ${mensagem(e)}` };
  }

  revalidatePath("/escola/[id]", "page");
  return { ok: true };
}

export async function enviarRelatorioParaEscola(visitaId: number): Promise<ResultadoRelatorio> {
  let usuario: UsuarioSessao;
  try {
    usuario = await exigirUsuario();
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }
  const { email, nome } = usuario;

  const [linha] = await db
    .select({ visita: visitas, emailEscola: escolas.email })
    .from(visitas)
    .innerJoin(escolas, eq(escolas.id, visitas.escolaId))
    .where(eq(visitas.id, visitaId));
  if (!linha) return { ok: false, erro: "Relatório não encontrado" };
  const { visita, emailEscola } = linha;
  if (!emailEscola) return { ok: false, erro: "Esta escola não tem e-mail cadastrado" };
  if (!visita.driveFileId) return { ok: false, erro: "O relatório não tem arquivo no Drive" };

  const codigo = codigoRelatorio(visita.ano, visita.numero, visita.versao);
  const r = visita.retrato;

  try {
    // versão atual do arquivo, já com as assinaturas feitas no tablet
    const pdf = await baixarArquivoDoDrive(visita.driveFileId);
    await enviarEmail({
      remetente: email,
      para: emailEscola,
      cc: email,
      cco: EMAIL_TIME,
      responderPara: EMAIL_TIME,
      assunto: `Relatório de conferência de dispositivos — ${r.escola.nome} — ${codigo}`,
      texto: textoEmailRelatorio(r, codigo, nome),
      html: htmlEmailRelatorio(r, codigo, nome),
      anexo: { nome: nomeArquivoRelatorio(r.escola.nome, codigo), conteudo: pdf },
    });
  } catch (e) {
    console.error("Falha ao enviar relatório", e);
    Sentry.captureException(e, { tags: { area: "relatorio", etapa: "enviar" }, extra: { visitaId } });
    return { ok: false, erro: mensagem(e) };
  }

  await db
    .update(visitas)
    .set({ enviadoPara: emailEscola, enviadoPor: email, enviadoEm: new Date() })
    .where(eq(visitas.id, visitaId));

  revalidatePath("/escola/[id]", "page");
  return { ok: true };
}
