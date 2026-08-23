import type { ReactNode } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

export type PropsDoCabecalhoTela = {
  titulo: string;
  subtitulo?: string;
  /** Ação primária da tela, à direita no desktop e abaixo no celular. */
  acao?: ReactNode;
  className?: string;
};

export function CabecalhoTela({ titulo, subtitulo, acao, className }: PropsDoCabecalhoTela) {
  return (
    <header
      className={juntarClasses(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-conteudo">{titulo}</h1>
        {subtitulo !== undefined ? (
          <p className="text-sm text-conteudo-suave">{subtitulo}</p>
        ) : null}
      </div>

      {acao !== undefined ? <div className="flex shrink-0 gap-2">{acao}</div> : null}
    </header>
  );
}
