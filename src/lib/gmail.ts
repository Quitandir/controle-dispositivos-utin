import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { db } from "@/db/index";
import { tokensGoogle } from "@/db/schema";

export const MSG_REAUTORIZAR =
  "Para enviar e-mails pelo sistema, saia e entre novamente, autorizando o envio na tela do Google.";

// Cabeçalho MIME com acentos (RFC 2047)
const codificar = (texto: string) => `=?UTF-8?B?${Buffer.from(texto, "utf-8").toString("base64")}?=`;

// quebra base64 em linhas de 76 caracteres, como pede o MIME
const quebrar = (b64: string) => b64.replace(/.{76}/g, "$&\r\n");

type Email = {
  remetente: string; // e-mail de quem está logado
  para: string;
  cc?: string;
  assunto: string;
  texto: string;
  anexo: { nome: string; conteudo: Buffer };
};

// Envia em nome de quem está logado, usando o refresh token guardado no login.
export async function enviarEmail({ remetente, para, cc, assunto, texto, anexo }: Email) {
  const [token] = await db.select().from(tokensGoogle).where(eq(tokensGoogle.email, remetente));
  if (!token) throw new Error(MSG_REAUTORIZAR);

  const oauth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  oauth.setCredentials({ refresh_token: token.refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth });

  const fronteira = `----relatorio-${Date.now()}`;
  const mensagem = [
    `From: ${remetente}`,
    `To: ${para}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${codificar(assunto)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${fronteira}"`,
    "",
    `--${fronteira}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    quebrar(Buffer.from(texto, "utf-8").toString("base64")),
    `--${fronteira}`,
    `Content-Type: application/pdf; name="${codificar(anexo.nome)}"`,
    `Content-Disposition: attachment; filename="${codificar(anexo.nome)}"`,
    "Content-Transfer-Encoding: base64",
    "",
    quebrar(anexo.conteudo.toString("base64")),
    `--${fronteira}--`,
  ].join("\r\n");

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: Buffer.from(mensagem).toString("base64url") },
    });
  } catch (e) {
    // refresh token revogado/expirado, ou concedido antes da permissão gmail.send
    const erro = e as { response?: { data?: { error?: string } }; message?: string };
    const semAutorizacao =
      erro.response?.data?.error === "invalid_grant" || /insufficient authentication scopes/i.test(erro.message ?? "");
    if (semAutorizacao) {
      await db.delete(tokensGoogle).where(eq(tokensGoogle.email, remetente));
      throw new Error(MSG_REAUTORIZAR);
    }
    throw e;
  }
}
