import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

/**
 * As quatro famílias de estado de 2.2, independentes de `--acao` sem exceção:
 * um tenant de marca verde não pode perder a distinção entre "confirmado" e
 * "ação primária desta tela".
 *
 * Estado nunca é distinguido só por cor — o selo sempre carrega rótulo textual.
 */
const selo = cva(
  'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-2xs font-medium whitespace-nowrap',
  {
    variants: {
      tom: {
        positivo: 'bg-positivo-suave text-positivo-conteudo',
        atencao: 'bg-atencao-suave text-atencao-conteudo',
        negativo: 'bg-negativo-suave text-negativo-conteudo',
        neutro: 'bg-neutro-suave text-neutro-conteudo',
        marca: 'bg-acao-suave text-acao',
      },
    },
    defaultVariants: { tom: 'neutro' },
  },
);

export type PropsDoSelo = ComponentPropsWithoutRef<'span'> & VariantProps<typeof selo>;

export const Selo = forwardRef<HTMLSpanElement, PropsDoSelo>(function Selo(
  { className, tom, ...props },
  ref,
) {
  return <span ref={ref} className={juntarClasses(selo({ tom }), className)} {...props} />;
});
