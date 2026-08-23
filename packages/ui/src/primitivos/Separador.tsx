import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

export type PropsDoSeparador = ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>;

export const Separador = forwardRef<HTMLDivElement, PropsDoSeparador>(function Separador(
  { className, orientation = 'horizontal', decorative = true, ...props },
  ref,
) {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      orientation={orientation}
      decorative={decorative}
      className={juntarClasses(
        'shrink-0 bg-borda',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
});
