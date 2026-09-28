import { auth, signOut } from "@/auth";

export default async function header() {
  const session = await auth();

  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-ink-soft">
          <span className="h-2 w-2 rounded-full bg-terracotta" />
          UTIN · Secretaria Municipal da Educação de Canoas
        </div>
        <div className="flex items-center gap-3 text-sm text-ink-soft">
          <span className="truncate">{session?.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button className="min-h-11 rounded-full border border-line px-4 font-semibold text-teal-deep hover:bg-paper-deep">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}