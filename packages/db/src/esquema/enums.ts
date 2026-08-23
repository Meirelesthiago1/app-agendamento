import { pgEnum } from 'drizzle-orm/pg-core';

export const statusEstabelecimento = pgEnum('status_estabelecimento', [
  'ATIVO',
  'SUSPENSO',
  'TESTE',
  'CANCELADO',
]);

export const estrategiaSlot = pgEnum('estrategia_slot', ['GRADE', 'COMPACTO']);

export const provedorExterno = pgEnum('provedor_externo', ['GOOGLE']);

export const canalVerificacao = pgEnum('canal_verificacao', ['SMS', 'WHATSAPP', 'EMAIL']);

/**
 * Sem isto, um token emitido para verificar e-mail poderia ser reapresentado
 * como redefinição de senha: o hash é o mesmo, e nada no registro diria que ele
 * não serve para aquilo.
 */
export const finalidadeVerificacao = pgEnum('finalidade_verificacao', [
  'OTP_TELEFONE',
  'VERIFICACAO_EMAIL',
  'RECUPERACAO_SENHA',
  'CONVITE_EQUIPE',
]);

export const papel = pgEnum('papel', ['PROPRIETARIO', 'ADMIN', 'FUNCIONARIO']);

export const statusVinculo = pgEnum('status_vinculo', ['CONVIDADO', 'ATIVO', 'DESATIVADO']);

export const exibicaoValor = pgEnum('exibicao_valor', [
  'FIXO',
  'A_PARTIR_DE',
  'OCULTO',
  'GRATUITO',
]);

export const tipoExcecao = pgEnum('tipo_excecao', ['BLOQUEIO', 'EXTRA']);

export const statusAgendamento = pgEnum('status_agendamento', [
  'AGUARDANDO',
  'CONFIRMADO',
  'CONCLUIDO',
  'CANCELADO',
  'FALTOU',
]);

export const origemAgendamento = pgEnum('origem_agendamento', ['PUBLICO', 'ADMIN']);

export const tipoCancelamento = pgEnum('tipo_cancelamento', [
  'DESISTENCIA',
  'REMARCACAO',
  'INDISPONIBILIDADE',
  'EXPIRACAO',
]);

export const canceladoPor = pgEnum('cancelado_por', ['CLIENTE', 'EQUIPE', 'SISTEMA']);

export const tipoLancamento = pgEnum('tipo_lancamento', ['AGENDAMENTO', 'AVULSO', 'TOTAL_DIA']);

export const canalNotificacao = pgEnum('canal_notificacao', ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']);

export const statusNotificacao = pgEnum('status_notificacao', [
  'PENDENTE',
  'ENVIADA',
  'FALHOU',
  'CANCELADA',
]);

export const atorTipo = pgEnum('ator_tipo', ['USUARIO', 'CLIENTE', 'SISTEMA']);
