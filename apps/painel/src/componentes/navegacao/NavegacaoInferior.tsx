import type { UsuarioDaSessao } from '@agendamento/contratos';
import { GatilhoDaFolha, IconeMenu, juntarClasses, RaizDaFolha } from '@agendamento/ui';
import { Link, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { itensDaBarra, itensDoMenu } from './itens.ts';
import { MenuDoPainel } from './MenuDoPainel.tsx';

const ATIVO = 'text-acao';
const INATIVO = 'text-conteudo-suave';

const CELULA = 'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-2xs';

/**
 * Três destinos e um "Menu" (D28). O polegar alcança o rodapé e não o topo, e é
 * por isso que a navegação do celular mora aqui em vez de num cabeçalho.
 */
export function NavegacaoInferior({ sessao }: { sessao: UsuarioDaSessao | null | undefined }) {
  const [aberto, definirAberto] = useState(false);
  const caminho = useRouterState({ select: (estado) => estado.location.pathname });

  // O gatilho não é um `Link`, então `activeProps` não o alcança: sem isto, quem
  // está em Horários vê os quatro alvos apagados e perde a orientação
  const menuAtivo = itensDoMenu().some((item) => caminho.startsWith(item.para));

  return (
    <RaizDaFolha open={aberto} onOpenChange={definirAberto}>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-borda bg-superficie pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {itensDaBarra().map((item) => (
          <Link
            key={item.para}
            to={item.para}
            className={CELULA}
            activeProps={{ className: ATIVO }}
            inactiveProps={{ className: INATIVO }}
          >
            <item.icone aria-hidden className="size-5" />
            {item.rotulo}
          </Link>
        ))}

        <GatilhoDaFolha
          className={juntarClasses(CELULA, menuAtivo ? ATIVO : INATIVO)}
          aria-current={menuAtivo ? 'page' : undefined}
        >
          <IconeMenu aria-hidden className="size-5" />
          Menu
        </GatilhoDaFolha>
      </nav>

      {aberto ? <MenuDoPainel sessao={sessao} aoNavegar={() => definirAberto(false)} /> : null}
    </RaizDaFolha>
  );
}
