// Campo de busca de dispositivo (home e página /buscar). Formulário GET simples: não precisa de JS.
export default function BuscaDispositivo({ valor = "" }: { valor?: string }) {
  return (
    <form action="/buscar" method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
      <input
        type="search"
        name="q"
        defaultValue={valor}
        required
        placeholder="Patrimônio, nº de série ou IMEI"
        aria-label="Buscar dispositivo por patrimônio, número de série ou IMEI"
        className="min-h-12 w-full rounded-xl border-2 border-line bg-white px-4 text-base outline-none focus:border-teal sm:max-w-sm"
      />
      <button type="submit" className="min-h-12 rounded-xl bg-teal px-5 font-semibold text-white">
        Buscar
      </button>
    </form>
  );
}
