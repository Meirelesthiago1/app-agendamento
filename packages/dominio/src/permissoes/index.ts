export type Papel = 'PROPRIETARIO' | 'ADMIN' | 'FUNCIONARIO';

/**
 * `GLOBAL` alcança qualquer profissional do estabelecimento; `PROPRIOS` só o
 * profissional que o próprio usuário é (decisão 33).
 */
export type Escopo = 'GLOBAL' | 'PROPRIOS';

export const PERMISSOES_CONHECIDAS = [
  'configuracoes.escrever',
  'usuarios.gerenciar',
  'servicos.escrever',
  'profissionais.escrever',
  'horarios.escrever',
  'bloqueios.escrever',
  'agenda.ler',
  'agendamentos.escrever',
  'atendimento.concluir',
  'lancamentos.criar',
  'lancamentos.estornar',
  'atendimento.reabrir',
  'encaixe.forcar',
  'clientes.bloquear',
  'relatorios.ler',
  'tenant.transferir',
] as const;

export type Permissao = (typeof PERMISSOES_CONHECIDAS)[number];

export type Concessao = {
  permissao: Permissao;
  escopo: Escopo;
};

/**
 * A matriz de 2.3 como constante versionada, nunca como verificação de papel
 * espalhada pelo código. Não existe tabela de permissões: `vinculos.papel` é
 * enum fixo de três valores, e papel novo já exigiria migração de qualquer jeito.
 */
export const PERMISSOES: Readonly<Record<Papel, readonly Concessao[]>> = {
  PROPRIETARIO: [
    { permissao: 'configuracoes.escrever', escopo: 'GLOBAL' },
    { permissao: 'usuarios.gerenciar', escopo: 'GLOBAL' },
    { permissao: 'servicos.escrever', escopo: 'GLOBAL' },
    { permissao: 'profissionais.escrever', escopo: 'GLOBAL' },
    { permissao: 'horarios.escrever', escopo: 'GLOBAL' },
    { permissao: 'bloqueios.escrever', escopo: 'GLOBAL' },
    { permissao: 'agenda.ler', escopo: 'GLOBAL' },
    { permissao: 'agendamentos.escrever', escopo: 'GLOBAL' },
    { permissao: 'atendimento.concluir', escopo: 'GLOBAL' },
    { permissao: 'lancamentos.criar', escopo: 'GLOBAL' },
    { permissao: 'lancamentos.estornar', escopo: 'GLOBAL' },
    { permissao: 'atendimento.reabrir', escopo: 'GLOBAL' },
    { permissao: 'encaixe.forcar', escopo: 'GLOBAL' },
    { permissao: 'clientes.bloquear', escopo: 'GLOBAL' },
    { permissao: 'relatorios.ler', escopo: 'GLOBAL' },
    { permissao: 'tenant.transferir', escopo: 'GLOBAL' },
  ],
  ADMIN: [
    { permissao: 'configuracoes.escrever', escopo: 'GLOBAL' },
    { permissao: 'usuarios.gerenciar', escopo: 'GLOBAL' },
    { permissao: 'servicos.escrever', escopo: 'GLOBAL' },
    { permissao: 'profissionais.escrever', escopo: 'GLOBAL' },
    { permissao: 'horarios.escrever', escopo: 'GLOBAL' },
    { permissao: 'bloqueios.escrever', escopo: 'GLOBAL' },
    { permissao: 'agenda.ler', escopo: 'GLOBAL' },
    { permissao: 'agendamentos.escrever', escopo: 'GLOBAL' },
    { permissao: 'atendimento.concluir', escopo: 'GLOBAL' },
    { permissao: 'lancamentos.criar', escopo: 'GLOBAL' },
    { permissao: 'lancamentos.estornar', escopo: 'GLOBAL' },
    { permissao: 'atendimento.reabrir', escopo: 'GLOBAL' },
    { permissao: 'encaixe.forcar', escopo: 'GLOBAL' },
    { permissao: 'clientes.bloquear', escopo: 'GLOBAL' },
    { permissao: 'relatorios.ler', escopo: 'GLOBAL' },
    // Sem `tenant.transferir`: 2.3 reserva a exclusão do tenant ao proprietário
  ],
  FUNCIONARIO: [
    { permissao: 'horarios.escrever', escopo: 'PROPRIOS' },
    { permissao: 'bloqueios.escrever', escopo: 'PROPRIOS' },
    { permissao: 'agenda.ler', escopo: 'PROPRIOS' },
    { permissao: 'agendamentos.escrever', escopo: 'PROPRIOS' },
    { permissao: 'atendimento.concluir', escopo: 'PROPRIOS' },
    { permissao: 'lancamentos.criar', escopo: 'PROPRIOS' },
    { permissao: 'encaixe.forcar', escopo: 'PROPRIOS' },
    { permissao: 'relatorios.ler', escopo: 'PROPRIOS' },
  ],
};

export type Ator = {
  papel: Papel;
  /** Nulo quando o usuário tem vínculo mas não é profissional (2.4). */
  profissionalId: string | null;
};

export function escopoDe(papel: Papel, permissao: Permissao): Escopo | null {
  return PERMISSOES[papel].find((c) => c.permissao === permissao)?.escopo ?? null;
}

export function podeExecutar(ator: Ator, permissao: Permissao): boolean {
  return escopoDe(ator.papel, permissao) !== null;
}

/**
 * A verificação com alvo. Um funcionário sem registro de profissional não
 * alcança nada em escopo `PROPRIOS` — não há "próprio" a que se referir.
 *
 * `staff_ve_agenda_completa` amplia apenas a leitura da agenda (2.3, nota 1):
 * ver a agenda de todos não é poder escrever nela.
 */
export function podeExecutarSobre(
  ator: Ator,
  permissao: Permissao,
  profissionalAlvoId: string | null,
  opcoes: { staffVeAgendaCompleta?: boolean } = {},
): boolean {
  const escopo = escopoDe(ator.papel, permissao);

  if (escopo === null) {
    return false;
  }

  if (escopo === 'GLOBAL') {
    return true;
  }

  if (permissao === 'agenda.ler' && opcoes.staffVeAgendaCompleta === true) {
    return true;
  }

  if (ator.profissionalId === null) {
    return false;
  }

  return profissionalAlvoId === ator.profissionalId;
}
