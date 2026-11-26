// Aparece no topo da lista quando ela abre a partir da busca da home, mostrando só o dispositivo buscado.
export default function AvisoFoco({ aoLimpar }: { aoLimpar: () => void }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 border-teal bg-teal/10 px-4 py-3 text-sm">
      <span className="font-semibold text-teal-deep">Mostrando só o dispositivo buscado.</span>
      <button
        type="button"
        onClick={aoLimpar}
        className="min-h-11 rounded-xl border border-teal bg-white px-4 font-semibold text-teal-deep"
      >
        Mostrar todos
      </button>
    </div>
  );
}
