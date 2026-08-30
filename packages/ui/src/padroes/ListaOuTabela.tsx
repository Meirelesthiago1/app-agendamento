import type { ReactNode } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';
import {
  CabecalhoDaTabela,
  Celula,
  Coluna,
  CorpoDaTabela,
  LinhaDaTabela,
  Tabela,
} from '../primitivos/Tabela.tsx';

export type ColunaDeLista<T> = {
  chave: string;
  rotulo: string;
  /** A célula da tabela **e** a linha do cartão. Uma função, uma fonte. */
  conteudo: (item: T) => ReactNode;
  /** Alinha à direita e liga numerais tabulares, para as casas empilharem. */
  numerica?: boolean;
  /** Título do cartão. O rótulo da coluna não é repetido embaixo dele. */
  principal?: boolean;
  /** Canto superior direito do cartão — é onde o menu de ações mora. */
  fixada?: boolean;
  /** Coluna de baixo valor, que não vale a altura que ocuparia no celular. */
  soNaTabela?: boolean;
};

export type PropsDaListaOuTabela<T> = {
  itens: readonly T[];
  chaveDoItem: (item: T) => string;
  colunas: readonly ColunaDeLista<T>[];
  /** `ListaVazia` do chamador: o texto de vazio é conteúdo, não design (6.5). */
  vazio?: ReactNode;
};

/**
 * Toda listagem do painel (D29): tabela acima do ponto de virada, cartões
 * abaixo. **Uma fonte de dados só** — as colunas viram dado e a forma é
 * escolhida aqui dentro. Dois blocos irmãos no chamador significariam escrever
 * a formatação de cada célula duas vezes, e a segunda nunca seria vista, porque
 * o desenvolvimento acontece no desktop.
 *
 * A escolha é **por CSS**, não por JavaScript: as duas árvores são renderizadas
 * e alternadas por `md:`. Sem `matchMedia`, sem listener de redimensionamento, e
 * sem discrepância na primeira pintura. Os focáveis existem em duplicata no DOM,
 * mas o ramo escondido está em `display: none` — fora da ordem de tabulação e da
 * árvore de acessibilidade, então não há alvo fantasma.
 *
 * **`conteudo(item)` é chamada duas vezes por item, e precisa ser pura.** Estado
 * ou identificador aleatório dentro dela quebra no ramo escondido, em silêncio.
 *
 * Não é uma tabela de dados: sem seleção de linha, cabeçalho fixo, expansão ou
 * virtualização. O painel pagina, e a maior lista é uma página.
 */
export function ListaOuTabela<T>({ itens, chaveDoItem, colunas, vazio }: PropsDaListaOuTabela<T>) {
  if (itens.length === 0) {
    return vazio ?? null;
  }

  const principal = colunas.find((coluna) => coluna.principal);
  const fixada = colunas.find((coluna) => coluna.fixada);
  const noCartao = colunas.filter(
    (coluna) => !coluna.principal && !coluna.fixada && coluna.soNaTabela !== true,
  );

  return (
    <>
      <div className="hidden md:block">
        <Tabela>
          <CabecalhoDaTabela>
            <LinhaDaTabela>
              {colunas.map((coluna) => (
                <Coluna
                  key={coluna.chave}
                  numerica={coluna.numerica}
                  className={coluna.fixada === true ? 'w-10' : undefined}
                >
                  {coluna.fixada === true ? (
                    <span className="sr-only">{coluna.rotulo}</span>
                  ) : (
                    coluna.rotulo
                  )}
                </Coluna>
              ))}
            </LinhaDaTabela>
          </CabecalhoDaTabela>

          <CorpoDaTabela>
            {itens.map((item) => (
              <LinhaDaTabela key={chaveDoItem(item)}>
                {colunas.map((coluna) => (
                  <Celula key={coluna.chave} numerica={coluna.numerica}>
                    {coluna.conteudo(item)}
                  </Celula>
                ))}
              </LinhaDaTabela>
            ))}
          </CorpoDaTabela>
        </Tabela>
      </div>

      <ul className="flex flex-col divide-y divide-borda md:hidden">
        {itens.map((item) => (
          <li key={chaveDoItem(item)} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              {principal === undefined ? null : (
                <span className="min-w-0 flex-1 text-sm font-medium text-conteudo">
                  {principal.conteudo(item)}
                </span>
              )}

              {fixada === undefined ? null : (
                <span className="shrink-0">{fixada.conteudo(item)}</span>
              )}
            </div>

            {noCartao.length === 0 ? null : (
              <dl className="flex flex-col gap-1">
                {noCartao.map((coluna) => (
                  <div key={coluna.chave} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-xs text-conteudo-suave">{coluna.rotulo}</dt>
                    <dd
                      className={juntarClasses(
                        'min-w-0 text-right text-sm text-conteudo',
                        coluna.numerica === true ? 'tabular-nums' : undefined,
                      )}
                    >
                      {coluna.conteudo(item)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
