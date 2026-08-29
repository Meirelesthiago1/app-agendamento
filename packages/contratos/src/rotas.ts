import { EXIBICOES_VALOR } from '@agendamento/dominio';
import { z } from 'zod';
import { corHex, dataLocal, fusoHorario, listaDeUuids, slug, uuid } from './comuns.js';

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

/** O que a tela de configurações edita em `estabelecimentos` (8.2). */
export const dadosDoEstabelecimento = z.object({
  nome: z.string().min(2).max(120),
  slug,
  segmento: z.string().max(50).nullable(),
  fusoHorario,
  logoUrl: z.url().max(500).nullable(),
  corTema: corHex.nullable(),
  telefonePublico: z
    .string()
    .regex(/^\d{10,11}$/, 'informe DDD e número')
    .nullable(),
  enderecoPublico: z.string().max(300).nullable(),
});

/**
 * As doze chaves de `configuracoes` (8.2). Os limites são de sanidade, não de
 * produto: granularidade de zero divide por zero no motor de slots, e janela de
 * dez anos faz `dias-com-vaga` varrer 3650 dias por requisição.
 */
export const politicasDoEstabelecimento = z.object({
  granularidadeSlotMin: z.number().int().min(5).max(120),
  estrategiaSlot: z.enum(['GRADE', 'COMPACTO']),
  antecedenciaMinimaMin: z.number().int().min(0).max(43_200),
  janelaAgendamentoDias: z.number().int().min(1).max(365),
  prazoCancelamentoMin: z.number().int().min(0).max(43_200),
  confirmacaoAutomatica: z.boolean(),
  permiteSemCadastro: z.boolean(),
  permiteMultiplosServicos: z.boolean(),
  exigeOtpTelefone: z.boolean(),
  staffVeAgendaCompleta: z.boolean(),
  folgaPodeExcederJanela: z.boolean(),
  /** Nulo é "sem limite", que é diferente de zero — zero proibiria agendar. */
  maxAtivosPorCliente: z.number().int().min(1).max(100).nullable(),
});

export const configuracaoCompleta = z.object({
  estabelecimento: dadosDoEstabelecimento.extend({ id: uuid }),
  politicas: politicasDoEstabelecimento,
});

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

  convidar: {
    metodo: 'POST',
    caminho: '/equipe/convites',
    publica: false,
    corpo: z.object({
      nome: z.string().min(2).max(120),
      email: z.email(),
      papel: z.enum(['PROPRIETARIO', 'ADMIN', 'FUNCIONARIO']),
    }),
    resposta: feito,
  },

  aceitarConvite: {
    metodo: 'POST',
    caminho: '/auth/convite',
    publica: false,
    corpo: z.object({ token: z.string().min(20), senha }),
    resposta: usuarioDaSessao,
  },

  pedirRecuperacao: {
    metodo: 'POST',
    caminho: '/auth/recuperacao',
    publica: false,
    corpo: z.object({ email: z.email() }),
    resposta: feito,
  },

  redefinirSenha: {
    metodo: 'POST',
    caminho: '/auth/nova-senha',
    publica: false,
    corpo: z.object({ token: z.string().min(20), senha }),
    resposta: feito,
  },

  obterConfiguracao: {
    metodo: 'GET',
    caminho: '/configuracoes',
    publica: false,
    resposta: configuracaoCompleta,
  },

  atualizarEstabelecimento: {
    metodo: 'PATCH',
    caminho: '/configuracoes/estabelecimento',
    publica: false,
    corpo: dadosDoEstabelecimento,
    resposta: configuracaoCompleta,
  },

  atualizarPoliticas: {
    metodo: 'PATCH',
    caminho: '/configuracoes/politicas',
    publica: false,
    corpo: politicasDoEstabelecimento,
    resposta: configuracaoCompleta,
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
export type ConfiguracaoCompleta = SaidaDe<Rotas['obterConfiguracao']>;
export type DadosDoEstabelecimento = z.infer<typeof dadosDoEstabelecimento>;
export type Politicas = z.infer<typeof politicasDoEstabelecimento>;
