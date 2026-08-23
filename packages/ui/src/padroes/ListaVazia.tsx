import type { ReactNode } from 'react';
import type { Icone } from '../icones/index.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';

export type PropsDaListaVazia = {
  icone: Icone;
  titulo: string;
  apoio?: string;
  /** Só quando existe uma ação óbvia (6.5). */
  acao?: ReactNode;
  className?: string;
};

/**
 * A receita fixa de 6.5, que encerra D-c. Não há ilustração: ela exigiria um
 * ilustrador, envelheceria mal, pesaria no bundle do público — que é crítico —
 * e, com um desenvolvedor, terminaria em três estilos diferentes. O ícone vem
 * do mesmo conjunto de toda a interface, o que já entrega a coerência que a
 * ilustração tentaria comprar.
 *
 * Vazio por ausência de dado e vazio por filtro são chamadas diferentes deste
 * mesmo componente: oferecer "Cadastrar serviço" a quem filtrou por uma
 * categoria sem resultado responde a outra pergunta.
 */
export function ListaVazia({ icone: Icone, titulo, apoio, acao, className }: PropsDaListaVazia) {
  return (
    <div
      className={juntarClasses(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-completo bg-superficie-afundada">
        <Icone aria-hidden className="size-6 text-conteudo-tenue" />
      </span>

      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-lg font-semibold text-conteudo">{titulo}</p>
        {apoio !== undefined ? <p className="text-sm text-conteudo-suave">{apoio}</p> : null}
      </div>

      {acao}
    </div>
  );
}
