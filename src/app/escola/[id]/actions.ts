"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db/index";
import { chromebooks, statusHistorico } from "@/db/schema";
import { statusValido } from "@/lib/status";

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
      .set({
        status: novoStatus,
        statusAtualizadoEm: new Date(),
        statusAtualizadoPor: email,
      })
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