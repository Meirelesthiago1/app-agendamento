import { ErroDominio } from '@agendamento/dominio';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Contexto } from '../contexto.ts';
import type { Pools } from '../infra/db/pools.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** Lança quando a rota não resolveu tenant: caso de uso sem tenant não existe. */
    contexto: () => Contexto;
  }
  interface FastifyInstance {
    pools: Pools;
  }
}

const PREFIXO_PUBLICO = '/publico/';

export function ehRotaPublica(caminho: string): boolean {
  return caminho.startsWith(PREFIXO_PUBLICO);
}

export type OpcoesDeContexto = {
  pools: Pools;
  /** Resolve o tenant do slug da rota. A etapa 11 acrescenta o subdomínio. */
  resolverTenant: (slug: string, pool: Pools['poolPublico']) => Promise<string | null>;
};

export const pluginDeContexto = fp<OpcoesDeContexto>(async (app: FastifyInstance, opcoes) => {
  app.decorate('pools', opcoes.pools);

  app.decorateRequest('contexto', function naoMontado(this: FastifyRequest): Contexto {
    throw new ErroDominio('NAO_ENCONTRADO', 'Esta rota não resolveu nenhum estabelecimento.');
  });

  app.addHook('preHandler', async (requisicao) => {
    const publica = ehRotaPublica(requisicao.url);
    const pool = publica ? opcoes.pools.poolPublico : opcoes.pools.poolGestor;
    const params = requisicao.params as { slug?: string } | undefined;

    const estabelecimentoId = publica
      ? params?.slug === undefined
        ? null
        : await opcoes.resolverTenant(params.slug, opcoes.pools.poolPublico)
      : (requisicao.autenticado?.estabelecimentoId ?? null);

    if (estabelecimentoId === null) {
      return;
    }

    const autenticado = requisicao.autenticado;

    const montado: Contexto = {
      estabelecimentoId,
      usuarioId: autenticado?.usuarioId ?? null,
      clienteId: null,
      papel: autenticado?.papel ?? null,
      profissionalId: autenticado?.profissionalId ?? null,
      origem: publica ? 'PUBLICO' : 'ADMIN',
      pool,
    };

    requisicao.contexto = () => montado;
  });
});
