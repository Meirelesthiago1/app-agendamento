import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import { z } from 'zod';

/**
 * Filtro, ordenação e página vivem **na URL**, não em `useState`.
 *
 * O gestor filtra o caixa, abre um lançamento e volta — e espera o filtro ainda
 * estar lá. Ele copia o link e manda para o contador. Ele dá F5. Nada disso
 * funciona com o estado em memória, e retrofitar depois é mexer em toda tela de
 * listagem (decisão da etapa 6, não da 13).
 */
export const parametrosDeTabela = z.object({
  busca: z.string().optional(),
  ordenar: z.string().optional(),
  sentido: z.enum(['asc', 'desc']).optional(),
  pagina: z.coerce.number().int().min(1).optional(),
});

export type ParametrosDeTabela = z.infer<typeof parametrosDeTabela>;

/** Para o `validateSearch` de qualquer rota de listagem. */
export function validarParametrosDeTabela(busca: Record<string, unknown>): ParametrosDeTabela {
  return parametrosDeTabela.parse(busca);
}

type Bruto = Record<string, unknown>;

/**
 * Puro, e por isso testável sem roteador: recebe o que está na URL e a mudança,
 * devolve o que deve ir para a URL.
 */
export function proximosParametros(atuais: Bruto, mudanca: Partial<ParametrosDeTabela>): Bruto {
  const proximos: Bruto = { ...atuais, ...mudanca };

  // Mudar filtro ou ordenação volta para a primeira página: manter a anterior
  // costuma cair num vazio, e parece que sumiu tudo
  if (mudanca.busca !== undefined || mudanca.ordenar !== undefined) {
    proximos.pagina = undefined;
  }

  for (const [chave, valor] of Object.entries(proximos)) {
    if (valor === undefined || valor === '') {
      delete proximos[chave];
    }
  }

  return proximos;
}

export function chaveDosParametros(parametros: ParametrosDeTabela): string {
  return JSON.stringify({
    busca: parametros.busca ?? '',
    ordenar: parametros.ordenar ?? '',
    sentido: parametros.sentido ?? 'asc',
    pagina: parametros.pagina ?? 1,
  });
}

export function useParametrosTabela() {
  const parametros = useSearch({ strict: false }) as ParametrosDeTabela;
  const navegar = useNavigate();

  const definir = useCallback(
    (mudanca: Partial<ParametrosDeTabela>) => {
      void navegar({
        // `replace` para o histórico não encher de um passo por tecla digitada
        replace: true,
        search: ((atuais: Bruto) => proximosParametros(atuais, mudanca)) as never,
      });
    },
    [navegar],
  );

  return {
    busca: parametros.busca ?? '',
    ordenar: parametros.ordenar,
    sentido: parametros.sentido ?? 'asc',
    pagina: parametros.pagina ?? 1,
    definir,
    /** Chave estável para o cache: mesma URL, mesma entrada. */
    comoChave: chaveDosParametros(parametros),
  };
}
