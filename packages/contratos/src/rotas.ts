import { EXIBICOES_VALOR } from '@agendamento/dominio';
import { z } from 'zod';
import {
  corHex,
  dataLocal,
  fusoHorario,
  listaDeUuids,
  slug,
  slugDeServico,
  uuid,
} from './comuns.js';

export type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

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

export const categoria = z.object({
  id: uuid,
  nome: z.string().min(2).max(80),
  posicao: z.number().int().nullable(),
});

export const dadosDaCategoria = categoria.omit({ id: true });

/**
 * O serviço como o painel o vê: inclui `ativo`, que o catálogo público nunca
 * mostra — inativo sai da vitrine, mas continua existindo no histórico (6.3).
 */
export const servicoDoPainel = servicoPublico.extend({
  ativo: z.boolean(),
  posicao: z.number().int().nullable(),
});

export const dadosDoServico = z.object({
  nome: z.string().min(2).max(120),
  slug: slugDeServico,
  descricao: z.string().max(2000).nullable(),
  categoriaId: uuid.nullable(),
  duracaoMin: z.number().int().min(5).max(600),
  folgaAntesMin: z.number().int().min(0).max(240),
  folgaDepoisMin: z.number().int().min(0).max(240),
  valorCentavos: z.number().int().min(0).max(99_999_999).nullable(),
  exibicaoValor: z.enum(EXIBICOES_VALOR),
  cor: corHex.nullable(),
  posicao: z.number().int().min(0).max(9999).nullable(),
});

export const catalogoDoPainel = z.object({
  categorias: z.array(categoria),
  servicos: z.array(servicoDoPainel),
});

/** As três combinações de 2.4 vivem na mesma tela, e é ela que as distingue. */
export const membroDaEquipe = z.object({
  id: uuid,
  nomeExibicao: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  ativo: z.boolean(),
  posicao: z.number().int().nullable(),
  /** Nulo é profissional sem login: cadastrado pelo gestor, não acessa nada. */
  vinculoId: uuid.nullable(),
  servicos: z.array(
    z.object({
      servicoId: uuid,
      duracaoOverrideMin: z.number().int().min(5).max(600).nullable(),
      valorOverrideCentavos: z.number().int().min(0).max(99_999_999).nullable(),
    }),
  ),
});

/** Quem tem acesso ao painel. Sem profissional é recepção ou financeiro (2.4). */
export const acessoDaEquipe = z.object({
  vinculoId: uuid,
  nome: z.string(),
  email: z.string(),
  papel: z.enum(['PROPRIETARIO', 'ADMIN', 'FUNCIONARIO']),
  status: z.enum(['CONVIDADO', 'ATIVO', 'DESATIVADO']),
  profissionalId: uuid.nullable(),
});

export const equipeCompleta = z.object({
  profissionais: z.array(membroDaEquipe),
  acessos: z.array(acessoDaEquipe),
});

export const dadosDoProfissional = z.object({
  nomeExibicao: z.string().min(2).max(120),
  bio: z.string().max(2000).nullable(),
  avatarUrl: z.url().max(500).nullable(),
  posicao: z.number().int().min(0).max(9999).nullable(),
  /** Liga o profissional a quem já tem acesso, ou o deixa sem login. */
  vinculoId: uuid.nullable(),
});

export const servicosDoProfissional = z.object({
  servicos: z
    .array(
      z.object({
        servicoId: uuid,
        duracaoOverrideMin: z.number().int().min(5).max(600).nullable(),
        valorOverrideCentavos: z.number().int().min(0).max(99_999_999).nullable(),
      }),
    )
    .max(200),
});

/** `HH:MM`, hora local do estabelecimento. O banco guarda `time` (8.5). */
export const horaLocal = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use o formato HH:MM');

export const faixaDeTrabalho = z.object({
  /** 0 = domingo … 6 = sábado, como a coluna guarda. */
  diaSemana: z.number().int().min(0).max(6),
  horaInicio: horaLocal,
  horaFim: horaLocal,
});

export type FaixaDeTrabalho = z.infer<typeof faixaDeTrabalho>;

