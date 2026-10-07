"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db/index";
import {
  chromebooks,
  escolas,
  statusHistorico,
  tablets,
  tabletStatusHistorico,
  telas,
  telaVistorias,
  telaVistoriaHistorico,
} from "@/db/schema";
import { statusValido, statusValidoTablet } from "@/lib/status";
import { validarVistoria, type DadosVistoria } from "@/lib/telas";

export async function atualizarStatus(chromebookId: number, novoStatus: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Não autenticado");
  if (!statusValido(novoStatus)) throw new Error("Status inválido");

  await db.transaction(async (tx) => {
    const [atual] = await tx
      .select({ status: chromebooks.status })
      .from(chromebooks)
      .where(eq(chromebooks.id, chromebookId));
    if (!atual) throw new Error("Chromebook não encontrado");
    if (atual.status === novoStatus) return;

    await tx
      .update(chromebooks)
      .set({ status: novoStatus, statusAtualizadoEm: new Date(), statusAtualizadoPor: email })
      .where(eq(chromebooks.id, chromebookId));

    await tx.insert(statusHistorico).values({
      chromebookId,
      statusAnterior: atual.status,
      statusNovo: novoStatus,
      alteradoPor: email,
    });
  });

  revalidatePath("/escola/[id]", "page");
  revalidatePath("/");
}

export async function atualizarStatusTablet(tabletId: number, novoStatus: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Não autenticado");
  if (!statusValidoTablet(novoStatus)) throw new Error("Status inválido");

  await db.transaction(async (tx) => {
    const [atual] = await tx
      .select({ status: tablets.status })
      .from(tablets)
      .where(eq(tablets.id, tabletId));
    if (!atual) throw new Error("Tablet não encontrado");
    if (atual.status === novoStatus) return;

    await tx
      .update(tablets)
      .set({ status: novoStatus, statusAtualizadoEm: new Date(), statusAtualizadoPor: email })
      .where(eq(tablets.id, tabletId));

    await tx.insert(tabletStatusHistorico).values({
      tabletId,
      statusAnterior: atual.status,
      statusNovo: novoStatus,
      alteradoPor: email,
    });
  });

  revalidatePath("/escola/[id]", "page");
  revalidatePath("/");
}

// Desmarcar o checkbox "localizado": volta ao status que o dispositivo tinha antes de virar
// localizado, segundo o histórico (pode ser null = não conferido). Devolve o status resultante.
export async function reverterLocalizado(chromebookId: number): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Não autenticado");

  const novo = await db.transaction(async (tx) => {
    const [atual] = await tx
      .select({ status: chromebooks.status })
      .from(chromebooks)
      .where(eq(chromebooks.id, chromebookId));
    if (!atual) throw new Error("Chromebook não encontrado");
    if (atual.status !== "localizado") return atual.status;

    const [ultima] = await tx
      .select({ statusAnterior: statusHistorico.statusAnterior })
      .from(statusHistorico)
      .where(and(eq(statusHistorico.chromebookId, chromebookId), eq(statusHistorico.statusNovo, "localizado")))
      .orderBy(desc(statusHistorico.alteradoEm), desc(statusHistorico.id))
      .limit(1);
    const anterior = ultima?.statusAnterior ?? null;

    await tx
      .update(chromebooks)
      .set({ status: anterior, statusAtualizadoEm: new Date(), statusAtualizadoPor: email })
      .where(eq(chromebooks.id, chromebookId));
    await tx.insert(statusHistorico).values({
      chromebookId,
      statusAnterior: "localizado",
      statusNovo: anterior,
      alteradoPor: email,
    });
    return anterior;
  });

  revalidatePath("/escola/[id]", "page");
  revalidatePath("/");
  return novo;
}

export async function reverterLocalizadoTablet(tabletId: number): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Não autenticado");

  const novo = await db.transaction(async (tx) => {
    const [atual] = await tx
      .select({ status: tablets.status })
      .from(tablets)
      .where(eq(tablets.id, tabletId));
    if (!atual) throw new Error("Tablet não encontrado");
    if (atual.status !== "localizado") return atual.status;

    const [ultima] = await tx
      .select({ statusAnterior: tabletStatusHistorico.statusAnterior })
      .from(tabletStatusHistorico)
      .where(and(eq(tabletStatusHistorico.tabletId, tabletId), eq(tabletStatusHistorico.statusNovo, "localizado")))
      .orderBy(desc(tabletStatusHistorico.alteradoEm), desc(tabletStatusHistorico.id))
      .limit(1);
    const anterior = ultima?.statusAnterior ?? null;

    await tx
      .update(tablets)
      .set({ status: anterior, statusAtualizadoEm: new Date(), statusAtualizadoPor: email })
      .where(eq(tablets.id, tabletId));
    await tx.insert(tabletStatusHistorico).values({
      tabletId,
      statusAnterior: "localizado",
      statusNovo: anterior,
      alteradoPor: email,
    });
    return anterior;
  });

  revalidatePath("/escola/[id]", "page");
  revalidatePath("/");
  return novo;
}

const fmtLog = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export async function adicionarObservacaoTablet(tabletId: number, texto: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Não autenticado");

  const textoLimpo = texto.trim();
  if (!textoLimpo) throw new Error("Observação vazia");

  const [atual] = await db
    .select({ observacoes: tablets.observacoes })
    .from(tablets)
    .where(eq(tablets.id, tabletId));
  if (!atual) throw new Error("Tablet não encontrado");

  const novaEntrada = `[${fmtLog.format(new Date())} — ${email}] ${textoLimpo}`;
  const observacoesAtualizadas = atual.observacoes
    ? `${atual.observacoes}\n${novaEntrada}`
    : novaEntrada;

  await db
    .update(tablets)
    .set({ observacoes: observacoesAtualizadas })
    .where(eq(tablets.id, tabletId));

  revalidatePath("/escola/[id]", "page");
}

