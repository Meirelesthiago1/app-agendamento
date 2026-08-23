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