function emMinutos(hora: string): number {
  const [h, m] = hora.split(':');

  return Number(h) * 60 + Number(m);
}

/**
 * Duas faixas do mesmo dia não podem se sobrepor. Não é preferência: o motor de
 * disponibilidade somaria o intervalo comum duas vezes, e o mesmo horário
 * apareceria duas vezes na tela do cliente.
 *
 * A checagem vive no contrato para valer nos dois lados — o formulário aponta a
 * linha errada antes de enviar, e o servidor recusa de qualquer forma.
 */
export const gradeSemanal = z
  .object({ faixas: z.array(faixaDeTrabalho).max(50) })
  .superRefine((valor, contexto) => {
    valor.faixas.forEach((faixa, indice) => {
      if (emMinutos(faixa.horaFim) <= emMinutos(faixa.horaInicio)) {
        contexto.addIssue({
          code: 'custom',
          path: ['faixas', indice, 'horaFim'],
          message: 'o fim precisa ser depois do início',
        });
      }
    });

    valor.faixas.forEach((faixa, indice) => {
      const conflita = valor.faixas.some(
        (outra, outroIndice) =>
          outroIndice < indice &&
          outra.diaSemana === faixa.diaSemana &&
          emMinutos(outra.horaInicio) < emMinutos(faixa.horaFim) &&
          emMinutos(faixa.horaInicio) < emMinutos(outra.horaFim),
      );

      if (conflita) {
        contexto.addIssue({
          code: 'custom',
          path: ['faixas', indice, 'horaInicio'],
          message: 'este intervalo se sobrepõe a outro do mesmo dia',
        });
      }
    });
  });

export const gradeDoProfissional = z.object({
  profissionalId: uuid,
  nomeExibicao: z.string(),
  ativo: z.boolean(),
  faixas: z.array(faixaDeTrabalho),
  /** Desde quando a grade vigente vale. Nulo quando a pessoa não tem grade. */
  vigenciaInicio: dataLocal.nullable(),
});

export const excecaoDeAgenda = z.object({
  id: uuid,
  /** Nulo é o estabelecimento inteiro (8.5). */
  profissionalId: uuid.nullable(),
  tipo: z.enum(['BLOQUEIO', 'EXTRA']),
  iniciaEm: z.iso.datetime(),
  terminaEm: z.iso.datetime(),
  diaInteiro: z.boolean(),
  /** Interno, nunca exposto ao cliente (5.9). */
  motivo: z.string().max(120).nullable(),
});

