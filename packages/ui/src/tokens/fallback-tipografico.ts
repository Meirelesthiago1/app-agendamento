/**
 * Encerra D-g: as métricas do fallback são **calculadas** a partir das tabelas
 * das próprias fontes, não copiadas de um artigo.
 *
 * Sem essa face de fallback, a troca da fonte de sistema pela Inter desloca o
 * texto na primeira pintura. O deslocamento é pequeno, mas acontece em **toda
 * visita nova da página pública** — que é justamente onde a primeira impressão
 * e o Core Web Vital importam (2.4).
 */

export type MetricasDeFonte = {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  xWidthAvg: number;
};

export type AjusteDeFallback = {
  sizeAdjust: string;
  ascentOverride: string;
  descentOverride: string;
  lineGapOverride: string;
};

function porcentagem(valor: number): string {
  return `${(valor * 100).toFixed(2)}%`;
}

/**
 * `size-adjust` iguala a largura média dos glifos das duas fontes; os overrides
 * de ascent, descent e line-gap são então reescalados por ele, para que a caixa
 * de linha resultante também coincida.
 */
export function calcularAjuste(
  preferida: MetricasDeFonte,
  substituta: MetricasDeFonte,
): AjusteDeFallback {
  const larguraPreferida = preferida.xWidthAvg / preferida.unitsPerEm;
  const larguraSubstituta = substituta.xWidthAvg / substituta.unitsPerEm;
  const sizeAdjust = larguraPreferida / larguraSubstituta;

  const proporcao = (valor: number) => Math.abs(valor) / preferida.unitsPerEm / sizeAdjust;

  return {
    sizeAdjust: porcentagem(sizeAdjust),
    ascentOverride: porcentagem(proporcao(preferida.ascent)),
    descentOverride: porcentagem(proporcao(preferida.descent)),
    lineGapOverride: porcentagem(proporcao(preferida.lineGap)),
  };
}

export function faceDeFallbackCss(nome: string, familia: string, ajuste: AjusteDeFallback): string {
  return [
    '@font-face {',
    `  font-family: '${nome}';`,
    `  src: local('${familia}');`,
    `  size-adjust: ${ajuste.sizeAdjust};`,
    `  ascent-override: ${ajuste.ascentOverride};`,
    `  descent-override: ${ajuste.descentOverride};`,
    `  line-gap-override: ${ajuste.lineGapOverride};`,
    '}',
  ].join('\n');
}
