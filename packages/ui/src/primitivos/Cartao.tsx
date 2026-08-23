import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

/**
 * Sombra nunca substitui borda (2.5). A referência separa planos por superfície
 * e borda de 1px; sombra difusa em card é o desvio mais comum e o que mais
 * rápido faz a interface parecer de outra família.
 */
const cartao = cva('rounded-lg border border-borda bg-superficie p-(--padding-cartao)', {
  variants: {
    interativo: {
      true: 'transition-colors duration-150 hover:border-borda-forte cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2',
      false: '',
    },
  },
  defaultVariants: { interativo: false },
});

export type PropsDoCartao = ComponentPropsWithoutRef<'div'> & VariantProps<typeof cartao>;

export const Cartao = forwardRef<HTMLDivElement, PropsDoCartao>(function Cartao(
  { className, interativo, ...props },
  ref,
) {
  return <div ref={ref} className={juntarClasses(cartao({ interativo }), className)} {...props} />;
});
