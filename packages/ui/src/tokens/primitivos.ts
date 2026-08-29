/**
 * A **única** fonte dos valores crus de cor (D14). `primitivos.css` é gerado a
 * partir daqui por `pnpm --filter @agendamento/ui tokens`, e há teste que
 * reprova se os dois saírem de sincronia.
 *
 * Por que a fonte é TypeScript e não o CSS: `derivarPaleta` precisa escolher em
 * tempo de execução entre texto claro e escuro sobre a cor do tenant (2.3), e
 * uma função pura não lê custom property. Com o CSS como fonte, esses valores
 * seriam duplicados à mão — que é exatamente o que D14 existe para impedir.
 */

export const NEUTROS = {
  'cinza-50': '#F9FAFB',
  'cinza-100': '#F3F4F6',
  'cinza-200': '#E5E7EB',
  'cinza-300': '#D1D5DB',
  'cinza-400': '#9CA3AF',
  'cinza-500': '#6B7280',
  'cinza-600': '#4B5563',
  'cinza-700': '#374151',
  'cinza-800': '#1F2937',
  'cinza-900': '#111827',
  branco: '#FFFFFF',
} as const;

/** A cor da referência, e o padrão de `--acao` quando não há `cor_tema`. */
export const MARCA = {
  'navy-500': '#1C2A3A',
  'navy-600': '#141F2B',
  'navy-100': '#E7EAEE',
} as const;

/**
 * As quatro famílias de estado de 2.2. Independentes de `--acao`, sem exceção:
 * `--acao` é escolhida pelo gestor e pode ser verde, e um tenant de marca verde
 * não pode perder a distinção entre "confirmado" e "ação primária desta tela".
 */
export const ESTADOS = {
  'verde-50': '#ECFDF5',
  'verde-100': '#D1FAE5',
  'verde-700': '#047857',
  'verde-800': '#065F46',

  'ambar-50': '#FFFBEB',
  'ambar-100': '#FEF3C7',
  'ambar-700': '#B45309',
  'ambar-800': '#92400E',

  'vermelho-50': '#FEF2F2',
  'vermelho-100': '#FEE2E2',
  'vermelho-700': '#B91C1C',
  'vermelho-800': '#991B1B',
} as const;

/**
 * Paleta de etiqueta: cores que quem usa a aplicação escolhe para marcar um
 * item e reconhecê-lo de relance numa lista. São oito porque acima disso elas
 * deixam de ser distinguíveis num ponto de dez pixels.
 *
 * São **dado**, não token: viajam como hex e são pintadas em tempo de execução,
 * o que nenhuma classe faria. Moram aqui porque D14 dá a este arquivo a posse
 * de todo valor cru de cor, inclusive o que a aplicação persiste.
 *
 * Ficam fora de `PRIMITIVOS` de propósito: não viram custom property nem classe
 * do Tailwind, porque nada na interface é estilizado com elas.
 */
export const CORES_DE_ETIQUETA = [
  { cor: '#EF4444', nome: 'Vermelho' },
  { cor: '#F59E0B', nome: 'Âmbar' },
  { cor: '#10B981', nome: 'Verde' },
  { cor: '#06B6D4', nome: 'Ciano' },
  { cor: '#3B82F6', nome: 'Azul' },
  { cor: '#8B5CF6', nome: 'Violeta' },
  { cor: '#EC4899', nome: 'Rosa' },
  { cor: '#64748B', nome: 'Cinza' },
] as const;

export const PRIMITIVOS = { ...NEUTROS, ...MARCA, ...ESTADOS } as const;

export type NomeDePrimitivo = keyof typeof PRIMITIVOS;

/** Sombra é o terceiro nível de separação, depois de superfície e borda (2.5). */
export const SOMBRAS = {
  'sombra-1': '0 1px 2px 0 rgb(17 24 39 / 0.06), 0 1px 3px 0 rgb(17 24 39 / 0.10)',
  'sombra-2': '0 10px 15px -3px rgb(17 24 39 / 0.10), 0 4px 6px -4px rgb(17 24 39 / 0.10)',
} as const;
