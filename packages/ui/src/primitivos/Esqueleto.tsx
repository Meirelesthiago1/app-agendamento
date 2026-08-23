import type { ComponentPropsWithoutRef } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

/** Agenda e caixa carregando. Nunca anunciado: é ruído para leitor de tela. */
export function Esqueleto({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      aria-hidden
      className={juntarClasses('animate-pulse rounded-md bg-borda', className)}
      {...props}
    />
  );
}
