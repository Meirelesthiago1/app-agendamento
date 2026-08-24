const CHAVE = 'agendamento:estabelecimento';

let emMemoria: string | null = null;

/**
 * O painel vive num endereço único (3.4), então o estabelecimento corrente é
 * escolha do cliente, enviada a cada requisição no cabeçalho. Fica fora do React
 * porque quem precisa dele é o cliente HTTP, que não é componente.
 *
 * Persistido no navegador para sobreviver ao F5 — é conveniência de quem usa,
 * não estado de sistema: o servidor confere o vínculo em toda requisição, e um
 * valor inválido aqui vira "não encontrado", não acesso indevido.
 */
export function estabelecimentoAtual(): string | null {
  if (emMemoria !== null) {
    return emMemoria;
  }

  try {
    emMemoria = window.localStorage.getItem(CHAVE);
  } catch {
    emMemoria = null;
  }

  return emMemoria;
}

export function definirEstabelecimentoAtual(id: string | null): void {
  emMemoria = id;

  try {
    if (id === null) {
      window.localStorage.removeItem(CHAVE);
    } else {
      window.localStorage.setItem(CHAVE, id);
    }
  } catch {
    // Janela anônima ou armazenamento bloqueado: a escolha vale só nesta sessão
  }
}
