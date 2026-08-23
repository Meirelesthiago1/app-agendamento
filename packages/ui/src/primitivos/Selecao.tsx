import type { VariantProps } from 'class-variance-authority';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { IconeAbrir } from '../icones/index.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';
import { controle } from './Entrada.tsx';

export type PropsDaSelecao = ComponentPropsWithoutRef<'select'> & VariantProps<typeof controle>;

/**
 * `select` nativo, não o do Radix. Em formulário longo de configuração o nativo
 * ganha: teclado, busca por digitação e a folha do sistema no celular vêm de
 * graça. O `Combo` com busca é outro componente, e vem na etapa 9.
 */
export const Selecao = forwardRef<HTMLSelectElement, PropsDaSelecao>(function Selecao(
  { className, invalido, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalido ?? undefined}
        className={juntarClasses(
          controle({ invalido }),
          'h-(--altura-controle) appearance-none pr-9',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <IconeAbrir
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-conteudo-suave"
      />
    </div>
  );
});
