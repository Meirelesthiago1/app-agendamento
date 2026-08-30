import { configuracoes, estabelecimentos, profissionais, vinculos } from '@agendamento/db';
import { type EnviadorEmail, ErroDominio } from '@agendamento/dominio';
import { and, eq } from 'drizzle-orm';
import type { Config } from '../../config.ts';
import { emailDeConvite } from '../../emails/index.ts';
import type { Executor, Transacao } from '../../infra/db/pools.ts';
import { emitirToken } from '../auth/codigos.ts';
import { papelPorExtenso } from '../auth/papeis.ts';
import * as repoAuth from '../auth/repositorio.ts';

export type DadosDoProvisionamento = {
  nome: string;
  slug: string;
  fusoHorario: string;
  segmento: string | null;
  plano: string;
  proprietario: { nome: string; email: string };
};

export type TenantProvisionado = {
  estabelecimentoId: string;
  slug: string;
  linkDoConvite: string;
};

export type DependenciasDoProvisionamento = {
  executor: Executor;
  config: Config;
  email: EnviadorEmail;
};

/**
 * Cria o tenant e convida o proprietário. Roda **fora da API**, como dono do
 * banco: não existe tenant ainda, então não existe contexto de RLS para abrir —
 * e é por isso que `estabelecimentos` não precisa de política de inserção, que
 * teria de ser aberta para qualquer um (2.2).
 *
 * O proprietário nasce `CONVIDADO`, como qualquer convite: quem define a senha
 * é ele, pelo link, e é o aceite que verifica o e-mail e ativa o vínculo.
 */
export async function provisionarTenant(
  deps: DependenciasDoProvisionamento,
  dados: DadosDoProvisionamento,
): Promise<TenantProvisionado> {
  const criado = await deps.executor.transaction(async (tx: Transacao) => {
    const [jaExiste] = await tx
      .select({ id: estabelecimentos.id })
      .from(estabelecimentos)
      .where(eq(estabelecimentos.slug, dados.slug))
      .limit(1);

    if (jaExiste !== undefined) {
      throw new ErroDominio('CONFLITO', `O endereço "${dados.slug}" já está em uso.`);
    }

    const [estabelecimento] = await tx
      .insert(estabelecimentos)
      .values({
        nome: dados.nome,
        slug: dados.slug,
        fusoHorario: dados.fusoHorario,
        segmento: dados.segmento,
        plano: dados.plano,
        status: 'ATIVO',
      })
      .returning({ id: estabelecimentos.id });

    if (estabelecimento === undefined) {
      throw new Error('insert de estabelecimento não devolveu linha');
    }

    // A linha 1:1 de 8.2, com os padrões que o próprio esquema carrega
    await tx.insert(configuracoes).values({ estabelecimentoId: estabelecimento.id });

    const existente = await repoAuth.buscarUsuarioPorEmail(tx, dados.proprietario.email);
    const usuarioId =
      existente?.id ?? (await repoAuth.criarUsuarioSemSenha(tx, dados.proprietario));

    await repoAuth.convidar(tx, {
      usuarioId,
      estabelecimentoId: estabelecimento.id,
      papel: 'PROPRIETARIO',
    });

    // Filtrado pelos dois: a mesma pessoa pode já ter vínculo em outro tenant,
    // e ligar o profissional ao vínculo errado daria a ela a agenda de lá
    const [vinculo] = await tx
      .select({ id: vinculos.id })
      .from(vinculos)
      .where(
        and(eq(vinculos.usuarioId, usuarioId), eq(vinculos.estabelecimentoId, estabelecimento.id)),
      )
      .limit(1);

    if (vinculo === undefined) {
      throw new Error('vínculo do proprietário não foi criado');
    }

    // Decisão 4: o proprietário já nasce atendendo. Sem isso o caso autônomo
    // exigiria configuração antes do primeiro agendamento, e
    // `agendamentos.profissional_id` não teria para onde apontar
    await tx.insert(profissionais).values({
      estabelecimentoId: estabelecimento.id,
      vinculoId: vinculo.id,
      nomeExibicao: dados.proprietario.nome,
      posicao: 0,
    });

    const { token } = await emitirToken(tx, {
      destino: dados.proprietario.email,
      finalidade: 'CONVITE_EQUIPE',
      referenciaId: estabelecimento.id,
      ip: null,
    });

    return { estabelecimentoId: estabelecimento.id, token };
  });

  const linkDoConvite = `${deps.config.APP_URL.replace(/\/$/, '')}/convite?token=${criado.token}`;

  // Fora da transação: e-mail não é atômico, e uma falha de SMTP não pode
  // desfazer o tenant. O link também volta no retorno, então o convite não se
  // perde se o envio falhar
  await deps.email.enviar(
    await emailDeConvite(dados.proprietario.email, {
      convidadoPor: 'Equipe do Agendamento',
      estabelecimento: dados.nome,
      papelPorExtenso: papelPorExtenso('PROPRIETARIO'),
      telefonePublico: null,
      corTema: null,
      link: linkDoConvite,
    }),
  );

  return { estabelecimentoId: criado.estabelecimentoId, slug: dados.slug, linkDoConvite };
}
