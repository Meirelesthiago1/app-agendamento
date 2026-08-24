import { type ChangeEvent, forwardRef, useCallback } from 'react';
import { IconeMais, IconeMenos } from '../icones/index.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';
import { BotaoIcone } from './BotaoIcone.tsx';
import { controle } from './Entrada.tsx';

export type PropsDoPasso = {
  /** Granularidade, antecedência e janela: minutos ou dias, sempre inteiros. */
  value: number;
  onChange: (valor: number) => void;
  passo?: number;
  minimo?: number;
  maximo?: number;
  /** "min", "dias" — some quando não faz sentido. */
  unidade?: string;
  id?: string;
  disabled?: boolean;
  invalido?: boolean;
  className?: string;
  'aria-describedby'?: string;
};

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/**
 * As três configurações numéricas de 8.2. Existe em vez de `<input
 * type="number">` porque o gestor ajusta de 15 em 15 minutos, e a seta nativa
 * anda de 1 em 1 — e some no celular.
 */
export const Passo = forwardRef<HTMLInputElement, PropsDoPasso>(function Passo(
  {
    value,
    onChange,
    passo = 1,
    minimo = 0,
    maximo = Number.MAX_SAFE_INTEGER,
    unidade,
    disabled,
    invalido,
    className,
    ...props
  },
  ref,
) {
  const andar = useCallback(
    (direcao: 1 | -1) => {
      onChange(limitar(value + direcao * passo, minimo, maximo));
    },
    [value, onChange, passo, minimo, maximo],
  );

  const aoDigitar = useCallback(
    (evento: ChangeEvent<HTMLInputElement>) => {
      const digitado = Number(evento.target.value.replace(/\D/g, ''));

      onChange(Number.isNaN(digitado) ? minimo : limitar(digitado, minimo, maximo));
    },
    [onChange, minimo, maximo],
  );

  return (
    <div className={juntarClasses('flex items-center gap-2', className)}>
      <BotaoIcone
        rotulo="Diminuir"
        variante="contorno"
        onClick={() => andar(-1)}
        disabled={disabled === true || value <= minimo}
      >
        <IconeMenos aria-hidden className="size-4" />
      </BotaoIcone>

      <div className="relative flex-1">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          role="spinbutton"
          aria-valuenow={value}
          aria-valuemin={minimo}
          aria-valuemax={maximo === Number.MAX_SAFE_INTEGER ? undefined : maximo}
          value={String(value)}
          onChange={aoDigitar}
          disabled={disabled}
          aria-invalid={invalido ?? undefined}
          className={juntarClasses(
            controle({ invalido }),
            'h-(--altura-controle) text-center tabular-nums',
            unidade === undefined ? undefined : 'pr-12',
          )}
          {...props}
        />

        {unidade === undefined ? null : (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-conteudo-suave"
          >
            {unidade}
          </span>
        )}
      </div>

      <BotaoIcone
        rotulo="Aumentar"
        variante="contorno"
        onClick={() => andar(1)}
        disabled={disabled === true || value >= maximo}
      >
        <IconeMais aria-hidden className="size-4" />
      </BotaoIcone>
    </div>
  );
});
