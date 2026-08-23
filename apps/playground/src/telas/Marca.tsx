import { CabecalhoTela, Cartao, SeletorCorMarca, useMarca } from '@agendamento/ui';
import { useState } from 'react';

/** As cores que 2.3 nomeia como problemáticas, mais os extremos. */
const CASOS = ['#FFFF00', '#FFFFFF', '#000000', '#00FF00', '#7C3AED', '#1C2A3A'];

export function Marca() {
  const [cor, definirCor] = useState('#FFFF00');
  const doProvedor = useMarca();

  return (
    <>
      <CabecalhoTela
        titulo="Marca"
        subtitulo="Cola um hex, vê a rampa derivada, o botão de exemplo e o aviso de compressão."
      />

      <Cartao className="max-w-xl">
        <SeletorCorMarca valor={cor} aoMudar={definirCor} />
      </Cartao>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-conteudo">Casos que 2.3 nomeia</h2>
        <div className="flex flex-wrap gap-2">
          {CASOS.map((caso) => (
            <button
              key={caso}
              type="button"
              onClick={() => definirCor(caso)}
              className="flex items-center gap-2 rounded-md border border-borda bg-superficie px-3 py-1.5 text-xs hover:border-borda-forte"
            >
              <span
                aria-hidden
                className="size-4 rounded-sm border border-borda"
                style={{ background: caso }}
              />
              <code className="numerais-tabulares">{caso}</code>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-conteudo">A cor aplicada na barra acima</h2>
        <p className="text-sm text-conteudo-suave">
          O seletor desta tela é independente. A cor da barra vem do ProvedorMarca, que injeta as
          variáveis no :root — é o mesmo caminho do layout.tsx do público.
        </p>
        <code className="numerais-tabulares text-xs text-conteudo-suave">
          --acao: {doProvedor.acao} · contraste {doProvedor.contrasteDoConteudo.toFixed(1)}:1
        </code>
      </section>
    </>
  );
}
