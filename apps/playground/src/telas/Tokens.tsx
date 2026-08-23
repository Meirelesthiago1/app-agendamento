import { CabecalhoTela, Cartao, Separador } from '@agendamento/ui';
import type { ReactNode } from 'react';

/** Renderizados a partir dos tokens reais, nunca de uma cópia da tabela. */
const SEMANTICOS = [
  ['superficie', 'superficie-afundada', 'superficie-elevada'],
  ['borda', 'borda-forte'],
  ['conteudo', 'conteudo-suave', 'conteudo-tenue'],
  ['acao', 'acao-forte', 'acao-suave', 'acao-conteudo'],
  ['positivo', 'positivo-suave', 'positivo-conteudo'],
  ['atencao', 'atencao-suave', 'atencao-conteudo'],
  ['negativo', 'negativo-suave', 'negativo-conteudo'],
  ['neutro', 'neutro-suave', 'neutro-conteudo'],
];

const TEXTOS = ['2xs', 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'];
const ESPACOS = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
const RAIOS = ['sm', 'md', 'lg', 'xl', 'completo'];
const ELEVACOES = ['nenhuma', 'sombra-1', 'sombra-2'];

function Secao({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-conteudo">{titulo}</h2>
        {nota !== undefined ? <p className="text-xs text-conteudo-suave">{nota}</p> : null}
      </div>
      <Cartao className="flex flex-col gap-4">{children}</Cartao>
    </section>
  );
}

export function Tokens() {
  return (
    <>
      <CabecalhoTela
        titulo="Tokens"
        subtitulo="Componente nunca lê primitivo. Tudo aqui é a camada semântica."
      />

      <Secao titulo="Cor" nota="Trocar cor_tema na barra move só a família de ação">
        {SEMANTICOS.map((familia) => (
          <div key={familia[0]} className="flex flex-wrap gap-3">
            {familia.map((nome) => (
              <div key={nome} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-8 shrink-0 rounded-md border border-borda"
                  style={{ background: `var(--${nome})` }}
                />
                <code className="text-2xs text-conteudo-suave">--{nome}</code>
              </div>
            ))}
          </div>
        ))}
      </Secao>

      <Secao titulo="Tipografia" nota="Inter variável, auto-hospedada, com numerais tabulares">
        {TEXTOS.map((escala) => (
          <div key={escala} className="flex items-baseline gap-4">
            <code className="w-16 shrink-0 text-2xs text-conteudo-tenue">--texto-{escala}</code>
            <span style={{ fontSize: `var(--texto-${escala})` }}>
              O gestor bloqueia o dia em dois toques
            </span>
          </div>
        ))}

        <Separador />

        <div className="flex flex-col gap-1">
          <code className="text-2xs text-conteudo-tenue">
            com e sem numerais tabulares: as colunas dançam sem eles
          </code>
          <span className="numerais-tabulares">R$ 1.234,56 · 09:15 · 11:30</span>
          <span>R$ 1.234,56 · 09:15 · 11:30</span>
        </div>
      </Secao>

      <Secao titulo="Espaçamento" nota="Escala de 4, a do Tailwind, sem customização">
        <div className="flex flex-wrap items-end gap-3">
          {ESPACOS.map((espaco) => (
            <div key={espaco} className="flex flex-col items-center gap-1">
              <span aria-hidden className="bg-acao" style={{ width: espaco, height: espaco }} />
              <code className="text-2xs text-conteudo-tenue">{espaco}</code>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Raio e elevação" nota="Sombra nunca substitui borda (2.5)">
        <div className="flex flex-wrap gap-3">
          {RAIOS.map((raio) => (
            <div key={raio} className="flex flex-col items-center gap-1">
              <span
                aria-hidden
                className="size-14 border border-borda bg-superficie"
                style={{ borderRadius: `var(--raio-${raio})` }}
              />
              <code className="text-2xs text-conteudo-tenue">{raio}</code>
            </div>
          ))}
        </div>

        <Separador />

        <div className="flex flex-wrap gap-4">
          {ELEVACOES.map((nivel) => (
            <div key={nivel} className="flex flex-col items-center gap-1">
              <span
                aria-hidden
                className="size-20 rounded-lg border border-borda bg-superficie"
                style={nivel === 'nenhuma' ? undefined : { boxShadow: `var(--${nivel})` }}
              />
              <code className="text-2xs text-conteudo-tenue">{nivel}</code>
            </div>
          ))}
        </div>
      </Secao>

      <Secao
        titulo="Densidade"
        nota="Altura de controle e padding de card mudam com o atributo do elemento raiz"
      >
        <div className="flex flex-col gap-2 text-sm">
          <code className="text-2xs text-conteudo-tenue">--altura-controle</code>
          <span
            aria-hidden
            className="w-40 rounded-md bg-acao-suave"
            style={{ height: 'var(--altura-controle)' }}
          />
        </div>
      </Secao>
    </>
  );
}
