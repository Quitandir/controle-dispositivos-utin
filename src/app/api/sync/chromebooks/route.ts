import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { sincronizarChromebooks } from "@/lib/sync-chromebooks";

// Máximo do plano Hobby com Fluid Compute (300s). Com 60s o cron era encerrado depois de
// ~3.900 dos ~11.600 aparelhos, e o resto ficava sem atualizar — sem nenhum erro visível.
export const maxDuration = 300;

// Se a sincronização se aproximar do limite, avisa pelo Sentry antes que volte a ser cortada.
const ALERTA_SEGUNDOS = 200;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const inicio = Date.now();
  const resultado = await sincronizarChromebooks();
  const segundos = Math.round((Date.now() - inicio) / 1000);

  if (segundos > ALERTA_SEGUNDOS) {
    Sentry.captureMessage(`Sincronização de Chromebooks levou ${segundos}s (limite: ${maxDuration}s)`, {
      level: "warning",
      extra: resultado,
    });
  }

  return NextResponse.json({ ...resultado, segundos });
}
