import { describe, expect, test } from 'vitest';
import * as ui from './index.ts';

/**
 * O lote de fundação da etapa 4, nomeado no plano de implementação. Este teste
 * é o que impede a etapa ser declarada pronta com dezessete de dezoito.
 */
const LOTE_DE_FUNDACAO = [
  'Botao',
  'BotaoIcone',
  'Campo',
  'Entrada',
  'AreaTexto',
  'Selecao',
  'Alternancia',
  'Caixa',
  'Selo',
  'Cartao',
  'Aviso',
  'Dialogo',
  'Esqueleto',
  'Separador',
  'Avatar',
  'CabecalhoTela',
  'ListaVazia',
  'BarraDeAcoes',
] as const;

const MARCA = ['derivarPaleta', 'ProvedorMarca'] as const;

describe('inventário do lote de fundação', () => {
  test('os dezoito componentes são exportados', () => {
    for (const nome of LOTE_DE_FUNDACAO) {
      expect(ui, `falta ${nome}`).toHaveProperty(nome);
    }
  });

  test('a marca vem junto', () => {
    for (const nome of MARCA) {
      expect(ui).toHaveProperty(nome);
    }
  });

  /**
   * `packages/ui` não conhece domínio (D8). O teste é literal: se o nome cita
   * agendamento, serviço, profissional, cliente ou lançamento, o componente
   * mora na aplicação que o usa, não aqui.
   */
  test('nenhum nome exportado cita domínio', () => {
    // `Caixa` fica fora da lista: em 6.1 ela é a caixa de seleção, e a colisão
    // com o livro-caixa é do português, não um vazamento de domínio
    const dominio = /agendamento|servico|profissional|cliente|lancamento|estabelecimento/i;
    const infratores = Object.keys(ui).filter((nome) => dominio.test(nome));

    expect(infratores).toEqual([]);
  });

  test('o conjunto de ícones passa por ui/icones, não pelo Lucide direto', () => {
    expect(ui).toHaveProperty('IconeCalendario');
    expect(ui).toHaveProperty('IconeCarregando');
  });
});
