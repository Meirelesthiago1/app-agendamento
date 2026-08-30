import { codigosVerificacao } from '@agendamento/db';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Transacao } from '../../infra/db/pools.ts';
import { gerarToken, hashDeToken } from './token.ts';

/**
 * O enum do banco tem também `VERIFICACAO_EMAIL`, que nada emite hoje: gestor
 * entra por convite (2.2), e o aceite já verifica o e-mail. O valor fica na
 * coluna para o cadastro opcional do cliente, na etapa 11 — tirá-lo custaria
 * uma migração de tipo para devolvê-lo depois.
 */
export type Finalidade = 'OTP_TELEFONE' | 'RECUPERACAO_SENHA' | 'CONVITE_EQUIPE';

/** Os prazos da seção 4 do conteúdo. */
export const VALIDADE_EM_HORAS: Record<Finalidade, number> = {
  OTP_TELEFONE: 5 / 60,
  RECUPERACAO_SENHA: 1,
  CONVITE_EQUIPE: 7 * 24,
};

export const MAX_TENTATIVAS = 5;

export type TokenEmitido = {
  token: string;
  expiraEm: Date;
};

export async function emitirToken(
  tx: Transacao,
  dados: {
    destino: string;
    finalidade: Finalidade;
    referenciaId: string | null;
    ip: string | null;
  },
): Promise<TokenEmitido> {
  const token = gerarToken();
  const expiraEm = new Date(Date.now() + VALIDADE_EM_HORAS[dados.finalidade] * 60 * 60 * 1000);

  await tx.insert(codigosVerificacao).values({
    destino: dados.destino,
    canal: 'EMAIL',
    finalidade: dados.finalidade,
    referenciaId: dados.referenciaId,
    codigoHash: hashDeToken(token),
    expiraEm,
    ip: dados.ip,
  });

  return { token, expiraEm };
}

export type CodigoValido = {
  id: string;
  destino: string;
  referenciaId: string | null;
};

/**
 * A finalidade entra na busca, não só no registro: sem ela, um token emitido
 * para confirmar e-mail seria aceito como redefinição de senha — o hash é o
 * mesmo, e nada distinguiria os dois.
 */
export async function consumirToken(
  tx: Transacao,
  token: string,
  finalidade: Finalidade,
): Promise<CodigoValido | null> {
  const [linha] = await tx
    .select({
      id: codigosVerificacao.id,
      destino: codigosVerificacao.destino,
      referenciaId: codigosVerificacao.referenciaId,
    })
    .from(codigosVerificacao)
    .where(
      and(
        eq(codigosVerificacao.codigoHash, hashDeToken(token)),
        eq(codigosVerificacao.finalidade, finalidade),
        isNull(codigosVerificacao.consumidoEm),
        gt(codigosVerificacao.expiraEm, new Date()),
      ),
    )
    .limit(1);

  if (linha === undefined) {
    return null;
  }

  // Marcar antes de qualquer efeito: o token é de uso único, e o link circula
  await tx
    .update(codigosVerificacao)
    .set({ consumidoEm: new Date() })
    .where(eq(codigosVerificacao.id, linha.id));

  return linha;
}

/** Um pedido novo invalida os anteriores da mesma finalidade e destino. */
export async function invalidarAnteriores(
  tx: Transacao,
  destino: string,
  finalidade: Finalidade,
): Promise<void> {
  await tx
    .update(codigosVerificacao)
    .set({ consumidoEm: new Date() })
    .where(
      and(
        eq(codigosVerificacao.destino, destino),
        eq(codigosVerificacao.finalidade, finalidade),
        isNull(codigosVerificacao.consumidoEm),
      ),
    );
}
