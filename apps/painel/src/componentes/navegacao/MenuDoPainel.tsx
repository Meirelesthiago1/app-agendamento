import type { UsuarioDaSessao } from '@agendamento/contratos';
import {
  FolhaInferior,
  IconeConfirmar,
  IconeSair,
  IconeTrocar,
  juntarClasses,
  Separador,
} from '@agendamento/ui';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { estabelecimentoAtual } from '../../lib/estabelecimento-atual.ts';
import { useSair, useTrocarEstabelecimento } from '../../lib/sessao.ts';
import { itensDoMenu } from './itens.ts';

const LINHA =
  'flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-sm text-conteudo hover:bg-superficie-afundada';

export type PropsDoMenuDoPainel = {
  sessao: UsuarioDaSessao | null | undefined;
  aoNavegar: () => void;
};

/**
 * O que não coube na barra, mais a conta. É a folha de D25 reaproveitada: a
 * ação fica sob o polegar, e construir um segundo componente parecido só para
 * navegação seria o desvio.
 */
export function MenuDoPainel({ sessao, aoNavegar }: PropsDoMenuDoPainel) {
  const sair = useSair();
  const trocar = useTrocarEstabelecimento();
  const [trocando, definirTrocando] = useState(false);

  const atual = estabelecimentoAtual();
  const escolhido = sessao?.estabelecimentos.find((e) => e.id === atual);
  const temMaisDeUm = (sessao?.estabelecimentos.length ?? 0) > 1;

  return (
    <FolhaInferior titulo={sessao?.nome ?? 'Menu'} descricao={sessao?.email}>
      <div className="flex flex-col gap-1 pb-2">
        {itensDoMenu().map((item) => (
          <Link key={item.para} to={item.para} className={LINHA} onClick={aoNavegar}>
            <item.icone aria-hidden className="size-5 text-conteudo-suave" />
            {item.rotulo}
          </Link>
        ))}

        <Separador className="my-2" />

        {temMaisDeUm ? (
          <>
            <button
              type="button"
              className={LINHA}
              aria-expanded={trocando}
              onClick={() => definirTrocando(!trocando)}
            >
              <IconeTrocar aria-hidden className="size-5 text-conteudo-suave" />
              <span className="flex-1 text-left">Trocar estabelecimento</span>
              <span className="truncate text-xs text-conteudo-suave">{escolhido?.nome}</span>
            </button>

            {/* Expande no lugar: uma segunda folha por cima da primeira empilha
                duas camadas de foco preso para escolher entre dois nomes */}
            {trocando
              ? sessao?.estabelecimentos.map((estabelecimento) => (
                  <button
                    key={estabelecimento.id}
                    type="button"
                    className={juntarClasses(LINHA, 'pl-10')}
                    onClick={async () => {
                      await trocar(estabelecimento.id);
                      aoNavegar();
                    }}
                  >
                    <span className="flex-1 text-left">{estabelecimento.nome}</span>
                    {estabelecimento.id === atual ? (
                      <IconeConfirmar aria-label="Atual" className="size-4 text-acao" />
                    ) : null}
                  </button>
                ))
              : null}
          </>
        ) : null}

        <button
          type="button"
          className={juntarClasses(LINHA, 'text-negativo')}
          onClick={() => sair.mutate()}
        >
          <IconeSair aria-hidden className="size-5" />
          Sair
        </button>
      </div>
    </FolhaInferior>
  );
}
