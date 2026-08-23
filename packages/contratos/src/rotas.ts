import { EXIBICOES_VALOR } from '@agendamento/dominio';
import { z } from 'zod';
import { dataLocal, listaDeUuids, slug, uuid } from './comuns.js';

export type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type DefinicaoDeRota = {
  metodo: Metodo;
  /** Com parâmetros nomeados no estilo do Fastify: `/publico/:slug/slots`. */
  caminho: string;
  params?: z.ZodType;
  query?: z.ZodType;
  corpo?: z.ZodType;
  resposta: z.ZodType;
  /** Escolhe o pool: `/publico/*` usa `poolPublico` (6.8 do stack). */
  publica: boolean;
};

const porSlug = z.object({ slug });

export const servicoPublico = z.object({
  id: uuid,
  slug: z.string(),
  nome: z.string(),
  descricao: z.string().nullable(),
  duracaoMin: z.number().int(),
  folgaAntesMin: z.number().int(),
  folgaDepoisMin: z.number().int(),
  valorCentavos: z.number().int().nullable(),
  exibicaoValor: z.enum(EXIBICOES_VALOR),
  cor: z.string().nullable(),
  categoriaId: uuid.nullable(),
});

export const profissionalPublico = z.object({
  id: uuid,
  nomeExibicao: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  servicoIds: z.array(uuid),
});

export const estabelecimentoPublico = z.object({
  id: uuid,
  slug: z.string(),
  nome: z.string(),
  fusoHorario: z.string(),
  logoUrl: z.string().nullable(),
  corTema: z.string().nullable(),
  telefonePublico: z.string().nullable(),
  enderecoPublico: z.string().nullable(),
  permiteMultiplosServicos: z.boolean(),
  janelaAgendamentoDias: z.number().int(),
});

export const slotDisponivel = z.object({
  /** Instante absoluto em UTC; a tela converte para o fuso do tenant. */
  inicio: z.iso.datetime(),
  profissionalIds: z.array(uuid),
});

export const usuarioDaSessao = z.object({
  id: uuid,
  nome: z.string(),
  email: z.string(),
  estabelecimentos: z.array(
    z.object({
      id: uuid,
      papel: z.enum(['PROPRIETARIO', 'ADMIN', 'FUNCIONARIO']),
    }),
  ),
  /** Nulo quando há mais de um e o cliente ainda não escolheu. */
  estabelecimentoAtual: uuid.nullable(),
});

/** Mínimo de oito caracteres, sem regra de composição: comprimento vale mais. */
export const senha = z.string().min(8).max(200);

const feito = z.object({ ok: z.boolean() });

export const ROTAS = {
  saude: {
    metodo: 'GET',
    caminho: '/saude',
    publica: true,
    resposta: z.object({
      ok: z.boolean(),
      banco: z.boolean(),
    }),
  },

  cadastrar: {
    metodo: 'POST',
    caminho: '/auth/cadastro',
    publica: false,
    corpo: z.object({
      nome: z.string().min(2).max(120),
      email: z.email(),
      senha,
    }),
    // A mesma resposta exista a conta ou não (1.1 do conteúdo)
    resposta: feito,
  },

  verificarEmail: {
    metodo: 'POST',
    caminho: '/auth/verificar-email',
    publica: false,
    corpo: z.object({ token: z.string().min(20) }),
    resposta: feito,
  },

  reenviarVerificacao: {
    metodo: 'POST',
    caminho: '/auth/reenviar-verificacao',
    publica: false,
    corpo: z.object({ email: z.email() }),
    resposta: feito,
  },

  entrar: {
    metodo: 'POST',
    caminho: '/auth/entrada',
    publica: false,
    corpo: z.object({ email: z.email(), senha }),
    resposta: usuarioDaSessao,
  },

  sair: {
    metodo: 'POST',
    caminho: '/auth/saida',
    publica: false,
    resposta: feito,
  },

  eu: {
    metodo: 'GET',
    caminho: '/auth/eu',
    publica: false,
    resposta: usuarioDaSessao,
  },

  catalogo: {
    metodo: 'GET',
    caminho: '/publico/:slug/catalogo',
    publica: true,
    params: porSlug,
    resposta: z.object({
      estabelecimento: estabelecimentoPublico,
      servicos: z.array(servicoPublico),
      profissionais: z.array(profissionalPublico),
    }),
  },

  /**
   * Disponibilidade é sempre buscada no cliente, com `staleTime: 0`, nunca por
   * Server Component com revalidação (T15). Disponibilidade em cache leva a
   * agendamento sobre horário ocupado.
   */
  slots: {
    metodo: 'GET',
    caminho: '/publico/:slug/slots',
    publica: true,
    params: porSlug,
    query: z.object({
      data: dataLocal,
      servicos: listaDeUuids,
      profissionalId: uuid.optional(),
    }),
    resposta: z.object({
      data: dataLocal,
      slots: z.array(slotDisponivel),
    }),
  },

  /** Só quais dias têm alguma vaga, com saída antecipada no primeiro slot (6.4). */
  diasComVaga: {
    metodo: 'GET',
    caminho: '/publico/:slug/dias-com-vaga',
    publica: true,
    params: porSlug,
    query: z.object({
      mes: z.string().regex(/^\d{4}-\d{2}$/, 'use o formato AAAA-MM'),
      servicos: listaDeUuids,
      profissionalId: uuid.optional(),
    }),
    resposta: z.object({
      dias: z.array(dataLocal),
    }),
  },
} as const satisfies Record<string, DefinicaoDeRota>;

export type Rotas = typeof ROTAS;
export type NomeDeRota = keyof Rotas;

type ChavesDeEntrada<R extends DefinicaoDeRota> =
  | (R['params'] extends z.ZodType ? 'params' : never)
  | (R['query'] extends z.ZodType ? 'query' : never)
  | (R['corpo'] extends z.ZodType ? 'corpo' : never);

/**
 * O que a chamada precisa receber. `z.input` e não `z.infer` porque a query
 * chega como texto e é transformada — `servicos=a,b` vira uma lista.
 */
export type EntradaDe<R extends DefinicaoDeRota> = Pick<
  {
    params: R['params'] extends z.ZodType ? z.input<R['params']> : never;
    query: R['query'] extends z.ZodType ? z.input<R['query']> : never;
    corpo: R['corpo'] extends z.ZodType ? z.input<R['corpo']> : never;
  },
  ChavesDeEntrada<R>
>;

export type SaidaDe<R extends DefinicaoDeRota> = z.infer<R['resposta']>;

export type Catalogo = SaidaDe<Rotas['catalogo']>;
export type Slots = SaidaDe<Rotas['slots']>;
export type DiasComVaga = SaidaDe<Rotas['diasComVaga']>;
export type UsuarioDaSessao = SaidaDe<Rotas['eu']>;
