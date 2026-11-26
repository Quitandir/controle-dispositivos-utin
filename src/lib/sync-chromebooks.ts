import { google, admin_directory_v1 } from "googleapis";
import { eq, isNotNull, sql } from "drizzle-orm";
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

function getAdmin(): admin_directory_v1.Admin {
  return google.admin({ version: "directory_v1", auth: getAuth() });
}

// Só os campos usados na gravação: o FULL completo traz dezenas de dados por aparelho
// (CPU, atividade, rede...) que o sistema descarta. FULL é necessário para recentUsers.
const CAMPOS_APARELHO = "deviceId,annotatedAssetId,serialNumber,model,notes,orgUnitPath,status,lastSync,recentUsers(email)";

type Aparelho = admin_directory_v1.Schema$ChromeOsDevice;

async function mapaEscolaPorOU() {
  const todas = await db.select({ id: escolas.id, orgUnitPath: escolas.orgUnitPath }).from(escolas);
  return new Map(todas.map((e) => [e.orgUnitPath, e.id]));
}

// Grava (insert ou update) um lote de aparelhos vindos do Google. Devolve quantos ficaram sem escola
// e quantos estão desprovisionados.
async function gravarAparelhos(devices: Aparelho[], escolaPorOU: Map<string | null, number>, agora: Date) {
  let semEscola = 0;
  let desprovisionados = 0;
  if (devices.length === 0) return { semEscola, desprovisionados };

  const lote = devices.map((d) => {
    const escolaId = d.orgUnitPath ? escolaPorOU.get(d.orgUnitPath) ?? null : null;
    if (!escolaId) semEscola++;
    if (d.status === "DEPROVISIONED") desprovisionados++;

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

  // um único INSERT com todo o lote
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

  return { semEscola, desprovisionados };
}

// Sincronização completa (cron diário): todos os aparelhos do domínio.
export async function sincronizarChromebooks() {
  const admin = getAdmin();
  const escolaPorOU = await mapaEscolaPorOU();

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
      projection: "FULL",
      fields: `nextPageToken,chromeosdevices(${CAMPOS_APARELHO})`,
      pageToken,
    });

  let pagina = await listar();
  for (;;) {
    const devices: Aparelho[] = pagina.data.chromeosdevices ?? [];
    const proximoToken = pagina.data.nextPageToken ?? undefined;

    // Busca a próxima página no Google enquanto grava esta no banco. Ganho modesto (~7%,
    // 169s → 157s medidos em 20/10/2026): quase todo o tempo é a resposta do Google (~1,3s
    // por página), e as páginas são sequenciais — cada uma traz o token da seguinte.
    const proxima = proximoToken ? listar(proximoToken) : null;
    proxima?.catch(() => {}); // se a gravação falhar antes, evita "unhandled rejection" desta busca

    const r = await gravarAparelhos(devices, escolaPorOU, agora);
    totalSincronizados += devices.length;
    totalSemEscola += r.semEscola;
    totalDesprovisionados += r.desprovisionados;

    paginas++;
    if (!proxima) break;
    pagina = await proxima;
  }

  // Chegou ao fim: todas as UOs foram lidas agora
  await db.update(escolas).set({ consoleAtualizadoEm: agora }).where(isNotNull(escolas.orgUnitPath));

  return { totalSincronizados, totalSemEscola, totalDesprovisionados, paginas };
}

// Sincronização de uma escola só (botão "Atualizar do Console"): lê a UO dela e, para os
// aparelhos que estavam ligados à escola mas não vieram na UO, consulta um a um onde estão agora.
export async function sincronizarUO(escolaId: number) {
  const [escola] = await db
    .select({ orgUnitPath: escolas.orgUnitPath })
    .from(escolas)
    .where(eq(escolas.id, escolaId));
  if (!escola) throw new Error("Escola não encontrada");
  if (!escola.orgUnitPath) throw new Error("Esta unidade não tem UO no Admin Console");

  const admin = getAdmin();
  const escolaPorOU = await mapaEscolaPorOU();
  const agora = new Date();

  // aparelhos que o sistema tinha nesta escola antes de atualizar
  const antes = await db
    .select({ googleDeviceId: chromebooks.googleDeviceId })
    .from(chromebooks)
    .where(eq(chromebooks.escolaId, escolaId));
  const idsAntes = new Set(antes.map((c) => c.googleDeviceId));

  // 1. tudo o que está na UO hoje (só a UO, sem as filhas — cada escola é uma UO exata)
  const naUO: Aparelho[] = [];
  let pageToken: string | undefined;
  do {
    const pagina = await admin.chromeosdevices.list({
      customerId: "my_customer",
      orgUnitPath: escola.orgUnitPath.replace(/^\//, ""), // a API pede o caminho sem a barra inicial
      maxResults: 200,
      projection: "FULL",
      fields: `nextPageToken,chromeosdevices(${CAMPOS_APARELHO})`,
      pageToken,
    });
    naUO.push(...(pagina.data.chromeosdevices ?? []));
    pageToken = pagina.data.nextPageToken ?? undefined;
  } while (pageToken);
  await gravarAparelhos(naUO, escolaPorOU, agora);

  const idsNaUO = new Set(naUO.map((d) => d.deviceId!));
  const entraram = naUO.filter((d) => !idsAntes.has(d.deviceId!)).length;

  // 2. os que estavam na escola e não vieram: foram movidos para outra UO (ou excluídos do Console)
  const sumidos = [...idsAntes].filter((id) => !idsNaUO.has(id));
  const encontrados: Aparelho[] = [];
  const naoEncontrados: string[] = [];
  for (let i = 0; i < sumidos.length; i += 5) {
    const grupo = sumidos.slice(i, i + 5);
    const respostas = await Promise.allSettled(
      grupo.map((deviceId) =>
        admin.chromeosdevices.get({ customerId: "my_customer", deviceId, projection: "FULL", fields: CAMPOS_APARELHO }),
      ),
    );
    respostas.forEach((r, j) => {
      if (r.status === "fulfilled") encontrados.push(r.value.data);
      else if ((r.reason as { code?: number })?.code === 404) naoEncontrados.push(grupo[j]);
      else throw r.reason;
    });
  }
  await gravarAparelhos(encontrados, escolaPorOU, agora);

  // Excluídos do Console (404): como na sincronização completa, o sistema não apaga nem desliga
  // nada — eles continuam na escola e só entram na contagem para o time saber.

  // quantos saíram de fato (um "sumido" pode ter voltado à UO entre as duas consultas)
  const sairam = encontrados.filter((d) => (d.orgUnitPath ? escolaPorOU.get(d.orgUnitPath) : null) !== escolaId).length;

  await db.update(escolas).set({ consoleAtualizadoEm: agora }).where(eq(escolas.id, escolaId));

  return { naUO: naUO.length, entraram, sairam, excluidosDoConsole: naoEncontrados.length };
}
