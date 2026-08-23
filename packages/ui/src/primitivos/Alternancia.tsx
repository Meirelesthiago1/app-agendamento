import * as Switch from '@radix-ui/react-switch';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

export type PropsDaAlternancia = ComponentPropsWithoutRef<typeof Switch.Root>;

/** As onze chaves booleanas de `configuracoes` (8.2). */
export const Alternancia = forwardRef<HTMLButtonElement, PropsDaAlternancia>(function Alternancia(
  { className, ...props },
  ref,
) {
  return (
    <Switch.Root
      ref={ref}
      className={juntarClasses(
        'peer inline-flex h-6 w-11 shrink-0 items-center rounded-completo border-2 border-transparent',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-acao data-[state=unchecked]:bg-borda-forte',
        className,
      )}
      {...props}
    >
      <Switch.Thumb
        className={juntarClasses(
          'pointer-events-none block size-5 rounded-completo bg-superficie shadow-1',
          'transition-transform duration-150',
          'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
        )}
      />
    </Switch.Root>
  );
});
