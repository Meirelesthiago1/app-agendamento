import * as DialogPrimitive from '@radix-ui/react-dialog';
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from 'react';
import { IconeCancelar } from '../icones/index.ts';
import { juntarClasses } from '../lib/juntar-classes.ts';
import { BotaoIcone } from './BotaoIcone.tsx';

export const RaizDaFolha = DialogPrimitive.Root;
export const GatilhoDaFolha = DialogPrimitive.Trigger;
export const FechamentoDaFolha = DialogPrimitive.Close;

export type PropsDaFolhaInferior = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  titulo: string;
  descricao?: string;
  rodape?: ReactNode;
};

/**
 * Ancorada embaixo, e **em toda largura** — não vira diálogo centralizado no
 * desktop. D25 escolheu a folha justamente contra o diálogo, porque ela coloca
 * a ação sob o polegar; um componente que muda de forma por largura dobraria a
 * matriz de estados de D10 sem nenhum chamador pedindo.
 *
 * Arrastar para fechar fica de fora: sobreposição, `Escape` e o botão cobrem as
 * três saídas, e o gesto seria código de toque sem biblioteca.
 */
export const FolhaInferior = forwardRef<HTMLDivElement, PropsDaFolhaInferior>(
  function FolhaInferior({ className, titulo, descricao, rodape, children, ...props }, ref) {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-conteudo/40" />

        <DialogPrimitive.Content
          ref={ref}
          {...props}
          // Sem descrição o Radix avisa no console pedindo uma; dizer
          // explicitamente que não há é o que ele aceita como resposta
          {...(descricao === undefined ? { 'aria-describedby': undefined } : {})}
          className={juntarClasses(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col',
            'rounded-t-xl border-t border-borda bg-superficie shadow-2',
            'focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 p-(--padding-cartao) pb-3">
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

          {/* A rolagem é do miolo, não da folha: cabeçalho e rodapé ficam
              alcançáveis com a lista longa */}
          <div className="min-h-0 flex-1 overflow-y-auto px-(--padding-cartao)">{children}</div>

          <div
            className={juntarClasses(
              'shrink-0 px-(--padding-cartao)',
              // A barra de gestos do iPhone come o rodapé sem o inset
              'pb-[max(var(--padding-cartao),env(safe-area-inset-bottom))]',
              rodape === undefined ? 'pt-(--padding-cartao)' : 'pt-3',
            )}
          >
            {rodape}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
