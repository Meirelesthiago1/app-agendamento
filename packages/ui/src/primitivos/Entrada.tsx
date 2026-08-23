import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

export const controle = cva(
  [
    'w-full rounded-md border bg-superficie px-3',
    'text-conteudo placeholder:text-conteudo-tenue',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:bg-superficie-afundada disabled:text-conteudo-tenue',
  ],
  {
    variants: {
      invalido: {
        true: 'border-negativo focus-visible:ring-negativo',
        false: 'border-borda-forte',
      },
    },
    defaultVariants: { invalido: false },
  },
);

export type PropsDaEntrada = Omit<ComponentPropsWithoutRef<'input'>, 'size'> &
  VariantProps<typeof controle>;

export const Entrada = forwardRef<HTMLInputElement, PropsDaEntrada>(function Entrada(
  { className, invalido, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalido ?? undefined}
      className={juntarClasses(controle({ invalido }), 'h-(--altura-controle)', className)}
      {...props}
    />
  );
});
