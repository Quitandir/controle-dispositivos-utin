"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db/index";
import { chromebooks, statusHistorico, tablets, tabletStatusHistorico } from "@/db/schema";
import { statusValido, statusValidoTablet } from "@/lib/status";

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