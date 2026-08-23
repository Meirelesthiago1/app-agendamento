import { boolean, char, integer, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { estrategiaSlot, statusEstabelecimento } from './enums.js';
import { politicaDeTenant, politicasDaRaiz } from './rls.js';
import { atualizadoEm, criadoEm, excluidoEm, idPrimario } from './tipos.js';

export const estabelecimentos = pgTable(
  'estabelecimentos',
  {
    id: idPrimario(),
    slug: varchar('slug', { length: 50 }).notNull().unique(),
    nome: varchar('nome', { length: 120 }).notNull(),
    segmento: varchar('segmento', { length: 50 }),
    fusoHorario: varchar('fuso_horario', { length: 50 }).notNull(),
    logoUrl: text('logo_url'),
    corTema: char('cor_tema', { length: 7 }),
    telefonePublico: varchar('telefone_publico', { length: 20 }),
    enderecoPublico: text('endereco_publico'),
    plano: varchar('plano', { length: 30 }).notNull(),
    status: statusEstabelecimento('status').notNull(),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    excluidoEm: excluidoEm(),
  },
  () => politicasDaRaiz(),
);

export const configuracoes = pgTable(
  'configuracoes',
  {
    estabelecimentoId: uuid('estabelecimento_id')
      .primaryKey()
      .references(() => estabelecimentos.id),
    granularidadeSlotMin: integer('granularidade_slot_min').notNull().default(15),
    estrategiaSlot: estrategiaSlot('estrategia_slot').notNull().default('GRADE'),
    antecedenciaMinimaMin: integer('antecedencia_minima_min').notNull().default(60),
    janelaAgendamentoDias: integer('janela_agendamento_dias').notNull().default(14),
    prazoCancelamentoMin: integer('prazo_cancelamento_min').notNull().default(1440),
    confirmacaoAutomatica: boolean('confirmacao_automatica').notNull().default(true),
    permiteSemCadastro: boolean('permite_sem_cadastro').notNull().default(true),
    permiteMultiplosServicos: boolean('permite_multiplos_servicos').notNull().default(true),
    exigeOtpTelefone: boolean('exige_otp_telefone').notNull().default(false),
    staffVeAgendaCompleta: boolean('staff_ve_agenda_completa').notNull().default(false),
    folgaPodeExcederJanela: boolean('folga_pode_exceder_janela').notNull().default(true),
    maxAtivosPorCliente: integer('max_ativos_por_cliente'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  () => [politicaDeTenant('configuracoes')],
);
