/**
 * Máscara é sempre uma função pura de dígitos → texto, nunca manipulação do
 * campo. Quem edita o meio de um telefone, cola de outro lugar ou usa o teclado
 * do celular passa por caminhos diferentes de `keydown`; derivar do valor puro
 * cobre todos de uma vez.
 */

export function apenasDigitos(bruto: string): string {
  return bruto.replace(/\D/g, '');
}

/** Fixo `(11) 2345-6789` e celular `(11) 92345-6789`, com o parcial legível. */
export function mascararTelefone(bruto: string): string {
  const digitos = apenasDigitos(bruto).slice(0, 11);

  if (digitos.length <= 2) {
    return digitos.length === 0 ? '' : `(${digitos}`;
  }

  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);

  // O nono dígito só existe no celular: até oito, quebra em 4+4
  const corte = resto.length > 8 ? 5 : 4;

  return resto.length <= corte
    ? `(${ddd}) ${resto}`
    : `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** `12.345-678`, do CEP. */
export function mascararCep(bruto: string): string {
  const digitos = apenasDigitos(bruto).slice(0, 8);

  return digitos.length <= 5 ? digitos : `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

export const MASCARAS = {
  telefone: mascararTelefone,
  cep: mascararCep,
} as const;

export type NomeDaMascara = keyof typeof MASCARAS;

/**
 * Centavos → texto de moeda, digitando da direita para a esquerda. É como
 * teclado de caixa funciona: `8000` vira `80,00`, e não `8000,00`.
 */
export function mascararMoeda(centavos: number): string {
  const inteiro = Math.trunc(Math.abs(centavos));
  const reais = Math.trunc(inteiro / 100).toLocaleString('pt-BR');
  const restante = String(inteiro % 100).padStart(2, '0');

  return `${centavos < 0 ? '-' : ''}${reais},${restante}`;
}

/** O inverso: lê o que está no campo e devolve centavos. */
export function centavosDoTexto(bruto: string): number {
  const digitos = apenasDigitos(bruto).slice(0, 11);

  return digitos.length === 0 ? 0 : Number(digitos);
}

/**
 * Minutos desde a meia-noite ↔ `HH:MM`. É essa a unidade da grade semanal: o
 * banco guarda `time` local (8.5), e comparar intervalos como número evita
 * comparar strings, que erra em `9:00` versus `10:00`.
 */
export function minutosDeHora(texto: string): number | null {
  const achado = /^(\d{1,2}):([0-5]\d)$/.exec(texto.trim());

  if (achado === null) {
    return null;
  }

  const horas = Number(achado[1]);

  return horas > 23 ? null : horas * 60 + Number(achado[2]);
}

export function horaDeMinutos(minutos: number): string {
  const normalizado = ((Math.trunc(minutos) % 1440) + 1440) % 1440;
  const horas = String(Math.trunc(normalizado / 60)).padStart(2, '0');

  return `${horas}:${String(normalizado % 60).padStart(2, '0')}`;
}

/** Digitação progressiva: `9` → `9`, `93` → `09:3`, `930` → `09:30`. */
export function mascararHora(bruto: string): string {
  const digitos = apenasDigitos(bruto).slice(0, 4);

  if (digitos.length <= 2) {
    return digitos;
  }

  // Três dígitos são hora de um algarismo: `930` é 09:30, não 93:0
  const corte = digitos.length === 3 ? 1 : 2;
  const horas = digitos.slice(0, corte).padStart(2, '0');

  return `${horas}:${digitos.slice(corte)}`;
}
