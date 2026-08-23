import { type DateTime, Interval } from 'luxon';
import { ErroDominio } from '../erros/index.js';
import {
  type DataLocal,
  datasEntre,
  diaDaSemana,
  emUtc,
  type HoraLocal,
  somarDias,
  vigenteEm,
} from '../tempo/index.js';

export const MIN_ITENS = 1;
export const MAX_ITENS = 5;

export type EstrategiaSlot = 'GRADE' | 'COMPACTO';

export type ConfiguracaoDeAgenda = {
  granularidadeSlotMin: number;
  estrategiaSlot: EstrategiaSlot;
  antecedenciaMinimaMin: number;
  janelaAgendamentoDias: number;
  folgaPodeExcederJanela: boolean;
};

export type LinhaDeGrade = {
  profissionalId: string;
  diaSemana: number;
  horaInicio: HoraLocal;
  horaFim: HoraLocal;
  vigenciaInicio: DataLocal;
  vigenciaFim: DataLocal | null;
};

export type ExcecaoDeAgenda = {
  /** Nulo alcança o estabelecimento inteiro (8.5). */
  profissionalId: string | null;
  tipo: 'BLOQUEIO' | 'EXTRA';
  iniciaEm: DateTime;
  terminaEm: DateTime;
};

export type Ocupacao = {
  profissionalId: string;
  ocupacaoInicio: DateTime;
  ocupacaoFim: DateTime;
};

/**
 * Tudo já carregado. A separação entre buscar e decidir é o que permite esta
 * função rodar no backend e no browser (5.2 do stack) — sem ela, `dominio` vira
 * uma pasta com nome bonito e o motor acaba reimplementado no frontend.
 */
export type ContextoDeDisponibilidade = {
  agora: DateTime;
  fuso: string;
  config: ConfiguracaoDeAgenda;
  grade: readonly LinhaDeGrade[];
  excecoes: readonly ExcecaoDeAgenda[];
  ocupacoes: readonly Ocupacao[];
};

export type ItemPedido = {
  servicoId: string;
  duracaoMin: number;
  folgaAntesMin: number;
  folgaDepoisMin: number;
};

export type ServicoDoProfissional = {
  servicoId: string;
  duracaoOverrideMin: number | null;
};

export type Profissional = {
  id: string;
  servicos: readonly ServicoDoProfissional[];
};

export type Slot = {
  inicio: DateTime;
  /** União dos elegíveis, para o caso "qualquer profissional" (6.3). */
  profissionalIds: string[];
};

const MINUTOS_POR_DIA = 24 * 60;

export function exigirItensValidos(itens: readonly ItemPedido[]): void {
  if (itens.length < MIN_ITENS || itens.length > MAX_ITENS) {
    throw new ErroDominio(
      'ITENS_FORA_DO_LIMITE',
      `Um agendamento aceita de ${MIN_ITENS} a ${MAX_ITENS} serviços.`,
    );
  }
}

/** Só quem executa **todos** os itens (6.2). */
export function profissionaisElegiveis(
  profissionais: readonly Profissional[],
  itens: readonly ItemPedido[],
): Profissional[] {
  return profissionais.filter((profissional) => {
    const oferecidos = new Set(profissional.servicos.map((s) => s.servicoId));

    return itens.every((item) => oferecidos.has(item.servicoId));
  });
}

export function duracaoEfetiva(item: ItemPedido, profissional: Profissional): number {
  const override = profissional.servicos.find(
    (s) => s.servicoId === item.servicoId,
  )?.duracaoOverrideMin;

  return override ?? item.duracaoMin;
}

export function duracaoTotal(itens: readonly ItemPedido[], profissional: Profissional): number {
  return itens.reduce((total, item) => total + duracaoEfetiva(item, profissional), 0);
}

/**
 * `folga_antes` do primeiro item e `folga_depois` do último. As intermediárias
 * são ignoradas de propósito (6.2) — somá-las infla o bloco de todo agendamento
 * múltiplo para cobrir um caso raro.
 */
export function folgasDoBloco(itens: readonly ItemPedido[]): {
  antesMin: number;
  depoisMin: number;
} {
  const primeiro = itens[0];
  const ultimo = itens[itens.length - 1];

  return {
    antesMin: primeiro?.folgaAntesMin ?? 0,
    depoisMin: ultimo?.folgaDepoisMin ?? 0,
  };
}

function alcanca(excecao: ExcecaoDeAgenda, profissionalId: string): boolean {
  return excecao.profissionalId === null || excecao.profissionalId === profissionalId;
}