// ---------------------------------------------------------------------------
// Telas interativas
// ---------------------------------------------------------------------------
// As actions de telas devolvem um resultado em vez de lançar erro: em produção
// o Next esconde a mensagem de exceções, e aqui a mensagem importa para o usuário.

export type ResultadoTela =
  | { ok: true }
  | { ok: false; erro: string }
  | { ok: false; outraEscola: string }; // tela já registrada em outra escola: pedir confirmação

function mensagem(e: unknown) {
  return e instanceof Error ? e.message : "Erro inesperado";
}

export async function registrarVistoriaTela(
  escolaId: number,
  patrimonioBruto: string,
  dadosBrutos: DadosVistoria,
  confirmarMudancaEscola: boolean,
): Promise<ResultadoTela> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, erro: "Sessão expirada. Entre novamente." };

  const patrimonio = patrimonioBruto.trim();
  if (!patrimonio) return { ok: false, erro: "Informe o número do patrimônio" };

  let dados: DadosVistoria;
  try {
    dados = validarVistoria(dadosBrutos);
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }

  const resultado = await db.transaction(async (tx): Promise<ResultadoTela> => {
    const [existente] = await tx.select().from(telas).where(eq(telas.patrimonio, patrimonio));

    let telaId: number;
    if (!existente) {
      const [nova] = await tx
        .insert(telas)
        .values({ patrimonio, escolaId, marca: dados.marca, criadoPor: email })
        .returning({ id: telas.id });
      telaId = nova.id;
    } else {
      if (existente.escolaId !== null && existente.escolaId !== escolaId && !confirmarMudancaEscola) {
        const [outra] = await tx
          .select({ nome: escolas.nome })
          .from(escolas)
          .where(eq(escolas.id, existente.escolaId));
        return { ok: false, outraEscola: outra?.nome ?? "outra escola" };
      }
      await tx
        .update(telas)
        .set({ escolaId, marca: dados.marca })
        .where(eq(telas.id, existente.id));
      telaId = existente.id;
    }

    await tx.insert(telaVistorias).values({
      telaId,
      escolaId,
      dataVisita: dados.dataVisita,
      sala: dados.sala,
      funcionando: dados.funcionando,
      emailInstalado: dados.emailInstalado,
      internet: dados.internet,
      atualizada: dados.atualizada,
      som: dados.som,
      apps: dados.apps,
      medidasRealizadas: dados.medidasRealizadas || null,
      anotacoes: dados.anotacoes || null,
      registradoPor: email,
    });

    return { ok: true };
  });

  if (resultado.ok) {
    revalidatePath("/escola/[id]", "page");
    revalidatePath("/");
  }
  return resultado;
}

const CAMPOS_VISTORIA = [
  "dataVisita",
  "sala",
  "funcionando",
  "emailInstalado",
  "internet",
  "atualizada",
  "som",
  "apps",
  "medidasRealizadas",
  "anotacoes",
] as const;

export async function editarVistoriaTela(
  vistoriaId: number,
  dadosBrutos: DadosVistoria,
): Promise<ResultadoTela> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, erro: "Sessão expirada. Entre novamente." };

  let dados: DadosVistoria;
  try {
    dados = validarVistoria(dadosBrutos);
  } catch (e) {
    return { ok: false, erro: mensagem(e) };
  }

  const resultado = await db.transaction(async (tx): Promise<ResultadoTela> => {
    const [atual] = await tx
      .select({ vistoria: telaVistorias, marca: telas.marca })
      .from(telaVistorias)
      .innerJoin(telas, eq(telas.id, telaVistorias.telaId))
      .where(eq(telaVistorias.id, vistoriaId));
    if (!atual) return { ok: false, erro: "Vistoria não encontrada" };

    const novos = {
      ...dados,
      medidasRealizadas: dados.medidasRealizadas || null,
      anotacoes: dados.anotacoes || null,
    };

    const alteracoes: Record<string, { de: unknown; para: unknown }> = {};
    for (const campo of CAMPOS_VISTORIA) {
      const de = atual.vistoria[campo];
      const para = novos[campo];
      if (JSON.stringify(de) !== JSON.stringify(para)) alteracoes[campo] = { de, para };
    }
    if (atual.marca !== dados.marca) alteracoes.marca = { de: atual.marca, para: dados.marca };

    if (Object.keys(alteracoes).length === 0) return { ok: true };

    const agora = new Date();
    await tx
      .update(telaVistorias)
      .set({
        dataVisita: novos.dataVisita,
        sala: novos.sala,
        funcionando: novos.funcionando,
        emailInstalado: novos.emailInstalado,
        internet: novos.internet,
        atualizada: novos.atualizada,
        som: novos.som,
        apps: novos.apps,
        medidasRealizadas: novos.medidasRealizadas,
        anotacoes: novos.anotacoes,
        atualizadoPor: email,
        atualizadoEm: agora,
      })
      .where(eq(telaVistorias.id, vistoriaId));

    if (alteracoes.marca) {
      await tx.update(telas).set({ marca: dados.marca }).where(eq(telas.id, atual.vistoria.telaId));
    }

    await tx.insert(telaVistoriaHistorico).values({
      vistoriaId,
      alteracoes,
      alteradoPor: email,
      alteradoEm: agora,
    });

    return { ok: true };
  });

  if (resultado.ok) revalidatePath("/escola/[id]", "page");
  return resultado;
}
