import { DateTime } from 'luxon';

/** Data local do estabelecimento, no formato `AAAA-MM-DD`. */
export type DataLocal = string;

/** Hora local do estabelecimento, `HH:MM` ou `HH:MM:SS`. */
export type HoraLocal = string;

export type Janela = {
  inicio: DateTime;
  fim: DateTime;
};

const DOMINGO_NO_LUXON = 7;

/**
 * Uma data de calendário não tem fuso. Interpretá-la no fuso da máquina faz a
 * aritmética de dias tropeçar na transição de horário de verão — somar um dia a
 * 2018-11-03 caía em 2018-11-04T01:00, e a comparação com o fim do intervalo
 * passava a perder o último dia. Ancorar em UTC mantém a aritmética puramente
 * civil, e o resultado idêntico em qualquer servidor.
 */
function comoDataCivil(data: DataLocal): DateTime {
  return exigirValido(DateTime.fromISO(data, { zone: 'utc' }), `data ${data}`);
}

function exigirValido(instante: DateTime, descricao: string): DateTime {
  if (!instante.isValid) {
    throw new RangeError(`${descricao}: ${instante.invalidReason ?? 'invalido'}`);
  }

  return instante;
}

/**
 * Converte hora local em instante absoluto **para uma data específica**.
 *
 * A conversão nunca pode ser pré-calculada para uma semana inteira: em transição
 * de horário de verão o dia tem 23 ou 25 horas, e o mesmo `08:00` cai em offsets
 * diferentes (6.3). O Brasil não observa DST hoje, mas a regra é política e
 * reversível, e o sistema atende fusos que podem voltar a observá-la.
 */
export function emUtc(data: DataLocal, hora: HoraLocal, fuso: string): DateTime {
  const completa = hora.length === 5 ? `${hora}:00` : hora;

  return exigirValido(
    DateTime.fromISO(`${data}T${completa}`, { zone: fuso }),
    `hora local ${data} ${hora} em ${fuso}`,
  ).toUTC();
}

export function janelaEmUtc(
  data: DataLocal,
  horaInicio: HoraLocal,
  horaFim: HoraLocal,
  fuso: string,
): Janela {
  const inicio = emUtc(data, horaInicio, fuso);
  const fim = emUtc(data, horaFim, fuso);

  if (fim <= inicio) {
    throw new RangeError(`janela vazia ou invertida em ${data}: ${horaInicio}–${horaFim}`);
  }

  return { inicio, fim };
}

/** 0 = domingo … 6 = sábado, como `horarios_trabalho.dia_semana` (8.5). */
export function diaDaSemana(data: DataLocal): number {
  const civil = comoDataCivil(data);

  return civil.weekday === DOMINGO_NO_LUXON ? 0 : civil.weekday;
}

export function dataDe(instante: DateTime, fuso: string): DataLocal {
  const local = instante.setZone(fuso);

  return exigirValido(local, 'instante').toISODate() as DataLocal;
}

export function hojeEm(fuso: string, agora: DateTime): DataLocal {
  return dataDe(agora, fuso);
}

export function somarDias(data: DataLocal, dias: number): DataLocal {
  return comoDataCivil(data).plus({ days: dias }).toISODate() as DataLocal;
}

/** Datas inclusivas nas duas pontas, como a vigência da grade (6.5). */
export function datasEntre(inicio: DataLocal, fim: DataLocal): DataLocal[] {
  const primeira = comoDataCivil(inicio);
  const ultima = comoDataCivil(fim);
  const datas: DataLocal[] = [];

  for (let dia = primeira; dia <= ultima; dia = dia.plus({ days: 1 })) {
    datas.push(dia.toISODate() as DataLocal);
  }

  return datas;
}

/**
 * Horas de duração do dia local. Existe para tornar visível o que 6.3 exige que
 * o motor suporte: 23 na entrada do horário de verão, 25 na saída.
 */
export function horasNoDia(data: DataLocal, fuso: string): number {
  const inicio = exigirValido(
    DateTime.fromISO(data, { zone: fuso }),
    `data ${data} em ${fuso}`,
  ).startOf('day');

  return inicio.plus({ days: 1 }).startOf('day').diff(inicio, 'hours').hours;
}

/** Vigência inclusiva nas duas pontas (6.5); `fim` nulo significa vigente. */
export function vigenteEm(
  data: DataLocal,
  vigenciaInicio: DataLocal,
  vigenciaFim: DataLocal | null,
): boolean {
  if (data < vigenciaInicio) {
    return false;
  }

  return vigenciaFim === null || data <= vigenciaFim;
}
