import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { juntarClasses } from '../lib/juntar-classes.ts';

const avatar = cva('relative flex shrink-0 overflow-hidden rounded-completo', {
  variants: {
    tamanho: {
      pequeno: 'size-8 text-xs',
      medio: 'size-10 text-sm',
      grande: 'size-14 text-lg',
    },
  },
  defaultVariants: { tamanho: 'medio' },
});

export type PropsDoAvatar = VariantProps<typeof avatar> & {
  nome: string;
  url?: string | null;
  className?: string;
};

/** Sem imagem, o mesmo desenho de monograma que compõe o ícone do PWA (2.8). */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? '?';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';

  return (primeira + ultima).toUpperCase();
}

export const Avatar = forwardRef<HTMLSpanElement, PropsDoAvatar>(function Avatar(
  { nome, url, tamanho, className },
  ref,
) {
  return (
    <AvatarPrimitive.Root ref={ref} className={juntarClasses(avatar({ tamanho }), className)}>
      {url ? (
        <AvatarPrimitive.Image src={url} alt={nome} className="size-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback
        delayMs={url ? 300 : 0}
        className="flex size-full items-center justify-center bg-acao-suave font-medium text-acao"
      >
        {iniciais(nome)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
});
