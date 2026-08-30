import * as Checkbox from '@radix-ui/react-checkbox';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { IconeConfirmar, IconeMenos } from '../icones/index.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';

export type PropsDaCaixa = ComponentPropsWithoutRef<typeof Checkbox.Root>;

/** Seleção múltipla na resolução em lote (5.9). */
export const Caixa = forwardRef<HTMLButtonElement, PropsDaCaixa>(function Caixa(
  { className, ...props },
  ref,
) {
  return (
    <Checkbox.Root
      ref={ref}
      className={juntarClasses(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-sm border border-borda-forte',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-acao data-[state=checked]:bg-acao',
        'data-[state=indeterminate]:border-acao data-[state=indeterminate]:bg-acao',
        className,
      )}
      {...props}
    >
      <Checkbox.Indicator className="text-acao-conteudo">
        {props.checked === 'indeterminate' ? (
          <IconeMenos aria-hidden className="size-3.5" />
        ) : (
          <IconeConfirmar aria-hidden className="size-3.5" />
        )}
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
});
