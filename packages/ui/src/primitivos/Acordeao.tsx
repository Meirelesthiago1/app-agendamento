import * as Accordion from '@radix-ui/react-accordion';
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from 'react';
import { IconeAbrir } from '../icones/index.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';

export const Acordeao = Accordion.Root;

export type PropsDoItemDoAcordeao = Omit<
  ComponentPropsWithoutRef<typeof Accordion.Item>,
  'children'
> & {
  titulo: ReactNode;
  /** Contagem ou estado à direita do título, visível com o item fechado. */
  resumo?: ReactNode;
  children: ReactNode;
};

/**
 * Grupos de configuração. Uma tela de trinta campos numa lista só é ilegível;
 * fechada por grupo, o gestor encontra o que veio mudar.
 */
export const ItemDoAcordeao = forwardRef<HTMLDivElement, PropsDoItemDoAcordeao>(
  function ItemDoAcordeao({ titulo, resumo, children, className, ...props }, ref) {
    return (
      <Accordion.Item
        ref={ref}
        className={juntarClasses('border-b border-borda last:border-b-0', className)}
        {...props}
      >
        <Accordion.Header className="flex">
          <Accordion.Trigger
            className={juntarClasses(
              'group flex flex-1 items-center gap-3 py-3 text-left text-sm font-medium text-conteudo',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2',
            )}
          >
            <span className="flex-1">{titulo}</span>

            {resumo === undefined ? null : (
              <span className="text-sm font-normal text-conteudo-suave">{resumo}</span>
            )}

            <IconeAbrir
              aria-hidden
              className="size-4 shrink-0 text-conteudo-suave transition-transform duration-150 group-data-[state=open]:rotate-180"
            />
          </Accordion.Trigger>
        </Accordion.Header>

        <Accordion.Content className="overflow-hidden data-[state=closed]:hidden">
          <div className="pb-4">{children}</div>
        </Accordion.Content>
      </Accordion.Item>
    );
  },
);
