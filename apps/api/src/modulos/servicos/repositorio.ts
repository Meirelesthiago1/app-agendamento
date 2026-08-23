import { servicos } from '@agendamento/db';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Transacao } from '../../infra/db/pools.ts';

export type ServicoPublico = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  duracaoMin: number;
  folgaAntesMin: number;
  folgaDepoisMin: number;
  valorCentavos: number | null;
  exibicaoValor: 'FIXO' | 'A_PARTIR_DE' | 'OCULTO' | 'GRATUITO';
  cor: string | null;
  categoriaId: string | null;
};

/**
 * O filtro explícito de `estabelecimento_id` acompanha a policy de RLS em toda
 * query (T7). Além da defesa em profundidade, o planner usa a cláusula para
 * escolher índice.
 */
export async function listar(
  tx: Transacao,
  estabelecimentoId: string,
  ids?: readonly string[],
): Promise<ServicoPublico[]> {
  const filtros = [
    eq(servicos.estabelecimentoId, estabelecimentoId),
    eq(servicos.ativo, true),
    isNull(servicos.excluidoEm),
  ];

  if (ids !== undefined) {
    filtros.push(inArray(servicos.id, [...ids]));
  }

  return tx
    .select({
      id: servicos.id,
      slug: servicos.slug,
      nome: servicos.nome,
      descricao: servicos.descricao,
      duracaoMin: servicos.duracaoMin,
      folgaAntesMin: servicos.folgaAntesMin,
      folgaDepoisMin: servicos.folgaDepoisMin,
      valorCentavos: servicos.valorCentavos,
      exibicaoValor: servicos.exibicaoValor,
      cor: servicos.cor,
      categoriaId: servicos.categoriaId,
    })
    .from(servicos)
    .where(and(...filtros));
}
