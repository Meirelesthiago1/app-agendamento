import { criarCliente } from '@agendamento/contratos';
import { estabelecimentoAtual } from './estabelecimento-atual.ts';

/**
 * O único lugar do painel que fala HTTP (7.1). Nenhum componente chama `fetch`;
 * as funcionalidades passam por aqui, e a tipagem vem do mesmo `ROTAS` que o
 * servidor registra.
 */
export const api = criarCliente({
  baseUrl: '/api',
  cabecalhos: (): Record<string, string> => {
    const escolhido = estabelecimentoAtual();

    return escolhido === null ? {} : { 'x-estabelecimento': escolhido };
  },
});
