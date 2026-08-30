import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

export const MenuSuspenso = DropdownMenu.Root;
export const GatilhoDoMenu = DropdownMenu.Trigger;

export const ConteudoDoMenu = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DropdownMenu.Content>
>(function ConteudoDoMenu({ className, sideOffset = 4, ...props }, ref) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        sideOffset={sideOffset}
        className={juntarClasses(
          'z-50 min-w-44 overflow-hidden rounded-md border border-borda bg-superficie p-1 shadow-2',
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
});

export type PropsDoItemDoMenu = ComponentPropsWithoutRef<typeof DropdownMenu.Item> & {
  /** Ação destrutiva: cancelar, remover. */
  tom?: 'neutro' | 'negativo';
};

export const ItemDoMenu = forwardRef<HTMLDivElement, PropsDoItemDoMenu>(function ItemDoMenu(
  { className, tom = 'neutro', ...props },
  ref,
) {
  return (
    <DropdownMenu.Item
      ref={ref}
      className={juntarClasses(
        'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
        'data-[highlighted]:bg-superficie-afundada',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        tom === 'negativo' ? 'text-negativo data-[highlighted]:bg-negativo-suave' : 'text-conteudo',
        className,
      )}
      {...props}
    />
  );
});

export const SeparadorDoMenu = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DropdownMenu.Separator>
>(function SeparadorDoMenu({ className, ...props }, ref) {
  return (
    <DropdownMenu.Separator
      ref={ref}
      className={juntarClasses('-mx-1 my-1 h-px bg-borda', className)}
      {...props}
    />
  );
});
