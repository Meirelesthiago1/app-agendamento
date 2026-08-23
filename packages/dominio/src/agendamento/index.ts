import type { DateTime } from 'luxon';
import { ErroDominio } from '../erros/index.js';
import { type Ator, type Papel, podeExecutarSobre } from '../permissoes/index.js';

export type StatusAgendamento = 'AGUARDANDO' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO' | 'FALTOU';

/** Ocupar a agenda é o que impede agendar sobre um atendimento já realizado (7.1). */
export const STATUS_QUE_OCUPAM: readonly StatusAgendamento[] = [
  'AGUARDANDO',
  'CONFIRMADO',
  'CONCLUIDO',
];

export type Origem = 'PUBLICO' | 'ADMIN' | 'SISTEMA';

export type Guarda =
  | 'slot_livre'
  | 'dentro_do_prazo_de_cancelamento'
  | 'ja_terminou'
  | 'ate_30_dias_da_conclusao';

export type Efeito =
  | 'notificar_cliente'
  | 'notificar_estabelecimento'
  | 'marcar_confirmado'
  | 'marcar_concluido'
  | 'marcar_cancelado'
  | 'criar_lancamento'
  | 'estornar_lancamento'
  | 'cancelar_lembretes_futuros';

export type Acao =
  | 'confirmar'
  | 'cancelar'
  | 'concluir'
  | 'marcar_falta'
  | 'reabrir'
  | 'desfazer_falta'
  | 'concluir_apos_falta'
  | 'reativar';

export type Transicao = {
  numero: number;
  acao: Acao;
  de: StatusAgendamento;
  para: StatusAgendamento;
  papeis: readonly Papel[];
  /** O cliente age pelo `token_gestao`, sem papel de equipe (10.7). */
  clientePode: boolean;
  sistemaPode: boolean;
  guardas: readonly Guarda[];
  efeitos: readonly Efeito[];
};

const EQUIPE_TODA: readonly Papel[] = ['PROPRIETARIO', 'ADMIN', 'FUNCIONARIO'];
const SO_GESTAO: readonly Papel[] = ['PROPRIETARIO', 'ADMIN'];

/**
 * As nove transições de 7.2, declaradas como dado. Adicionar um papel é editar
 * uma lista; e o servidor consegue expor as ações válidas para um agendamento e
 * um ator sem que o cliente replique regra nenhuma (7.8).
 */
export const TRANSICOES: readonly Transicao[] = [
  {
    numero: 1,
    acao: 'confirmar',
    de: 'AGUARDANDO',
    para: 'CONFIRMADO',
    papeis: EQUIPE_TODA,
    clientePode: false,
    sistemaPode: false,
    guardas: ['slot_livre'],
    efeitos: ['notificar_cliente', 'marcar_confirmado'],
  },
  {
    numero: 2,
    acao: 'cancelar',
    de: 'AGUARDANDO',
    para: 'CANCELADO',
    papeis: EQUIPE_TODA,
    clientePode: true,
    sistemaPode: true,
    guardas: ['dentro_do_prazo_de_cancelamento'],
    efeitos: ['notificar_cliente', 'notificar_estabelecimento', 'marcar_cancelado'],
  },
  {
    numero: 3,
    acao: 'concluir',
    de: 'CONFIRMADO',
    para: 'CONCLUIDO',
    papeis: EQUIPE_TODA,
    clientePode: false,
    sistemaPode: false,
    guardas: [],
    efeitos: ['marcar_concluido', 'criar_lancamento'],
  },
  {
    numero: 4,
    acao: 'cancelar',
    de: 'CONFIRMADO',
    para: 'CANCELADO',
    papeis: EQUIPE_TODA,
    clientePode: true,
    sistemaPode: false,
    guardas: ['dentro_do_prazo_de_cancelamento'],
    efeitos: [
      'notificar_cliente',
      'notificar_estabelecimento',
      'marcar_cancelado',
      'cancelar_lembretes_futuros',
    ],
  },
  {
    numero: 5,
    acao: 'marcar_falta',
    de: 'CONFIRMADO',
    para: 'FALTOU',
    papeis: EQUIPE_TODA,
    clientePode: false,
    sistemaPode: false,
    guardas: ['ja_terminou'],
    efeitos: ['cancelar_lembretes_futuros'],
  },
  {
    numero: 6,
    acao: 'reabrir',
    de: 'CONCLUIDO',
    para: 'CONFIRMADO',
    papeis: SO_GESTAO,
    clientePode: false,
    sistemaPode: false,
    guardas: ['ate_30_dias_da_conclusao'],
    efeitos: ['estornar_lancamento'],
  },
  {
    numero: 7,
    acao: 'desfazer_falta',
    de: 'FALTOU',
    para: 'CONFIRMADO',
    papeis: EQUIPE_TODA,
    clientePode: false,
    sistemaPode: false,
    guardas: [],
    efeitos: [],
  },
  {
    numero: 8,
    acao: 'concluir_apos_falta',
    de: 'FALTOU',
    para: 'CONCLUIDO',
    papeis: EQUIPE_TODA,
    clientePode: false,
    sistemaPode: false,
    guardas: [],
    efeitos: ['marcar_concluido', 'criar_lancamento'],
  },
  {
    numero: 9,
    acao: 'reativar',
    de: 'CANCELADO',
    para: 'CONFIRMADO',
    papeis: SO_GESTAO,
    clientePode: false,
    sistemaPode: false,
    guardas: ['slot_livre'],
    efeitos: ['notificar_cliente'],
  },
];

