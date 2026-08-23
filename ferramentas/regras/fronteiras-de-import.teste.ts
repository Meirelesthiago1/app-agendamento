import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { verificar } from './fronteiras-de-import.ts';
import { criarFixtura, type Fixtura } from './lib/fixtura.ts';

describe('fronteiras de import', () => {
  let fixtura: Fixtura;

  beforeEach(() => {
    fixtura = criarFixtura('regra-import');
  });

  afterEach(() => {
    fixtura.descartar();
  });

  test('aceita o grafo de 4.2', () => {
    fixtura.escrever(
      'packages/contratos/src/index.ts',
      "import { Papel } from '@agendamento/dominio';\n",
    );
    fixtura.escrever('apps/api/src/servidor.ts', "import { db } from '@agendamento/db';\n");
    fixtura.escrever('apps/painel/src/Aplicacao.tsx', "import { Botao } from '@agendamento/ui';\n");

    expect(verificar(fixtura.raiz)).toEqual([]);
  });

  test('recusa packages/ui importando dominio (D8)', () => {
    fixtura.escrever(
      'packages/ui/src/primitivos/Botao.tsx',
      "import { Papel } from '@agendamento/dominio';\n",
    );

    const violacoes = verificar(fixtura.raiz);

    expect(violacoes).toHaveLength(1);
    expect(violacoes[0]?.mensagem).toContain('nenhum pacote interno');
  });

  test('recusa frontend importando db', () => {
    fixtura.escrever('apps/publico/src/consulta.ts', "import { db } from '@agendamento/db';\n");

    expect(verificar(fixtura.raiz)).toHaveLength(1);
  });

  test('recusa packages/ui alcançando apps por caminho relativo', () => {
    fixtura.escrever(
      'packages/ui/src/lib/atalho.ts',
      "import { algo } from '../../../../apps/painel/src/Aplicacao';\n",
    );

    const violacoes = verificar(fixtura.raiz);

    expect(violacoes).toHaveLength(1);
    expect(violacoes[0]?.mensagem).toContain('não pode sair da própria área');
  });

  test('recusa funcionalidade importando de funcionalidade (T16)', () => {
    fixtura.escrever(
      'apps/painel/src/funcionalidades/agenda/hooks/useAgendaDoDia.ts',
      "import { buscarCliente } from '../../clientes/api';\n",
    );

    const violacoes = verificar(fixtura.raiz);

    expect(violacoes).toHaveLength(1);
    expect(violacoes[0]?.mensagem).toContain('funcionalidade não importa de funcionalidade');
  });

  test('aceita import dentro da mesma funcionalidade', () => {
    fixtura.escrever(
      'apps/painel/src/funcionalidades/agenda/hooks/useAgendaDoDia.ts',
      "import { CartaoAgendamento } from '../componentes/CartaoAgendamento';\n",
    );

    expect(verificar(fixtura.raiz)).toEqual([]);
  });

  test('aceita funcionalidade importando de componentes compartilhados', () => {
    fixtura.escrever(
      'apps/painel/src/funcionalidades/agenda/hooks/useAgendaDoDia.ts',
      "import { Tabela } from '../../../componentes/Tabela';\n",
    );

    expect(verificar(fixtura.raiz)).toEqual([]);
  });
});
