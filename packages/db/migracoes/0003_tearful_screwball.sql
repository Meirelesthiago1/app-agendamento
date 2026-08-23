CREATE TYPE "public"."finalidade_verificacao" AS ENUM('OTP_TELEFONE', 'VERIFICACAO_EMAIL', 'RECUPERACAO_SENHA', 'CONVITE_EQUIPE');--> statement-breakpoint
ALTER TABLE "codigos_verificacao" ADD COLUMN "finalidade" "finalidade_verificacao" NOT NULL;--> statement-breakpoint
ALTER TABLE "codigos_verificacao" ADD COLUMN "referencia_id" uuid;--> statement-breakpoint
CREATE INDEX "codigos_verificacao_hash_idx" ON "codigos_verificacao" USING btree ("codigo_hash");