export const dadosDaExcecao = excecaoDeAgenda
  .omit({ id: true })
  .refine((valor) => new Date(valor.terminaEm) > new Date(valor.iniciaEm), {
    message: 'o fim precisa ser depois do início',
    path: ['terminaEm'],
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

  /** A grade **vigente** de cada pessoa. Versões passadas não têm tela (6.5). */
  listarHorarios: {
    metodo: 'GET',
    caminho: '/horarios',
    publica: false,
    resposta: z.object({ grades: z.array(gradeDoProfissional) }),
  },

  definirGrade: {
    metodo: 'PUT',
    caminho: '/horarios/:profissionalId',
    publica: false,
    params: z.object({ profissionalId: uuid }),
    corpo: gradeSemanal,
    resposta: z.object({ grades: z.array(gradeDoProfissional) }),
  },

  listarExcecoes: {
    metodo: 'GET',
    caminho: '/excecoes',
    publica: false,
    query: z.object({ de: dataLocal, ate: dataLocal }),
    resposta: z.object({ excecoes: z.array(excecaoDeAgenda) }),
  },

  criarExcecao: {
    metodo: 'POST',
    caminho: '/excecoes',
    publica: false,
    corpo: dadosDaExcecao,
    resposta: excecaoDeAgenda,
  },

  removerExcecao: {
    metodo: 'DELETE',
    caminho: '/excecoes/:id',
    publica: false,
    params: z.object({ id: uuid }),
    resposta: z.object({ ok: z.boolean() }),
  },

  listarEquipe: {
    metodo: 'GET',
    caminho: '/equipe',
    publica: false,
    resposta: equipeCompleta,
  },

  criarProfissional: {
    metodo: 'POST',
    caminho: '/equipe/profissionais',
    publica: false,
    corpo: dadosDoProfissional,
    resposta: equipeCompleta,
  },

  atualizarProfissional: {
    metodo: 'PATCH',
    caminho: '/equipe/profissionais/:id',
    publica: false,
    params: z.object({ id: uuid }),
    corpo: dadosDoProfissional,
    resposta: equipeCompleta,
  },

  /** Desativar com agenda futura é bloqueado até resolver (6.3). */
  definirProfissionalAtivo: {
    metodo: 'PATCH',
    caminho: '/equipe/profissionais/:id/ativo',
    publica: false,
    params: z.object({ id: uuid }),
    corpo: z.object({ ativo: z.boolean() }),
    resposta: equipeCompleta,
  },

  /** Substitui a lista inteira: é o que a tela edita, com as caixas marcadas. */
  definirServicosDoProfissional: {
    metodo: 'PUT',
    caminho: '/equipe/profissionais/:id/servicos',
    publica: false,
    params: z.object({ id: uuid }),
    corpo: servicosDoProfissional,
    resposta: equipeCompleta,
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

  /** O catálogo como o gestor o edita: inclui inativos e as categorias vazias. */
  listarCatalogo: {
    metodo: 'GET',
    caminho: '/catalogo',
    publica: false,
    resposta: catalogoDoPainel,
  },

  criarCategoria: {
    metodo: 'POST',
    caminho: '/catalogo/categorias',
    publica: false,
    corpo: dadosDaCategoria,
    resposta: catalogoDoPainel,
  },

  atualizarCategoria: {
    metodo: 'PATCH',
    caminho: '/catalogo/categorias/:id',
    publica: false,
    params: z.object({ id: uuid }),
    corpo: dadosDaCategoria,
    resposta: catalogoDoPainel,
  },

  /** Os serviços da categoria ficam sem categoria, nunca são removidos junto. */
  removerCategoria: {
    metodo: 'DELETE',
    caminho: '/catalogo/categorias/:id',
    publica: false,
    params: z.object({ id: uuid }),
    resposta: catalogoDoPainel,
  },

  criarServico: {
    metodo: 'POST',
    caminho: '/catalogo/servicos',
    publica: false,
    corpo: dadosDoServico,
    resposta: catalogoDoPainel,
  },

  atualizarServico: {
    metodo: 'PATCH',
    caminho: '/catalogo/servicos/:id',
    publica: false,
    params: z.object({ id: uuid }),
    corpo: dadosDoServico,
    resposta: catalogoDoPainel,
  },

  /** Desativar com agenda futura é bloqueado até resolver (6.3). */
  definirServicoAtivo: {
    metodo: 'PATCH',
    caminho: '/catalogo/servicos/:id/ativo',
    publica: false,
    params: z.object({ id: uuid }),
    corpo: z.object({ ativo: z.boolean() }),
    resposta: catalogoDoPainel,
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
export type CatalogoDoPainel = z.infer<typeof catalogoDoPainel>;
export type Categoria = z.infer<typeof categoria>;
export type DadosDaCategoria = z.infer<typeof dadosDaCategoria>;
export type ServicoDoPainel = z.infer<typeof servicoDoPainel>;
export type DadosDoServico = z.infer<typeof dadosDoServico>;
export type EquipeCompleta = z.infer<typeof equipeCompleta>;
export type MembroDaEquipe = z.infer<typeof membroDaEquipe>;
export type AcessoDaEquipe = z.infer<typeof acessoDaEquipe>;
export type DadosDoProfissional = z.infer<typeof dadosDoProfissional>;
export type ServicosDoProfissional = z.infer<typeof servicosDoProfissional>;
export type GradeSemanal = z.infer<typeof gradeSemanal>;
export type GradeDoProfissional = z.infer<typeof gradeDoProfissional>;
export type ExcecaoDeAgenda = z.infer<typeof excecaoDeAgenda>;
export type DadosDaExcecao = z.infer<typeof dadosDaExcecao>;
