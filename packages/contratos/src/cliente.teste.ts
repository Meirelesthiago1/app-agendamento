import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { aplicarErrosServidor, criarCliente, ErroDaApi } from './cliente.js';
import { SLUGS_RESERVADOS, slug } from './comuns.js';
import type { Slots } from './rotas.js';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Tipado com a assinatura do `fetch` para que `mock.calls[0][0]` exista. */
const mockDeBusca = (responder: () => Response) =>
  vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => responder());

const CATALOGO_VAZIO = {
  estabelecimento: {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'corte-fino',
    nome: 'Barbearia Corte Fino',
    fusoHorario: 'America/Sao_Paulo',
    logoUrl: null,
    corTema: null,
    telefonePublico: null,
    enderecoPublico: null,
    permiteMultiplosServicos: true,
    janelaAgendamentoDias: 7,
  },
  servicos: [],
  profissionais: [],
};

describe('tipagem ponta a ponta', () => {
  // O ts-rest com Zod 4 inferia `any` aqui, em silêncio. Este bloco é o que
  // detecta se a substituição alguma vez degradar do mesmo jeito.
  test('a resposta de slots é o objeto declarado, não `any`', () => {
    expectTypeOf<Slots>().toHaveProperty('slots');
    expectTypeOf<Slots['slots'][number]['inicio']>().toEqualTypeOf<string>();
    expectTypeOf<Slots['slots'][number]['profissionalIds']>().toEqualTypeOf<string[]>();
    expectTypeOf<Slots>().not.toBeAny();
  });

  test('a entrada exige os parâmetros da rota', () => {
    const cliente = criarCliente({ baseUrl: 'http://x', buscar: vi.fn() });

    expectTypeOf(cliente.slots).parameter(0).toMatchObjectType<{
      params: { slug: string };
      query: { data: string; servicos: string; profissionalId?: string | undefined };
    }>();
  });

  test('rota sem parâmetro nenhum é chamada sem argumento', () => {
    const cliente = criarCliente({ baseUrl: 'http://x', buscar: vi.fn() });

    expectTypeOf(cliente.saude).parameters.toEqualTypeOf<[]>();
  });
});

describe('montagem da requisição', () => {
  test('substitui o parâmetro no caminho e monta a query', async () => {
    const buscar = mockDeBusca(() => respostaJson({ data: '2026-09-01', slots: [] }));
    const cliente = criarCliente({ baseUrl: 'http://api.teste/', buscar });

    await cliente.slots({
      params: { slug: 'corte-fino' },
      query: { data: '2026-09-01', servicos: 'a,b' },
    });

    expect(buscar.mock.calls[0]?.[0]).toBe(
      'http://api.teste/publico/corte-fino/slots?data=2026-09-01&servicos=a%2Cb',
    );
  });

  test('omite da query o que não foi informado', async () => {
    const buscar = mockDeBusca(() => respostaJson({ dias: [] }));
    const cliente = criarCliente({ baseUrl: 'http://api.teste', buscar });

    await cliente.diasComVaga({
      params: { slug: 'corte-fino' },
      query: { mes: '2026-09', servicos: 'a', profissionalId: undefined },
    });

    expect(buscar.mock.calls[0]?.[0]).not.toContain('profissionalId');
  });

  test('valida a resposta contra o contrato', async () => {
    const buscar = mockDeBusca(() => respostaJson({ estabelecimento: {}, servicos: [] }));
    const cliente = criarCliente({ baseUrl: 'http://api.teste', buscar });

    await expect(cliente.catalogo({ params: { slug: 'corte-fino' } })).rejects.toThrow();
  });

  test('devolve o corpo já validado', async () => {
    const buscar = mockDeBusca(() => respostaJson(CATALOGO_VAZIO));
    const cliente = criarCliente({ baseUrl: 'http://api.teste', buscar });

    const catalogo = await cliente.catalogo({ params: { slug: 'corte-fino' } });

    expect(catalogo.estabelecimento.nome).toBe('Barbearia Corte Fino');
  });
});

describe('erro', () => {
  test('traduz o formato de 6.10 em ErroDaApi', async () => {
    const buscar = mockDeBusca(() =>
      respostaJson(
        {
          erro: {
            codigo: 'SLOT_OCUPADO',
            mensagem: 'Esse horário acabou de ser ocupado.',
            campos: { 'itens.0.servicoId': ['serviço indisponível'] },
          },
        },
        409,
      ),
    );
    const cliente = criarCliente({ baseUrl: 'http://api.teste', buscar });

    const erro = await cliente.catalogo({ params: { slug: 'corte-fino' } }).then(
      () => null,
      (motivo: unknown) => motivo,
    );

    expect(erro).toBeInstanceOf(ErroDaApi);
    expect((erro as ErroDaApi).codigo).toBe('SLOT_OCUPADO');
    expect((erro as ErroDaApi).status).toBe(409);
    expect((erro as ErroDaApi).campos).toEqual({ 'itens.0.servicoId': ['serviço indisponível'] });
  });

  test('resposta de erro fora do formato não vaza detalhe interno', async () => {
    const buscar = mockDeBusca(() => new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    const cliente = criarCliente({ baseUrl: 'http://api.teste', buscar });

    const erro = await cliente.catalogo({ params: { slug: 'corte-fino' } }).then(
      () => null,
      (motivo: unknown) => motivo as ErroDaApi,
    );

    expect(erro?.codigo).toBe('RESPOSTA_INESPERADA');
    expect(erro?.message).toBe('Não foi possível concluir. Tente novamente.');
  });
});

describe('aplicarErrosServidor', () => {
  test('aplica cada campo e informa que tratou', () => {
    const definir = vi.fn();
    const erro = new ErroDaApi(422, 'DADOS_INVALIDOS', 'Confira os campos', {
      nome: ['obrigatório'],
      'itens.0.servicoId': ['inválido'],
    });

    expect(aplicarErrosServidor(erro, definir)).toBe(true);
    expect(definir).toHaveBeenCalledWith('nome', { type: 'servidor', message: 'obrigatório' });
    expect(definir).toHaveBeenCalledWith('itens.0.servicoId', {
      type: 'servidor',
      message: 'inválido',
    });
  });

  test('erro sem campos cai no tratamento global', () => {
    const definir = vi.fn();
    const erro = new ErroDaApi(409, 'SLOT_OCUPADO', 'Ocupado');

    expect(aplicarErrosServidor(erro, definir)).toBe(false);
    expect(definir).not.toHaveBeenCalled();
  });

  test('o que não é erro da API também cai no global', () => {
    expect(aplicarErrosServidor(new TypeError('rede'), vi.fn())).toBe(false);
  });
});

describe('slug', () => {
  test('aceita o formato do subdomínio', () => {
    expect(slug.safeParse('corte-fino').success).toBe(true);
    expect(slug.safeParse('bem-estar-2').success).toBe(true);
  });

  test('recusa formato inválido', () => {
    expect(slug.safeParse('Corte Fino').success).toBe(false);
    expect(slug.safeParse('-corte').success).toBe(false);
    expect(slug.safeParse('co').success).toBe(false);
  });

  test('recusa os endereços do próprio sistema', () => {
    for (const reservado of SLUGS_RESERVADOS) {
      expect(slug.safeParse(reservado).success).toBe(false);
    }
  });
});
