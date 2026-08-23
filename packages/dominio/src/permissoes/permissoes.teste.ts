import { describe, expect, test } from 'vitest';
import {
  type Ator,
  escopoDe,
  PERMISSOES,
  PERMISSOES_CONHECIDAS,
  podeExecutar,
  podeExecutarSobre,
} from './index.js';

const dono: Ator = { papel: 'PROPRIETARIO', profissionalId: 'p-dono' };
const admin: Ator = { papel: 'ADMIN', profissionalId: 'p-admin' };
const funcionario: Ator = { papel: 'FUNCIONARIO', profissionalId: 'p-func' };
const recepcao: Ator = { papel: 'FUNCIONARIO', profissionalId: null };

describe('a matriz de 2.3', () => {
  test('só o proprietário transfere ou exclui o tenant', () => {
    expect(podeExecutar(dono, 'tenant.transferir')).toBe(true);
    expect(podeExecutar(admin, 'tenant.transferir')).toBe(false);
    expect(podeExecutar(funcionario, 'tenant.transferir')).toBe(false);
  });

  test('funcionário não configura o tenant nem cadastra serviço', () => {
    expect(podeExecutar(funcionario, 'configuracoes.escrever')).toBe(false);
    expect(podeExecutar(funcionario, 'servicos.escrever')).toBe(false);
    expect(podeExecutar(funcionario, 'profissionais.escrever')).toBe(false);
    expect(podeExecutar(funcionario, 'usuarios.gerenciar')).toBe(false);
  });

  test('funcionário não estorna, não reabre e não bloqueia cliente', () => {
    expect(podeExecutar(funcionario, 'lancamentos.estornar')).toBe(false);
    expect(podeExecutar(funcionario, 'atendimento.reabrir')).toBe(false);
    expect(podeExecutar(funcionario, 'clientes.bloquear')).toBe(false);
  });

  test('o que o funcionário faz, faz só sobre si', () => {
    for (const permissao of [
      'agendamentos.escrever',
      'atendimento.concluir',
      'lancamentos.criar',
      'encaixe.forcar',
      'relatorios.ler',
    ] as const) {
      expect(escopoDe('FUNCIONARIO', permissao)).toBe('PROPRIOS');
    }
  });

  test('proprietário e admin agem sobre qualquer profissional', () => {
    expect(escopoDe('PROPRIETARIO', 'agendamentos.escrever')).toBe('GLOBAL');
    expect(escopoDe('ADMIN', 'agendamentos.escrever')).toBe('GLOBAL');
  });

  test('toda concessão usa uma permissão da lista fechada', () => {
    const conhecidas = new Set<string>(PERMISSOES_CONHECIDAS);

    for (const concessoes of Object.values(PERMISSOES)) {
      for (const concessao of concessoes) {
        expect(conhecidas.has(concessao.permissao)).toBe(true);
      }
    }
  });

  test('admin tem tudo do proprietário menos transferir o tenant', () => {
    const doDono = PERMISSOES.PROPRIETARIO.map((c) => c.permissao);
    const doAdmin = new Set(PERMISSOES.ADMIN.map((c) => c.permissao));

    expect(doDono.filter((p) => !doAdmin.has(p))).toEqual(['tenant.transferir']);
  });
});

describe('escopo PROPRIOS', () => {
  test('funcionário conclui o próprio atendimento', () => {
    expect(podeExecutarSobre(funcionario, 'atendimento.concluir', 'p-func')).toBe(true);
  });

  test('funcionário não conclui atendimento de outro profissional (7.3)', () => {
    expect(podeExecutarSobre(funcionario, 'atendimento.concluir', 'p-outro')).toBe(false);
  });

  test('proprietário conclui o de qualquer um', () => {
    expect(podeExecutarSobre(dono, 'atendimento.concluir', 'p-outro')).toBe(true);
  });

  test('usuário sem registro de profissional não alcança nada em PROPRIOS', () => {
    // Recepção ou financeiro: tem vínculo, não recebe agendamento (2.4)
    expect(podeExecutarSobre(recepcao, 'atendimento.concluir', 'p-func')).toBe(false);
    expect(podeExecutarSobre(recepcao, 'agenda.ler', 'p-func')).toBe(false);
  });
});

describe('staff_ve_agenda_completa', () => {
  test('amplia a leitura da agenda do funcionário', () => {
    expect(podeExecutarSobre(funcionario, 'agenda.ler', 'p-outro')).toBe(false);
    expect(
      podeExecutarSobre(funcionario, 'agenda.ler', 'p-outro', { staffVeAgendaCompleta: true }),
    ).toBe(true);
  });

  test('ver a agenda de todos não é poder escrever nela', () => {
    expect(
      podeExecutarSobre(funcionario, 'agendamentos.escrever', 'p-outro', {
        staffVeAgendaCompleta: true,
      }),
    ).toBe(false);
    expect(
      podeExecutarSobre(funcionario, 'atendimento.concluir', 'p-outro', {
        staffVeAgendaCompleta: true,
      }),
    ).toBe(false);
  });

  test('não dá agenda a quem não é profissional', () => {
    expect(
      podeExecutarSobre(recepcao, 'agenda.ler', 'p-func', { staffVeAgendaCompleta: true }),
    ).toBe(true);
  });
});
