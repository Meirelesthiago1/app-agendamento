import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';
import { Botao } from './Botao.tsx';

export type PropsDaConfirmacao = {
  aberta: boolean;
  aoMudarAbertura: (aberta: boolean) => void;
  titulo: string;
  /** O que vai acontecer, em uma frase. Nunca "Tem certeza?" sozinho. */
  descricao: ReactNode;
  rotuloConfirmar: string;
  rotuloCancelar?: string;
  /** Destrutiva pinta a ação de negativo: cancelar, bloquear, estornar. */
  destrutiva?: boolean;
  carregando?: boolean;
  aoConfirmar: () => void;
};

/**
 * `AlertDialog`, não `Dialog`: o foco cai na ação, `Escape` não fecha por
 * descuido e o leitor de tela anuncia como alerta. A diferença importa porque
 * estas são as ações que não têm desfazer.
 */
export function Confirmacao({
  aberta,
  aoMudarAbertura,
  titulo,
  descricao,
  rotuloConfirmar,
  rotuloCancelar = 'Voltar',
  destrutiva = false,
  carregando = false,
  aoConfirmar,
}: PropsDaConfirmacao) {
  return (
    <AlertDialog.Root open={aberta} onOpenChange={aoMudarAbertura}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-conteudo/40" />

        <AlertDialog.Content
          className={[
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
            'flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-6 shadow-2',
            'focus-visible:outline-none',
          ].join(' ')}
        >
          <AlertDialog.Title className="text-lg font-semibold text-conteudo">
            {titulo}
          </AlertDialog.Title>

          <AlertDialog.Description className="text-sm text-conteudo-suave">
            {descricao}
          </AlertDialog.Description>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Botao variante="contorno" disabled={carregando}>
                {rotuloCancelar}
              </Botao>
            </AlertDialog.Cancel>

            {/* `onClick` em vez de `AlertDialog.Action`: a ação é assíncrona, e
                o Action fecha o diálogo antes de a requisição responder */}
            <Botao
              variante={destrutiva ? 'destrutiva' : 'solida'}
              carregando={carregando}
              onClick={aoConfirmar}
            >
              {rotuloConfirmar}
            </Botao>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
