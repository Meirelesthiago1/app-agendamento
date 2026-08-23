import { createContext, type ReactNode, use, useMemo } from 'react';
import {
  COR_PADRAO,
  derivarPaleta,
  paletaComoCss,
  type ResultadoDaDerivacao,
} from './derivar-paleta.ts';

const ContextoDaMarca = createContext<ResultadoDaDerivacao>(derivarPaleta(COR_PADRAO));

export function useMarca(): ResultadoDaDerivacao {
  return use(ContextoDaMarca);
}

export type PropsDoProvedorMarca = {
  /** `estabelecimentos.cor_tema`. Nulo cai na identidade do produto. */
  corTema?: string | null;
  /**
   * Escopo do CSS. O público injeta em `:root` no `layout.tsx`; o playground
   * usa um seletor próprio para alternar sem recarregar.
   */
  seletor?: string;
  children: ReactNode;
};

/**
 * A paleta entra como bloco `<style>` renderizado **no servidor**, junto com o
 * tenant que o `layout.tsx` já resolveu (2.3). Aplicar no cliente produz um
 * lampejo com a cor errada em toda primeira pintura — e é a primeira pintura da
 * página pública que decide a impressão do cliente.
 */
export function ProvedorMarca({ corTema, seletor = ':root', children }: PropsDoProvedorMarca) {
  const paleta = useMemo(() => derivarPaleta(corTema ?? COR_PADRAO), [corTema]);
  const css = useMemo(() => `${seletor} {\n${paletaComoCss(paleta)}\n}`, [paleta, seletor]);

  return (
    <ContextoDaMarca value={paleta}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: bloco de variáveis CSS derivado de uma cor já validada por `derivarPaleta` */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </ContextoDaMarca>
  );
}
