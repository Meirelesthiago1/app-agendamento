import {
  type ContextoDeDisponibilidade,
  calcularSlots,
  type DataLocal,
  diasComVaga,
  ErroDominio,
  emUtc,
  type ItemPedido,
  type Profissional,
  profissionaisElegiveis,
  somarDias,
} from '@agendamento/dominio';
import { DateTime } from 'luxon';
import type { Contexto } from '../../contexto.ts';
import { type Transacao, unidadeDeTrabalho } from '../../infra/db/pools.ts';
import * as repoAgendamentos from '../agendamentos/repositorio.ts';
import * as repoEstabelecimentos from '../estabelecimentos/repositorio.ts';
import * as repoHorarios from '../horarios/repositorio.ts';
import * as repoProfissionais from '../profissionais/repositorio.ts';
import * as repoServicos from '../servicos/repositorio.ts';

export type PedidoDeSlots = {
  data: DataLocal;
  servicoIds: readonly string[];
  profissionalId?: string | undefined;
};

export type PedidoDeDias = {
  mes: string;
  servicoIds: readonly string[];
  profissionalId?: string | undefined;
};

type Carregado = {
  contexto: ContextoDeDisponibilidade;
  itens: ItemPedido[];
  profissionais: Profissional[];
};

function exigirServicosDistintos(servicoIds: readonly string[]): void {
  if (new Set(servicoIds).size !== servicoIds.length) {
    throw new ErroDominio('DADOS_INVALIDOS', 'Cada serviço só pode aparecer uma vez.', {
      servicos: ['serviço repetido'],
    });
  }
}

/**
 * A parte que busca. A que decide vive em `packages/dominio` e roda igual no
 * browser (5.2 do stack) — misturar as duas é como o motor acaba duplicado.
 *
 * Cada repositório é dono das consultas do seu domínio; atravessar módulos é
 * trabalho do caso de uso, que é quem orquestra (6.2).
 */
async function carregar(
  tx: Transacao,
  contexto: Contexto,
  fusoHorario: string,
  servicoIds: readonly string[],
  profissionalId: string | undefined,
  de: DataLocal,
  ate: DataLocal,
  agora: DateTime,
): Promise<Carregado> {
  exigirServicosDistintos(servicoIds);

  const config = await repoEstabelecimentos.buscarConfiguracao(tx, contexto.estabelecimentoId);
  const servicos = await repoServicos.listar(tx, contexto.estabelecimentoId, servicoIds);

  if (config === null) {
    throw new ErroDominio('NAO_ENCONTRADO', 'Estabelecimento sem configuração.');
  }

  if (servicos.length !== servicoIds.length) {
    throw new ErroDominio('NAO_ENCONTRADO', 'Um dos serviços não existe ou não está ativo.');
  }

  if (servicos.length > 1 && !config.permiteMultiplosServicos) {
    throw new ErroDominio(
      'MULTIPLOS_SERVICOS_DESABILITADO',
      'Este estabelecimento aceita um serviço por agendamento.',
    );
  }

  const porId = new Map(servicos.map((servico) => [servico.id, servico]));

  // A ordem do pedido é a ordem do bloco: `folga_antes` do primeiro e
  // `folga_depois` do último (6.2)
  const itens: ItemPedido[] = servicoIds.map((id) => {
    const servico = porId.get(id);

    if (servico === undefined) {
      throw new ErroDominio('NAO_ENCONTRADO', 'Um dos serviços não existe ou não está ativo.');
    }

    return {
      servicoId: servico.id,
      duracaoMin: servico.duracaoMin,
      folgaAntesMin: servico.folgaAntesMin,
      folgaDepoisMin: servico.folgaDepoisMin,
    };
  });

  const equipe = await repoProfissionais.listarComServicos(tx, contexto.estabelecimentoId);
  const candidatos =
    profissionalId === undefined ? equipe : equipe.filter((p) => p.id === profissionalId);
  const elegiveis = profissionaisElegiveis(candidatos, itens);

  if (elegiveis.length === 0) {
    throw new ErroDominio(
      'PROFISSIONAL_NAO_ELEGIVEL',
      'Nenhum profissional executa todos os serviços escolhidos.',
    );
  }

  const ids = elegiveis.map((profissional) => profissional.id);
  const inicioDaFaixa = emUtc(de, '00:00', fusoHorario).toJSDate();
  const fimDaFaixa = emUtc(somarDias(ate, 1), '00:00', fusoHorario).toJSDate();

  const grade = await repoHorarios.listarGrade(tx, contexto.estabelecimentoId, ids);
  const excecoes = await repoHorarios.listarExcecoes(
    tx,
    contexto.estabelecimentoId,
    inicioDaFaixa,
    fimDaFaixa,
  );
  const ocupacoes = await repoAgendamentos.listarOcupacoes(
    tx,
    contexto.estabelecimentoId,
    ids,
    inicioDaFaixa,
    fimDaFaixa,
  );

  return {
    itens,
    profissionais: elegiveis,
    contexto: {
      agora,
      fuso: fusoHorario,
      config: {
        granularidadeSlotMin: config.granularidadeSlotMin,
        estrategiaSlot: config.estrategiaSlot,
        antecedenciaMinimaMin: config.antecedenciaMinimaMin,
        janelaAgendamentoDias: config.janelaAgendamentoDias,
        folgaPodeExcederJanela: config.folgaPodeExcederJanela,
      },
      grade,
      excecoes,
      ocupacoes,
    },
  };
}

export async function obterSlots(
  contexto: Contexto,
  fusoHorario: string,
  pedido: PedidoDeSlots,
  agora: DateTime = DateTime.utc(),
) {
  return unidadeDeTrabalho(contexto, async (tx) => {
    const carregado = await carregar(
      tx,
      contexto,
      fusoHorario,
      pedido.servicoIds,
      pedido.profissionalId,
      pedido.data,
      pedido.data,
      agora,
    );

    const slots = calcularSlots(
      carregado.contexto,
      { itens: carregado.itens, profissionais: carregado.profissionais },
      pedido.data,
    );

    return {
      data: pedido.data,
      slots: slots.map((slot) => ({
        inicio: slot.inicio.toISO() ?? '',
        profissionalIds: slot.profissionalIds,
      })),
    };
  });
}

export async function obterDiasComVaga(
  contexto: Contexto,
  fusoHorario: string,
  pedido: PedidoDeDias,
  agora: DateTime = DateTime.utc(),
) {
  const primeiroDia = `${pedido.mes}-01`;
  const ultimoDia = DateTime.fromISO(primeiroDia, { zone: 'utc' }).endOf('month').toISODate();

  if (ultimoDia === null) {
    throw new ErroDominio('DADOS_INVALIDOS', 'Mês inválido.', { mes: ['mês inválido'] });
  }

  return unidadeDeTrabalho(contexto, async (tx) => {
    const carregado = await carregar(
      tx,
      contexto,
      fusoHorario,
      pedido.servicoIds,
      pedido.profissionalId,
      primeiroDia,
      ultimoDia,
      agora,
    );

    return {
      dias: diasComVaga(
        carregado.contexto,
        { itens: carregado.itens, profissionais: carregado.profissionais },
        primeiroDia,
        ultimoDia,
      ),
    };
  });
}
