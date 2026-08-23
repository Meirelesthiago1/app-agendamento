import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from 'react';
import { IconeAlerta, IconeAtencao, IconeInformacao, IconeSucesso } from '../icones/index.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';

const aviso = cva('flex gap-3 rounded-md border p-3 text-sm', {
  variants: {
    tom: {
      informacao: 'border-borda bg-superficie-afundada text-conteudo',
      positivo: 'border-positivo/25 bg-positivo-suave text-positivo-conteudo',
      atencao: 'border-atencao/25 bg-atencao-suave text-atencao-conteudo',
      negativo: 'border-negativo/25 bg-negativo-suave text-negativo-conteudo',
    },
  },
  defaultVariants: { tom: 'informacao' },
});

const ICONES = {
  informacao: IconeInformacao,
  positivo: IconeSucesso,
  atencao: IconeAtencao,
  negativo: IconeAlerta,
} as const;

export type PropsDoAviso = ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof aviso> & {
    titulo?: string;
    children: ReactNode;
  };

/**
 * Retorno de toda mutação. `role` muda com o tom: erro interrompe o leitor de
 * tela, confirmação espera a pausa.
 */
export const Aviso = forwardRef<HTMLDivElement, PropsDoAviso>(function Aviso(
  { className, tom = 'informacao', titulo, children, ...props },
  ref,
) {
  const Icone = ICONES[tom ?? 'informacao'];

  return (
    <div
      ref={ref}
      role={tom === 'negativo' ? 'alert' : 'status'}
      className={juntarClasses(aviso({ tom }), className)}
      {...props}
    >
      <Icone aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-0.5">
        {titulo !== undefined ? <strong className="font-medium">{titulo}</strong> : null}
        <div>{children}</div>
      </div>
    </div>
  );
});
