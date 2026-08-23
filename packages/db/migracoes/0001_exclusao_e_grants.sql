-- Migração escrita à mão: o DSL do Drizzle não expressa constraint de exclusão
-- nem GRANT.

-- 8.5 — torna o duplo agendamento impossível no nível do banco, independentemente
-- de condição de corrida na aplicação. Encaixe é deliberadamente excluído: é a
-- sobreposição que o gestor autoriza de forma explícita (5.4).
ALTER TABLE "agendamentos"
  ADD CONSTRAINT "agendamentos_sem_sobreposicao"
  EXCLUDE USING gist (
    "profissional_id" WITH =,
    tstzrange("ocupacao_inicio", "ocupacao_fim") WITH &&
  )
  WHERE (
    "status" IN ('AGUARDANDO', 'CONFIRMADO', 'CONCLUIDO')
    AND "encaixe" = false
  );
--> statement-breakpoint

-- O `CREATE ROLE` da migração anterior nasce NOLOGIN. A senha é definida por
-- ambiente, fora de migração — aqui vai apenas a capacidade de conectar.
ALTER ROLE "agendamento_gestor" WITH LOGIN;
--> statement-breakpoint
ALTER ROLE "agendamento_publico" WITH LOGIN;
--> statement-breakpoint

GRANT USAGE ON SCHEMA "public" TO "agendamento_gestor", "agendamento_publico";
--> statement-breakpoint

----------------------------------------------------------------------------
-- agendamento_gestor — o painel
----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "estabelecimentos", "configuracoes",
  "usuarios", "identidades_externas", "codigos_verificacao", "sessoes", "vinculos",
  "profissionais", "clientes",
  "categorias_servico", "servicos", "profissionais_servicos",
  "horarios_trabalho", "excecoes_agenda",
  "agendamentos", "agendamento_itens",
  "notificacoes"
TO "agendamento_gestor";
--> statement-breakpoint

-- Auditoria não se edita. O DELETE existe só para o expurgo de 24 meses da
-- decisão 42, e nenhum caso de uso o utiliza.
GRANT SELECT, INSERT, DELETE ON "auditoria" TO "agendamento_gestor";
--> statement-breakpoint

-- 7.4 — o livro-caixa é append-only, e a única mutação permitida é preencher
-- `estornado_por_lancamento_id` uma vez. O GRANT de coluna torna a regra
-- impossível de burlar por query errada, em vez de depender de disciplina.
GRANT SELECT, INSERT ON "lancamentos" TO "agendamento_gestor";
--> statement-breakpoint
GRANT UPDATE ("estornado_por_lancamento_id") ON "lancamentos" TO "agendamento_gestor";
--> statement-breakpoint

----------------------------------------------------------------------------
-- agendamento_publico — o fluxo público
--
-- 9.6: leitura de catálogo, grade e existência de ocupação; escrita restrita a
-- clientes, agendamentos e agendamento_itens. Nunca alcança lancamentos,
-- observacoes_internas nem a leitura da auditoria.
----------------------------------------------------------------------------

GRANT SELECT ON
  "estabelecimentos", "configuracoes",
  "categorias_servico", "servicos", "profissionais", "profissionais_servicos",
  "horarios_trabalho", "excecoes_agenda"
TO "agendamento_publico";
--> statement-breakpoint

-- Sem `observacoes_internas` e sem `motivo_bloqueio`: 8.3.1 exige que a recusa a
-- cliente bloqueado seja genérica, sem revelar que o bloqueio existe.
GRANT SELECT (
  "id", "estabelecimento_id", "usuario_id", "nome", "telefone", "email",
  "data_nascimento", "bloqueado", "criado_em", "atualizado_em", "excluido_em"
) ON "clientes" TO "agendamento_publico";
--> statement-breakpoint

GRANT SELECT (
  "id", "estabelecimento_id", "cliente_id", "profissional_id",
  "inicia_em", "termina_em", "ocupacao_inicio", "ocupacao_fim", "status",
  "valor_total_snapshot", "duracao_total_min_snapshot", "origem",
  "qualquer_profissional", "encaixe", "observacoes_cliente",
  "token_gestao", "token_gestao_expira_em", "tipo_cancelamento",
  "criado_por_usuario_id", "confirmado_em", "concluido_em", "cancelado_em",
  "cancelado_por", "motivo_cancelamento", "criado_em", "atualizado_em"
) ON "agendamentos" TO "agendamento_publico";
--> statement-breakpoint

GRANT SELECT, INSERT ON "agendamento_itens" TO "agendamento_publico";
--> statement-breakpoint

GRANT INSERT ON "clientes", "agendamentos" TO "agendamento_publico";
--> statement-breakpoint

-- 8.3.1 — preenche o e-mail quando o cadastro não tem. O nome nunca é
-- sobrescrito, e a ausência de GRANT sobre ele é o que garante isso.
GRANT UPDATE ("email", "atualizado_em") ON "clientes" TO "agendamento_publico";
--> statement-breakpoint

-- 10.7 — cancelamento self-service por `token_gestao`, dentro do prazo.
GRANT UPDATE (
  "status", "tipo_cancelamento", "cancelado_em", "cancelado_por",
  "motivo_cancelamento", "atualizado_em"
) ON "agendamentos" TO "agendamento_publico";
--> statement-breakpoint

-- O outbox de 6.5 do stack nasce dentro da transação que cria o agendamento.
GRANT INSERT ON "notificacoes" TO "agendamento_publico";
--> statement-breakpoint

-- Escreve, nunca lê: 8.3.1 exige registrar a divergência de nome, e 9.6 proíbe a
-- página pública de alcançar a auditoria.
GRANT INSERT ON "auditoria" TO "agendamento_publico";
