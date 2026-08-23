import { ErroDominio } from '@agendamento/dominio';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { Contexto } from '../contexto.ts';
import type { Executor, Pools } from '../infra/db/pools.ts';
import type { Estabelecimento } from '../modulos/estabelecimentos/repositorio.ts';

/**
 * O que a rota recebe depois que o tenant foi resolvido. O estabelecimento vem
 * junto porque quem o resolveu já o tinha inteiro em mãos — devolver só o id
 * obrigaria toda rota pública a consultá-lo uma segunda vez.
 */
export type Resolvido = {
  contexto: Contexto;
  estabelecimento: Estabelecimento | null;
};

declare module 'fastify' {
  interface FastifyRequest {
    /** Lança quando a rota não resolveu tenant: caso de uso sem tenant não existe. */
    resolvido: () => Resolvido;
  }
}

const PREFIXO_PUBLICO = '/publico/';

function ehRotaPublica(caminho: string): boolean {
  return caminho.startsWith(PREFIXO_PUBLICO);
}

export type OpcoesDeContexto = {
  pools: Pools;
  /** Resolve o tenant pelo slug da rota. A etapa 11 acrescenta o subdomínio. */
  buscarPorSlug: (executor: Executor, slug: string) => Promise<Estabelecimento | null>;
};

export const pluginDeContexto = fp<OpcoesDeContexto>(async (app: FastifyInstance, opcoes) => {
  app.decorateRequest('resolvido', (): Resolvido => {
    throw new ErroDominio('NAO_ENCONTRADO', 'Estabelecimento não encontrado.');
  });

  app.addHook('preHandler', async (requisicao) => {
    const publica = ehRotaPublica(requisicao.url);
    const pool = publica ? opcoes.pools.poolPublico : opcoes.pools.poolGestor;
    const params = requisicao.params as { slug?: string } | undefined;

    const estabelecimento =
      publica && params?.slug !== undefined ? await opcoes.buscarPorSlug(pool, params.slug) : null;

    const estabelecimentoId = publica
      ? (estabelecimento?.id ?? null)
      : (requisicao.autenticado?.estabelecimentoId ?? null);

    if (estabelecimentoId === null) {
      return;
    }

    const autenticado = requisicao.autenticado;

    const resolvido: Resolvido = {
      estabelecimento,
      contexto: {
        estabelecimentoId,
        usuarioId: autenticado?.usuarioId ?? null,
        clienteId: null,
        papel: autenticado?.papel ?? null,
        profissionalId: autenticado?.profissionalId ?? null,
        origem: publica ? 'PUBLICO' : 'ADMIN',
        pool,
      },
    };

    requisicao.resolvido = () => resolvido;
  });
});
