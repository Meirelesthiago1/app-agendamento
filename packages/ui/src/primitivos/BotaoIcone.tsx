import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

const botaoIcone = cva(
  [
    'inline-flex items-center justify-center shrink-0',
    'rounded-md transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variante: {
        fantasma: 'text-conteudo-suave hover:bg-superficie-afundada hover:text-conteudo',
        contorno: 'border border-borda-forte bg-superficie hover:bg-superficie-afundada',
        solida: 'bg-acao text-acao-conteudo hover:bg-acao-forte',
      },
      tamanho: {
        pequeno: 'size-8',
        medio: 'size-(--altura-controle)',
      },
    },
    defaultVariants: { variante: 'fantasma', tamanho: 'medio' },
  },
);

export type PropsDoBotaoIcone = ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof botaoIcone> & {
    /** Obrigatório: botão só com ícone não tem nome acessível sem ele. */
    rotulo: string;
    children: ReactNode;
  };

export const BotaoIcone = forwardRef<HTMLButtonElement, PropsDoBotaoIcone>(function BotaoIcone(
  { className, variante, tamanho, rotulo, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={rotulo}
      title={rotulo}
      className={juntarClasses(botaoIcone({ variante, tamanho }), className)}
      {...props}
    >
      {children}
    </button>
  );
});
