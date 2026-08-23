import type { CamposComErro, CodigoErro } from '@agendamento/dominio';
import { respostaErro } from './erros.js';
import {
  type DefinicaoDeRota,
  type EntradaDe,
  type NomeDeRota,
  ROTAS,
  type Rotas,
  type SaidaDe,
} from './rotas.js';

/**
 * O erro do lado do cliente. Carrega o status porque quem chama às vezes precisa
 * distinguir "não encontrei" de "não posso" sem olhar o código de domínio.
 */
export class ErroDaApi extends Error {
  readonly status: number;
  readonly codigo: CodigoErro | 'RESPOSTA_INESPERADA';
  readonly campos: CamposComErro | undefined;

  constructor(
    status: number,
    codigo: CodigoErro | 'RESPOSTA_INESPERADA',
    mensagem: string,
    campos?: CamposComErro,
  ) {
    super(mensagem);
    this.name = 'ErroDaApi';
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

export function eErroDaApi(valor: unknown): valor is ErroDaApi {
  return valor instanceof ErroDaApi;
}

/**
 * Assinatura estrutural do `setError` do react-hook-form. Declarada assim para
 * que `contratos` não dependa da biblioteca de formulário.
 */
export type DefinirErroDeCampo = (campo: string, erro: { type: string; message: string }) => void;

/**
 * Aplica os erros por campo e informa se tratou. Quando devolve `false`, o erro
 * não é de campo e cai no tratamento global — um aviso, nunca tela em branco
 * (6.10 do stack).
 */
export function aplicarErrosServidor(erro: unknown, definirErro: DefinirErroDeCampo): boolean {
  if (!eErroDaApi(erro) || erro.campos === undefined) {
    return false;
  }

  let aplicou = false;

  for (const [campo, mensagens] of Object.entries(erro.campos)) {
    const primeira = mensagens[0];

    if (primeira !== undefined) {
      definirErro(campo, { type: 'servidor', message: primeira });
      aplicou = true;
    }
  }

  return aplicou;
}

type Entrada = {
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  corpo?: unknown;
};

function montarCaminho(rota: DefinicaoDeRota, params: Record<string, string>): string {
  return rota.caminho.replace(/:([a-zA-Z]+)/g, (_, nome: string) => {
    const valor = params[nome];

    if (valor === undefined) {
      throw new ErroDaApi(0, 'RESPOSTA_INESPERADA', `Parâmetro de rota ausente: ${nome}`);
    }

    return encodeURIComponent(valor);
  });
}

function montarBusca(query: Record<string, unknown>): string {
  const busca = new URLSearchParams();

  for (const [chave, valor] of Object.entries(query)) {
    if (valor === undefined || valor === null) {
      continue;
    }

    busca.set(chave, Array.isArray(valor) ? valor.join(',') : String(valor));
  }

  const texto = busca.toString();

  return texto.length > 0 ? `?${texto}` : '';
}

export type OpcoesDoCliente = {
  baseUrl: string;
  /** Injetável para teste e para o Next, que substitui o `fetch` global. */
  buscar?: typeof fetch;
  cabecalhos?: () => Record<string, string> | Promise<Record<string, string>>;
};

export type Cliente = {
  [N in NomeDeRota]: (
    ...entrada: keyof EntradaDe<Rotas[N]> extends never ? [] : [EntradaDe<Rotas[N]>]
  ) => Promise<SaidaDe<Rotas[N]>>;
};

async function traduzirFalha(resposta: Response): Promise<never> {
  let corpo: unknown;

  try {
    corpo = await resposta.json();
  } catch {
    throw new ErroDaApi(
      resposta.status,
      'RESPOSTA_INESPERADA',
      'Não foi possível concluir. Tente novamente.',
    );
  }

  const analisado = respostaErro.safeParse(corpo);

  if (!analisado.success) {
    throw new ErroDaApi(
      resposta.status,
      'RESPOSTA_INESPERADA',
      'Não foi possível concluir. Tente novamente.',
    );
  }

  const { codigo, mensagem, campos } = analisado.data.erro;

  throw new ErroDaApi(resposta.status, codigo, mensagem, campos);
}

/**
 * Substitui o cliente do ts-rest, que não infere nada com Zod 4. A tipagem vem
 * do mesmo `ROTAS` que o servidor registra, então servidor e telas não podem
 * divergir sem quebrar a compilação.
 */
export function criarCliente(opcoes: OpcoesDoCliente): Cliente {
  const buscar = opcoes.buscar ?? globalThis.fetch;
  const base = opcoes.baseUrl.replace(/\/$/, '');

  const metodos = Object.entries(ROTAS).map(([nome, rota]) => {
    const chamar = async (entrada: Entrada = {}) => {
      const caminho = montarCaminho(rota, entrada.params ?? {});
      const busca = entrada.query ? montarBusca(entrada.query) : '';
      const cabecalhos = {
        accept: 'application/json',
        ...(entrada.corpo === undefined ? {} : { 'content-type': 'application/json' }),
        ...((await opcoes.cabecalhos?.()) ?? {}),
      };

      const resposta = await buscar(`${base}${caminho}${busca}`, {
        method: rota.metodo,
        headers: cabecalhos,
        credentials: 'include',
        ...(entrada.corpo === undefined ? {} : { body: JSON.stringify(entrada.corpo) }),
      });

      if (!resposta.ok) {
        await traduzirFalha(resposta);
      }

      return rota.resposta.parse(await resposta.json());
    };

    return [nome, chamar] as const;
  });

  // A construção é dinâmica; o contrato de tipos vem de `ROTAS`, e é ele que
  // vale para quem chama.
  return Object.fromEntries(metodos) as unknown as Cliente;
}
