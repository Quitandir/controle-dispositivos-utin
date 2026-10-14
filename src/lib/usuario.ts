import { auth } from "@/auth";
import { emailAutorizado } from "./acesso";

export type UsuarioSessao = {
  nome: string;
  email: string;
};

// Segunda barreira, no início de cada server action: além do proxy, confere se há
// sessão E se a pessoa continua na lista de autorizados. Lança erro se não — as actions
// que devolvem { ok: false } precisam capturá-lo (em produção o Next esconde a mensagem).
export async function exigirUsuario(): Promise<UsuarioSessao> {
  const session = await auth();

  const emailSessao = session?.user?.email;
  if (!emailSessao) throw new Error("Sessão expirada. Entre novamente.");
  if (!(await emailAutorizado(emailSessao))) throw new Error("Usuário não permitido para acessar o serviço.");

  return {
    nome: session.user?.name || emailSessao,
    email: emailSessao,
  };
}
