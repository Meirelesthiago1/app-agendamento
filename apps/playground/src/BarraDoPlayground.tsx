import { COR_PADRAO } from '@agendamento/ui';

export type Tema = 'painel' | 'publico';
export type Densidade = 'compacta' | 'confortavel';

export type PropsDaBarra = {
  tela: string;
  telas: readonly string[];
  aoTrocarTela: (tela: string) => void;
  tema: Tema;
  aoTrocarTema: (tema: Tema) => void;
  densidade: Densidade;
  aoTrocarDensidade: (densidade: Densidade) => void;
  corTema: string;
  aoTrocarCor: (cor: string) => void;
};

const seletor = 'h-8 rounded-md border border-borda-forte bg-superficie px-2 text-xs text-conteudo';

/**
 * É esta barra que justifica o playground ser um app próprio, e não uma rota do
 * painel (D9): uma rota dentro do painel herdaria o tema dele, e não teria como
 * provar as duas identidades lado a lado.
 */
export function BarraDoPlayground(props: PropsDaBarra) {
  return (
    <header className="sticky top-0 z-50 flex flex-wrap items-center gap-3 border-b border-borda bg-superficie px-4 py-2">
      <nav className="flex gap-1" aria-label="Telas do playground">
        {props.telas.map((nome) => (
          <button
            key={nome}
            type="button"
            onClick={() => props.aoTrocarTela(nome)}
            aria-current={props.tela === nome ? 'page' : undefined}
            className={
              props.tela === nome
                ? 'rounded-md bg-acao px-3 py-1 text-xs font-medium text-acao-conteudo'
                : 'rounded-md px-3 py-1 text-xs font-medium text-conteudo-suave hover:bg-superficie-afundada'
            }
          >
            {nome}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-conteudo-suave">
        <label className="flex items-center gap-1.5">
          tema
          <select
            className={seletor}
            value={props.tema}
            onChange={(evento) => props.aoTrocarTema(evento.target.value as Tema)}
          >
            <option value="painel">painel</option>
            <option value="publico">publico</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          densidade
          <select
            className={seletor}
            value={props.densidade}
            onChange={(evento) => props.aoTrocarDensidade(evento.target.value as Densidade)}
          >
            <option value="compacta">compacta (painel)</option>
            <option value="confortavel">confortavel (publico)</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          cor_tema
          <input
            type="color"
            className="size-8 cursor-pointer rounded-md border border-borda-forte bg-superficie"
            value={props.corTema}
            onChange={(evento) => props.aoTrocarCor(evento.target.value.toUpperCase())}
          />
          <code className="numerais-tabulares">{props.corTema}</code>
        </label>

        <button
          type="button"
          onClick={() => props.aoTrocarCor(COR_PADRAO)}
          className="rounded-md px-2 py-1 underline decoration-dotted hover:text-conteudo"
        >
          restaurar
        </button>
      </div>
    </header>
  );
}
