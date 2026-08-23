import { profissionais, sessoes, usuarios, vinculos } from '@agendamento/db';
import type { Papel } from '@agendamento/dominio';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Executor, Transacao } from '../../infra/db/pools.ts';

type Alcance = Transacao | Executor;

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  senhaHash: string | null;
  emailVerificadoEm: Date | null;
};

export async function buscarUsuarioPorEmail(
  executor: Alcance,
  email: string,
): Promise<Usuario | null> {
  const [linha] = await executor
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      senhaHash: usuarios.senhaHash,
      emailVerificadoEm: usuarios.emailVerificadoEm,
    })
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);

  return linha ?? null;
}

export async function criarUsuario(
  tx: Transacao,
  dados: { nome: string; email: string; senhaHash: string },
): Promise<string> {
  const [linha] = await tx.insert(usuarios).values(dados).returning({ id: usuarios.id });

  if (linha === undefined) {
    throw new Error('Falha ao criar usuario');
  }

  return linha.id;
}

export async function marcarEmailVerificado(tx: Transacao, usuarioId: string): Promise<void> {
  await tx
    .update(usuarios)
    .set({ emailVerificadoEm: new Date(), atualizadoEm: new Date() })
    .where(eq(usuarios.id, usuarioId));
}

export async function definirSenha(
  tx: Transacao,
  usuarioId: string,
  senhaHash: string,
): Promise<void> {
  await tx
    .update(usuarios)
    .set({ senhaHash, atualizadoEm: new Date() })
    .where(eq(usuarios.id, usuarioId));
}

export type SessaoAberta = {
  id: string;
  usuarioId: string;
  nome: string;
  email: string;
};

export async function abrirSessao(
  tx: Transacao,
  dados: {
    usuarioId: string;
    tokenHash: string;
    expiraEm: Date;
    userAgent: string | null;
    ip: string | null;
  },
): Promise<string> {
  const [linha] = await tx
    .insert(sessoes)
    .values({
      usuarioId: dados.usuarioId,
      refreshTokenHash: dados.tokenHash,
      expiraEm: dados.expiraEm,
      userAgent: dados.userAgent,
      ip: dados.ip,
      ultimoUsoEm: new Date(),
    })
    .returning({ id: sessoes.id });

  if (linha === undefined) {
    throw new Error('Falha ao abrir sessao');
  }

  return linha.id;
}

/**
 * A revogação derruba o acesso imediatamente, e é a razão de a sessão ser opaca
 * em tabela em vez de JWT (T19): sessão de 30 dias sem revogação é inaceitável
 * quando alguém sai da equipe.
 */
export async function buscarSessaoValida(
  executor: Alcance,
  tokenHash: string,
): Promise<SessaoAberta | null> {
  const [linha] = await executor
    .select({
      id: sessoes.id,
      usuarioId: sessoes.usuarioId,
      nome: usuarios.nome,
      email: usuarios.email,
    })
    .from(sessoes)
    .innerJoin(usuarios, eq(usuarios.id, sessoes.usuarioId))
    .where(
      and(
        eq(sessoes.refreshTokenHash, tokenHash),
        isNull(sessoes.revogadaEm),
        gt(sessoes.expiraEm, new Date()),
      ),
    )
    .limit(1);

  return linha ?? null;
}

/** Janela deslizante: o uso diário renova, e o abandono expira (10.2). */
export async function renovarSessao(
  executor: Alcance,
  sessaoId: string,
  expiraEm: Date,
): Promise<void> {
  await executor
    .update(sessoes)
    .set({ ultimoUsoEm: new Date(), expiraEm })
    .where(eq(sessoes.id, sessaoId));
}

export async function revogarSessao(executor: Alcance, sessaoId: string): Promise<void> {
  await executor.update(sessoes).set({ revogadaEm: new Date() }).where(eq(sessoes.id, sessaoId));
}

export async function revogarTodasDoUsuario(tx: Transacao, usuarioId: string): Promise<void> {
  await tx
    .update(sessoes)
    .set({ revogadaEm: new Date() })
    .where(and(eq(sessoes.usuarioId, usuarioId), isNull(sessoes.revogadaEm)));
}

export type VinculoAtivo = {
  id: string;
  estabelecimentoId: string;
  papel: Papel;
};

/**
 * Roda **antes** de existir tenant: é ela que descobre de quais estabelecimentos
 * o usuário participa. A política `vinculos_proprios` é o que a torna possível,
 * e ela depende de `app.usuario_id` estar definido na transação.
 */
export async function listarVinculosAtivos(
  tx: Transacao,
  usuarioId: string,
): Promise<VinculoAtivo[]> {
  // Exige transação: `set_config(..., true)` é local a ela, e fora de uma a
  // variável some antes da consulta seguinte
  await tx.execute(sql`SELECT set_config('app.usuario_id', ${usuarioId}, true)`);

  return tx
    .select({
      id: vinculos.id,
      estabelecimentoId: vinculos.estabelecimentoId,
      papel: vinculos.papel,
    })
    .from(vinculos)
    .where(and(eq(vinculos.usuarioId, usuarioId), eq(vinculos.status, 'ATIVO')));
}

/**
 * Separada da listagem de vínculos de propósito: `profissionais` tem RLS por
 * tenant, e antes de o estabelecimento estar escolhido a consulta volta vazia —
 * silenciosamente. Só depois de definir `app.estabelecimento_id` é que dá para
 * descobrir se aquele vínculo é também um profissional (2.4).
 */
export async function buscarProfissionalDoVinculo(
  tx: Transacao,
  estabelecimentoId: string,
  vinculoId: string,
): Promise<string | null> {
  await tx.execute(sql`SELECT set_config('app.estabelecimento_id', ${estabelecimentoId}, true)`);

  const [linha] = await tx
    .select({ id: profissionais.id })
    .from(profissionais)
    .where(and(eq(profissionais.vinculoId, vinculoId), isNull(profissionais.excluidoEm)))
    .limit(1);

  return linha?.id ?? null;
}