export function buscarTransicao(de: StatusAgendamento, para: StatusAgendamento): Transicao | null {
  return TRANSICOES.find((t) => t.de === de && t.para === para) ?? null;
}

export function exigirTransicao(de: StatusAgendamento, para: StatusAgendamento): Transicao {
  const transicao = buscarTransicao(de, para);

  if (transicao === null) {
    throw new ErroDominio('TRANSICAO_INVALIDA', `Não é possível ir de ${de} para ${para}.`);
  }

  return transicao;
}

export type Agendamento = {
  status: StatusAgendamento;
  profissionalId: string;
  iniciaEm: DateTime;
  terminaEm: DateTime;
  concluidoEm: DateTime | null;
};

export type ContextoDaTransicao = {
  agora: DateTime;
  /** `configuracoes.prazo_cancelamento_min` (8.2). */
  prazoCancelamentoMin: number;
  staffVeAgendaCompleta: boolean;
  slotLivre: boolean;
};

const DIAS_PARA_REABRIR = 30;

export function papelPodeExecutar(
  transicao: Transicao,
  ator: Ator | null,
  origem: Origem,
): boolean {
  if (origem === 'SISTEMA') {
    return transicao.sistemaPode;
  }

  if (origem === 'PUBLICO') {
    return transicao.clientePode;
  }

  return ator !== null && transicao.papeis.includes(ator.papel);
}

export function guardaAtendida(
  guarda: Guarda,
  agendamento: Agendamento,
  contexto: ContextoDaTransicao,
): boolean {
  switch (guarda) {
    case 'slot_livre':
      return contexto.slotLivre;
    case 'ja_terminou':
      return contexto.agora >= agendamento.terminaEm;
    case 'dentro_do_prazo_de_cancelamento':
      return (
        agendamento.iniciaEm.diff(contexto.agora, 'minutes').minutes >=
        contexto.prazoCancelamentoMin
      );
    case 'ate_30_dias_da_conclusao':
      return (
        agendamento.concluidoEm !== null &&
        contexto.agora.diff(agendamento.concluidoEm, 'days').days <= DIAS_PARA_REABRIR
      );
  }
}

/**
 * O prazo de cancelamento vale para o cliente, não para a equipe (7.2). O gestor
 * cancela a qualquer momento — é ele quem lida com a consequência.
 */
