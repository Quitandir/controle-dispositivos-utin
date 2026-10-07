import * as Sentry from "@sentry/nextjs";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/db/index";
import { tokensGoogle } from "@/db/schema";
import { emailAutorizado } from "@/lib/acesso";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      authorization: {
        params: {
          // gmail.send: o relatório é enviado à escola a partir da conta de quem está logado.
          // access_type=offline + prompt=consent garantem que o Google devolva o refresh token.
          scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  // Erros de login também vão para /entrar (em vez da página genérica em inglês do Auth.js).
  // Caso comum no tablet: o "Voltar" do Android reabre a tela de consentimento do Google,
  // que reenvia um callback sem login iniciado — o Auth.js recusa (verificação PKCE/state).
  pages: {signIn: "/entrar", error: "/entrar"},
  // Erros de login (como o do "Voltar" no tablet) não chegam ao onRequestError porque o
  // Auth.js os trata internamente — por isso são enviados ao Sentry aqui.
  logger: {
    error(erro) {
      console.error("[auth][error]", erro);
      Sentry.captureException(erro, { tags: { area: "login" } });
    },
  },
  callbacks: {
  // só entra quem está na tabela usuarios_autorizados (e é do domínio @canoasedu)
  signIn({ profile }) {
    return emailAutorizado(profile?.email);
  },
  authorized({ auth }) {
    // no proxy: precisa de sessão E continuar na lista — remover alguém da tabela
    // derruba o acesso mesmo com a sessão ainda válida. Os demais vão para /entrar.
    return emailAutorizado(auth?.user?.email);
  },
},
  events: {
    // guarda o refresh token no banco (nunca na sessão do navegador)
    async signIn({ account, profile }) {
      const email = profile?.email;
      if (!email || !account?.refresh_token) return;
      await db
        .insert(tokensGoogle)
        .values({ email, refreshToken: account.refresh_token })
        .onConflictDoUpdate({
          target: tokensGoogle.email,
          set: { refreshToken: account.refresh_token, atualizadoEm: new Date() },
        });
    },
  },
});
