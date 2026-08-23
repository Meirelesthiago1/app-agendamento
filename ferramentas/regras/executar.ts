import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fronteiraDominio from './fronteira-dominio.ts';
import * as fronteirasDeImport from './fronteiras-de-import.ts';
import * as hexForaDePrimitivos from './hex-fora-de-primitivos.ts';
import type { Regra } from './lib/tipos.ts';

const REGRAS: readonly Regra[] = [fronteiraDominio, hexForaDePrimitivos, fronteirasDeImport];

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

let reprovadas = 0;

for (const regra of REGRAS) {
  const violacoes = regra.verificar(raiz);

  if (violacoes.length === 0) {
    process.stdout.write(`  ok    ${regra.NOME}\n`);
    continue;
  }

  reprovadas += 1;
  process.stdout.write(`  FALHA ${regra.NOME}\n`);

  for (const violacao of violacoes) {
    process.stdout.write(`        ${violacao.arquivo}:${violacao.linha} — ${violacao.mensagem}\n`);
  }
}

if (reprovadas > 0) {
  process.stderr.write(`\n${reprovadas} de ${REGRAS.length} regras reprovaram.\n`);
  process.exit(1);
}
