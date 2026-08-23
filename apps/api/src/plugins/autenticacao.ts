import type { Papel } from '@agendamento/dominio';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export type Autenticado = {
  usuarioId: string;
  papel: Papel;
  profissionalId: string | null;
  estabelecimentoId: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    autenticado: Autenticado | null;
  }
}

/**
 * Resolve usuário, vínculo e papel a partir da sessão. A etapa 5 substitui o
 * corpo desta função pela leitura da sessão opaca em `sessoes` (T19); o formato
 * de saída é o que as camadas acima já consomem, e não muda.
 *
 * Enquanto isso, nenhuma requisição é autenticada — o que mantém honesto o que
 * a etapa 3 entrega: só rotas públicas funcionam.
 */
async function resolverSessao(_requisicao: FastifyRequest): Promise<Autenticado | null> {
  return null;
}

export const pluginDeAutenticacao = fp(async (app: FastifyInstance) => {
  app.decorateRequest('autenticado', null);

  app.addHook('onRequest', async (requisicao) => {
    requisicao.autenticado = await resolverSessao(requisicao);
  });
});
