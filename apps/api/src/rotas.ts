import { type DefinicaoDeRota, type NomeDeRota, ROTAS, type Rotas } from '@agendamento/contratos';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

type Params<R extends DefinicaoDeRota> = R['params'] extends z.ZodType
  ? z.output<R['params']>
  : undefined;

type Query<R extends DefinicaoDeRota> = R['query'] extends z.ZodType
  ? z.output<R['query']>
  : undefined;

type Corpo<R extends DefinicaoDeRota> = R['corpo'] extends z.ZodType
  ? z.output<R['corpo']>
  : undefined;

export type EntradaValidada<R extends DefinicaoDeRota> = {
  params: Params<R>;
  query: Query<R>;
  corpo: Corpo<R>;
  requisicao: FastifyRequest;
  reply: FastifyReply;
};

export type Manipulador<N extends NomeDeRota> = (
  entrada: EntradaValidada<Rotas[N]>,
) => Promise<z.input<Rotas[N]['resposta']>>;

/**
 * Registra a rota a partir da mesma definição que o cliente usa. Servidor e
 * telas leem `ROTAS`: divergir passa a quebrar a compilação, que era o que o
 * ts-rest existia para fazer e deixou de fazer com Zod 4.
 */
export function registrarRota<N extends NomeDeRota>(
  app: FastifyInstance,
  nome: N,
  manipulador: Manipulador<N>,
): void {
  const rota: DefinicaoDeRota = ROTAS[nome];

  app.route({
    method: rota.metodo,
    url: rota.caminho,
    schema: {
      ...(rota.params ? { params: rota.params } : {}),
      ...(rota.query ? { querystring: rota.query } : {}),
      ...(rota.corpo ? { body: rota.corpo } : {}),
      response: { 200: rota.resposta },
    },
    handler: async (requisicao, reply) => {
      const entrada = {
        params: requisicao.params,
        query: requisicao.query,
        corpo: requisicao.body,
        requisicao,
        reply,
      } as EntradaValidada<Rotas[N]>;

      return manipulador(entrada);
    },
  });
}
