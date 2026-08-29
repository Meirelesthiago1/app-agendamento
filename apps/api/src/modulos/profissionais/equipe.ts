import {
  agendamentos,
  profissionais,
  profissionaisServicos,
  usuarios,
  vinculos,
} from '@agendamento/db';
import { STATUS_QUE_OCUPAM } from '@agendamento/dominio';
import { and, asc, count, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { Transacao } from '../../infra/db/pools.ts';

export type MembroDaEquipe = {
  id: string;
  nomeExibicao: string;
  bio: string | null;
  avatarUrl: string | null;
  ativo: boolean;
  posicao: number | null;
  vinculoId: string | null;
  servicos: {
    servicoId: string;
    duracaoOverrideMin: number | null;
    valorOverrideCentavos: number | null;
  }[];
};

export type DadosDoProfissional = {
  nomeExibicao: string;
  bio: string | null;
  avatarUrl: string | null;
  posicao: number | null;
  vinculoId: string | null;
};

/** Inclui inativos: 6.3 permite desligar, e reativar precisa do mesmo lugar. */
export async function listarProfissionais(
  tx: Transacao,
  estabelecimentoId: string,
): Promise<MembroDaEquipe[]> {
  const pessoas = await tx
    .select({
      id: profissionais.id,
      nomeExibicao: profissionais.nomeExibicao,
      bio: profissionais.bio,
      avatarUrl: profissionais.avatarUrl,
      ativo: profissionais.ativo,
      posicao: profissionais.posicao,
      vinculoId: profissionais.vinculoId,
    })
    .from(profissionais)
    .where(
      and(eq(profissionais.estabelecimentoId, estabelecimentoId), isNull(profissionais.excluidoEm)),
    )
    .orderBy(asc(profissionais.posicao), asc(profissionais.nomeExibicao));

  const ligacoes = await tx
    .select({
      profissionalId: profissionaisServicos.profissionalId,
      servicoId: profissionaisServicos.servicoId,
      duracaoOverrideMin: profissionaisServicos.duracaoOverrideMin,
      valorOverrideCentavos: profissionaisServicos.valorOverrideCentavos,
    })
    .from(profissionaisServicos)
    .where(eq(profissionaisServicos.estabelecimentoId, estabelecimentoId));

  const porProfissional = new Map<string, MembroDaEquipe['servicos']>();

  for (const ligacao of ligacoes) {
    const lista = porProfissional.get(ligacao.profissionalId) ?? [];

    lista.push({
      servicoId: ligacao.servicoId,
      duracaoOverrideMin: ligacao.duracaoOverrideMin,
      valorOverrideCentavos: ligacao.valorOverrideCentavos,
    });
    porProfissional.set(ligacao.profissionalId, lista);
  }

  return pessoas.map((pessoa) => ({
    ...pessoa,
    servicos: porProfissional.get(pessoa.id) ?? [],
  }));
}

export type AcessoDaEquipe = {
  vinculoId: string;
  nome: string;
  email: string;
  papel: 'PROPRIETARIO' | 'ADMIN' | 'FUNCIONARIO';
  status: 'CONVIDADO' | 'ATIVO' | 'DESATIVADO';
  profissionalId: string | null;
};

/**
 * `usuarios` não tem tenant e por isso não tem política de RLS: a mesma pessoa
 * pode ter vínculo em vários estabelecimentos. Quem escopa é o join com
 * `vinculos`, que é onde a política vive.
 */
export async function listarAcessos(
  tx: Transacao,
  estabelecimentoId: string,
): Promise<AcessoDaEquipe[]> {
  const linhas = await tx
    .select({
      vinculoId: vinculos.id,
      nome: usuarios.nome,
      email: usuarios.email,
      papel: vinculos.papel,
      status: vinculos.status,
    })
    .from(vinculos)
    .innerJoin(usuarios, eq(vinculos.usuarioId, usuarios.id))
    .where(eq(vinculos.estabelecimentoId, estabelecimentoId))
    .orderBy(asc(usuarios.nome));

  const ligados = await tx
    .select({ id: profissionais.id, vinculoId: profissionais.vinculoId })
    .from(profissionais)
    .where(
      and(eq(profissionais.estabelecimentoId, estabelecimentoId), isNull(profissionais.excluidoEm)),
    );

  const porVinculo = new Map(
    ligados
      .filter((pessoa) => pessoa.vinculoId !== null)
      .map((pessoa) => [pessoa.vinculoId as string, pessoa.id]),
  );

  return linhas.map((linha) => ({
    ...linha,
    profissionalId: porVinculo.get(linha.vinculoId) ?? null,
  }));
}

/** O vínculo precisa ser deste estabelecimento antes de virar profissional. */
export async function vinculoEhDoTenant(
  tx: Transacao,
  estabelecimentoId: string,
  vinculoId: string,
): Promise<boolean> {
  const [linha] = await tx
    .select({ id: vinculos.id })
    .from(vinculos)
    .where(and(eq(vinculos.id, vinculoId), eq(vinculos.estabelecimentoId, estabelecimentoId)))
    .limit(1);

  return linha !== undefined;
}

export async function criarProfissional(
  tx: Transacao,
  estabelecimentoId: string,
  dados: DadosDoProfissional,
): Promise<void> {
  await tx.insert(profissionais).values({ ...dados, estabelecimentoId });
}

export async function atualizarProfissional(
  tx: Transacao,
  estabelecimentoId: string,
  id: string,
  dados: DadosDoProfissional,
): Promise<number> {
  const alterados = await tx
    .update(profissionais)
    .set({ ...dados, atualizadoEm: new Date() })
    .where(and(eq(profissionais.id, id), eq(profissionais.estabelecimentoId, estabelecimentoId)))
    .returning({ id: profissionais.id });

  return alterados.length;
}

export async function definirAtivo(
  tx: Transacao,
  estabelecimentoId: string,
  id: string,
  ativo: boolean,
): Promise<number> {
  const alterados = await tx
    .update(profissionais)
    .set({ ativo, atualizadoEm: new Date() })
    .where(and(eq(profissionais.id, id), eq(profissionais.estabelecimentoId, estabelecimentoId)))
    .returning({ id: profissionais.id });

  return alterados.length;
}

export async function existeProfissional(
  tx: Transacao,
  estabelecimentoId: string,
  id: string,
): Promise<boolean> {
  const [linha] = await tx
    .select({ id: profissionais.id })
    .from(profissionais)
    .where(
      and(
        eq(profissionais.id, id),
        eq(profissionais.estabelecimentoId, estabelecimentoId),
        isNull(profissionais.excluidoEm),
      ),
    )
    .limit(1);

  return linha !== undefined;
}

export type LigacaoDeServico = {
  servicoId: string;
  duracaoOverrideMin: number | null;
  valorOverrideCentavos: number | null;
};

/**
 * Apaga e reinsere: a tela edita a lista inteira, com caixas marcadas, e
 * calcular o diferencial aqui produziria três consultas para chegar ao mesmo
 * estado. A transação torna a troca atômica.
 */
export async function definirServicos(
  tx: Transacao,
  estabelecimentoId: string,
  profissionalId: string,
  ligacoes: readonly LigacaoDeServico[],
): Promise<void> {
  await tx
    .delete(profissionaisServicos)
    .where(
      and(
        eq(profissionaisServicos.estabelecimentoId, estabelecimentoId),
        eq(profissionaisServicos.profissionalId, profissionalId),
      ),
    );

  if (ligacoes.length > 0) {
    await tx.insert(profissionaisServicos).values(
      ligacoes.map((ligacao) => ({
        estabelecimentoId,
        profissionalId,
        servicoId: ligacao.servicoId,
        duracaoOverrideMin: ligacao.duracaoOverrideMin,
        valorOverrideCentavos: ligacao.valorOverrideCentavos,
      })),
    );
  }
}

/** A conta que 6.3 exige antes de deixar desativar um profissional. */
export async function contarAgendaFuturaDoProfissional(
  tx: Transacao,
  estabelecimentoId: string,
  profissionalId: string,
  agora: Date,
): Promise<number> {
  const [linha] = await tx
    .select({ total: count() })
    .from(agendamentos)
    .where(
      and(
        eq(agendamentos.estabelecimentoId, estabelecimentoId),
        eq(agendamentos.profissionalId, profissionalId),
        inArray(agendamentos.status, [...STATUS_QUE_OCUPAM]),
        gt(agendamentos.iniciaEm, agora),
      ),
    );

  return linha?.total ?? 0;
}
