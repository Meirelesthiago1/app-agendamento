import { CODIGOS_ERRO } from '@agendamento/dominio';
import { z } from 'zod';

/**
 * Enum fechado, compartilhado pelas três aplicações. Escrever um código
 * inexistente falha em tempo de compilação, e o mapa de código para status HTTP
 * vive num lugar só — o plugin de erros da API (6.6, 6.10).
 */
export const codigoErro = z.enum(CODIGOS_ERRO);

/**
 * As chaves de `campos` usam a notação de caminho do react-hook-form —
 * `nome`, `itens.0.servicoId`, `horarios.2.horaFim`. Não é detalhe de
 * formatação: é o que permite ao helper do frontend chamar `setError(caminho)`
 * direto, sem um conversor em cada formulário (T30).
 */
export const respostaErro = z.object({
  erro: z.object({
    codigo: codigoErro,
    /** Gerada no servidor e sempre exibível. Nunca contém SQL, stack ou tabela. */
    mensagem: z.string(),
    campos: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

export type RespostaErro = z.infer<typeof respostaErro>;
