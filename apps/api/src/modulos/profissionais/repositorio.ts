import { profissionais, profissionaisServicos } from '@agendamento/db';
import type { Profissional } from '@agendamento/dominio';
import { and, eq, isNull } from 'drizzle-orm';
import type { Transacao } from '../../infra/db/pools.ts';

export type ProfissionalComServicos = Profissional & {
  nomeExibicao: string;
  bio: string | null;
  avatarUrl: string | null;
};

export async function listarComServicos(
  tx: Transacao,
  estabelecimentoId: string,
): Promise<ProfissionalComServicos[]> {
  // Em série de propósito: a transação vive numa conexão só, que executa uma
  // consulta por vez. `Promise.all` aqui não paraleliza — enfileira, e o driver
  // avisa que vai deixar de aceitar isso.
  const pessoas = await tx
    .select({
      id: profissionais.id,
      nomeExibicao: profissionais.nomeExibicao,
      bio: profissionais.bio,
      avatarUrl: profissionais.avatarUrl,
    })
    .from(profissionais)
    .where(
      and(
        eq(profissionais.estabelecimentoId, estabelecimentoId),
        eq(profissionais.ativo, true),
        isNull(profissionais.excluidoEm),
      ),
    );

  const vinculos = await tx
    .select({
      profissionalId: profissionaisServicos.profissionalId,
      servicoId: profissionaisServicos.servicoId,
      duracaoOverrideMin: profissionaisServicos.duracaoOverrideMin,
    })
    .from(profissionaisServicos)
    .where(eq(profissionaisServicos.estabelecimentoId, estabelecimentoId));

  const porProfissional = new Map<string, Profissional['servicos'][number][]>();

  for (const vinculo of vinculos) {
    const lista = porProfissional.get(vinculo.profissionalId) ?? [];

    lista.push({ servicoId: vinculo.servicoId, duracaoOverrideMin: vinculo.duracaoOverrideMin });
    porProfissional.set(vinculo.profissionalId, lista);
  }

  return pessoas.map((pessoa) => ({
    ...pessoa,
    servicos: porProfissional.get(pessoa.id) ?? [],
  }));
}
