import { type EnviadorEmail, ErroDominio } from '@agendamento/dominio';
import type { Config } from '../../config.ts';
import { emailDeVerificacao } from '../../emails/index.ts';
import { type Executor, emTransacao } from '../../infra/db/pools.ts';
import { consumirToken, emitirToken, invalidarAnteriores } from './codigos.ts';
import * as repositorio from './repositorio.ts';
import { gerarHashDeSenha, senhaConfere } from './senha.ts';
import { criarSessao } from './sessao.ts';

export type Dependencias = {
  pool: Executor;
  email: EnviadorEmail;
  config: Config;
};

export type DadosDeCadastro = {
  nome: string;
  email: string;
  senha: string;
  ip: string | null;
};

function linkDeVerificacao(config: Config, token: string): string {
  return `${config.APP_URL.replace(/\/$/, '')}/verificar-email?token=${token}`;
}

/**
 * A resposta é sempre a mesma, exista a conta ou não (1.1 do conteúdo).
 * Diferenciar entregaria quais e-mails estão na base a quem só precisa de um
 * formulário e paciência.
 */
export async function cadastrar(deps: Dependencias, dados: DadosDeCadastro): Promise<void> {
  const enviar = await emTransacao(deps.pool, async (tx) => {
    const existente = await repositorio.buscarUsuarioPorEmail(tx, dados.email);

    if (existente !== null) {
      // Conta já existe: nada é criado e nada é dito. Quem esqueceu que tem
      // conta chega pela recuperação de senha, que também não revela nada.
      return null;
    }

    const usuarioId = await repositorio.criarUsuario(tx, {
      nome: dados.nome,
      email: dados.email,
      senhaHash: await gerarHashDeSenha(dados.senha),
    });

    const { token } = await emitirToken(tx, {
      destino: dados.email,
      finalidade: 'VERIFICACAO_EMAIL',
      referenciaId: usuarioId,
      ip: dados.ip,
    });

    return { nome: dados.nome, token };
  });

  if (enviar === null) {
    return;
  }

  // Fora da transação: e-mail não é atômico, e uma falha de SMTP não pode
  // desfazer a criação da conta. O outbox de 6.5 resolve isso na etapa 12.
  await deps.email.enviar(
    await emailDeVerificacao(dados.email, {
      nome: enviar.nome,
      link: linkDeVerificacao(deps.config, enviar.token),
    }),
  );
}

export async function verificarEmail(deps: Dependencias, token: string): Promise<void> {
  const verificado = await emTransacao(deps.pool, async (tx) => {
    const codigo = await consumirToken(tx, token, 'VERIFICACAO_EMAIL');

    if (codigo === null || codigo.referenciaId === null) {
      return false;
    }

    await repositorio.marcarEmailVerificado(tx, codigo.referenciaId);

    return true;
  });

  if (!verificado) {
    throw new ErroDominio('NAO_ENCONTRADO', 'Este link expirou ou já foi usado. Peça um novo.');
  }
}

export async function reenviarVerificacao(
  deps: Dependencias,
  email: string,
  ip: string | null,
): Promise<void> {
  const enviar = await emTransacao(deps.pool, async (tx) => {
    const usuario = await repositorio.buscarUsuarioPorEmail(tx, email);

    if (usuario === null || usuario.emailVerificadoEm !== null) {
      return null;
    }

    await invalidarAnteriores(tx, email, 'VERIFICACAO_EMAIL');

    const { token } = await emitirToken(tx, {
      destino: email,
      finalidade: 'VERIFICACAO_EMAIL',
      referenciaId: usuario.id,
      ip,
    });

    return { nome: usuario.nome, token };
  });

  if (enviar === null) {
    return;
  }

  await deps.email.enviar(
    await emailDeVerificacao(email, {
      nome: enviar.nome,
      link: linkDeVerificacao(deps.config, enviar.token),
    }),
  );
}

export type DadosDeEntrada = {
  email: string;
  senha: string;
  userAgent: string | null;
  ip: string | null;
};

export type SessaoIniciada = {
  token: string;
  usuarioId: string;
  nome: string;
  email: string;
};

/**
 * Uma mensagem só para senha errada, e-mail inexistente e e-mail não
 * verificado (1.1). Distinguir entrega a lista de contas, e o gestor que digitou
 * a senha errada não precisa saber qual dos três aconteceu — precisa tentar de
 * novo.
 */
const CREDENCIAL_INVALIDA = 'E-mail ou senha incorretos.';

export async function entrar(deps: Dependencias, dados: DadosDeEntrada): Promise<SessaoIniciada> {
  const resultado = await emTransacao(deps.pool, async (tx) => {
    const usuario = await repositorio.buscarUsuarioPorEmail(tx, dados.email);

    if (usuario === null) {
      // Gasta o mesmo tempo de um acerto: sem isto, a diferença de resposta
      // entrega quais e-mails existem
      await gerarHashDeSenha(dados.senha);
      return null;
    }

    if (!(await senhaConfere(dados.senha, usuario.senhaHash))) {
      return null;
    }

    if (usuario.emailVerificadoEm === null) {
      return null;
    }

    return {
      token: await criarSessao(tx, {
        usuarioId: usuario.id,
        userAgent: dados.userAgent,
        ip: dados.ip,
      }),
      usuarioId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
    };
  });

  if (resultado === null) {
    throw new ErroDominio('SEM_PERMISSAO', CREDENCIAL_INVALIDA);
  }

  return resultado;
}