function guardasQueSeAplicam(transicao: Transicao, origem: Origem): readonly Guarda[] {
  if (origem === 'ADMIN') {
    return transicao.guardas.filter((g) => g !== 'dentro_do_prazo_de_cancelamento');
  }

  return transicao.guardas;
}

export type TentativaDeTransicao = {
  agendamento: Agendamento;
  para: StatusAgendamento;
  ator: Ator | null;
  origem: Origem;
  contexto: ContextoDaTransicao;
};

function atorAlcancaOAgendamento(tentativa: TentativaDeTransicao): boolean {
  if (tentativa.origem !== 'ADMIN' || tentativa.ator === null) {
    return true;
  }

  return podeExecutarSobre(
    tentativa.ator,
    'agendamentos.escrever',
    tentativa.agendamento.profissionalId,
    { staffVeAgendaCompleta: tentativa.contexto.staffVeAgendaCompleta },
  );
}

export function transicaoPermitida(tentativa: TentativaDeTransicao): boolean {
  const transicao = buscarTransicao(tentativa.agendamento.status, tentativa.para);

  if (transicao === null || !papelPodeExecutar(transicao, tentativa.ator, tentativa.origem)) {
    return false;
  }

  if (!atorAlcancaOAgendamento(tentativa)) {
    return false;
  }

  return guardasQueSeAplicam(transicao, tentativa.origem).every((guarda) =>
    guardaAtendida(guarda, tentativa.agendamento, tentativa.contexto),
  );
}

function erroDaGuarda(guarda: Guarda) {
  switch (guarda) {
    case 'slot_livre':
      return 'SLOT_OCUPADO' as const;
    case 'dentro_do_prazo_de_cancelamento':
      return 'PRAZO_CANCELAMENTO_EXPIRADO' as const;
    case 'ja_terminou':
      return 'AINDA_NAO_TERMINOU' as const;
    case 'ate_30_dias_da_conclusao':
      return 'REABERTURA_FORA_DO_PRAZO' as const;
  }
}

function mensagemDaGuarda(guarda: Guarda): string {
  switch (guarda) {
    case 'slot_livre':
      return 'Esse horário já está ocupado.';
    case 'dentro_do_prazo_de_cancelamento':
      return 'O prazo para cancelar já passou. Entre em contato com o estabelecimento.';
    case 'ja_terminou':
      return 'O atendimento ainda não terminou.';
    case 'ate_30_dias_da_conclusao':
      return 'Atendimentos concluídos há mais de 30 dias não podem ser reabertos.';
  }
}

/** Lança o erro específico, para que a interface diga o que aconteceu (6.10). */
export function verificarTransicao(tentativa: TentativaDeTransicao): Transicao {
  const transicao = exigirTransicao(tentativa.agendamento.status, tentativa.para);

  if (!papelPodeExecutar(transicao, tentativa.ator, tentativa.origem)) {
    throw new ErroDominio('SEM_PERMISSAO', 'Seu perfil não permite esta ação.');
  }

  if (!atorAlcancaOAgendamento(tentativa)) {
    throw new ErroDominio('FORA_DO_ESCOPO', 'Este agendamento é de outro profissional.');
  }

  for (const guarda of guardasQueSeAplicam(transicao, tentativa.origem)) {
    if (!guardaAtendida(guarda, tentativa.agendamento, tentativa.contexto)) {
      throw new ErroDominio(erroDaGuarda(guarda), mensagemDaGuarda(guarda));
    }
  }

  return transicao;
}

/**
 * O que alimenta `acoes_disponiveis` (7.8): o servidor decide, o cliente só
 * renderiza os botões. Permissão nunca é replicada no frontend (5.4 do stack).
 */
export function acoesDisponiveis(
  agendamento: Agendamento,
  ator: Ator | null,
  origem: Origem,
  contexto: ContextoDaTransicao,
): Acao[] {
  return TRANSICOES.filter(
    (transicao) =>
      transicao.de === agendamento.status &&
      transicaoPermitida({ agendamento, para: transicao.para, ator, origem, contexto }),
  ).map((transicao) => transicao.acao);
}
