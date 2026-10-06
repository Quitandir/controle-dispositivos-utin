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

  let pageToken: string | undefined = undefined;
  let totalSincronizados = 0;
  let totalSemEscola = 0;
  let totalDesprovisionados = 0;
  let paginas = 0;
  const agora = new Date();

  do {
    const res: { data: admin_directory_v1.Schema$ChromeOsDevices } = await admin.chromeosdevices.list({
      customerId: "my_customer",
      maxResults: 200,
      projection: "FULL",
      pageToken,
    });

    const devices: admin_directory_v1.Schema$ChromeOsDevice[] = res.data.chromeosdevices ?? [];

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

      // um único INSERT com todo o lote da página (até 200 linhas de uma vez)
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
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { totalSincronizados, totalSemEscola, totalDesprovisionados, paginas };
}