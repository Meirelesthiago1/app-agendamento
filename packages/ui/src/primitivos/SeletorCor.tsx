import * as RadioGroup from '@radix-ui/react-radio-group';
import { forwardRef } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

export type OpcaoDeCor = { cor: string; nome: string };

export type PropsDoSeletorCor = {
  /** Hex de sete caracteres, como `servicos.cor` guarda. `null` é sem cor. */
  value: string | null;
  onChange: (cor: string | null) => void;
  /** A paleta oferecida. Quem decide os valores é quem usa (D14). */
  opcoes: readonly OpcaoDeCor[];
  /** Deixa escolher "sem cor". */
  permiteVazio?: boolean;
  id?: string;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
};

/** O `RadioGroup` não aceita valor vazio; este sentinela representa "sem cor". */
const SEM_COR = 'sem-cor';

const AMOSTRA = [
  'size-8 rounded-completo',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'data-[state=checked]:ring-2 data-[state=checked]:ring-acao data-[state=checked]:ring-offset-2',
].join(' ');

/**
 * Cor de serviço, para a agenda ficar legível de relance. É escolha entre
 * opções, não seletor livre: cor arbitrária escolhida a olho vira texto ilegível
 * sobre ela, e a agenda é onde o contraste importa mais.
 *
 * Marca do tenant é outro problema, e tem `SeletorCorMarca` — lá a cor é
 * arbitrária de propósito, e a derivação em OKLCH é que garante o contraste.
 */
export const SeletorCor = forwardRef<HTMLDivElement, PropsDoSeletorCor>(function SeletorCor(
  { value, onChange, opcoes, permiteVazio = true, disabled, className, ...props },
  ref,
) {
  return (
    <RadioGroup.Root
      ref={ref}
      value={value ?? SEM_COR}
      onValueChange={(escolhido) => onChange(escolhido === SEM_COR ? null : escolhido)}
      disabled={disabled}
      className={juntarClasses('flex flex-wrap gap-2', className)}
      {...props}
    >
      {permiteVazio ? (
        <RadioGroup.Item
          value={SEM_COR}
          aria-label="Sem cor"
          className={juntarClasses(AMOSTRA, 'border-2 border-dashed border-borda-forte')}
        />
      ) : null}

      {opcoes.map((opcao) => (
        <RadioGroup.Item
          key={opcao.cor}
          value={opcao.cor}
          aria-label={opcao.nome}
          // A cor vem de quem usa, em tempo de execução: não há classe possível
          style={{ backgroundColor: opcao.cor }}
          className={juntarClasses(AMOSTRA, 'border border-borda')}
        />
      ))}
    </RadioGroup.Root>
  );
});
