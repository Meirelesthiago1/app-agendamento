import { ErroDominio } from '@agendamento/dominio';

/** Violação de constraint de exclusão. */
const VIOLACAO_DE_EXCLUSAO = '23P01';

const SOBREPOSICAO_DE_AGENDAMENTO = 'agendamentos_sem_sobreposicao';

type ErroPostgres = {
  code?: unknown;
  constraint?: unknown;
};

function comoErroPostgres(erro: unknown): ErroPostgres | null {
  return typeof erro === 'object' && erro !== null ? (erro as ErroPostgres) : null;
}

/**
 * T12 — o repositório é a última camada que conhece PostgreSQL. Acima daqui nada
 * sabe o que é um SQLSTATE. Erro não reconhecido volta intacto, para não engolir
 * falha nenhuma.
 */
export function traduzirErroDoBanco(erro: unknown): unknown {
  const doBanco = comoErroPostgres(erro);

  if (
    doBanco?.code === VIOLACAO_DE_EXCLUSAO &&
    doBanco.constraint === SOBREPOSICAO_DE_AGENDAMENTO
  ) {
    return new ErroDominio('SLOT_OCUPADO', 'Esse horário acabou de ser ocupado. Escolha outro.');
  }

  return erro;
}
