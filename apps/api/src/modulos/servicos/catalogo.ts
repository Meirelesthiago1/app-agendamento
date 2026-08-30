import { agendamentoItens, agendamentos, categoriasServico, servicos } from '@agendamento/db';
import { STATUS_QUE_OCUPAM } from '@agendamento/dominio';
import { and, asc, count, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import type { Transacao } from '../../infra/db/pools.ts';

export type CategoriaDoPainel = {
  id: string;
  nome: string;
  posicao: number | null;
};

export type DadosDaCategoria = Omit<CategoriaDoPainel, 'id'>;

export async function listarCategorias(
  tx: Transacao,
  estabelecimentoId: string,
): Promise<CategoriaDoPainel[]> {
  return tx
    .select({
      id: categoriasServico.id,
      nome: categoriasServico.nome,
      posicao: categoriasServico.posicao,
    })
    .from(categoriasServico)
    .where(eq(categoriasServico.estabelecimentoId, estabelecimentoId))
    .orderBy(asc(categoriasServico.posicao), asc(categoriasServico.nome));
}

export async function criarCategoria(
  tx: Transacao,
  estabelecimentoId: string,
  dados: DadosDaCategoria,
): Promise<void> {
  await tx.insert(categoriasServico).values({ ...dados, estabelecimentoId });
}

export async function atualizarCategoria(
  tx: Transacao,
  estabelecimentoId: string,
  id: string,
  dados: DadosDaCategoria,
): Promise<number> {
  const alteradas = await tx
    .update(categoriasServico)
    .set({ ...dados, atualizadoEm: new Date() })
    .where(
      and(eq(categoriasServico.id, id), eq(categoriasServico.estabelecimentoId, estabelecimentoId)),
    )
    .returning({ id: categoriasServico.id });

  return alteradas.length;
}

/**
 * Remover categoria **solta** os serviços em vez de removê-los junto. Apagar
 * cinco serviços por apagar o agrupamento deles seria perda de dado sem aviso,
 * e a FK não deixaria de qualquer forma.
 */
export async function removerCategoria(
  tx: Transacao,
  estabelecimentoId: string,
  id: string,
): Promise<number> {
  await tx
    .update(servicos)
    .set({ categoriaId: null, atualizadoEm: new Date() })
    .where(and(eq(servicos.categoriaId, id), eq(servicos.estabelecimentoId, estabelecimentoId)));

  const removidas = await tx
    .delete(categoriasServico)
    .where(
      and(eq(categoriasServico.id, id), eq(categoriasServico.estabelecimentoId, estabelecimentoId)),
    )
    .returning({ id: categoriasServico.id });

  return removidas.length;
}

export type ServicoDoPainel = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  categoriaId: string | null;
  duracaoMin: number;
  folgaAntesMin: number;
  folgaDepoisMin: number;
  valorCentavos: number | null;
  exibicaoValor: 'FIXO' | 'A_PARTIR_DE' | 'OCULTO' | 'GRATUITO';
  cor: string | null;
  ativo: boolean;
  posicao: number | null;
};

export type DadosDoServico = Omit<ServicoDoPainel, 'id' | 'ativo'>;

const COLUNAS = {
  id: servicos.id,
  slug: servicos.slug,
  nome: servicos.nome,
  descricao: servicos.descricao,
  categoriaId: servicos.categoriaId,
  duracaoMin: servicos.duracaoMin,
  folgaAntesMin: servicos.folgaAntesMin,
  folgaDepoisMin: servicos.folgaDepoisMin,
  valorCentavos: servicos.valorCentavos,
  exibicaoValor: servicos.exibicaoValor,
  cor: servicos.cor,
  ativo: servicos.ativo,
  posicao: servicos.posicao,
};

/** Inclui inativos: quem edita o catálogo precisa poder reativar o que desligou. */
export async function listarParaGestao(
  tx: Transacao,
  estabelecimentoId: string,
): Promise<ServicoDoPainel[]> {
  return tx
    .select(COLUNAS)
    .from(servicos)
    .where(and(eq(servicos.estabelecimentoId, estabelecimentoId), isNull(servicos.excluidoEm)))
    .orderBy(asc(servicos.posicao), asc(servicos.nome));
}

export async function slugDeServicoLivre(
  tx: Transacao,
  estabelecimentoId: string,
  slug: string,
  exceto: string | null,
): Promise<boolean> {
  const filtros = [eq(servicos.estabelecimentoId, estabelecimentoId), eq(servicos.slug, slug)];

  if (exceto !== null) {
    filtros.push(ne(servicos.id, exceto));
  }

  const [linha] = await tx
    .select({ id: servicos.id })
    .from(servicos)
    .where(and(...filtros))
    .limit(1);

  return linha === undefined;
}

export async function criarServico(
  tx: Transacao,
  estabelecimentoId: string,
  dados: DadosDoServico,
): Promise<void> {
  await tx.insert(servicos).values({ ...dados, estabelecimentoId });
}

export async function atualizarServico(
  tx: Transacao,
  estabelecimentoId: string,
  id: string,
  dados: DadosDoServico,
): Promise<number> {
  const alterados = await tx
    .update(servicos)
    .set({ ...dados, atualizadoEm: new Date() })
    .where(and(eq(servicos.id, id), eq(servicos.estabelecimentoId, estabelecimentoId)))
    .returning({ id: servicos.id });

  return alterados.length;
}

export async function definirAtivo(
  tx: Transacao,
  estabelecimentoId: string,
  id: string,
  ativo: boolean,
): Promise<number> {
  const alterados = await tx
    .update(servicos)
    .set({ ativo, atualizadoEm: new Date() })
    .where(and(eq(servicos.id, id), eq(servicos.estabelecimentoId, estabelecimentoId)))
    .returning({ id: servicos.id });

  return alterados.length;
}

/**
 * Quantos agendamentos ainda por acontecer usam este serviço — a conta que 6.3
 * exige antes de deixar desativar. Conta pelos itens, e não por
 * `agendamentos.servico_id`, que não existe: um agendamento tem vários serviços,
 * e desativar um deles afeta o agendamento inteiro.
 */
export async function contarAgendaFuturaDoServico(
  tx: Transacao,
  estabelecimentoId: string,
  servicoId: string,
  agora: Date,
): Promise<number> {
  const [linha] = await tx
    .select({ total: count() })
    .from(agendamentoItens)
    .innerJoin(agendamentos, eq(agendamentoItens.agendamentoId, agendamentos.id))
    .where(
      and(
        eq(agendamentoItens.estabelecimentoId, estabelecimentoId),
        eq(agendamentoItens.servicoId, servicoId),
        inArray(agendamentos.status, [...STATUS_QUE_OCUPAM]),
        gt(agendamentos.iniciaEm, agora),
      ),
    );

  return linha?.total ?? 0;
}
