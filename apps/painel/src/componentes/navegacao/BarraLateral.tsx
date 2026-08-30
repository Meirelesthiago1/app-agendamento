import { Link } from '@tanstack/react-router';
import { NAVEGACAO } from './itens.ts';

/** No desktop cabe tudo, então não há overflow: a largura extra é o ganho (D27). */
export function BarraLateral() {
  return (
    <nav
      aria-label="Seções do painel"
      className="hidden w-56 shrink-0 flex-col gap-1 border-r border-borda bg-superficie p-3 md:flex"
    >
      {NAVEGACAO.map((item) => (
        <Link
          key={item.para}
          to={item.para}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-superficie-afundada"
          activeProps={{ className: 'bg-acao-suave text-acao' }}
          inactiveProps={{ className: 'text-conteudo-suave' }}
        >
          <item.icone aria-hidden className="size-4" />
          {item.rotulo}
        </Link>
      ))}
    </nav>
  );
}
