import type { VariantProps } from 'class-variance-authority';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';
import { controle } from './Entrada.tsx';

export type PropsDaAreaTexto = ComponentPropsWithoutRef<'textarea'> & VariantProps<typeof controle>;

export const AreaTexto = forwardRef<HTMLTextAreaElement, PropsDaAreaTexto>(function AreaTexto(
  { className, invalido, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalido ?? undefined}
      className={juntarClasses(controle({ invalido }), 'py-2 resize-y', className)}
      {...props}
    />
  );
});
