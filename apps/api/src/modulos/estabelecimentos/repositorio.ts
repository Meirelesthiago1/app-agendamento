import { configuracoes, estabelecimentos } from '@agendamento/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { Executor, Transacao } from '../../infra/db/pools.ts';

export type Estabelecimento = {
  id: string;
  slug: string;
  nome: string;
  fusoHorario: string;
  logoUrl: string | null;
  corTema: string | null;
  telefonePublico: string | null;
  enderecoPublico: string | null;
};

/**
 * A única consulta que aceita executor fora de transação, porque é a que
 * descobre o tenant — e portanto roda antes da transação que define
 * `app.estabelecimento_id`. Todo o resto recebe `Transacao` (T11).
 */
export async function buscarPorSlug(
  executor: Transacao | Executor,
  slug: string,
): Promise<Estabelecimento | null> {
  const [linha] = await executor
    .select({
      id: estabelecimentos.id,
      slug: estabelecimentos.slug,
      nome: estabelecimentos.nome,
      fusoHorario: estabelecimentos.fusoHorario,
      logoUrl: estabelecimentos.logoUrl,
      corTema: estabelecimentos.corTema,
      telefonePublico: estabelecimentos.telefonePublico,
      enderecoPublico: estabelecimentos.enderecoPublico,
    })
    .from(estabelecimentos)
    .where(and(eq(estabelecimentos.slug, slug), isNull(estabelecimentos.excluidoEm)))
    .limit(1);

  return linha ?? null;
}

export async function buscarConfiguracao(tx: Transacao, estabelecimentoId: string) {
  const [linha] = await tx
    .select()
    .from(configuracoes)
    .where(eq(configuracoes.estabelecimentoId, estabelecimentoId))
    .limit(1);

  return linha ?? null;
}

/** Os campos que a tela de configurações edita, já sob o tenant da transação. */
export async function buscarParaGestao(tx: Transacao, estabelecimentoId: string) {
  const [linha] = await tx
    .select({
      id: estabelecimentos.id,
      nome: estabelecimentos.nome,
      slug: estabelecimentos.slug,
      segmento: estabelecimentos.segmento,
      fusoHorario: estabelecimentos.fusoHorario,
      logoUrl: estabelecimentos.logoUrl,
      corTema: estabelecimentos.corTema,
      telefonePublico: estabelecimentos.telefonePublico,
      enderecoPublico: estabelecimentos.enderecoPublico,
    })
    .from(estabelecimentos)
    .where(and(eq(estabelecimentos.id, estabelecimentoId), isNull(estabelecimentos.excluidoEm)))
    .limit(1);

  return linha ?? null;
}

export type DadosDoEstabelecimento = {
  nome: string;
  slug: string;
  segmento: string | null;
  fusoHorario: string;
  logoUrl: string | null;
  corTema: string | null;
  telefonePublico: string | null;
  enderecoPublico: string | null;
};

export async function atualizarDados(
  tx: Transacao,
  estabelecimentoId: string,
  dados: DadosDoEstabelecimento,
): Promise<void> {
  await tx
    .update(estabelecimentos)
    .set({ ...dados, atualizadoEm: new Date() })
    .where(eq(estabelecimentos.id, estabelecimentoId));
}

/** Quem usa o slug é outro tenant, fora da RLS: a busca precisa do id inteiro. */
export async function slugEstaLivre(
  executor: Transacao | Executor,
  slugDesejado: string,
  exceto: string,
): Promise<boolean> {
  const [linha] = await executor
    .select({ id: estabelecimentos.id })
    .from(estabelecimentos)
    .where(eq(estabelecimentos.slug, slugDesejado))
    .limit(1);

  return linha === undefined || linha.id === exceto;
}

export type Politicas = Omit<
  typeof configuracoes.$inferInsert,
  'estabelecimentoId' | 'criadoEm' | 'atualizadoEm'
>;

export async function atualizarPoliticas(
  tx: Transacao,
  estabelecimentoId: string,
  politicas: Politicas,
): Promise<void> {
  await tx
    .update(configuracoes)
    .set({ ...politicas, atualizadoEm: new Date() })
    .where(eq(configuracoes.estabelecimentoId, estabelecimentoId));
}
