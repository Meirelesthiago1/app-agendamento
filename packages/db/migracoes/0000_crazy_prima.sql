-- Acrescentado à mão. `citext` sustenta os e-mails de 8.3 e precisa existir antes
-- dos CREATE TABLE que o usam; `btree_gist` é exigido pela constraint de exclusão
-- de 8.5, criada na migração seguinte.
CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."ator_tipo" AS ENUM('USUARIO', 'CLIENTE', 'SISTEMA');--> statement-breakpoint
CREATE TYPE "public"."canal_notificacao" AS ENUM('EMAIL', 'SMS', 'WHATSAPP', 'PUSH');--> statement-breakpoint
CREATE TYPE "public"."canal_verificacao" AS ENUM('SMS', 'WHATSAPP', 'EMAIL');--> statement-breakpoint
CREATE TYPE "public"."cancelado_por" AS ENUM('CLIENTE', 'EQUIPE', 'SISTEMA');--> statement-breakpoint
CREATE TYPE "public"."estrategia_slot" AS ENUM('GRADE', 'COMPACTO');--> statement-breakpoint
CREATE TYPE "public"."exibicao_valor" AS ENUM('FIXO', 'A_PARTIR_DE', 'OCULTO', 'GRATUITO');--> statement-breakpoint
CREATE TYPE "public"."origem_agendamento" AS ENUM('PUBLICO', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."papel" AS ENUM('PROPRIETARIO', 'ADMIN', 'FUNCIONARIO');--> statement-breakpoint
CREATE TYPE "public"."provedor_externo" AS ENUM('GOOGLE');--> statement-breakpoint
CREATE TYPE "public"."status_agendamento" AS ENUM('AGUARDANDO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO', 'FALTOU');--> statement-breakpoint
CREATE TYPE "public"."status_estabelecimento" AS ENUM('ATIVO', 'SUSPENSO', 'TESTE', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."status_notificacao" AS ENUM('PENDENTE', 'ENVIADA', 'FALHOU', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."status_vinculo" AS ENUM('CONVIDADO', 'ATIVO', 'DESATIVADO');--> statement-breakpoint
CREATE TYPE "public"."tipo_cancelamento" AS ENUM('DESISTENCIA', 'REMARCACAO', 'INDISPONIBILIDADE', 'EXPIRACAO');--> statement-breakpoint
CREATE TYPE "public"."tipo_excecao" AS ENUM('BLOQUEIO', 'EXTRA');--> statement-breakpoint
CREATE TYPE "public"."tipo_lancamento" AS ENUM('AGENDAMENTO', 'AVULSO', 'TOTAL_DIA');--> statement-breakpoint
CREATE ROLE "agendamento_gestor";--> statement-breakpoint
CREATE ROLE "agendamento_publico";--> statement-breakpoint
CREATE TABLE "agendamento_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"agendamento_id" uuid NOT NULL,
	"servico_id" uuid NOT NULL,
	"posicao" integer NOT NULL,
	"duracao_min_snapshot" integer NOT NULL,
	"valor_centavos_snapshot" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agendamento_itens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "agendamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"profissional_id" uuid NOT NULL,
	"inicia_em" timestamp with time zone NOT NULL,
	"termina_em" timestamp with time zone NOT NULL,
	"ocupacao_inicio" timestamp with time zone NOT NULL,
	"ocupacao_fim" timestamp with time zone NOT NULL,
	"status" "status_agendamento" NOT NULL,
	"valor_total_snapshot" integer,
	"duracao_total_min_snapshot" integer NOT NULL,
	"origem" "origem_agendamento" NOT NULL,
	"qualquer_profissional" boolean DEFAULT false NOT NULL,
	"encaixe" boolean DEFAULT false NOT NULL,
	"observacoes_cliente" text,
	"observacoes_internas" text,
	"token_gestao" varchar(64),
	"token_gestao_expira_em" timestamp with time zone,
	"tipo_cancelamento" "tipo_cancelamento",
	"criado_por_usuario_id" uuid,
	"confirmado_em" timestamp with time zone,
	"concluido_em" timestamp with time zone,
	"cancelado_em" timestamp with time zone,
	"cancelado_por" "cancelado_por",
	"motivo_cancelamento" varchar(200),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agendamentos_token_gestao_unique" UNIQUE("token_gestao")
);
--> statement-breakpoint
ALTER TABLE "agendamentos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "excecoes_agenda" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"profissional_id" uuid,
	"tipo" "tipo_excecao" NOT NULL,
	"inicia_em" timestamp with time zone NOT NULL,
	"termina_em" timestamp with time zone NOT NULL,
	"dia_inteiro" boolean DEFAULT false NOT NULL,
	"motivo" varchar(120),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "excecoes_agenda" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "horarios_trabalho" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"profissional_id" uuid NOT NULL,
	"dia_semana" smallint NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fim" time NOT NULL,
	"vigencia_inicio" date NOT NULL,
	"vigencia_fim" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "horarios_trabalho" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categorias_servico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"nome" varchar(80) NOT NULL,
	"posicao" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categorias_servico" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profissionais_servicos" (
	"estabelecimento_id" uuid NOT NULL,
	"profissional_id" uuid NOT NULL,
	"servico_id" uuid NOT NULL,
	"duracao_override_min" integer,
	"valor_override_centavos" integer,
	CONSTRAINT "profissionais_servicos_profissional_id_servico_id_pk" PRIMARY KEY("profissional_id","servico_id")
);
--> statement-breakpoint
ALTER TABLE "profissionais_servicos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "servicos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"categoria_id" uuid,
	"slug" varchar(60) NOT NULL,
	"nome" varchar(120) NOT NULL,
	"descricao" text,
	"duracao_min" integer NOT NULL,
	"folga_antes_min" integer DEFAULT 0 NOT NULL,
	"folga_depois_min" integer DEFAULT 0 NOT NULL,
	"valor_centavos" integer,
	"exibicao_valor" "exibicao_valor" DEFAULT 'FIXO' NOT NULL,
	"cor" char(7),
	"ativo" boolean DEFAULT true NOT NULL,
	"posicao" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"excluido_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "servicos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "configuracoes" (
	"estabelecimento_id" uuid PRIMARY KEY NOT NULL,
	"granularidade_slot_min" integer DEFAULT 15 NOT NULL,
	"estrategia_slot" "estrategia_slot" DEFAULT 'GRADE' NOT NULL,
	"antecedencia_minima_min" integer DEFAULT 60 NOT NULL,
	"janela_agendamento_dias" integer DEFAULT 14 NOT NULL,
	"prazo_cancelamento_min" integer DEFAULT 1440 NOT NULL,
	"confirmacao_automatica" boolean DEFAULT true NOT NULL,
	"permite_sem_cadastro" boolean DEFAULT true NOT NULL,
	"permite_multiplos_servicos" boolean DEFAULT true NOT NULL,
	"exige_otp_telefone" boolean DEFAULT false NOT NULL,
	"staff_ve_agenda_completa" boolean DEFAULT false NOT NULL,
	"folga_pode_exceder_janela" boolean DEFAULT true NOT NULL,
	"max_ativos_por_cliente" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "configuracoes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estabelecimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(50) NOT NULL,
	"nome" varchar(120) NOT NULL,
	"segmento" varchar(50),
	"fuso_horario" varchar(50) NOT NULL,
	"logo_url" text,
	"cor_tema" char(7),
	"telefone_publico" varchar(20),
	"endereco_publico" text,
	"plano" varchar(30) NOT NULL,
	"status" "status_estabelecimento" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"excluido_em" timestamp with time zone,
	CONSTRAINT "estabelecimentos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "estabelecimentos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"ator_usuario_id" uuid,
	"ator_tipo" "ator_tipo",
	"cliente_id" uuid,
	"entidade" varchar(60) NOT NULL,
	"entidade_id" uuid NOT NULL,
	"acao" varchar(40) NOT NULL,
	"diff" jsonb,
	"ip" "inet",
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auditoria" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lancamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"data_lancamento" date NOT NULL,
	"profissional_id" uuid,
	"tipo" "tipo_lancamento" NOT NULL,
	"agendamento_id" uuid,
	"servico_id" uuid,
	"cliente_id" uuid,
	"nome_cliente" varchar(120),
	"quantidade" integer DEFAULT 1 NOT NULL,
	"valor_centavos" integer NOT NULL,
	"observacao" text,
	"estorna_lancamento_id" uuid,
	"estornado_por_lancamento_id" uuid,
	"criado_por_usuario_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lancamentos_agendamento_chk" CHECK (("lancamentos"."tipo" = 'AGENDAMENTO') = ("lancamentos"."agendamento_id" IS NOT NULL)),
	CONSTRAINT "lancamentos_servico_chk" CHECK ("lancamentos"."servico_id" IS NULL OR "lancamentos"."tipo" = 'AVULSO')
);
--> statement-breakpoint
ALTER TABLE "lancamentos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notificacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"agendamento_id" uuid,
	"canal" "canal_notificacao" NOT NULL,
	"template" varchar(60) NOT NULL,
	"destinatario" varchar(160) NOT NULL,
	"agendada_para" timestamp with time zone NOT NULL,
	"enviada_em" timestamp with time zone,
	"status" "status_notificacao" NOT NULL,
	"erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notificacoes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "codigos_verificacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destino" varchar(160) NOT NULL,
	"canal" "canal_verificacao" NOT NULL,
	"codigo_hash" text NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"consumido_em" timestamp with time zone,
	"ip" "inet",
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identidades_externas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"provedor" "provedor_externo" NOT NULL,
	"provedor_id" varchar(120) NOT NULL,
	"email" "citext",
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip" "inet",
	"ultimo_uso_em" timestamp with time zone,
	"expira_em" timestamp with time zone NOT NULL,
	"revogada_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(120) NOT NULL,
	"email" "citext" NOT NULL,
	"telefone" varchar(20),
	"senha_hash" text,
	"email_verificado_em" timestamp with time zone,
	"telefone_verificado_em" timestamp with time zone,
	"ultimo_login_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vinculos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"papel" "papel" NOT NULL,
	"status" "status_vinculo" NOT NULL,
	"convidado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vinculos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"usuario_id" uuid,
	"nome" varchar(120) NOT NULL,
	"telefone" varchar(20) NOT NULL,
	"email" "citext",
	"data_nascimento" date,
	"observacoes_internas" text,
	"bloqueado" boolean DEFAULT false NOT NULL,
	"motivo_bloqueio" varchar(200),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"excluido_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "clientes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profissionais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estabelecimento_id" uuid NOT NULL,
	"vinculo_id" uuid,
	"nome_exibicao" varchar(120) NOT NULL,
	"bio" text,
	"avatar_url" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"posicao" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"excluido_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profissionais" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agendamento_itens" ADD CONSTRAINT "agendamento_itens_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamento_itens" ADD CONSTRAINT "agendamento_itens_agendamento_id_agendamentos_id_fk" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamento_itens" ADD CONSTRAINT "agendamento_itens_servico_id_servicos_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_profissional_id_profissionais_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_criado_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excecoes_agenda" ADD CONSTRAINT "excecoes_agenda_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excecoes_agenda" ADD CONSTRAINT "excecoes_agenda_profissional_id_profissionais_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios_trabalho" ADD CONSTRAINT "horarios_trabalho_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios_trabalho" ADD CONSTRAINT "horarios_trabalho_profissional_id_profissionais_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_servico" ADD CONSTRAINT "categorias_servico_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profissionais_servicos" ADD CONSTRAINT "profissionais_servicos_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profissionais_servicos" ADD CONSTRAINT "profissionais_servicos_profissional_id_profissionais_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profissionais_servicos" ADD CONSTRAINT "profissionais_servicos_servico_id_servicos_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_categoria_id_categorias_servico_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_servico"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracoes" ADD CONSTRAINT "configuracoes_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_ator_usuario_id_usuarios_id_fk" FOREIGN KEY ("ator_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_profissional_id_profissionais_id_fk" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_agendamento_id_agendamentos_id_fk" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_servico_id_servicos_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_estorna_lancamento_id_lancamentos_id_fk" FOREIGN KEY ("estorna_lancamento_id") REFERENCES "public"."lancamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_estornado_por_lancamento_id_lancamentos_id_fk" FOREIGN KEY ("estornado_por_lancamento_id") REFERENCES "public"."lancamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_criado_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_agendamento_id_agendamentos_id_fk" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identidades_externas" ADD CONSTRAINT "identidades_externas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profissionais" ADD CONSTRAINT "profissionais_estabelecimento_id_estabelecimentos_id_fk" FOREIGN KEY ("estabelecimento_id") REFERENCES "public"."estabelecimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profissionais" ADD CONSTRAINT "profissionais_vinculo_id_vinculos_id_fk" FOREIGN KEY ("vinculo_id") REFERENCES "public"."vinculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agendamento_itens_posicao_uk" ON "agendamento_itens" USING btree ("agendamento_id","posicao");--> statement-breakpoint
CREATE INDEX "agendamento_itens_servico_idx" ON "agendamento_itens" USING btree ("estabelecimento_id","servico_id");--> statement-breakpoint
CREATE INDEX "agendamentos_profissional_idx" ON "agendamentos" USING btree ("estabelecimento_id","profissional_id","inicia_em");--> statement-breakpoint
CREATE INDEX "agendamentos_ativos_idx" ON "agendamentos" USING btree ("estabelecimento_id","inicia_em") WHERE status IN ('AGUARDANDO', 'CONFIRMADO');--> statement-breakpoint
CREATE INDEX "agendamentos_cliente_idx" ON "agendamentos" USING btree ("estabelecimento_id","cliente_id",inicia_em DESC);--> statement-breakpoint
CREATE INDEX "excecoes_agenda_periodo_idx" ON "excecoes_agenda" USING btree ("estabelecimento_id","inicia_em","termina_em");--> statement-breakpoint
CREATE INDEX "horarios_trabalho_estabelecimento_idx" ON "horarios_trabalho" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE INDEX "horarios_trabalho_grade_idx" ON "horarios_trabalho" USING btree ("profissional_id","dia_semana","vigencia_inicio");--> statement-breakpoint
CREATE INDEX "categorias_servico_estabelecimento_idx" ON "categorias_servico" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE INDEX "profissionais_servicos_estabelecimento_idx" ON "profissionais_servicos" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE INDEX "servicos_estabelecimento_idx" ON "servicos" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "servicos_slug_uk" ON "servicos" USING btree ("estabelecimento_id","slug");--> statement-breakpoint
CREATE INDEX "auditoria_entidade_idx" ON "auditoria" USING btree ("estabelecimento_id","entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "auditoria_criado_em_idx" ON "auditoria" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "lancamentos_data_idx" ON "lancamentos" USING btree ("estabelecimento_id","data_lancamento");--> statement-breakpoint
CREATE UNIQUE INDEX "lancamentos_agendamento_uk" ON "lancamentos" USING btree ("agendamento_id") WHERE agendamento_id IS NOT NULL AND estorna_lancamento_id IS NULL AND estornado_por_lancamento_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lancamentos_total_dia_uk" ON "lancamentos" USING btree ("estabelecimento_id","data_lancamento","profissional_id") WHERE tipo = 'TOTAL_DIA' AND estorna_lancamento_id IS NULL AND estornado_por_lancamento_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lancamentos_estorno_uk" ON "lancamentos" USING btree ("estorna_lancamento_id") WHERE estorna_lancamento_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notificacoes_estabelecimento_idx" ON "notificacoes" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE INDEX "notificacoes_fila_idx" ON "notificacoes" USING btree ("status","agendada_para");--> statement-breakpoint
CREATE INDEX "codigos_verificacao_destino_idx" ON "codigos_verificacao" USING btree ("destino","expira_em");--> statement-breakpoint
CREATE UNIQUE INDEX "identidades_externas_provedor_uk" ON "identidades_externas" USING btree ("provedor","provedor_id");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_idx" ON "sessoes" USING btree ("usuario_id","expira_em");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_telefone_verificado_uk" ON "usuarios" USING btree ("telefone") WHERE telefone_verificado_em IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vinculos_estabelecimento_idx" ON "vinculos" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vinculos_usuario_estabelecimento_uk" ON "vinculos" USING btree ("usuario_id","estabelecimento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vinculos_proprietario_unico_uk" ON "vinculos" USING btree ("estabelecimento_id") WHERE papel = 'PROPRIETARIO' AND status = 'ATIVO';--> statement-breakpoint
CREATE INDEX "clientes_estabelecimento_idx" ON "clientes" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_telefone_uk" ON "clientes" USING btree ("estabelecimento_id","telefone");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_email_uk" ON "clientes" USING btree ("estabelecimento_id","email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE INDEX "profissionais_estabelecimento_idx" ON "profissionais" USING btree ("estabelecimento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profissionais_vinculo_uk" ON "profissionais" USING btree ("vinculo_id") WHERE vinculo_id IS NOT NULL;--> statement-breakpoint
CREATE POLICY "agendamento_itens_isolamento" ON "agendamento_itens" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "agendamentos_isolamento" ON "agendamentos" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "excecoes_agenda_isolamento" ON "excecoes_agenda" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "horarios_trabalho_isolamento" ON "horarios_trabalho" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "categorias_servico_isolamento" ON "categorias_servico" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "profissionais_servicos_isolamento" ON "profissionais_servicos" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "servicos_isolamento" ON "servicos" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "configuracoes_isolamento" ON "configuracoes" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "estabelecimentos_leitura" ON "estabelecimentos" AS PERMISSIVE FOR SELECT TO "agendamento_gestor", "agendamento_publico" USING (true);--> statement-breakpoint
CREATE POLICY "estabelecimentos_alteracao" ON "estabelecimentos" AS PERMISSIVE FOR UPDATE TO "agendamento_gestor" USING (id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "estabelecimentos_remocao" ON "estabelecimentos" AS PERMISSIVE FOR DELETE TO "agendamento_gestor" USING (id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "auditoria_isolamento" ON "auditoria" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "lancamentos_isolamento" ON "lancamentos" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "notificacoes_isolamento" ON "notificacoes" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "vinculos_isolamento" ON "vinculos" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "clientes_isolamento" ON "clientes" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "profissionais_isolamento" ON "profissionais" AS PERMISSIVE FOR ALL TO "agendamento_gestor", "agendamento_publico" USING (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid) WITH CHECK (estabelecimento_id = nullif(current_setting('app.estabelecimento_id', true), '')::uuid);