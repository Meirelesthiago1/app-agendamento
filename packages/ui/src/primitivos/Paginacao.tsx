import { IconeAnterior, IconeProximo } from '../icones/index.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';
import { BotaoIcone } from './BotaoIcone.tsx';

export type PropsDaPaginacao = {
  pagina: number;
  porPagina: number;
  total: number;
  aoMudarPagina: (pagina: number) => void;
  className?: string;
};

/**
 * Anterior e próxima, com a faixa exibida. Numeração de páginas foi descartada:
 * exige saber quantas são antes de renderizar, e a contagem exata custa um
 * segundo `COUNT` em toda listagem — para uma navegação que quase ninguém usa.
 */
export function Paginacao({
  pagina,
  porPagina,
  total,
  aoMudarPagina,
  className,
}: PropsDaPaginacao) {
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);
  const temProxima = ultimo < total;

  return (
    <div className={juntarClasses('flex items-center justify-between gap-3', className)}>
      <p aria-live="polite" className="text-xs text-conteudo-suave tabular-nums">
        {total === 0 ? 'Nenhum registro' : `${primeiro}–${ultimo} de ${total}`}
      </p>

      <div className="flex items-center gap-1">
        <BotaoIcone
          rotulo="Página anterior"
          variante="contorno"
          disabled={pagina <= 1}
          onClick={() => aoMudarPagina(pagina - 1)}
        >
          <IconeAnterior aria-hidden className="size-4" />
        </BotaoIcone>

        <BotaoIcone
          rotulo="Próxima página"
          variante="contorno"
          disabled={!temProxima}
          onClick={() => aoMudarPagina(pagina + 1)}
        >
          <IconeProximo aria-hidden className="size-4" />
        </BotaoIcone>
      </div>
    </div>
  );
}