/**
 * As janelas de trabalho do dia, já em instantes absolutos. A conversão acontece
 * por data e nunca para a semana inteira: em transição de horário de verão o dia
 * tem 23 ou 25 horas (6.3).
 */
export function janelasDoDia(
  contexto: ContextoDeDisponibilidade,
  profissionalId: string,
  data: DataLocal,
): Interval[] {
  const dia = diaDaSemana(data);

  const daGrade = contexto.grade
    .filter(
      (linha) =>
        linha.profissionalId === profissionalId &&
        linha.diaSemana === dia &&
        vigenteEm(data, linha.vigenciaInicio, linha.vigenciaFim),
    )
    .map((linha) =>
      Interval.fromDateTimes(
        emUtc(data, linha.horaInicio, contexto.fuso),
        emUtc(data, linha.horaFim, contexto.fuso),
      ),
    );

  const limitesDoDia = Interval.fromDateTimes(
    emUtc(data, '00:00', contexto.fuso),
    emUtc(somarDias(data, 1), '00:00', contexto.fuso),
  );

  const extras = contexto.excecoes
    .filter((e) => e.tipo === 'EXTRA' && alcanca(e, profissionalId))
    .map((e) => Interval.fromDateTimes(e.iniciaEm, e.terminaEm))
    .filter((intervalo) => intervalo.overlaps(limitesDoDia));

  const bloqueios = contexto.excecoes
    .filter((e) => e.tipo === 'BLOQUEIO' && alcanca(e, profissionalId))
    .map((e) => Interval.fromDateTimes(e.iniciaEm, e.terminaEm));

  const somadas = Interval.merge([...daGrade, ...extras]);

  return somadas
    .flatMap((janela) => (bloqueios.length === 0 ? [janela] : janela.difference(...bloqueios)))
    .filter((janela) => janela.isValid && janela.length('minutes') > 0);
}

function ocupacoesDe(contexto: ContextoDeDisponibilidade, profissionalId: string): Interval[] {
  return contexto.ocupacoes
    .filter((o) => o.profissionalId === profissionalId)
    .map((o) => Interval.fromDateTimes(o.ocupacaoInicio, o.ocupacaoFim));
}

/**
 * `GRADE` alinha os candidatos à granularidade contada da meia-noite local, para
 * que o cliente veja 09:00 e 09:15 em vez de 09:07. `COMPACTO` parte do começo de
 * cada vão livre e emenda um atendimento no outro (6.7).
 */
function candidatos(
  janela: Interval,
  contexto: ContextoDeDisponibilidade,
  data: DataLocal,
  duracaoDoBlocoMin: number,
  ocupacoes: readonly Interval[],
): DateTime[] {
  const inicioDoDia = emUtc(data, '00:00', contexto.fuso);
  const janelaInicio = janela.start;
  const janelaFim = janela.end;

  if (janelaInicio === null || janelaFim === null) {
    return [];
  }

  if (contexto.config.estrategiaSlot === 'COMPACTO') {
    const vaos = ocupacoes.length === 0 ? [janela] : janela.difference(...ocupacoes);
    const inicios: DateTime[] = [];

    for (const vao of vaos) {
      const comeco = vao.start;
      const fim = vao.end;

      if (comeco === null || fim === null) {
        continue;
      }

      for (
        let t = comeco;
        t.plus({ minutes: duracaoDoBlocoMin }) <= fim;
        t = t.plus({ minutes: duracaoDoBlocoMin })
      ) {
        inicios.push(t);
      }
    }

    return inicios;
  }

  const passo = contexto.config.granularidadeSlotMin;
  const desdeMeiaNoite = janelaInicio.diff(inicioDoDia, 'minutes').minutes;
  const primeiroAlinhado = Math.ceil(desdeMeiaNoite / passo) * passo;
  const inicios: DateTime[] = [];

  for (let minutos = primeiroAlinhado; minutos <= MINUTOS_POR_DIA * 2; minutos += passo) {
    const t = inicioDoDia.plus({ minutes: minutos });

    if (t >= janelaFim) {
      break;
    }

    inicios.push(t);
  }

  return inicios;
}

type Pedido = {
  itens: readonly ItemPedido[];
  profissionais: readonly Profissional[];
};

