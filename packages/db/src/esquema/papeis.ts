import { pgRole } from 'drizzle-orm/pg-core';

/**
 * Os dois papéis de 9.6. Nenhum deles é dono das tabelas — é isso que faz a RLS
 * valer para eles, já que o dono a ignora por padrão.
 */
export const papelGestor = pgRole('agendamento_gestor');

export const papelPublico = pgRole('agendamento_publico');
