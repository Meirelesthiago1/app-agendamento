import { sql } from 'drizzle-orm';
import { pgPolicy } from 'drizzle-orm/pg-core';
import { papelGestor, papelPublico } from './papeis.js';

/**
 * Duas defesas, e a segunda não é óbvia.
 *
 * O argumento `true` faz `current_setting` devolver NULL em vez de erro quando a
 * variável nunca foi definida na sessão. Mas depois de uma transação que a
 * definiu, o PostgreSQL a restaura para string **vazia**, não para indefinida — e
 * `''::uuid` levanta 22P02. Numa conexão de pool isso transforma "sem tenant" em
 * erro exatamente onde 10.1 do stack exige resultado vazio. O `nullif` fecha os
 * dois casos.
 */
const tenantAtual = sql`nullif(current_setting('app.estabelecimento_id', true), '')::uuid`;

const AMBOS = [papelGestor, papelPublico];

export function politicaDeTenant(tabela: string) {
  return pgPolicy(`${tabela}_isolamento`, {
    as: 'permissive',
    for: 'all',
    to: AMBOS,
    using: sql`estabelecimento_id = ${tenantAtual}`,
    withCheck: sql`estabelecimento_id = ${tenantAtual}`,
  });
}

/**
 * O usuário precisa enxergar os próprios vínculos **antes** de existir tenant:
 * é a consulta que descobre de quais estabelecimentos ele participa, e ela roda
 * no login, quando `app.estabelecimento_id` ainda não foi definido.
 *
 * Políticas permissivas se somam em OR, então esta convive com a de tenant sem
 * afrouxá-la: quem não é o próprio usuário continua limitado ao tenant corrente.
 */
export function politicaDosProprios() {
  return pgPolicy('vinculos_proprios', {
    as: 'permissive',
    for: 'select',
    to: papelGestor,
    using: sql`usuario_id = nullif(current_setting('app.usuario_id', true), '')::uuid`,
  });
}

/**
 * A tabela raiz é o diretório de tenants, e não pode usar a política acima: o
 * middleware do público resolve `{slug}.dominio.com` antes de existir contexto,
 * e a criação do estabelecimento acontece antes de haver tenant para apontar.
 * Leitura fica aberta — slug, nome, logo e cor já são públicos por construção —
 * e a escrita é limitada ao tenant corrente, com o papel público sem GRANT algum
 * de escrita aqui.
 */
export function politicasDaRaiz() {
  return [
    pgPolicy('estabelecimentos_leitura', {
      as: 'permissive',
      for: 'select',
      to: AMBOS,
      using: sql`true`,
    }),
    pgPolicy('estabelecimentos_alteracao', {
      as: 'permissive',
      for: 'update',
      to: papelGestor,
      using: sql`id = ${tenantAtual}`,
      withCheck: sql`id = ${tenantAtual}`,
    }),
    pgPolicy('estabelecimentos_remocao', {
      as: 'permissive',
      for: 'delete',
      to: papelGestor,
      using: sql`id = ${tenantAtual}`,
    }),
  ];
}
