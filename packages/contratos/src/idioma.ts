import { z } from 'zod';

/**
 * As mensagens padrão do Zod são em inglês, e chegam à tela: `campos` da
 * resposta de erro alimenta o `setError` de cada formulário (T30). A regra de
 * voz do conteúdo (seção 1) é português direto, então a locale é ligada aqui —
 * uma vez, no pacote que os três aplicativos importam — e não em cada schema.
 *
 * Mensagem específica continua sendo escrita à mão no schema: "este endereço é
 * reservado pelo sistema" diz o que fazer, e a genérica não.
 */
z.config(z.locales.pt());
