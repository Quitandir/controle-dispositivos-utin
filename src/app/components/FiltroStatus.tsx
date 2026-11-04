import { FILTRO_NAO_CONFERIDO, FILTRO_TODOS } from "@/lib/status";

export default function FiltroStatus({ valor, opcoes, aoMudar }: {
    valor: string;
    opcoes: readonly { valor: string, rotulo: string }[];
    aoMudar: (novo: string) => void;
}) {
    return (
        <select
            value={valor}
            onChange={(e) => aoMudar(e.target.value)}
            aria-label="Filtrar por status"
            className="min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 text-base outline-none focus:border-teal md:w-56"
        >
            <option value={FILTRO_TODOS}>Todos os status</option>
            <option value={FILTRO_NAO_CONFERIDO}>Não conferido</option>
            {opcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                </option>
            ))}
        </select>
    );
}