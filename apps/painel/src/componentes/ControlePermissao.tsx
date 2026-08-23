import { type Permissao, podeExecutarSobre } from '@agendamento/dominio';
import type { ReactNode } from 'react';
import { estabelecimentoAtual } from '../lib/estabelecimento-atual.ts';
import { useSessao } from '../lib/sessao.ts';

export type PropsDoControlePermissao = {
  permissao: Permissao;
  /** Sobre qual profissional a ação recai, quando o escopo é `PROPRIOS`. */
  profissionalId?: string | null;
  children: ReactNode;
  /** O que mostrar no lugar. Por padrão, nada. */
  alternativa?: ReactNode;
};

/**
 * Esconde ação que o papel não alcança — **nunca** autoriza (5.4 do stack).
 * Quem autoriza é o servidor, em toda requisição. Este componente existe para
 * não oferecer um botão que vai responder 403, o que é frustrante e parece
 * defeito.
 *
 * A matriz vem de `packages/dominio`, a mesma que o servidor lê. Duas cópias da
 * regra divergiriam, e a que diverge em silêncio é a do cliente.
 */
export function ControlePermissao({
  permissao,
  profissionalId = null,
  children,
  alternativa = null,
}: PropsDoControlePermissao) {
  const { data: sessao } = useSessao();
  const atual = estabelecimentoAtual();
  const vinculo = sessao?.estabelecimentos.find((e) => e.id === atual);

  if (vinculo === undefined) {
    return <>{alternativa}</>;
  }

  const alcanca = podeExecutarSobre(
    { papel: vinculo.papel, profissionalId: null },
    permissao,
    profissionalId,
  );

  return <>{alcanca ? children : alternativa}</>;
}
