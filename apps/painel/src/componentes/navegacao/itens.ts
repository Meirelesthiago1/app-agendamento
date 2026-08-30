import {
  type Icone,
  IconeCalendario,
  IconeCartao,
  IconeConfiguracoes,
  IconeHorario,
  IconeLoja,
  IconePessoa,
  IconePessoas,
} from '@agendamento/ui';

export type ItemDeNavegacao = {
  para: string;
  rotulo: string;
  icone: Icone;
};

/** A ordem da barra lateral, que no desktop mostra todos. */
export const NAVEGACAO: readonly ItemDeNavegacao[] = [
  { para: '/agenda', rotulo: 'Agenda', icone: IconeCalendario },
  { para: '/clientes', rotulo: 'Clientes', icone: IconePessoa },
  { para: '/caixa', rotulo: 'Caixa', icone: IconeCartao },
  { para: '/catalogo', rotulo: 'Catálogo', icone: IconeLoja },
  { para: '/equipe', rotulo: 'Equipe', icone: IconePessoas },
  { para: '/horarios', rotulo: 'Horários', icone: IconeHorario },
  { para: '/configuracoes', rotulo: 'Ajustes', icone: IconeConfiguracoes },
];

/**
 * Os três de uso diário, que ficam sempre visíveis no celular (D28). Com o
 * "Menu", são quatro células — sete não caberiam: dariam 55px cada, abaixo do
 * piso de 44px, com rótulo truncado.
 *
 * `/clientes` e `/caixa` chegam nas etapas 10 e 13; até lá caem no
 * `notFoundComponent`. A barra já nasce na forma final para não haver troca
 * depois.
 */
export const NA_BARRA_INFERIOR: readonly string[] = ['/agenda', '/clientes', '/caixa'];

/**
 * O complemento, derivado — **nunca** uma segunda lista escrita à mão. Tela sem
 * caminho no celular some em silêncio, porque no desktop a barra lateral
 * continua mostrando: quem acrescenta em `NAVEGACAO` não descobre o buraco.
 */
export function itensDoMenu(
  todos: readonly ItemDeNavegacao[] = NAVEGACAO,
  naBarra: readonly string[] = NA_BARRA_INFERIOR,
): ItemDeNavegacao[] {
  return todos.filter((item) => !naBarra.includes(item.para));
}

export function itensDaBarra(
  todos: readonly ItemDeNavegacao[] = NAVEGACAO,
  naBarra: readonly string[] = NA_BARRA_INFERIOR,
): ItemDeNavegacao[] {
  return naBarra
    .map((para) => todos.find((item) => item.para === para))
    .filter((item): item is ItemDeNavegacao => item !== undefined);
}
