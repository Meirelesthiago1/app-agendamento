/** Valores em centavos, inteiros. Moeda fixa em BRL, mercado nacional (8.1). */
export type Centavos = number;

export type ExibicaoValor = 'FIXO' | 'A_PARTIR_DE' | 'OCULTO' | 'GRATUITO';

export type ItemDeValor = {
  exibicao: ExibicaoValor;
  centavos: Centavos | null;
};

export type ValorExibido =
  | { tipo: 'FIXO'; centavos: Centavos }
  | { tipo: 'A_PARTIR_DE'; centavos: Centavos }
  | { tipo: 'GRATUITO' }
  | { tipo: 'OCULTO' };

const FORMATADOR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatarBRL(centavos: Centavos): string {
  return FORMATADOR.format(centavos / 100);
}

export function somarCentavos(valores: readonly (Centavos | null)[]): Centavos {
  return valores.reduce<Centavos>((total, valor) => total + (valor ?? 0), 0);
}

/**
 * 9.2 — basta um item `OCULTO` ou `A_PARTIR_DE` para o total virar "a partir de".
 *
 * Dois casos que a regra não nomeia e que precisam de resposta honesta: todos os
 * itens gratuitos resultam em `GRATUITO`, e todos ocultos resultam em `OCULTO`.
 * Somar zero e anunciar "a partir de R$ 0,00" seria pior que não exibir nada.
 */
export function totalizar(itens: readonly ItemDeValor[]): ValorExibido {
  if (itens.length === 0) {
    return { tipo: 'OCULTO' };
  }

  if (itens.every((item) => item.exibicao === 'GRATUITO')) {
    return { tipo: 'GRATUITO' };
  }

  if (itens.every((item) => item.exibicao === 'OCULTO')) {
    return { tipo: 'OCULTO' };
  }

  const centavos = somarCentavos(
    itens.map((item) => (item.exibicao === 'GRATUITO' ? 0 : item.centavos)),
  );

  const incerto = itens.some(
    (item) => item.exibicao === 'OCULTO' || item.exibicao === 'A_PARTIR_DE',
  );

  return incerto ? { tipo: 'A_PARTIR_DE', centavos } : { tipo: 'FIXO', centavos };
}

export function formatarValorExibido(valor: ValorExibido): string {
  switch (valor.tipo) {
    case 'FIXO':
      return formatarBRL(valor.centavos);
    case 'A_PARTIR_DE':
      return `a partir de ${formatarBRL(valor.centavos)}`;
    case 'GRATUITO':
      return 'Gratuito';
    case 'OCULTO':
      return 'Sob consulta';
  }
}
