import { type CodigoErro, ErroDominio, eErroDominio } from '@agendamento/dominio';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  type ZodFastifySchemaValidationError,
} from 'fastify-type-provider-zod';

/**
 * O único mapa de código para status HTTP do sistema (6.6, 6.10). Nenhuma outra
 * camada conhece status: o repositório traduz SQLSTATE em `ErroDominio`, o caso
 * de uso lança `ErroDominio`, e a tradução para HTTP acontece aqui.
 */
const STATUS: Record<CodigoErro, number> = {
  SLOT_OCUPADO: 409,
  SLOT_INDISPONIVEL: 409,
  FORA_DA_JANELA: 422,
  ANTECEDENCIA_INSUFICIENTE: 422,
  PROFISSIONAL_NAO_ELEGIVEL: 422,

  TRANSICAO_INVALIDA: 409,
  GUARDA_FALHOU: 409,
  PRAZO_CANCELAMENTO_EXPIRADO: 422,
  REABERTURA_FORA_DO_PRAZO: 422,
  AINDA_NAO_TERMINOU: 422,

  SEM_PERMISSAO: 403,
  FORA_DO_ESCOPO: 403,

  ITENS_FORA_DO_LIMITE: 422,
  MULTIPLOS_SERVICOS_DESABILITADO: 422,

  CLIENTE_BLOQUEADO: 422,
  LIMITE_DE_ATIVOS_ATINGIDO: 422,

  MUITAS_REQUISICOES: 429,
  NAO_ENCONTRADO: 404,
  DADOS_INVALIDOS: 422,
  CONFLITO: 409,
};

/**
 * Toda rota validada por schema ganha erro por campo sem escrever nada. O
 * `instancePath` vem em barras (`/itens/0/servicoId`); a conversão para ponto é
 * o que permite ao helper do frontend chamar `setError(caminho)` direto,
 * dispensando um conversor em cada formulário (T30).
 */
function camposDaValidacao(
  problemas: readonly ZodFastifySchemaValidationError[],
): Record<string, string[]> {
  const campos: Record<string, string[]> = {};

  for (const problema of problemas) {
    const caminho = problema.instancePath.replace(/^\//, '').split('/').filter(Boolean).join('.');
    const chave = caminho.length > 0 ? caminho : '(corpo)';
    const existentes = campos[chave] ?? [];

    existentes.push(problema.message ?? 'valor inválido');
    campos[chave] = existentes;
  }

  return campos;
}

function responder(
  reply: FastifyReply,
  status: number,
  codigo: CodigoErro,
  mensagem: string,
  campos?: Record<string, string[]>,
) {
  return reply.status(status).send({
    erro: campos === undefined ? { codigo, mensagem } : { codigo, mensagem, campos },
  });
}

export const pluginDeErros = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((erro, requisicao: FastifyRequest, reply) => {
    if (hasZodFastifySchemaValidationErrors(erro)) {
      const campos = camposDaValidacao(erro.validation);

      requisicao.log.info({ campos }, 'entrada invalida');

      return responder(
        reply,
        STATUS.DADOS_INVALIDOS,
        'DADOS_INVALIDOS',
        'Confira os campos destacados.',
        campos,
      );
    }

    if (eErroDominio(erro)) {
      requisicao.log.info({ codigo: erro.codigo }, 'erro de dominio');

      return responder(reply, STATUS[erro.codigo], erro.codigo, erro.message, erro.campos);
    }

    // Resposta que não bate com o contrato é defeito nosso, nunca do cliente
    if (isResponseSerializationError(erro)) {
      requisicao.log.error({ erro }, 'resposta fora do contrato');

      return responder(reply, 500, 'CONFLITO', 'Não foi possível concluir. Tente novamente.');
    }

    const status = (erro as { statusCode?: number }).statusCode ?? 500;

    if (status === 404) {
      return responder(reply, 404, 'NAO_ENCONTRADO', 'Endereço não encontrado.');
    }

    if (status === 429) {
      return responder(
        reply,
        429,
        'MUITAS_REQUISICOES',
        'Muitas requisições. Aguarde um instante.',
      );
    }

    if (status < 500) {
      return responder(reply, status, 'DADOS_INVALIDOS', 'Requisição inválida.');
    }

    // A mensagem exibível nunca contém SQL, stack, identificador interno nem
    // nome de tabela (6.10). O detalhe fica no log.
    requisicao.log.error({ erro }, 'falha nao tratada');

    return responder(reply, 500, 'CONFLITO', 'Não foi possível concluir. Tente novamente.');
  });

  app.setNotFoundHandler((_requisicao, reply) =>
    responder(reply, 404, 'NAO_ENCONTRADO', 'Endereço não encontrado.'),
  );
});

export function statusDe(codigo: CodigoErro): number {
  return STATUS[codigo];
}

export { ErroDominio };
