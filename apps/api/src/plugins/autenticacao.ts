import { ErroDominio, type Papel } from '@agendamento/dominio';
import cookie from '@fastify/cookie';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Config } from '../config.ts';
import type { Pools } from '../infra/db/pools.ts';
import {
  type Identidade,
  NOME_DO_COOKIE,
  opcoesDoCookie,
  resolverIdentidade,
} from '../modulos/auth/sessao.ts';

export type Autenticado = {
  sessaoId: string;
  usuarioId: string;
  nome: string;
  email: string;
  papel: Papel;
  profissionalId: string | null;
  estabelecimentoId: string;
  /** Alimenta o seletor de estabelecimento da etapa 6. */
  estabelecimentosDisponiveis: string[];
};

declare module 'fastify' {
  interface FastifyRequest {
    autenticado: Autenticado | null;
    /** Quem é a pessoa, mesmo sem estabelecimento escolhido ainda. */
    identidade: Identidade | null;
  }

  interface FastifyInstance {
    opcoesDoCookieDeSessao: () => ReturnType<typeof opcoesDoCookie>;
  }
}

/**
 * O painel vive num endereço único (`app.dominio.com`, 3.4), então o
 * estabelecimento corrente não vem do subdomínio: o cliente informa qual
 * escolheu, e o servidor confere se existe vínculo ativo. Sem estado no
 * servidor, trocar de estabelecimento é instantâneo — que é o que o seletor da
 * etapa 6 precisa.
 */
export const CABECALHO_DO_ESTABELECIMENTO = 'x-estabelecimento';

export type OpcoesDeAutenticacao = {
  config: Config;
  pools: Pools;
};

export const pluginDeAutenticacao = fp<OpcoesDeAutenticacao>(
  async (app: FastifyInstance, opcoes) => {
    await app.register(cookie, { secret: opcoes.config.SESSAO_SEGREDO });

    app.decorateRequest('autenticado', null);
    app.decorateRequest('identidade', null);
    app.decorate('opcoesDoCookieDeSessao', () => opcoesDoCookie(opcoes.config));

    app.addHook('onRequest', async (requisicao: FastifyRequest) => {
      const token = requisicao.cookies[NOME_DO_COOKIE];

      if (token === undefined) {
        return;
      }

      const pedido = requisicao.headers[CABECALHO_DO_ESTABELECIMENTO];
      const identidade = await resolverIdentidade(
        opcoes.pools.poolGestor,
        token,
        typeof pedido === 'string' ? pedido : undefined,
      );

      if (identidade === null) {
        requisicao.log.debug('sessao invalida ou expirada');
        return;
      }

      if (identidade.pedidoRecusado) {
        // Mesma resposta de "não existe": confirmar que existe e não é seu já é
        // informação sobre o sistema (1.1 do conteúdo)
        throw new ErroDominio('NAO_ENCONTRADO', 'Estabelecimento não encontrado.');
      }

      requisicao.identidade = identidade;

      const escolhido = identidade.escolhido;

      if (escolhido === null) {
        return;
      }

      requisicao.autenticado = {
        sessaoId: identidade.sessaoId,
        usuarioId: identidade.usuarioId,
        nome: identidade.nome,
        email: identidade.email,
        papel: escolhido.papel,
        profissionalId: escolhido.profissionalId,
        estabelecimentoId: escolhido.estabelecimentoId,
        estabelecimentosDisponiveis: identidade.vinculos.map((v) => v.estabelecimentoId),
      };
    });
  },
);
