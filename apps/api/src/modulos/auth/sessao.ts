import type { Config } from '../../config.ts';
import { type Executor, emTransacao, type Transacao } from '../../infra/db/pools.ts';
import * as repositorio from './repositorio.ts';
import { gerarToken, hashDeToken } from './token.ts';

/** 30 dias (10.2). Pedir login semanalmente em PWA de uso diário é hostil. */
export const DIAS_DE_SESSAO = 30;

export const NOME_DO_COOKIE = 'sessao';

/**
 * Só renova quando falta mais de um dia de uso desde a última vez. Escrever em
 * `sessoes` a cada requisição transformaria a tabela mais quente do sistema num
 * ponto de escrita constante, sem ganho: a janela é de trinta dias.
 */
const INTERVALO_DE_RENOVACAO_MS = 24 * 60 * 60 * 1000;

export function expiracaoDaSessao(agora = new Date()): Date {
  return new Date(agora.getTime() + DIAS_DE_SESSAO * 24 * 60 * 60 * 1000);
}

/**
 * Cookie no domínio pai (10.6): `app.dominio.com`, `auth.dominio.com` e
 * `{slug}.dominio.com` são origens distintas, e a sessão precisa atravessá-las.
 *
 * Derivado de `APP_URL` em vez de configurado à parte — uma variável a menos
 * para divergir do endereço real. Em `localhost` não há domínio: o navegador
 * recusa o atributo, e a sessão vale só para a origem, que é o suficiente em
 * desenvolvimento.
 */
export function dominioDoCookie(appUrl: string): string | undefined {
  const { hostname } = new URL(appUrl);

  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return undefined;
  }

  const partes = hostname.split('.');

  return partes.length > 2 ? `.${partes.slice(-2).join('.')}` : `.${hostname}`;
}

export function opcoesDoCookie(config: Config) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    domain: dominioDoCookie(config.APP_URL),
    maxAge: DIAS_DE_SESSAO * 24 * 60 * 60,
  };
}

export type Identidade = {
  sessaoId: string;
  usuarioId: string;
  nome: string;
  email: string;
  vinculos: repositorio.VinculoAtivo[];
  /** Nulo quando há mais de um vínculo e o cliente ainda não escolheu. */
  escolhido: (repositorio.VinculoAtivo & { profissionalId: string | null }) | null;
  /** O cliente pediu um estabelecimento que não é dele. */
  pedidoRecusado: boolean;
};

export async function criarSessao(
  tx: Transacao,
  dados: { usuarioId: string; userAgent: string | null; ip: string | null },
): Promise<string> {
  const token = gerarToken();

  await repositorio.abrirSessao(tx, {
    usuarioId: dados.usuarioId,
    tokenHash: hashDeToken(token),
    expiraEm: expiracaoDaSessao(),
    userAgent: dados.userAgent,
    ip: dados.ip,
  });

  return token;
}

/**
 * Resolve quem é o usuário e de quais estabelecimentos ele participa. Tudo numa
 * transação só, porque a listagem de vínculos depende de uma variável de sessão
 * local à transação.
 */
export async function resolverIdentidade(
  pool: Executor,
  token: string,
  estabelecimentoPedido?: string,
): Promise<Identidade | null> {
  return emTransacao(pool, async (tx) => {
    const sessao = await repositorio.buscarSessaoValida(tx, hashDeToken(token));

    if (sessao === null) {
      return null;
    }

    const vinculos = await repositorio.listarVinculosAtivos(tx, sessao.usuarioId);

    // Um só vínculo dispensa escolha; vários exigem que o cliente diga qual
    const alvo =
      estabelecimentoPedido === undefined
        ? vinculos.length === 1
          ? vinculos[0]
          : undefined
        : vinculos.find((v) => v.estabelecimentoId === estabelecimentoPedido);

    const base = {
      sessaoId: sessao.id,
      usuarioId: sessao.usuarioId,
      nome: sessao.nome,
      email: sessao.email,
      vinculos,
    };

    if (alvo === undefined) {
      return {
        ...base,
        escolhido: null,
        pedidoRecusado: estabelecimentoPedido !== undefined,
      };
    }

    return {
      ...base,
      escolhido: {
        ...alvo,
        profissionalId: await repositorio.buscarProfissionalDoVinculo(
          tx,
          alvo.estabelecimentoId,
          alvo.id,
        ),
      },
      pedidoRecusado: false,
    };
  });
}

export async function renovarSePreciso(
  pool: Executor,
  sessaoId: string,
  ultimoUsoEm: Date | null,
): Promise<void> {
  const passou =
    ultimoUsoEm === null || Date.now() - ultimoUsoEm.getTime() > INTERVALO_DE_RENOVACAO_MS;

  if (passou) {
    await repositorio.renovarSessao(pool, sessaoId, expiracaoDaSessao());
  }
}

export async function encerrarSessao(pool: Executor, sessaoId: string): Promise<void> {
  await repositorio.revogarSessao(pool, sessaoId);
}
