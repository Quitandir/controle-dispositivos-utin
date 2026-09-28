import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
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
});