import {
  Avatar,
  Botao,
  type Icone,
  IconeCalendario,
  IconeCartao,
  IconeConfiguracoes,
  IconePessoa,
  IconePessoas,
} from '@agendamento/ui';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useSair, useSessao } from '../lib/sessao.ts';
import { SeletorDeEstabelecimento } from './SeletorDeEstabelecimento.tsx';

type ItemDeNavegacao = {
  para: string;
  rotulo: string;
  icone: Icone;
};

const NAVEGACAO: ItemDeNavegacao[] = [
  { para: '/agenda', rotulo: 'Agenda', icone: IconeCalendario },
  { para: '/clientes', rotulo: 'Clientes', icone: IconePessoa },
  { para: '/caixa', rotulo: 'Caixa', icone: IconeCartao },
  { para: '/equipe', rotulo: 'Equipe', icone: IconePessoas },
  { para: '/configuracoes', rotulo: 'Ajustes', icone: IconeConfiguracoes },
];

const ATIVO = 'text-acao';
const INATIVO = 'text-conteudo-suave';

/**
 * Duas larguras, um componente. No celular a navegação vira barra inferior,
 * porque o polegar alcança o rodapé e não o topo — e o painel é usado no
 * celular do gestor para bloquear o dia em dois toques (5.9).
 */
export function Layout({ children }: { children: ReactNode }) {
  const { data: sessao } = useSessao();
  const sair = useSair();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <nav
        aria-label="Seções do painel"
        className="hidden w-56 shrink-0 flex-col gap-1 border-r border-borda bg-superficie p-3 md:flex"
      >
        {NAVEGACAO.map((item) => (
          <Link
            key={item.para}
            to={item.para}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-superficie-afundada"
            activeProps={{ className: `bg-acao-suave ${ATIVO}` }}
            inactiveProps={{ className: INATIVO }}
          >
            <item.icone aria-hidden className="size-4" />
            {item.rotulo}
          </Link>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-borda bg-superficie px-4 py-2">
          {sessao ? <SeletorDeEstabelecimento sessao={sessao} /> : null}

          <div className="ml-auto flex items-center gap-2">
            {sessao ? <Avatar nome={sessao.nome} tamanho="pequeno" /> : null}
            <Botao
              variante="fantasma"
              tamanho="pequeno"
              onClick={() => sair.mutate()}
              carregando={sair.isPending}
            >
              Sair
            </Botao>
          </div>
        </header>

        {/* pb-16 no celular: a barra inferior fixa cobriria o fim do conteúdo */}
        <main className="min-w-0 flex-1 p-4 pb-20 md:pb-4">{children}</main>
      </div>

      <nav
        aria-label="Seções do painel"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-borda bg-superficie pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {NAVEGACAO.map((item) => (
          <Link
            key={item.para}
            to={item.para}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-2xs"
            activeProps={{ className: ATIVO }}
            inactiveProps={{ className: INATIVO }}
          >
            <item.icone aria-hidden className="size-5" />
            {item.rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );
}
