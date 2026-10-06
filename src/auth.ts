import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/db/index";
import { tokensGoogle } from "@/db/schema";

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
  pages: {signIn: "/entrar"},
  callbacks: {
  signIn({ profile }) {
    const email = profile?.email ?? "";
    return email.endsWith("@canoasedu.rs.gov.br");
  },
  authorized({ auth }) {
    // no middleware: só passa quem tem sessão; os demais vão para o login
    return !!auth;
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
