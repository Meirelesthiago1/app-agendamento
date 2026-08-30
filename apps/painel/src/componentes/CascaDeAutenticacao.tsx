import { Cartao } from '@agendamento/ui';
import type { ReactNode } from 'react';

export type PropsDaCascaDeAutenticacao = {
  titulo: string;
  apoio?: string;
  children: ReactNode;
  /** Linha de navegação abaixo do cartão. */
  rodape?: ReactNode;
};

/** A moldura comum de entrar, convite, recuperação e nova senha. */
export function CascaDeAutenticacao({
  titulo,
  apoio,
  children,
  rodape,
}: PropsDaCascaDeAutenticacao) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-conteudo">{titulo}</h1>
        {apoio === undefined ? null : <p className="text-sm text-conteudo-suave">{apoio}</p>}
      </div>

      <Cartao>{children}</Cartao>

      {rodape === undefined ? null : (
        <p className="text-center text-sm text-conteudo-suave">{rodape}</p>
      )}
    </main>
  );
}
