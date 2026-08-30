import { Avatar, Botao } from '@agendamento/ui';
import type { ReactNode } from 'react';
import { useSair, useSessao } from '../lib/sessao.ts';
import { BarraLateral } from './navegacao/BarraLateral.tsx';
import { NavegacaoInferior } from './navegacao/NavegacaoInferior.tsx';
import { SeletorDeEstabelecimento } from './SeletorDeEstabelecimento.tsx';

/**
 * O painel nasce em ~390px e cresce (D27). No celular a navegação é a barra
 * inferior, porque o polegar alcança o rodapé; o cabeçalho some, e o que ele
 * carregava — quem sou eu, onde estou, sair — mora no menu.
 *
 * A tira de contexto é a exceção: com mais de um estabelecimento, quem opera
 * precisa ver **em qual** o tempo todo. Cancelar o dia no estabelecimento errado
 * é o erro que ela previne.
 */
export function Layout({ children }: { children: ReactNode }) {
  const { data: sessao } = useSessao();
  const sair = useSair();

  const atual = sessao?.estabelecimentoAtual;
  const escolhido = sessao?.estabelecimentos.find((e) => e.id === atual);
  const temMaisDeUm = (sessao?.estabelecimentos.length ?? 0) > 1;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <BarraLateral />

      <div className="flex min-w-0 flex-1 flex-col">
        {temMaisDeUm && escolhido !== undefined ? (
          <p className="border-b border-borda bg-superficie px-4 py-1.5 text-xs text-conteudo-suave md:hidden">
            {escolhido.nome}
          </p>
        ) : null}

        <header className="hidden items-center gap-3 border-b border-borda bg-superficie px-4 py-2 md:flex">
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

        {/* pb-20 no celular: a barra inferior é fixa e cobriria o fim */}
        <main className="mx-auto w-full min-w-0 max-w-(--largura-conteudo) flex-1 p-4 pb-20 md:pb-4">
          {children}
        </main>
      </div>

      <NavegacaoInferior sessao={sessao} />
    </div>
  );
}
