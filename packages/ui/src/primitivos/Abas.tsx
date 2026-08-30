import * as Tabs from '@radix-ui/react-tabs';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

export const Abas = Tabs.Root;

export const ListaDeAbas = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof Tabs.List>>(
  function ListaDeAbas({ className, ...props }, ref) {
    return (
      <Tabs.List
        ref={ref}
        className={juntarClasses(
          'flex items-center gap-1 border-b border-borda overflow-x-auto',
          className,
        )}
        {...props}
      />
    );
  },
);

export const Aba = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof Tabs.Trigger>>(
  function Aba({ className, ...props }, ref) {
    return (
      <Tabs.Trigger
        ref={ref}
        className={juntarClasses(
          'shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium',
          // -1px para a borda da aba ativa cobrir a da lista, e não somar duas
          '-mb-px border-b-2 border-transparent text-conteudo-suave',
          'transition-colors duration-150',
          'hover:text-conteudo',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=active]:border-acao data-[state=active]:text-acao',
          className,
        )}
        {...props}
      />
    );
  },
);

export const PainelDaAba = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof Tabs.Content>
>(function PainelDaAba({ className, ...props }, ref) {
  return (
    <Tabs.Content
      ref={ref}
      className={juntarClasses(
        'pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao',
        className,
      )}
      {...props}
    />
  );
});
