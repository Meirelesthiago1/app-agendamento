import { formatarDuracao, formatarMoeda } from '../lib/formatar.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';

/**
 * A mesma forma que `totalizar` devolve, declarada aqui porque `ui` não importa
 * domínio (D8). Estrutural: o que vem de `dominio/dinheiro` encaixa sem
 * conversão, e um quinto caso lá quebraria o build aqui — que é o que se quer.
 */
export type ValorParaExibir =
  | { tipo: 'FIXO'; centavos: number }
  | { tipo: 'A_PARTIR_DE'; centavos: number }
  | { tipo: 'GRATUITO' }
  | { tipo: 'OCULTO' };

export type ItemDoResumo = {
  nome: string;
  duracaoMin: number;
  valor: ValorParaExibir;
};

export type PropsDoResumoDeValor = {
  itens: readonly ItemDoResumo[];
  total: ValorParaExibir;
  duracaoTotalMin: number;
  className?: string;
};

/**
 * `OCULTO` **não vira "sob consulta"** (C10): não escrever a linha de valor é
 * honesto, e "sob consulta" promete um atendimento que ninguém ofereceu.
 */
function textoDoValor(valor: ValorParaExibir): string | null {
  switch (valor.tipo) {
    case 'FIXO':
      return formatarMoeda(valor.centavos);
    case 'A_PARTIR_DE':
      return `a partir de ${formatarMoeda(valor.centavos)}`;
    case 'GRATUITO':
      return 'Gratuito';
    case 'OCULTO':
      return null;
  }
}

export function ResumoDeValor({ itens, total, duracaoTotalMin, className }: PropsDoResumoDeValor) {
  const totalEmTexto = textoDoValor(total);

  return (
    <div className={juntarClasses('flex flex-col gap-2', className)}>
      <ul className="flex flex-col gap-1.5">
        {itens.map((item) => {
          const valor = textoDoValor(item.valor);

          return (
            <li key={item.nome} className="flex items-baseline gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate text-conteudo">{item.nome}</span>

              <span className="shrink-0 text-conteudo-suave tabular-nums">
                {formatarDuracao(item.duracaoMin)}
              </span>

              {valor === null ? null : (
                <span className="shrink-0 text-conteudo tabular-nums">{valor}</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-baseline gap-3 border-t border-borda pt-2 text-sm font-medium">
        <span className="flex-1 text-conteudo">Total</span>

        <span className="shrink-0 text-conteudo-suave tabular-nums">
          {formatarDuracao(duracaoTotalMin)}
        </span>

        {totalEmTexto === null ? null : (
          <span className="shrink-0 text-conteudo tabular-nums">{totalEmTexto}</span>
        )}
      </div>
    </div>
  );
}
