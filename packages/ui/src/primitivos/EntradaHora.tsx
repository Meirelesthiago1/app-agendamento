import { type ChangeEvent, type FocusEvent, forwardRef, useCallback, useState } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';
import { Entrada, type PropsDaEntrada } from './Entrada.tsx';
import { horaDeMinutos, mascararHora, minutosDeHora } from './mascaras.ts';

export type PropsDaEntradaHora = Omit<
  PropsDaEntrada,
  'value' | 'defaultValue' | 'onChange' | 'type'
> & {
  /** Minutos desde a meia-noite. `null` enquanto a hora está incompleta. */
  value: number | null;
  onChange: (minutos: number | null) => void;
};

/**
 * `<input type="time">` foi descartado: o formato depende do idioma do
 * dispositivo, e o gestor que monta a grade de uma semana inteira digita rápido
 * — o seletor nativo do celular custa três toques por campo.
 *
 * O texto em edição vive aqui e o valor sai em minutos: enquanto está
 * incompleto, não existe hora para propagar, e propagar `null` a cada tecla
 * apagaria o que já foi digitado.
 */
export const EntradaHora = forwardRef<HTMLInputElement, PropsDaEntradaHora>(function EntradaHora(
  { value, onChange, onBlur, className, ...props },
  ref,
) {
  const [emEdicao, setEmEdicao] = useState<string | null>(null);
  const texto = emEdicao ?? (value === null ? '' : horaDeMinutos(value));

  const aoMudar = useCallback(
    (evento: ChangeEvent<HTMLInputElement>) => {
      const mascarado = mascararHora(evento.target.value);

      setEmEdicao(mascarado);
      onChange(minutosDeHora(mascarado));
    },
    [onChange],
  );

  // Ao sair, o campo volta a mostrar o valor: `9:3` some, `09:30` fica completo
  const aoSair = useCallback(
    (evento: FocusEvent<HTMLInputElement>) => {
      setEmEdicao(null);
      onBlur?.(evento);
    },
    [onBlur],
  );

  return (
    <Entrada
      ref={ref}
      inputMode="numeric"
      placeholder="00:00"
      value={texto}
      onChange={aoMudar}
      onBlur={aoSair}
      className={juntarClasses('tabular-nums', className)}
      {...props}
    />
  );
});
