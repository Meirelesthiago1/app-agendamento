import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gerarPrimitivosCss } from './gerar.ts';

writeFileSync(fileURLToPath(new URL('./primitivos.css', import.meta.url)), gerarPrimitivosCss());
process.stdout.write('primitivos.css gerado a partir de primitivos.ts\n');
