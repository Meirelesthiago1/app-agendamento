import type { ReactNode } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

export type PropsDaBarraDeAcoes = {
  children: ReactNode;
  /** Fixa no rodapé da janela: o padrão do kit em todo o público. */
  fixa?: boolean;
  className?: string;
};

/**
 * O `env(safe-area-inset-bottom)` evita que a ação primária fique atrás da
 * barra de gestos do iPhone — no fluxo público ela é o único jeito de avançar.
 */
export function BarraDeAcoes({ children, fixa = false, className }: PropsDaBarraDeAcoes) {
  return (
    <div
      className={juntarClasses(
        'flex items-center gap-3 border-t border-borda bg-superficie px-4 py-3',
        fixa ? 'fixed inset-x-0 bottom-0 z-40 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : '',
        className,
      )}
    >
      {children}
    </div>
  );
}
