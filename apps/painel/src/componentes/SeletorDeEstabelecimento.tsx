import type { UsuarioDaSessao } from '@agendamento/contratos';
import { IconeAbrir } from '@agendamento/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { trocarEstabelecimento } from '../lib/consultas.ts';
import { estabelecimentoAtual } from '../lib/estabelecimento-atual.ts';

export type PropsDoSeletor = {
  sessao: UsuarioDaSessao;
};

/**
 * Aparece quando há mais de um vínculo e some quando há um só — quem atende num
 * lugar não deve ver um seletor de uma opção.
 *
 * Trocar **não** limpa o cache: com o estabelecimento na chave, cada um é uma
 * entrada distinta e voltar é instantâneo. O que se faz é invalidar, para as
 * telas recarregarem com o cabeçalho novo.
 */
export function SeletorDeEstabelecimento({ sessao }: PropsDoSeletor) {
  const cliente = useQueryClient();
  const roteador = useRouter();

  if (sessao.estabelecimentos.length <= 1) {
    return null;
  }

  return (
    <label className="relative flex items-center">
      <span className="sr-only">Estabelecimento</span>
      <select
        value={estabelecimentoAtual() ?? ''}
        onChange={async (evento) => {
          trocarEstabelecimento(evento.target.value);
          await cliente.invalidateQueries();
          await roteador.invalidate();
        }}
        className="h-9 appearance-none rounded-md border border-borda-forte bg-superficie pl-3 pr-8 text-sm text-conteudo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2"
      >
        {sessao.estabelecimentos.map((estabelecimento) => (
          <option key={estabelecimento.id} value={estabelecimento.id}>
            {estabelecimento.id.slice(0, 8)}
          </option>
        ))}
      </select>
      <IconeAbrir
        aria-hidden
        className="pointer-events-none absolute right-2 size-4 text-conteudo-suave"
      />
    </label>
  );
}
