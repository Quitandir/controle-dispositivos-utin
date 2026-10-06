"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db/index";
import { escolas, visitas } from "@/db/schema";
import { baixarArquivoDoDrive, salvarPdfNoDrive } from "@/lib/drive";
import { enviarEmail } from "@/lib/gmail";
import { codigoRelatorio, itensComStatus, nomeArquivoRelatorio } from "@/lib/relatorio";
import { contarPendentes, montarRetrato } from "@/lib/relatorio-dados";
import { gerarPdfRelatorio } from "@/lib/relatorio-pdf";
import { formatarData } from "@/lib/telas";

// Como nas actions de telas: devolve o erro em vez de lançar, porque em produção
// o Next esconde a mensagem das exceções.
export type ResultadoRelatorio = { ok: true } | { ok: false; erro: string };

function mensagem(e: unknown) {
  return e instanceof Error ? e.message : "Erro inesperado";
}

export async function gerarRelatorio(escolaId: number, diretorNomeBruto: string): Promise<ResultadoRelatorio> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, erro: "Sessão expirada. Entre novamente." };
  const nome = session.user?.name || email;

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
    return { ok: false, erro: `Não foi possível gerar o relatório: ${mensagem(e)}` };
  }

  revalidatePath("/escola/[id]", "page");
  return { ok: true };
}

export async function enviarRelatorioParaEscola(visitaId: number): Promise<ResultadoRelatorio> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, erro: "Sessão expirada. Entre novamente." };
  const nome = session.user?.name || email;

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
  const naoLocalizados = itensComStatus(r, "nao_localizado").length;

  const texto = [
    `Prezada equipe diretiva da ${r.escola.nome},`,
    "",
    `Segue em anexo o relatório ${codigo}, referente à conferência de dispositivos realizada em ${formatarData(r.dataVisita)}, assinado pela direção e pela UTIN.`,
    ...(naoLocalizados > 0
      ? [
          "",
          `O relatório lista ${naoLocalizados} dispositivo${naoLocalizados === 1 ? "" : "s"} não localizado${naoLocalizados === 1 ? "" : "s"}. ` +
            "Solicitamos a busca na escola e, caso não sejam encontrados, o registro de boletim de ocorrência do extravio, com envio de cópia à UTIN.",
        ]
      : []),
    "",
    "Atenciosamente,",
    nome,
    "UTIN · Secretaria Municipal da Educação de Canoas",
  ].join("\n");

  try {
    // versão atual do arquivo, já com as assinaturas feitas no tablet
    const pdf = await baixarArquivoDoDrive(visita.driveFileId);
    await enviarEmail({
      remetente: email,
      para: emailEscola,
      cc: email,
      assunto: `Relatório de conferência de dispositivos — ${r.escola.nome} — ${codigo}`,
      texto,
      anexo: { nome: nomeArquivoRelatorio(r.escola.nome, codigo), conteudo: pdf },
    });
  } catch (e) {
    console.error("Falha ao enviar relatório", e);
    return { ok: false, erro: mensagem(e) };
  }

  await db
    .update(visitas)
    .set({ enviadoPara: emailEscola, enviadoPor: email, enviadoEm: new Date() })
    .where(eq(visitas.id, visitaId));

  revalidatePath("/escola/[id]", "page");
  return { ok: true };
}
