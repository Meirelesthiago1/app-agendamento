import { FUSOS_BRASIL } from '@agendamento/contratos';
import { ErroDominio, podeExecutar } from '@agendamento/dominio';
import type { Contexto } from '../../contexto.ts';
import { unidadeDeTrabalho } from '../../infra/db/pools.ts';
import * as repo from './repositorio.ts';

export type DadosDoEstabelecimento = repo.DadosDoEstabelecimento;

type Fuso = (typeof FUSOS_BRASIL)[number];

/**
 * A coluna é `varchar` e o contrato promete uma das dezesseis. A entrada já é
 * validada; o que sobra é linha antiga ou editada à mão no banco — e responder
 * um fuso que a tela não sabe exibir é pior que dizer que o dado está errado.
 */
function comoFuso(valor: string): Fuso {
  if (!(FUSOS_BRASIL as readonly string[]).includes(valor)) {
    throw new ErroDominio('DADOS_INVALIDOS', `Fuso horário desconhecido: ${valor}.`);
  }

  return valor as Fuso;
}

export type Politicas = repo.Politicas;

/**
 * O que a tela de configurações lê e escreve. Estabelecimento e políticas vêm
 * juntos porque a tela é uma só, e duas requisições para montá-la deixariam o
 * cabeçalho com o nome antigo enquanto a segunda não chega.
 */
async function montar(contexto: Contexto, tx: Parameters<typeof repo.buscarParaGestao>[0]) {
  const estabelecimento = await repo.buscarParaGestao(tx, contexto.estabelecimentoId);
  const politicas = await repo.buscarConfiguracao(tx, contexto.estabelecimentoId);

  if (estabelecimento === null || politicas === null) {
    throw new ErroDominio('NAO_ENCONTRADO', 'Estabelecimento não encontrado.');
  }

  return {
    estabelecimento: { ...estabelecimento, fusoHorario: comoFuso(estabelecimento.fusoHorario) },
    politicas: {
      granularidadeSlotMin: politicas.granularidadeSlotMin,
      estrategiaSlot: politicas.estrategiaSlot,
      antecedenciaMinimaMin: politicas.antecedenciaMinimaMin,
      janelaAgendamentoDias: politicas.janelaAgendamentoDias,
      prazoCancelamentoMin: politicas.prazoCancelamentoMin,
      confirmacaoAutomatica: politicas.confirmacaoAutomatica,
      permiteSemCadastro: politicas.permiteSemCadastro,
      permiteMultiplosServicos: politicas.permiteMultiplosServicos,
      exigeOtpTelefone: politicas.exigeOtpTelefone,
      staffVeAgendaCompleta: politicas.staffVeAgendaCompleta,
      folgaPodeExcederJanela: politicas.folgaPodeExcederJanela,
      maxAtivosPorCliente: politicas.maxAtivosPorCliente,
    },
  };
}

function exigirEscrita(contexto: Contexto): void {
  if (
    contexto.papel === null ||
    !podeExecutar(
      { papel: contexto.papel, profissionalId: contexto.profissionalId },
      'configuracoes.escrever',
    )
  ) {
    throw new ErroDominio('SEM_PERMISSAO', 'Seu perfil não permite alterar as configurações.');
  }
}

export async function obter(contexto: Contexto) {
  return unidadeDeTrabalho(contexto, (tx) => montar(contexto, tx));
}

export async function atualizarDados(contexto: Contexto, dados: DadosDoEstabelecimento) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    // O índice único é quem garante; esta consulta existe para a mensagem ser
    // sobre o endereço, e não um erro de constraint do Postgres
    if (!(await repo.slugEstaLivre(tx, dados.slug, contexto.estabelecimentoId))) {
      throw new ErroDominio('CONFLITO', 'Este endereço já está em uso.');
    }

    await repo.atualizarDados(tx, contexto.estabelecimentoId, dados);

    return montar(contexto, tx);
  });
}

export async function atualizarPoliticas(contexto: Contexto, politicas: Politicas) {
  exigirEscrita(contexto);

  return unidadeDeTrabalho(contexto, async (tx) => {
    await repo.atualizarPoliticas(tx, contexto.estabelecimentoId, politicas);

    return montar(contexto, tx);
  });
}