function slotsDoProfissional(
  contexto: ContextoDeDisponibilidade,
  itens: readonly ItemPedido[],
  profissional: Profissional,
  data: DataLocal,
  pararNoPrimeiro: boolean,
): DateTime[] {
  const duracao = duracaoTotal(itens, profissional);
  const folgas = folgasDoBloco(itens);
  const blocoComFolgas = folgas.antesMin + duracao + folgas.depoisMin;
  const ocupacoes = ocupacoesDe(contexto, profissional.id);
  const naoAntesDe = contexto.agora.plus({ minutes: contexto.config.antecedenciaMinimaMin });
  const encontrados: DateTime[] = [];

  for (const janela of janelasDoDia(contexto, profissional.id, data)) {
    const janelaFim = janela.end;
    const janelaInicio = janela.start;

    if (janelaFim === null || janelaInicio === null) {
      continue;
    }

    for (const inicio of candidatos(janela, contexto, data, blocoComFolgas, ocupacoes)) {
      if (inicio < naoAntesDe) {
        continue;
      }

      const fimAtendimento = inicio.plus({ minutes: duracao });

      if (fimAtendimento > janelaFim) {
        continue;
      }

      const ocupacaoInicio = inicio.minus({ minutes: folgas.antesMin });
      const ocupacaoFim = fimAtendimento.plus({ minutes: folgas.depoisMin });

      // 6.3 — o atendimento precisa caber na janela; a folga só transborda quando
      // a configuração permite. O pseudocódigo de 6.1 checa apenas o fim, mas a
      // folga da frente transborda do mesmo jeito, e prender só uma ponta deixaria
      // a regra pela metade.
      if (
        !contexto.config.folgaPodeExcederJanela &&
        (ocupacaoFim > janelaFim || ocupacaoInicio < janelaInicio)
      ) {
        continue;
      }

      const bloco = Interval.fromDateTimes(ocupacaoInicio, ocupacaoFim);

      if (ocupacoes.some((ocupada) => ocupada.overlaps(bloco))) {
        continue;
      }

      encontrados.push(inicio);

      if (pararNoPrimeiro) {
        return encontrados;
      }
    }
  }

  return encontrados;
}

function dentroDaJanelaDeAgendamento(
  contexto: ContextoDeDisponibilidade,
  data: DataLocal,
): boolean {
  const hoje = contexto.agora.setZone(contexto.fuso).toISODate();

  if (hoje === null) {
    return false;
  }

  return data <= somarDias(hoje, contexto.config.janelaAgendamentoDias);
}

/** O algoritmo completo de 6.1, para um dia só. */
export function calcularSlots(
  contexto: ContextoDeDisponibilidade,
  pedido: Pedido,
  data: DataLocal,
): Slot[] {
  exigirItensValidos(pedido.itens);

  if (!dentroDaJanelaDeAgendamento(contexto, data)) {
    return [];
  }

  const elegiveis = profissionaisElegiveis(pedido.profissionais, pedido.itens);
  const porInstante = new Map<string, Slot>();

  for (const profissional of elegiveis) {
    for (const inicio of slotsDoProfissional(contexto, pedido.itens, profissional, data, false)) {
      const chave = inicio.toISO() ?? '';
      const existente = porInstante.get(chave);

      if (existente) {
        existente.profissionalIds.push(profissional.id);
        continue;
      }

      porInstante.set(chave, { inicio, profissionalIds: [profissional.id] });
    }
  }

  return [...porInstante.values()]
    .sort((a, b) => a.inicio.toMillis() - b.inicio.toMillis())
    .map((slot) => ({
      inicio: slot.inicio,
      // Desempate determinístico por id, para que "qualquer profissional" não
      // dependa da ordem em que o banco devolveu as linhas (6.3)
      profissionalIds: [...slot.profissionalIds].sort(),
    }));
}

/**
 * A mesma função, com critério de parada diferente (6.4): basta saber que o dia
 * tem alguma vaga. Rodar o algoritmo completo para 30 dias e descartar o
 * resultado é a query mais cara do sistema, e ela fica exposta sem autenticação.
 */
export function diasComVaga(
  contexto: ContextoDeDisponibilidade,
  pedido: Pedido,
  dataInicio: DataLocal,
  dataFim: DataLocal,
): DataLocal[] {
  exigirItensValidos(pedido.itens);

  const elegiveis = profissionaisElegiveis(pedido.profissionais, pedido.itens);
  const comVaga: DataLocal[] = [];

  for (const data of datasEntre(dataInicio, dataFim)) {
    if (!dentroDaJanelaDeAgendamento(contexto, data)) {
      continue;
    }

    const tem = elegiveis.some(
      (profissional) =>
        slotsDoProfissional(contexto, pedido.itens, profissional, data, true).length > 0,
    );

    if (tem) {
      comVaga.push(data);
    }
  }

  return comVaga;
}
