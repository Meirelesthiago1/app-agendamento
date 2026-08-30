import { describe, expect, test } from 'vitest';
import {
  itensDaBarra,
  itensDoMenu,
  NA_BARRA_INFERIOR,
  NAVEGACAO,
} from '../componentes/navegacao/itens.ts';
import { CHAVES_GLOBAIS, chavesDe, ehChaveEscopada } from './chaves.ts';
import {
  chaveDosParametros,
  parametrosDeTabela,
  proximosParametros,
} from './useParametrosTabela.ts';

const BARBEARIA = '11111111-1111-4111-8111-111111111111';
const CLINICA = '22222222-2222-4222-8222-222222222222';

/**
 * "Consequência que precisa ser garantida por construção, não por disciplina":
 * sem o estabelecimento na chave, trocar de estabelecimento mostra dados em
 * cache do anterior — e a tela parece certa.
 */
describe('o estabelecimento entra em toda chave escopada', () => {
  const chaves = chavesDe(BARBEARIA);

  const todas: readonly (readonly unknown[])[] = [
    chaves.tudo,
    chaves.configuracao,
    chaves.catalogo,
    chaves.equipe,
    chaves.horarios,
    chaves.excecoesTudo,
    chaves.excecoes('2026-09-01..2026-09-30'),
    chaves.servicos,
    chaves.clientes('ana'),
    chaves.agendaDoDia('2026-09-01'),
    chaves.caixa('2026-09'),
  ];

  test('nenhuma chave sai sem o id na raiz', () => {
    for (const chave of todas) {
      expect(ehChaveEscopada(chave, BARBEARIA), JSON.stringify(chave)).toBe(true);
    }
  });

  test('as mesmas consultas em estabelecimentos diferentes são entradas distintas', () => {
    const daClinica = chavesDe(CLINICA);

    expect(JSON.stringify(chaves.catalogo)).not.toBe(JSON.stringify(daClinica.catalogo));
    expect(JSON.stringify(chaves.agendaDoDia('2026-09-01'))).not.toBe(
      JSON.stringify(daClinica.agendaDoDia('2026-09-01')),
    );
  });

  test('o prefixo do estabelecimento alcança todas as suas chaves', () => {
    for (const chave of todas) {
      expect(chave.slice(0, chaves.tudo.length)).toEqual([...chaves.tudo]);
    }
  });

  test('só a sessão vive fora de um estabelecimento', () => {
    expect(Object.values(CHAVES_GLOBAIS)).toHaveLength(1);
    expect(CHAVES_GLOBAIS.sessao).toEqual(['sessao']);
  });
});

/** O estado da tabela na URL sobrevive ao F5, ao voltar e ao link copiado. */
describe('parâmetros de tabela na URL', () => {
  test('o que está na URL é lido de volta igual', () => {
    const daUrl = { busca: 'ana', ordenar: 'nome', sentido: 'desc', pagina: '3' };

    expect(parametrosDeTabela.parse(daUrl)).toEqual({
      busca: 'ana',
      ordenar: 'nome',
      sentido: 'desc',
      pagina: 3,
    });
  });

  test('URL vazia devolve os padrões, sem quebrar', () => {
    expect(parametrosDeTabela.parse({})).toEqual({});
  });

  test('valor vazio some da URL, em vez de virar `?busca=`', () => {
    expect(proximosParametros({ busca: 'ana' }, { busca: '' })).toEqual({});
  });

  test('mudar o filtro volta para a primeira página', () => {
    expect(proximosParametros({ busca: 'ana', pagina: 5 }, { busca: 'bruno' })).toEqual({
      busca: 'bruno',
    });
  });

  test('mudar de página preserva o filtro', () => {
    expect(proximosParametros({ busca: 'ana' }, { pagina: 2 })).toEqual({
      busca: 'ana',
      pagina: 2,
    });
  });

  test('a chave de cache é estável para a mesma URL', () => {
    const um = parametrosDeTabela.parse({ busca: 'ana', pagina: '2' });
    const outro = parametrosDeTabela.parse({ pagina: '2', busca: 'ana' });

    expect(chaveDosParametros(um)).toBe(chaveDosParametros(outro));
  });

  test('e muda quando a URL muda', () => {
    expect(chaveDosParametros(parametrosDeTabela.parse({ pagina: '1' }))).not.toBe(
      chaveDosParametros(parametrosDeTabela.parse({ pagina: '2' })),
    );
  });

  test('sentido fora do enum é recusado, em vez de virar consulta inválida', () => {
    expect(parametrosDeTabela.safeParse({ sentido: 'lateral' }).success).toBe(false);
  });
});

/**
 * A barra do celular mostra três (D28), e o resto vive no menu. O defeito que
 * estes testes previnem é concreto: alguém acrescenta uma tela em `NAVEGACAO`,
 * ela não entra em nenhum dos dois, e some **em silêncio** — porque no desktop
 * a barra lateral continua mostrando, e é lá que se desenvolve.
 */
describe('navegação do painel', () => {
  test('nenhuma tela fica sem caminho no celular', () => {
    const alcancaveis = [...itensDaBarra(), ...itensDoMenu()].map((item) => item.para).sort();

    expect(alcancaveis).toEqual(NAVEGACAO.map((item) => item.para).sort());
  });

  test('e nenhuma aparece nos dois lugares', () => {
    const naBarra = new Set(itensDaBarra().map((item) => item.para));

    expect(itensDoMenu().some((item) => naBarra.has(item.para))).toBe(false);
  });

  test('são três na barra, porque a quarta célula é o Menu', () => {
    expect(itensDaBarra()).toHaveLength(3);
  });

  /** Um caminho com erro de digitação vira célula que some, não erro. */
  test('todo caminho da barra existe na navegação', () => {
    const conhecidos = new Set(NAVEGACAO.map((item) => item.para));

    for (const para of NA_BARRA_INFERIOR) {
      expect(conhecidos.has(para), para).toBe(true);
    }
  });
});
