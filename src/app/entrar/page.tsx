import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Um login que falha não derruba a sessão existente: quem ainda está logado volta direto ao sistema.
  if (await auth()) redirect("/");

  const { error } = await searchParams;
  const mensagemErro = !error
    ? null
    : error === "AccessDenied"
      ? "Use sua conta institucional @canoasedu.rs.gov.br para entrar."
      : "Não foi possível concluir a entrada. Tente novamente.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest text-ink-soft">
          <span className="h-2 w-2 rounded-full bg-terracotta" />
          UTIN · Secretaria Municipal da Educação de Canoas
        </div>

        <h1 className="mt-5 font-display text-2xl font-semibold text-teal-deep">
          Controle de Dispositivos
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Entre com sua conta institucional para acessar a conferência de Chromebooks e tablets.
        </p>

        {mensagemErro && (
          <p
            role="alert"
            className="mt-5 rounded-xl border-2 border-terracotta bg-terracotta/10 px-4 py-3 text-sm font-semibold text-terracotta"
          >
            {mensagemErro}
          </p>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", {redirectTo: "/"});
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:bg-paper-deep"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
              />
              <path
                fill="#FBBC05"
                d="M3.97 10.72A5.4 5.4 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
              />
            </svg>
            Entrar com Google
          </button>
        </form>

        <p className="mt-5 font-mono text-xs text-ink-soft">
          Acesso restrito a contas @canoasedu.rs.gov.br
        </p>
      </div>
    </main>
  );
}