import { PRIMITIVOS, SOMBRAS } from './primitivos.ts';

const AVISO = [
  '/*',
  ' * Gerado por `pnpm --filter @agendamento/ui tokens`. Não editar à mão:',
  ' * a fonte é `primitivos.ts`, e há teste que reprova a divergência.',
  ' */',
].join('\n');

/**
 * O único arquivo CSS com valor cru de cor (D14). A camada semântica lê daqui;
 * componente nunca lê primitivo (2.1).
 */
export function gerarPrimitivosCss(): string {
  const cores = Object.entries(PRIMITIVOS).map(([nome, valor]) => `  --${nome}: ${valor};`);
  const sombras = Object.entries(SOMBRAS).map(([nome, valor]) => `  --${nome}: ${valor};`);

  return [AVISO, '', ':root {', ...cores, '', ...sombras, '}', ''].join('\n');
}
