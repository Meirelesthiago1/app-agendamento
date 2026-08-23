import { ErroDominio, type LimitadorTaxa } from '@agendamento/dominio';
import { sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Config } from './config.ts';
import type { Pools } from './infra/db/pools.ts';
import { criarLimitadorEmMemoria } from './infra/limite/memoria.ts';
import { criarPortas, type Portas } from './infra/portas.ts';
import * as disponibilidade from './modulos/disponibilidade/casos-de-uso.ts';
import { buscarTenantPorSlug } from './modulos/disponibilidade/repositorio.ts';
import { pluginDeAutenticacao } from './plugins/autenticacao.ts';
import { pluginDeContexto } from './plugins/contexto.ts';
import { pluginDeErros } from './plugins/erros.ts';
import { pluginDeLimiteDeTaxa } from './plugins/limite-taxa.ts';
import { registrarRota } from './rotas.ts';

export type Dependencias = {
  config: Config;
  pools: Pools;
  limitador?: LimitadorTaxa;
};

export type Aplicacao = FastifyInstance & { portas: Portas };

/**
 * `slots` e `dias_com_vaga` são as consultas mais caras do sistema e ficam
 * expostas sem autenticação (6.4). Os números são calibráveis — a lacuna que a
 * etapa 11 fecha é qual valor, não se existe limite.
 */
const LIMITES = {
  '/publico/:slug/slots': { requisicoes: 60, janelaSegundos: 60 },
  '/publico/:slug/dias-com-vaga': { requisicoes: 30, janelaSegundos: 60 },
} as const;

export async function criarAplicacao(deps: Dependencias): Promise<Aplicacao> {
  const app = Fastify({
    logger: {
      level: deps.config.LOG_NIVEL,
      // Correlação por requisição vive no log, nunca transportando tenant (T13)
      redact: ['req.headers.cookie', 'req.headers.authorization'],
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const limitador = deps.limitador ?? criarLimitadorEmMemoria();
  const portas = await criarPortas(deps.config, app.log, limitador);

  await app.register(pluginDeErros);
  await app.register(pluginDeAutenticacao);
  await app.register(pluginDeLimiteDeTaxa, {
    limitador,
    limites: LIMITES,
    padrao: { requisicoes: 300, janelaSegundos: 60 },
  });
  await app.register(pluginDeContexto, {
    pools: deps.pools,
    resolverTenant: async (slug, pool) => (await buscarTenantPorSlug(pool, slug))?.id ?? null,
  });

  registrarRota(app, 'saude', async () => {
    await deps.pools.poolGestor.execute(sql`SELECT 1`);

    return { ok: true, banco: true };
  });

  registrarRota(app, 'catalogo', async ({ params, requisicao }) => {
    const contexto = requisicao.contexto();
    const tenant = await buscarTenantPorSlug(contexto.pool, params.slug);

    if (tenant === null) {
      throw new ErroDominio('NAO_ENCONTRADO', 'Estabelecimento não encontrado.');
    }

    return disponibilidade.obterCatalogo(contexto, tenant);
  });

  registrarRota(app, 'slots', async ({ params, query, requisicao, reply }) => {
    const contexto = requisicao.contexto();
    const tenant = await buscarTenantPorSlug(contexto.pool, params.slug);

    if (tenant === null) {
      throw new ErroDominio('NAO_ENCONTRADO', 'Estabelecimento não encontrado.');
    }

    // T15 — disponibilidade nunca é cacheada: em cache, leva a agendamento
    // sobre horário ocupado
    reply.header('cache-control', 'no-store');

    return disponibilidade.obterSlots(contexto, tenant.fusoHorario, {
      data: query.data,
      servicoIds: query.servicos,
      profissionalId: query.profissionalId,
    });
  });

  registrarRota(app, 'diasComVaga', async ({ params, query, requisicao, reply }) => {
    const contexto = requisicao.contexto();
    const tenant = await buscarTenantPorSlug(contexto.pool, params.slug);

    if (tenant === null) {
      throw new ErroDominio('NAO_ENCONTRADO', 'Estabelecimento não encontrado.');
    }

    reply.header('cache-control', 'no-store');

    return disponibilidade.obterDiasComVaga(contexto, tenant.fusoHorario, {
      mes: query.mes,
      servicoIds: query.servicos,
      profissionalId: query.profissionalId,
    });
  });

  // As portas viajam na instância para que caso de uso e tarefa do worker as
  // recebam do mesmo lugar.
  const comPortas = app as unknown as Aplicacao;

  comPortas.portas = portas;

  return comPortas;
}
