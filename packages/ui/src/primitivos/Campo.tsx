import { type ReactNode, useId } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

export type PropsDoCampo = {
  rotulo: string;
  /** Texto de apoio abaixo do controle. Some quando há erro. */
  apoio?: string;
  erro?: string;
  obrigatorio?: boolean;
  className?: string;
  /**
   * Recebe o que o controle precisa para ficar ligado ao rótulo, ao apoio e ao
   * erro. É aqui que `aria-describedby` e `aria-invalid` são amarrados **uma
   * vez**, em vez de trinta (4.4).
   */
  children: (ligacao: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
    invalido: boolean;
  }) => ReactNode;
};

/**
 * O componente de maior alavancagem do inventário (4.4): rótulo, controle,
 * apoio e erro, com a acessibilidade ligada num lugar só. Todo cadastro do
 * painel e todo passo do fluxo público passam por ele.
 */
export function Campo({ rotulo, apoio, erro, obrigatorio, className, children }: PropsDoCampo) {
  const id = useId();
  const idDoApoio = `${id}-apoio`;
  const idDoErro = `${id}-erro`;
  const invalido = erro !== undefined;

  const descrito = [erro !== undefined ? idDoErro : null, apoio !== undefined ? idDoApoio : null]
    .filter((parte) => parte !== null)
    .join(' ');

  return (
    <div className={juntarClasses('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-conteudo">
        {rotulo}
        {obrigatorio ? (
          <span aria-hidden className="ml-0.5 text-negativo">
            *
          </span>
        ) : null}
      </label>

      {children({
        id,
        'aria-describedby': descrito.length > 0 ? descrito : undefined,
        'aria-invalid': invalido || undefined,
        invalido,
      })}

      {erro !== undefined ? (
        <p id={idDoErro} className="text-xs text-negativo" role="alert">
          {erro}
        </p>
      ) : null}

      {erro === undefined && apoio !== undefined ? (
        <p id={idDoApoio} className="text-xs text-conteudo-suave">
          {apoio}
        </p>
      ) : null}
    </div>
  );
}
