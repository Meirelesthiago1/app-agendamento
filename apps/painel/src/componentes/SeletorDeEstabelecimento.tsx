import type { UsuarioDaSessao } from '@agendamento/contratos';
import { Selecao } from '@agendamento/ui';
import { estabelecimentoAtual } from '../lib/estabelecimento-atual.ts';
import { useTrocarEstabelecimento } from '../lib/sessao.ts';

export type PropsDoSeletor = {
  sessao: UsuarioDaSessao;
};

/**
 * Aparece quando há mais de um vínculo e some quando há um só — quem atende num
 * lugar não deve ver um seletor de uma opção.
 */
export function SeletorDeEstabelecimento({ sessao }: PropsDoSeletor) {
  const trocar = useTrocarEstabelecimento();

  if (sessao.estabelecimentos.length <= 1) {
    return null;
  }

  return (
    <Selecao
      // `Selecao` envolve o `select` num invólucro, então um `label` externo não
      // o alcança: o nome acessível vem do atributo
      aria-label="Estabelecimento"
      className="w-auto"
      value={estabelecimentoAtual() ?? ''}
      onChange={(evento) => void trocar(evento.target.value)}
    >
      {sessao.estabelecimentos.map((estabelecimento) => (
        <option key={estabelecimento.id} value={estabelecimento.id}>
          {estabelecimento.nome}
        </option>
      ))}
    </Selecao>
  );
}
