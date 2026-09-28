import { NextResponse } from "next/server";
import { sincronizarChromebooks } from "@/lib/sync-chromebooks";

export const maxDuration = 60; // Hobby permite até 60s por padrão nesse tipo de função

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const resultado = await sincronizarChromebooks();
  return NextResponse.json(resultado);
}