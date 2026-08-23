import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/esquema/index.ts',
  out: './migracoes',
  // Sem isto o drizzle-kit ignora `pgRole` e `pgPolicy`, e a RLS não sai na migração.
  entities: { roles: true },
  dbCredentials: {
    url: process.env.DIRETO_BANCO_URL ?? '',
  },
});
