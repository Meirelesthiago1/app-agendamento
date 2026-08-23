import { ErroDominio, type LimitadorTaxa } from '@agendamento/dominio';
import { sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Config } from './config.ts';
import type { Contexto } from './contexto.ts';
import type { Pools } from './infra/db/pools.ts';
import { criarLimitadorEmMemoria } from './infra/limite/memoria.ts';
import { criarPortas, type Portas } from './infra/portas.ts';
import * as auth from './modulos/auth/casos-de-uso.ts';
import { encerrarSessao, NOME_DO_COOKIE } from './modulos/auth/sessao.ts';
import * as disponibilidade from './modulos/disponibilidade/casos-de-uso.ts';
import { obterCatalogoPublico } from './modulos/estabelecimentos/casos-de-uso.ts';
import { buscarPorSlug, type Estabelecimento } from './modulos/estabelecimentos/repositorio.ts';
import { pluginDeAutenticacao } from './plugins/autenticacao.ts';
import { pluginDeContexto } from './plugins/contexto.ts';
import { pluginDeErros } from './plugins/erros.ts';
import { pluginDeLimiteDeTaxa } from './plugins/limite-taxa.ts';
import { registrarRota } from './rotas.ts';

export type Dependencias = {
  config: Config;
  pools: Pools;
  limitador?: LimitadorTaxa;
  /** Injetável para que o teste conte quantas vezes o tenant é resolvido. */
  buscarPorSlug?: typeof buscarPorSlug;
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
  // Tentativa de senha é o alvo óbvio de força bruta, e o limite por IP é a
  // primeira barreira
  '/auth/entrada': { requisicoes: 10, janelaSegundos: 60 },
  '/auth/cadastro': { requisicoes: 5, janelaSegundos: 60 },
  '/auth/reenviar-verificacao': { requisicoes: 3, janelaSegundos: 60 },
} as const;

/** O tenant já foi resolvido pelo plugin de contexto; aqui só se confere. */
function exigirTenant(requisicao: FastifyRequest): {
  contexto: Contexto;
  estabelecimento: Estabelecimento;
} {
  const { contexto, estabelecimento } = requisicao.resolvido();

  if (estabelecimento === null) {
    throw new ErroDominio('NAO_ENCONTRADO', 'Estabelecimento não encontrado.');
  }

  return { contexto, estabelecimento };
}

export async function criarAplicacao(deps: Dependencias): Promise<Aplicacao> {
  const app = Fastify({
    logger: {
      level: deps.config.LOG_NIVEL,
      redact: ['req.headers.cookie', 'req.headers.authorization'],
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const limitador = deps.limitador ?? criarLimitadorEmMemoria();
  const portas = await criarPortas(deps.config, app.log, limitador);

  await app.register(pluginDeErros);
  await app.register(pluginDeAutenticacao, { config: deps.config, pools: deps.pools });
  await app.register(pluginDeLimiteDeTaxa, {
    limitador,
    limites: LIMITES,
    padrao: { requisicoes: 300, janelaSegundos: 60 },
  });
  await app.register(pluginDeContexto, {
    pools: deps.pools,
    buscarPorSlug: deps.buscarPorSlug ?? buscarPorSlug,
  });

  registrarRota(app, 'saude', async () => {
    await deps.pools.poolGestor.execute(sql`SELECT 1`);

    return { ok: true, banco: true };
  });

  const dependenciasDeAuth = () => ({
    pool: deps.pools.poolGestor,
    email: portas.email,
    config: deps.config,
  });

  function comoUsuarioDaSessao(requisicao: FastifyRequest) {
    const identidade = requisicao.identidade;

    if (identidade === null) {
      throw new ErroDominio('SEM_PERMISSAO', 'Entre para continuar.');
    }

    return {
      id: identidade.usuarioId,
      nome: identidade.nome,
      email: identidade.email,
      estabelecimentos: identidade.vinculos.map((v) => ({
        id: v.estabelecimentoId,
        papel: v.papel,
      })),
      estabelecimentoAtual: identidade.escolhido?.estabelecimentoId ?? null,
    };
  }

  registrarRota(app, 'cadastrar', async ({ corpo, requisicao }) => {
    await auth.cadastrar(dependenciasDeAuth(), { ...corpo, ip: requisicao.ip });

    return { ok: true };
  });

  registrarRota(app, 'verificarEmail', async ({ corpo }) => {
    await auth.verificarEmail(dependenciasDeAuth(), corpo.token);

    return { ok: true };
  });

  registrarRota(app, 'reenviarVerificacao', async ({ corpo, requisicao }) => {
    await auth.reenviarVerificacao(dependenciasDeAuth(), corpo.email, requisicao.ip);

    return { ok: true };
  });

  registrarRota(app, 'entrar', async ({ corpo, requisicao, reply }) => {
    const sessao = await auth.entrar(dependenciasDeAuth(), {
      ...corpo,
      userAgent: requisicao.headers['user-agent'] ?? null,
      ip: requisicao.ip,
    });

    reply.setCookie(NOME_DO_COOKIE, sessao.token, app.opcoesDoCookieDeSessao());

    return {
      id: sessao.usuarioId,
      nome: sessao.nome,
      email: sessao.email,
      // O vínculo só é resolvido na requisição seguinte, quando o cookie chega
      estabelecimentos: [],
      estabelecimentoAtual: null,
    };
  });

  registrarRota(app, 'sair', async ({ requisicao, reply }) => {
    const identidade = requisicao.identidade;

    if (identidade !== null) {
      await encerrarSessao(deps.pools.poolGestor, identidade.sessaoId);
    }

    reply.clearCookie(NOME_DO_COOKIE, app.opcoesDoCookieDeSessao());

    return { ok: true };
  });

  registrarRota(app, 'eu', async ({ requisicao }) => comoUsuarioDaSessao(requisicao));

  registrarRota(app, 'catalogo', async ({ requisicao }) => {
    const { contexto, estabelecimento } = exigirTenant(requisicao);

    return obterCatalogoPublico(contexto, estabelecimento);
  });

  registrarRota(app, 'slots', async ({ query, requisicao, reply }) => {
    const { contexto, estabelecimento } = exigirTenant(requisicao);

    // T15 — disponibilidade nunca é cacheada: em cache, leva a agendamento
    // sobre horário ocupado
    reply.header('cache-control', 'no-store');

    return disponibilidade.obterSlots(contexto, estabelecimento.fusoHorario, {
      data: query.data,
      servicoIds: query.servicos,
      profissionalId: query.profissionalId,
    });
  });

  registrarRota(app, 'diasComVaga', async ({ query, requisicao, reply }) => {
    const { contexto, estabelecimento } = exigirTenant(requisicao);

    reply.header('cache-control', 'no-store');

    return disponibilidade.obterDiasComVaga(contexto, estabelecimento.fusoHorario, {
      mes: query.mes,
      servicoIds: query.servicos,
      profissionalId: query.profissionalId,
    });
  });

  const comPortas = app as unknown as Aplicacao;

  comPortas.portas = portas;

  return comPortas;
}
