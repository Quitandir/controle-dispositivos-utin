import { google, admin_directory_v1 } from "googleapis";
import { sql } from "drizzle-orm";
import { db } from "@/db/index";
import { escolas, chromebooks } from "@/db/schema";

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/admin.directory.device.chromeos.readonly"],
    subject: process.env.GOOGLE_ADMIN_IMPERSONATE_EMAIL,
  });
}

export async function sincronizarChromebooks() {
  const auth = getAuth();
  const admin: admin_directory_v1.Admin = google.admin({ version: "directory_v1", auth });

  const todasEscolas = await db.select().from(escolas);
  const escolaPorOU = new Map(todasEscolas.map((e) => [e.orgUnitPath, e.id]));

  let totalSincronizados = 0;
  let totalSemEscola = 0;
  let totalDesprovisionados = 0;
  let paginas = 0;
  const agora = new Date();

  // O Google devolve no máximo 100 aparelhos por página, mesmo pedindo mais (~117 páginas).
  const listar = (pageToken?: string) =>
    admin.chromeosdevices.list({
      customerId: "my_customer",
      maxResults: 200,
      projection: "FULL", // necessário para recentUsers
      // Só os campos usados abaixo: o FULL completo traz dezenas de dados por aparelho
      // (CPU, atividade, rede...) que o sistema descarta.
      fields:
        "nextPageToken,chromeosdevices(deviceId,annotatedAssetId,serialNumber,model,notes,orgUnitPath,status,lastSync,recentUsers(email))",
      pageToken,
    });

  let pagina = await listar();
  for (;;) {
    const devices: admin_directory_v1.Schema$ChromeOsDevice[] = pagina.data.chromeosdevices ?? [];
    const proximoToken = pagina.data.nextPageToken ?? undefined;

    // Busca a próxima página no Google enquanto grava esta no banco. Ganho modesto (~7%,
    // 169s → 157s medidos em 20/10/2026): quase todo o tempo é a resposta do Google (~1,3s
    // por página), e as páginas são sequenciais — cada uma traz o token da seguinte.
    const proxima = proximoToken ? listar(proximoToken) : null;
    proxima?.catch(() => {}); // se a gravação falhar antes, evita "unhandled rejection" desta busca

    if (devices.length > 0) {
      const lote = devices.map((d: admin_directory_v1.Schema$ChromeOsDevice) => {
        const escolaId = d.orgUnitPath ? escolaPorOU.get(d.orgUnitPath) ?? null : null;
        if (!escolaId) totalSemEscola++;
        if (d.status === "DEPROVISIONED") totalDesprovisionados++;

        return {
          googleDeviceId: d.deviceId!,
          escolaId,
          assetId: d.annotatedAssetId ?? null,
          serialNumber: d.serialNumber ?? null,
          model: d.model ?? null,
          notes: d.notes ?? null,
          orgUnitPath: d.orgUnitPath ?? null,
          googleStatus: d.status ?? null,
          ultimoSyncGoogle: d.lastSync ? new Date(d.lastSync) : null,
          ultimoUsuario: d.recentUsers?.find((u) => u.email)?.email ?? null,
          lastSyncedAt: agora,
        };
      });

      // um único INSERT com todo o lote da página
      await db
        .insert(chromebooks)
        .values(lote)
        .onConflictDoUpdate({
          target: chromebooks.googleDeviceId,
          // status, statusAtualizadoEm e statusAtualizadoPor propositalmente
          // ficam de fora daqui — são geridos pela conferência local, o sync nunca sobrescreve.
          set: {
            escolaId: sql`excluded.escola_id`,
            assetId: sql`excluded.asset_id`,
            serialNumber: sql`excluded.serial_number`,
            model: sql`excluded.model`,
            notes: sql`excluded.notes`,
            orgUnitPath: sql`excluded.org_unit_path`,
            googleStatus: sql`excluded.google_status`,
            ultimoSyncGoogle: sql`excluded.ultimo_sync_google`,
            ultimoUsuario: sql`excluded.ultimo_usuario`,
            lastSyncedAt: sql`excluded.last_synced_at`,
          },
        });

      totalSincronizados += lote.length;
    }

    paginas++;
    if (!proxima) break;
    pagina = await proxima;
  }

  return { totalSincronizados, totalSemEscola, totalDesprovisionados, paginas };
}