import { type ChangeEvent, forwardRef, useCallback } from 'react';
import { Entrada, type PropsDaEntrada } from './Entrada.tsx';
import { apenasDigitos, MASCARAS, type NomeDaMascara } from './mascaras.ts';

export type PropsDaEntradaMascarada = Omit<
  PropsDaEntrada,
  'value' | 'defaultValue' | 'onChange' | 'type'
> & {
  mascara: NomeDaMascara;
  /** Sempre os dígitos, sem máscara: é isso que o contrato recebe. */
  value: string;
  onChange: (digitos: string) => void;
};

/**
 * Telefone é obrigatório no fluxo público (9.5), e a máscara existe para o
 * cliente conferir o que digitou. Quem lê o valor recebe **só os dígitos** — a
 * formatação é da tela, e mandá-la para o banco produziria duas grafias do
 * mesmo número.
 */
export const EntradaMascarada = forwardRef<HTMLInputElement, PropsDaEntradaMascarada>(
  function EntradaMascarada({ mascara, value, onChange, ...props }, ref) {
    const formatar = MASCARAS[mascara];

    const aoMudar = useCallback(
      (evento: ChangeEvent<HTMLInputElement>) => {
        onChange(apenasDigitos(evento.target.value));
      },
      [onChange],
    );

    return (
      <Entrada
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete={mascara === 'telefone' ? 'tel-national' : 'postal-code'}
        value={formatar(value)}
        onChange={aoMudar}
        {...props}
      />
    );
  },
);
