import { ErroDominio, type LimitadorTaxa } from '@agendamento/dominio';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export type Limite = {
  requisicoes: number;
  janelaSegundos: number;
};

export type OpcoesDeLimite = {
  limitador: LimitadorTaxa;
  /** Por rota, porque `slots` e `dias_com_vaga` são as mais caras (6.4). */
  limites: Record<string, Limite>;
  padrao: Limite;
};

function chaveDe(requisicao: FastifyRequest): string {
  const rota = requisicao.routeOptions.url ?? requisicao.url;

  return `${rota}:${requisicao.ip}`;
}

export const pluginDeLimiteDeTaxa = fp<OpcoesDeLimite>(async (app: FastifyInstance, opcoes) => {
  app.addHook('onRequest', async (requisicao, reply) => {
    const rota = requisicao.routeOptions.url;
    const limite = (rota === undefined ? undefined : opcoes.limites[rota]) ?? opcoes.padrao;

    const resultado = await opcoes.limitador.consumir(
      chaveDe(requisicao),
      limite.requisicoes,
      limite.janelaSegundos,
    );

    reply.header('x-limite-restante', String(resultado.restantes));

    if (!resultado.permitido) {
      reply.header(
        'retry-after',
        String(Math.max(1, Math.ceil((resultado.liberaEm.getTime() - Date.now()) / 1000))),
      );

      throw new ErroDominio(
        'MUITAS_REQUISICOES',
        'Muitas requisições em pouco tempo. Aguarde um instante.',
      );
    }
  });
});
