import { MARCA, NEUTROS } from '../tokens/primitivos.ts';
import { contraste, ehHexValido, hexParaOklch, type Oklch, oklchParaHex } from './cor.ts';

export type Paleta = {
  acao: string;
  acaoForte: string;
  acaoSuave: string;
  acaoConteudo: string;
};

export type ResultadoDaDerivacao = Paleta & {
  /** A cor informada não era utilizável como fundo de botão e foi ajustada. */
  comprimida: boolean;
  contrasteDoConteudo: number;
  /** Contraste do botão contra a página. É o que o amarelo puro reprova. */
  contrasteDaSuperficie: number;
};

/** Texto sobre a ação (4.5) e a ação contra a página, como controle (3:1). */
const CONTRASTE_DE_TEXTO = 4.5;
const CONTRASTE_DE_CONTROLE = 3;

const SUPERFICIE = NEUTROS.branco;

const QUEDA_DO_FORTE = 0.08;
const LUMINOSIDADE_DO_SUAVE = 0.95;
const CROMA_DO_SUAVE = 0.22;

const PASSO_DA_BUSCA = 0.005;

export const COR_PADRAO = MARCA['navy-500'];

function melhorConteudo(fundo: string): string {
  return contraste(fundo, NEUTROS.branco) >= contraste(fundo, NEUTROS['cinza-900'])
    ? NEUTROS.branco
    : NEUTROS['cinza-900'];
}

/**
 * Duas restrições, e a segunda é a que o amarelo puro reprova.
 *
 * A primeira é óbvia: o texto precisa ser legível sobre o botão. A segunda não:
 * um botão amarelo sobre página branca tem texto preto perfeitamente legível e
 * mesmo assim **some como forma** — não se enxerga onde o botão começa. É esse
 * o "botão Confirmar invisível" de 2.3, e é contraste contra a superfície, não
 * contra o próprio texto.
 */
function utilizavel(hex: string): boolean {
  return (
    contraste(hex, melhorConteudo(hex)) >= CONTRASTE_DE_TEXTO &&
    contraste(hex, SUPERFICIE) >= CONTRASTE_DE_CONTROLE
  );
}

/**
 * Procura a luminosidade **mais próxima** da escolhida que atenda às duas
 * restrições, andando para os dois lados. Preservar matiz e croma é o que faz o
 * gestor receber a cor que escolheu, só utilizável.
 */
function aproximarParaUtilizavel(original: Oklch): { cor: string; ajustada: boolean } {
  const comoEscolhida = oklchParaHex(original);

  if (utilizavel(comoEscolhida)) {
    return { cor: comoEscolhida, ajustada: false };
  }

  for (let distancia = PASSO_DA_BUSCA; distancia <= 1; distancia += PASSO_DA_BUSCA) {
    for (const candidato of [original.l - distancia, original.l + distancia]) {
      if (candidato < 0 || candidato > 1) {
        continue;
      }

      const hex = oklchParaHex({ ...original, l: candidato });

      if (utilizavel(hex)) {
        return { cor: hex, ajustada: true };
      }
    }
  }

  return { cor: COR_PADRAO, ajustada: true };
}

export function derivarPaleta(hex: string): ResultadoDaDerivacao {
  const original = hexParaOklch(ehHexValido(hex) ? hex : COR_PADRAO);
  const { cor: acao, ajustada } = aproximarParaUtilizavel(original);
  const base = hexParaOklch(acao);
  const acaoConteudo = melhorConteudo(acao);

  return {
    acao,
    acaoForte: oklchParaHex({ ...base, l: Math.max(0.15, base.l - QUEDA_DO_FORTE) }),
    acaoSuave: oklchParaHex({
      ...base,
      l: LUMINOSIDADE_DO_SUAVE,
      c: base.c * CROMA_DO_SUAVE,
    }),
    acaoConteudo,
    comprimida: ajustada,
    contrasteDoConteudo: contraste(acao, acaoConteudo),
    contrasteDaSuperficie: contraste(acao, SUPERFICIE),
  };
}

/**
 * Aplicada no `layout.tsx` do público, que já resolve o tenant no servidor.
 * Aplicar no cliente produz um lampejo com a cor errada em toda primeira
 * pintura (2.3).
 */
export function paletaComoCss(paleta: Paleta): string {
  return [
    `--acao: ${paleta.acao};`,
    `--acao-forte: ${paleta.acaoForte};`,
    `--acao-suave: ${paleta.acaoSuave};`,
    `--acao-conteudo: ${paleta.acaoConteudo};`,
  ].join('\n');
}
