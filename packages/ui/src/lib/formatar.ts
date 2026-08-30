/**
 * `packages/ui` não conhece domínio (D8), então não importa `formatarBRL` de
 * `dominio`. Não é cópia de regra: moeda e idioma são fixos no produto, e os
 * dois lados são a mesma chamada de `Intl` — o que existe uma vez é a decisão,
 * não a implementação.
 */
const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarMoeda(centavos: number): string {
  return MOEDA.format(centavos / 100);
}

/** `90` → `1h30`, `60` → `1h`, `45` → `45 min`. */
export function formatarDuracao(minutos: number): string {
  const horas = Math.trunc(minutos / 60);
  const resto = minutos % 60;

  if (horas === 0) {
    return `${resto} min`;
  }

  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, '0')}`;
}
