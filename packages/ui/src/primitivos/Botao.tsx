import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { IconeCarregando } from '../icones/index.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';

const botao = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md font-medium select-none',
    'transition-colors duration-150',
    // `outline: none` sem substituto é o defeito de acessibilidade mais comum
    // e o mais fácil de evitar (4.3)
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variante: {
        solida: 'bg-acao text-acao-conteudo hover:bg-acao-forte active:bg-acao-forte',
        suave: 'bg-acao-suave text-acao hover:brightness-95 active:brightness-90',
        contorno:
          'border border-borda-forte bg-superficie text-conteudo hover:bg-superficie-afundada',
        fantasma: 'text-conteudo hover:bg-superficie-afundada active:bg-borda',
        destrutiva: 'bg-negativo text-acao-conteudo hover:brightness-90 active:brightness-85',
      },
      tamanho: {
        pequeno: 'h-8 px-3 text-xs',
        medio: 'h-(--altura-controle) px-4 text-sm',
        grande: 'h-(--altura-controle) px-6 text-base',
      },
      larguraTotal: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variante: 'solida', tamanho: 'medio', larguraTotal: false },
  },
);

export type PropsDoBotao = ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof botao> & {
    /**
     * Carregamento é prop, não componente: um botão que troca de identidade ao
     * salvar perde o foco e a largura (4.2).
     */
    carregando?: boolean;
    asChild?: boolean;
  };

export const Botao = forwardRef<HTMLButtonElement, PropsDoBotao>(function Botao(
  { className, variante, tamanho, larguraTotal, carregando, asChild, children, ...props },
  ref,
) {
  // `asChild` compõe sem elemento extra: um botão que é link não produz <a><button>
  const Elemento = asChild ? Slot : 'button';

  return (
    <Elemento
      ref={ref}
      className={juntarClasses(botao({ variante, tamanho, larguraTotal }), className)}
      disabled={props.disabled ?? carregando}
      aria-busy={carregando}
      {...props}
    >
      {carregando ? <IconeCarregando aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </Elemento>
  );
});
