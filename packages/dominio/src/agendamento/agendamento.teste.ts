import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import { ErroDominio } from '../erros/index.js';
import type { Ator } from '../permissoes/index.js';
import {
  type Agendamento,
  acoesDisponiveis,
  buscarTransicao,
  type ContextoDaTransicao,
  type Origem,
  type StatusAgendamento,
  TRANSICOES,
  transicaoPermitida,
  verificarTransicao,
} from './index.js';

const AGORA = DateTime.fromISO('2026-09-01T12:00:00.000Z');

const dono: Ator = { papel: 'PROPRIETARIO', profissionalId: 'p-dono' };
const admin: Ator = { papel: 'ADMIN', profissionalId: 'p-admin' };
const funcionario: Ator = { papel: 'FUNCIONARIO', profissionalId: 'p-func' };

function agendamento(parcial: Partial<Agendamento> = {}): Agendamento {
  return {
    status: 'CONFIRMADO',
    profissionalId: 'p-func',
    iniciaEm: AGORA.plus({ days: 3 }),
    terminaEm: AGORA.plus({ days: 3, minutes: 30 }),
    concluidoEm: null,
    ...parcial,
  };
}

function contexto(parcial: Partial<ContextoDaTransicao> = {}): ContextoDaTransicao {
  return {
    agora: AGORA,
    prazoCancelamentoMin: 1440,
    staffVeAgendaCompleta: false,
    slotLivre: true,
    ...parcial,
  };
}

const tentar = (
  alvo: Agendamento,
  para: StatusAgendamento,
  ator: Ator | null,
  origem: Origem,
  ctx: ContextoDaTransicao = contexto(),
) => transicaoPermitida({ agendamento: alvo, para, ator, origem, contexto: ctx });

