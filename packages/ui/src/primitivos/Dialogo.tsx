import * as DialogPrimitive from '@radix-ui/react-dialog';
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from 'react';
import { IconeCancelar } from '../icones/index.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';
import { BotaoIcone } from './BotaoIcone.tsx';

export const RaizDoDialogo = DialogPrimitive.Root;
export const GatilhoDoDialogo = DialogPrimitive.Trigger;
export const FechamentoDoDialogo = DialogPrimitive.Close;

export type PropsDoDialogo = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  titulo: string;
  /** Ligado por `aria-describedby`; ausente, o Radix avisa no console. */
  descricao?: string;
  rodape?: ReactNode;
};

/**
 * Foco preso e devolvido ao gatilho vem do Radix — é metade da razão de ele
 * estar na stack (4.5). Reimplementar armadilha de foco à mão é onde diálogo
 * caseiro sempre falha.
 */
export const Dialogo = forwardRef<HTMLDivElement, PropsDoDialogo>(function Dialogo(
  { className, titulo, descricao, rodape, children, ...props },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-conteudo/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <DialogPrimitive.Content
        ref={ref}
        className={juntarClasses(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'rounded-xl border border-borda bg-superficie p-(--padding-cartao) shadow-2',
          'focus:outline-none',
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-lg font-semibold text-conteudo">
              {titulo}
            </DialogPrimitive.Title>
            {descricao !== undefined ? (
              <DialogPrimitive.Description className="text-sm text-conteudo-suave">
                {descricao}
              </DialogPrimitive.Description>
            ) : null}
          </div>

          <DialogPrimitive.Close asChild>
            <BotaoIcone rotulo="Fechar" tamanho="pequeno">
              <IconeCancelar aria-hidden className="size-4" />
            </BotaoIcone>
          </DialogPrimitive.Close>
        </div>

        {children}

        {rodape !== undefined ? (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {rodape}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
