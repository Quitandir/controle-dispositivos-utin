import { Readable } from "node:stream";
import { google } from "googleapis";

// A Service Account acessa o Drive compartilhado "Time Google" como membro dele
// (Administrador de conteúdo), sem delegação de domínio — por isso não há `subject`.
function getDrive() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

const PASTA_MIME = "application/vnd.google-apps.folder";

// Pasta do ano dentro de "Relatórios de visitas" — criada se ainda não existir.
async function pastaDoAno(ano: number): Promise<string> {
  const raiz = process.env.DRIVE_PASTA_RELATORIOS_ID;
  if (!raiz) throw new Error("DRIVE_PASTA_RELATORIOS_ID não configurada");
  const drive = getDrive();

  const busca = await drive.files.list({
    q: `'${raiz}' in parents and name = '${ano}' and mimeType = '${PASTA_MIME}' and trashed = false`,
    fields: "files(id)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });
  const existente = busca.data.files?.[0]?.id;
  if (existente) return existente;

  const criada = await drive.files.create({
    requestBody: { name: String(ano), mimeType: PASTA_MIME, parents: [raiz] },
    fields: "id",
    supportsAllDrives: true,
  });
  return criada.data.id!;
}

export async function salvarPdfNoDrive(nome: string, conteudo: Buffer, ano: number) {
  const drive = getDrive();
  const pasta = await pastaDoAno(ano);
  const res = await drive.files.create({
    requestBody: { name: nome, parents: [pasta], mimeType: "application/pdf" },
    media: { mimeType: "application/pdf", body: Readable.from(conteudo) },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  return { id: res.data.id!, url: res.data.webViewLink! };
}

// Baixa a versão atual do arquivo — depois da assinatura a lápis no tablet,
// o Drive salva a anotação no mesmo arquivo.
export async function baixarArquivoDoDrive(fileId: string): Promise<Buffer> {
  const res = await getDrive().files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}