describe('a tabela de 7.2', () => {
  test('tem as nove transições, numeradas de 1 a 9', () => {
    expect(TRANSICOES).toHaveLength(9);
    expect(TRANSICOES.map((t) => t.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('nenhum par de origem e destino aparece duas vezes', () => {
    const pares = TRANSICOES.map((t) => `${t.de}->${t.para}`);

    expect(new Set(pares).size).toBe(pares.length);
  });

  test('as transições bloqueadas de 7.3 não existem', () => {
    // Forçar a passagem pela 6 é o que torna o estorno explícito e auditado
    expect(buscarTransicao('CONCLUIDO', 'CANCELADO')).toBeNull();
    // Registraria receita de atendimento nunca aprovado
    expect(buscarTransicao('AGUARDANDO', 'CONCLUIDO')).toBeNull();
    expect(buscarTransicao('AGUARDANDO', 'FALTOU')).toBeNull();
    expect(buscarTransicao('CANCELADO', 'CONCLUIDO')).toBeNull();
  });

  test('só reabrir e reativar são exclusivas da gestão', () => {
    const soGestao = TRANSICOES.filter((t) => !t.papeis.includes('FUNCIONARIO'));

    expect(soGestao.map((t) => t.acao)).toEqual(['reabrir', 'reativar']);
  });

  test('as três transições que tocam o caixa são as de 7.5', () => {
    const comCaixa = TRANSICOES.filter((t) =>
      t.efeitos.some((e) => e === 'criar_lancamento' || e === 'estornar_lancamento'),
    );

    expect(comCaixa.map((t) => t.numero)).toEqual([3, 6, 8]);
  });

  test('marcar falta não notifica ninguém por padrão', () => {
    const falta = buscarTransicao('CONFIRMADO', 'FALTOU');

    expect(falta?.efeitos).not.toContain('notificar_cliente');
  });
});

describe('quem pode', () => {
  test('o cliente cancela, mas não confirma nem conclui', () => {
    expect(tentar(agendamento({ status: 'AGUARDANDO' }), 'CANCELADO', null, 'PUBLICO')).toBe(true);
    expect(tentar(agendamento({ status: 'AGUARDANDO' }), 'CONFIRMADO', null, 'PUBLICO')).toBe(
      false,
    );
    expect(tentar(agendamento(), 'CONCLUIDO', null, 'PUBLICO')).toBe(false);
  });

  test('o sistema só expira solicitação pendente (5.7)', () => {
    expect(tentar(agendamento({ status: 'AGUARDANDO' }), 'CANCELADO', null, 'SISTEMA')).toBe(true);
    expect(tentar(agendamento(), 'CANCELADO', null, 'SISTEMA')).toBe(false);
    expect(tentar(agendamento(), 'CONCLUIDO', null, 'SISTEMA')).toBe(false);
  });

  test('funcionário não reabre atendimento concluído', () => {
    const concluido = agendamento({ status: 'CONCLUIDO', concluidoEm: AGORA.minus({ days: 2 }) });

    expect(tentar(concluido, 'CONFIRMADO', funcionario, 'ADMIN')).toBe(false);
    expect(tentar(concluido, 'CONFIRMADO', admin, 'ADMIN')).toBe(true);
  });

  test('funcionário não age sobre agendamento de outro profissional (7.3)', () => {
    const deOutro = agendamento({ profissionalId: 'p-outro' });

    expect(tentar(deOutro, 'CONCLUIDO', funcionario, 'ADMIN')).toBe(false);
    expect(tentar(deOutro, 'CONCLUIDO', dono, 'ADMIN')).toBe(true);
  });

  test('ver a agenda completa não autoriza escrever nela', () => {
    const deOutro = agendamento({ profissionalId: 'p-outro' });

    expect(
      tentar(deOutro, 'CONCLUIDO', funcionario, 'ADMIN', contexto({ staffVeAgendaCompleta: true })),
    ).toBe(false);
  });
});

describe('guardas', () => {
  test('falta só depois que o atendimento termina', () => {
    const futuro = agendamento();
    const passado = agendamento({
      iniciaEm: AGORA.minus({ hours: 2 }),
      terminaEm: AGORA.minus({ hours: 1 }),
    });

    expect(tentar(futuro, 'FALTOU', dono, 'ADMIN')).toBe(false);
    expect(tentar(passado, 'FALTOU', dono, 'ADMIN')).toBe(true);
  });

  test('o cliente cancela dentro do prazo, e não fora dele', () => {
    const ctx = contexto({ prazoCancelamentoMin: 1440 });
    const comFolga = agendamento({ iniciaEm: AGORA.plus({ days: 2 }) });
    const emCima = agendamento({ iniciaEm: AGORA.plus({ hours: 2 }) });

    expect(tentar(comFolga, 'CANCELADO', null, 'PUBLICO', ctx)).toBe(true);
    expect(tentar(emCima, 'CANCELADO', null, 'PUBLICO', ctx)).toBe(false);
  });

  test('o prazo de cancelamento não vale para a equipe', () => {
    const emCima = agendamento({ iniciaEm: AGORA.plus({ hours: 2 }) });

    expect(tentar(emCima, 'CANCELADO', dono, 'ADMIN')).toBe(true);
  });

  test('reabrir vale até 30 dias da conclusão', () => {
    const dentro = agendamento({ status: 'CONCLUIDO', concluidoEm: AGORA.minus({ days: 29 }) });
    const fora = agendamento({ status: 'CONCLUIDO', concluidoEm: AGORA.minus({ days: 31 }) });

    expect(tentar(dentro, 'CONFIRMADO', dono, 'ADMIN')).toBe(true);
    expect(tentar(fora, 'CONFIRMADO', dono, 'ADMIN')).toBe(false);
  });

  test('confirmar e reativar exigem o slot livre', () => {
    const ocupado = contexto({ slotLivre: false });

    expect(
      tentar(agendamento({ status: 'AGUARDANDO' }), 'CONFIRMADO', dono, 'ADMIN', ocupado),
    ).toBe(false);
    expect(tentar(agendamento({ status: 'CANCELADO' }), 'CONFIRMADO', dono, 'ADMIN', ocupado)).toBe(
      false,
    );
  });

  test('desfazer falta não tem guarda: é a marcação mais errada do sistema', () => {
    const faltou = agendamento({ status: 'FALTOU' });

    expect(tentar(faltou, 'CONFIRMADO', funcionario, 'ADMIN', contexto({ slotLivre: false }))).toBe(
      true,
    );
  });
});

describe('erro específico, não genérico', () => {
  const erroAoTentar = (
    alvo: Agendamento,
    para: StatusAgendamento,
    ator: Ator | null,
    origem: Origem,
    ctx = contexto(),
  ) => {
    try {
      verificarTransicao({ agendamento: alvo, para, ator, origem, contexto: ctx });
      return null;
    } catch (erro) {
      return erro as ErroDominio;
    }
  };

  test('transição inexistente', () => {
    const erro = erroAoTentar(agendamento({ status: 'CONCLUIDO' }), 'CANCELADO', dono, 'ADMIN');

    expect(erro).toBeInstanceOf(ErroDominio);
    expect(erro?.codigo).toBe('TRANSICAO_INVALIDA');
  });

  test('papel sem direito', () => {
    expect(
      erroAoTentar(
        agendamento({ status: 'CONCLUIDO', concluidoEm: AGORA.minus({ days: 1 }) }),
        'CONFIRMADO',
        funcionario,
        'ADMIN',
      )?.codigo,
    ).toBe('SEM_PERMISSAO');
  });

  test('agendamento de outro profissional', () => {
    expect(
      erroAoTentar(agendamento({ profissionalId: 'p-outro' }), 'CONCLUIDO', funcionario, 'ADMIN')
        ?.codigo,
    ).toBe('FORA_DO_ESCOPO');
  });

  test('cada guarda tem seu código', () => {
    expect(erroAoTentar(agendamento(), 'FALTOU', dono, 'ADMIN')?.codigo).toBe('AINDA_NAO_TERMINOU');
    expect(
      erroAoTentar(
        agendamento({ iniciaEm: AGORA.plus({ hours: 2 }) }),
        'CANCELADO',
        null,
        'PUBLICO',
      )?.codigo,
    ).toBe('PRAZO_CANCELAMENTO_EXPIRADO');
    expect(
      erroAoTentar(
        agendamento({ status: 'CONCLUIDO', concluidoEm: AGORA.minus({ days: 40 }) }),
        'CONFIRMADO',
        dono,
        'ADMIN',
      )?.codigo,
    ).toBe('REABERTURA_FORA_DO_PRAZO');
    expect(
      erroAoTentar(
        agendamento({ status: 'AGUARDANDO' }),
        'CONFIRMADO',
        dono,
        'ADMIN',
        contexto({ slotLivre: false }),
      )?.codigo,
    ).toBe('SLOT_OCUPADO');
  });

  test('a mensagem é exibível e não vaza estado interno', () => {
    const erro = erroAoTentar(agendamento(), 'FALTOU', dono, 'ADMIN');

    expect(erro?.message).toBe('O atendimento ainda não terminou.');
  });
});

describe('acoes_disponiveis alimenta os botões (7.8)', () => {
  test('o proprietário vê tudo que cabe no estado', () => {
    expect(
      acoesDisponiveis(agendamento({ status: 'AGUARDANDO' }), dono, 'ADMIN', contexto()),
    ).toEqual(['confirmar', 'cancelar']);
  });

  test('o funcionário sobre agendamento alheio não vê ação nenhuma', () => {
    expect(
      acoesDisponiveis(
        agendamento({ profissionalId: 'p-outro' }),
        funcionario,
        'ADMIN',
        contexto(),
      ),
    ).toEqual([]);
  });

  test('o cliente vê apenas cancelar, e só dentro do prazo', () => {
    expect(acoesDisponiveis(agendamento(), null, 'PUBLICO', contexto())).toEqual(['cancelar']);
    expect(
      acoesDisponiveis(
        agendamento({ iniciaEm: AGORA.plus({ minutes: 30 }) }),
        null,
        'PUBLICO',
        contexto(),
      ),
    ).toEqual([]);
  });

  test('atendimento em andamento oferece concluir, mas ainda não falta', () => {
    const emAndamento = agendamento({
      iniciaEm: AGORA.minus({ minutes: 10 }),
      terminaEm: AGORA.plus({ minutes: 20 }),
    });

    expect(acoesDisponiveis(emAndamento, dono, 'ADMIN', contexto())).toEqual([
      'concluir',
      'cancelar',
    ]);
  });

  test('depois do fim, a falta aparece', () => {
    const terminado = agendamento({
      iniciaEm: AGORA.minus({ hours: 1 }),
      terminaEm: AGORA.minus({ minutes: 30 }),
    });

    expect(acoesDisponiveis(terminado, dono, 'ADMIN', contexto())).toContain('marcar_falta');
  });

  test('estado final sem ação para o cliente', () => {
    expect(
      acoesDisponiveis(agendamento({ status: 'CANCELADO' }), null, 'PUBLICO', contexto()),
    ).toEqual([]);
  });
});
