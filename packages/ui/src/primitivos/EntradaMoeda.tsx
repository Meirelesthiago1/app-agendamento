import { type ChangeEvent, forwardRef, useCallback } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';
import { Entrada, type PropsDaEntrada } from './Entrada.tsx';
import { centavosDoTexto, mascararMoeda } from './mascaras.ts';

export type PropsDaEntradaMoeda = Omit<
  PropsDaEntrada,
  'value' | 'defaultValue' | 'onChange' | 'type'
> & {
  /** Centavos, inteiros (8.1). `null` é campo vazio, não zero. */
  value: number | null;
  onChange: (centavos: number | null) => void;
};

/**
 * Digita da direita para a esquerda, como teclado de caixa. O valor trafega em
 * centavos inteiros do começo ao fim: converter para reais em ponto flutuante
 * na tela e de volta no servidor perde centavo em valores comuns.
 */
export const EntradaMoeda = forwardRef<HTMLInputElement, PropsDaEntradaMoeda>(function EntradaMoeda(
  { value, onChange, className, ...props },
  ref,
) {
  const aoMudar = useCallback(
    (evento: ChangeEvent<HTMLInputElement>) => {
      const texto = evento.target.value;

      onChange(texto.trim() === '' ? null : centavosDoTexto(texto));
    },
    [onChange],
  );

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-conteudo-suave"
      >
        R$
      </span>

      <Entrada
        ref={ref}
        inputMode="numeric"
        value={value === null ? '' : mascararMoeda(value)}
        onChange={aoMudar}
        className={juntarClasses('pl-9 text-right tabular-nums', className)}
        {...props}
      />
    </div>
  );
});
