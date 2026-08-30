import { COR_PADRAO, ProvedorMarca } from '@agendamento/ui';
import { useEffect, useState } from 'react';
import { BarraDoPlayground, type Densidade, type Tema } from './BarraDoPlayground.tsx';
import { Formularios } from './telas/Formularios.tsx';
import { Marca } from './telas/Marca.tsx';
import { Padroes } from './telas/Padroes.tsx';
import { Primitivos } from './telas/Primitivos.tsx';
import { Tokens } from './telas/Tokens.tsx';

const TELAS = {
  tokens: Tokens,
  primitivos: Primitivos,
  formularios: Formularios,
  padroes: Padroes,
  marca: Marca,
} as const;

type NomeDaTela = keyof typeof TELAS;

const NOMES = Object.keys(TELAS) as NomeDaTela[];

function telaDaUrl(): NomeDaTela {
  const alvo = window.location.hash.replace('#', '');

  return NOMES.includes(alvo as NomeDaTela) ? (alvo as NomeDaTela) : 'tokens';
}

export function Aplicacao() {
  const [tela, definirTela] = useState<NomeDaTela>(telaDaUrl);
  const [tema, definirTema] = useState<Tema>('painel');
  const [densidade, definirDensidade] = useState<Densidade>('compacta');
  const [corTema, definirCor] = useState(COR_PADRAO);

  // Tema e densidade são atributos do elemento raiz (2.6), não props
  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    document.documentElement.dataset.densidade = densidade;
  }, [tema, densidade]);

  useEffect(() => {
    const aoTrocarHash = () => definirTela(telaDaUrl());

    window.addEventListener('hashchange', aoTrocarHash);

    return () => window.removeEventListener('hashchange', aoTrocarHash);
  }, []);

  const Tela = TELAS[tela];

  return (
    // O painel não aplica a cor do tenant (2.3); aqui ela é aplicada nos dois
    // porque o propósito da tela é justamente inspecionar a derivação
    <ProvedorMarca corTema={corTema} seletor=":root">
      <BarraDoPlayground
        tela={tela}
        telas={NOMES}
        aoTrocarTela={(nome) => {
          window.location.hash = nome;
        }}
        tema={tema}
        aoTrocarTema={definirTema}
        densidade={densidade}
        aoTrocarDensidade={definirDensidade}
        corTema={corTema}
        aoTrocarCor={definirCor}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8">
        <Tela />
      </main>
    </ProvedorMarca>
  );
}
