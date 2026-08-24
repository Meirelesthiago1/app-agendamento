import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { IconeAbrir } from '../icones/index.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';

/**
 * O invólucro rola sozinho no eixo horizontal. Sem ele, a tabela larga empurra
 * o corpo da página e o celular ganha rolagem lateral em tudo — inclusive na
 * navegação inferior, que é fixa.
 */
export const Tabela = forwardRef<HTMLTableElement, ComponentPropsWithoutRef<'table'>>(
  function Tabela({ className, ...props }, ref) {
    return (
      <div className="w-full overflow-x-auto">
        <table
          ref={ref}
          className={juntarClasses('w-full border-collapse text-sm', className)}
          {...props}
        />
      </div>
    );
  },
);

export const CabecalhoDaTabela = forwardRef<
  HTMLTableSectionElement,
  ComponentPropsWithoutRef<'thead'>
>(function CabecalhoDaTabela({ className, ...props }, ref) {
  return (
    <thead ref={ref} className={juntarClasses('border-b border-borda', className)} {...props} />
  );
});

export const CorpoDaTabela = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<'tbody'>>(
  function CorpoDaTabela({ className, ...props }, ref) {
    return (
      <tbody ref={ref} className={juntarClasses('divide-y divide-borda', className)} {...props} />
    );
  },
);

export const LinhaDaTabela = forwardRef<HTMLTableRowElement, ComponentPropsWithoutRef<'tr'>>(
  function LinhaDaTabela({ className, ...props }, ref) {
    return (
      <tr
        ref={ref}
        className={juntarClasses('transition-colors hover:bg-superficie-afundada', className)}
        {...props}
      />
    );
  },
);

export type Ordenacao = 'asc' | 'desc' | null;

export type PropsDaColuna = Omit<ComponentPropsWithoutRef<'th'>, 'onClick'> & {
  /** Presente torna a coluna ordenável; `null` é ordenável mas não ordenada. */
  ordenacao?: Ordenacao;
  aoOrdenar?: () => void;
  /** Números alinham à direita, para as casas decimais empilharem. */
  numerica?: boolean;
};

export const Coluna = forwardRef<HTMLTableCellElement, PropsDaColuna>(function Coluna(
  { className, children, ordenacao, aoOrdenar, numerica = false, ...props },
  ref,
) {
  const conteudo =
    aoOrdenar === undefined ? (
      children
    ) : (
      <button
        type="button"
        onClick={aoOrdenar}
        className={juntarClasses(
          'group inline-flex items-center gap-1 rounded-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao',
        )}
      >
        {children}

        <IconeAbrir
          aria-hidden
          className={juntarClasses(
            'size-3.5 transition-transform duration-150',
            ordenacao === 'asc' ? 'rotate-180' : undefined,
            ordenacao === null || ordenacao === undefined
              ? 'opacity-0 group-hover:opacity-50'
              : undefined,
          )}
        />
      </button>
    );

  return (
    <th
      ref={ref}
      scope="col"
      // O leitor de tela anuncia a ordem sem depender do ícone
      aria-sort={
        ordenacao === 'asc' ? 'ascending' : ordenacao === 'desc' ? 'descending' : undefined
      }
      className={juntarClasses(
        'whitespace-nowrap px-3 py-2 text-xs font-medium text-conteudo-suave',
        numerica ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    >
      {conteudo}
    </th>
  );
});

export type PropsDaCelula = ComponentPropsWithoutRef<'td'> & { numerica?: boolean };

export const Celula = forwardRef<HTMLTableCellElement, PropsDaCelula>(function Celula(
  { className, numerica = false, ...props },
  ref,
) {
  return (
    <td
      ref={ref}
      className={juntarClasses(
        'px-3 py-2 text-conteudo',
        numerica ? 'text-right tabular-nums' : undefined,
        className,
      )}
      {...props}
    />
  );
});
