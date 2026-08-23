# Sistema de Agendamento Multi-Tenant — Sistema de Design

**Versão 1.2**

> **Alteração da v1.1 para a v1.2:** a escala tipográfica de 2.4 sobe um degrau — o corpo do painel passa de 14 para 16px e o do público de 16 para 18px. Os nomes dos tokens não mudam, e nenhum componente foi tocado: é exatamente o que a camada semântica existe para permitir. Nenhuma outra decisão foi alterada.

Documento visual. Define tokens, primitivos, convenções de componente e a estratégia de identidade das duas aplicações.

> **Alteração da v1.0 para a v1.1:** encerramento das pendências D-a, D-c, D-d e D-f; a D-b passou para o stack (6.10) e a D-e ganhou documento próprio. Acrescentadas as seções 2.8, 5.2 e 6.5, e as decisões D19 a D26. Nenhum token, componente ou convenção anterior foi alterado.

**Entradas obrigatórias:** `planejamento-agendamento.md` (v1.3) e `definicao-stack.md` (v1.0). Este documento não redefine regra de negócio nem escolhe biblioteca de infraestrutura — apenas decide como a interface se parece e de que peças ela é feita. Referências no formato `(5.1)` apontam para o funcional; `(T14)` aponta para o stack.

**Referência de mão única.** Este cita os dois anteriores; nenhum deles cita este. Redesenhar a interface nunca exige nova versão do funcional nem do stack.

**Fronteira entre os três documentos**

| Vai para o funcional | Vai para o stack | Vai para este |
|---|---|---|
| O que a tela faz e por quê | Com o que ela é construída | Como ela se parece e de que peças |
| "A etapa 1 não pode custar um passo a quem agenda um só serviço" | React + Vite, Tailwind + CVA | `Etiqueta`, `BarraDeAcoes`, escala de espaçamento |
| Cinco estados de agendamento | TanStack Query | Cores de estado, e a regra de nunca distinguir só por cor |
| `exibicao_valor` aceita `A_PARTIR_DE` | Zod no contrato | `ResumoDeValor` renderiza o prefixo |

---

## Sumário

1. [Premissa](#1-premissa)
2. [Tokens](#2-tokens)
3. [Estrutura de `packages/ui`](#3-estrutura-de-packagesui)
4. [Convenções de componente](#4-convenções-de-componente)
5. [Playground](#5-playground)
6. [Inventário fechado](#6-inventário-fechado)
7. [Decisões registradas](#7-decisões-registradas)
8. [Pendências](#8-pendências)

---

## 1. Premissa

### 1.1 Duas identidades, um sistema

A decisão 14 do funcional produz duas aplicações com requisitos visuais opostos:

| | Painel do gestor | Página pública |
|---|---|---|
| Identidade | Fixa, do produto | Do tenant (`logo_url`, `cor_tema`) |
| Frequência | Diária | Esporádica |
| Densidade | Alta — muita informação por tela | Baixa — uma decisão por tela |
| Plataforma dominante | Desktop, com mobile obrigatório | Mobile |
| Tolerância a peso | Alta | Crítica |

Isso **não** justifica dois sistemas de design. Justifica **um contrato de tokens com dois temas**. A alternativa — cada aplicação com seu conjunto de cores e componentes — significa que corrigir o foco de um input é corrigir duas vezes, e que as duas divergem em seis meses sem ninguém ter decidido isso.

O que varia entre as duas é o **valor** dos tokens semânticos e a densidade. O que não varia é o nome dos tokens, a API dos componentes e o comportamento.

### 1.2 A referência do Figma

*Doctor Appointment App UI Kit* — 25 telas mobile, família de ícones Iconsax, paleta amostrada da tela "Book Appointment":

```
#1C2A3A   navy — cor de ação e de tinta
#FFFFFF   superfície de card
#F9FAFB   superfície de página e de campo em repouso
#6B7280   texto secundário
```

A escala neutra é, na prática, a escala `gray` do Tailwind com um navy próprio no lugar do azul — o que encaixa sem atrito no Tailwind + CVA já decidido (T14).

**O que se aproveita:**

- A estrutura da paleta: uma cor de ação escura e quase sem croma, sobre uma escala neutra ampla. Interface calma, em que a cor sinaliza ação e estado, nunca decora.
- Raio generoso, e separação por superfície e borda em vez de sombra.
- Quatro padrões concretos e diretamente aplicáveis: calendário mensal com dias indisponíveis desabilitados (etapa 3 de 5.1), grade de chips de horário (etapa 4), cartão com ações no rodapé, e ação primária de largura total fixa no rodapé da tela.

**O que não se aproveita:**

- As telas. Favoritos, mapa, chat, carrossel de onboarding e perfil de médico não existem neste produto, e a navegação por aba inferior do kit não é a do painel.
- **A marca.** Este é o ponto que mais importa: o kit tem uma identidade, e a página pública não pode ter. A cor da página pública é `estabelecimentos.cor_tema`, escolhida pelo gestor. O navy da referência é o **valor padrão** de quem não definiu cor — nunca uma constante do sistema.
- A premissa de que tudo é mobile. O painel precisa de densidade de desktop, que o kit não exercita.

### 1.3 Por que o sistema de design vem antes das telas

O motivo com dentes não é "padrão e manutenibilidade" em abstrato. É que `packages/ui` é importado por **duas aplicações que serão escritas em momentos diferentes**, com meses entre elas. Sem o contrato de tokens fechado antes, o painel nasce com um conjunto de cores e o público com outro, e unificar depois é varredura em todos os arquivos das duas.

O segundo motivo é que o playground é o lugar mais barato para descobrir que a API de um componente está errada. Descobrir isso na décima tela custa dez refatorações.

**O risco de fazer isso cedo, nomeado:** construir quarenta componentes e usar doze. A mitigação está na seção 6 — o inventário é **fechado e derivado das telas do funcional**, e cada linha nomeia a tela que a exige. Nenhum componente entra por parecer útil.

A mitigação estrutural está no plano de implementação: o sistema de design é entregue em **um lote de fundação**, com o que toda tela usa, e depois **cresce puxado por tela**. Um primitivo só entra quando existe uma tela esperando por ele.

---

## 2. Tokens

### 2.1 Três camadas

| Camada | Exemplo | Quem usa |
|---|---|---|
| **Primitivo** | `--cinza-200`, `--navy-500` | Só a camada semântica. **Nunca** um componente |
| **Semântico** | `--superficie`, `--conteudo-suave`, `--acao` | Todo componente |
| **De componente** | `--altura-controle` | O componente que o declara |

A regra que sustenta as outras: **componente nunca lê primitivo.** É isso que permite trocar o tema do tenant e, mais tarde, ligar o tema escuro sem tocar em componente nenhum. Um `bg-cinza-100` dentro de um botão quebra as duas coisas de uma vez.

### 2.2 Cor

**Primitivos — escala neutra**

```css
--cinza-50:  #F9FAFB;   --cinza-500: #6B7280;
--cinza-100: #F3F4F6;   --cinza-600: #4B5563;
--cinza-200: #E5E7EB;   --cinza-700: #374151;
--cinza-300: #D1D5DB;   --cinza-800: #1F2937;
--cinza-400: #9CA3AF;   --cinza-900: #111827;

--navy-500:  #1C2A3A;   /* a cor da referência; padrão de --acao */
```

**Semânticos — superfície e conteúdo**

| Token | Valor (claro) | Uso |
|---|---|---|
| `--superficie` | `#FFFFFF` | Fundo de card e de diálogo |
| `--superficie-afundada` | `--cinza-50` | Fundo de página; campo em repouso |
| `--superficie-elevada` | `#FFFFFF` | Popover e menu, com `--sombra-1` |
| `--borda` | `--cinza-200` | Divisória padrão |
| `--borda-forte` | `--cinza-300` | Campo em foco; item selecionado |
| `--conteudo` | `--cinza-900` | Texto principal |
| `--conteudo-suave` | `--cinza-500` | Texto de apoio, rótulo, hint |
| `--conteudo-tenue` | `--cinza-400` | Placeholder e desabilitado |

**Semânticos — ação**

| Token | Uso |
|---|---|
| `--acao` | Cor de ação e de marca. Padrão `--navy-500`; no público, derivada de `cor_tema` |
| `--acao-forte` | Estados `:hover` e `:active` |
| `--acao-suave` | Fundo de item selecionado e de selo de marca |
| `--acao-conteudo` | Texto e ícone **sobre** `--acao` |

**Semânticos — estado**

Quatro famílias, cada uma com `-suave` (fundo) e `-conteudo` (texto sobre o suave):

| Família | Cobre |
|---|---|
| `--positivo` | `CONFIRMADO`, `CONCLUIDO`, entrada de caixa |
| `--atencao` | `AGUARDANDO`, pendente de fechamento, atrasado (5.8) |
| `--negativo` | `CANCELADO`, `FALTOU`, linha de estorno (7.4) |
| `--neutro` | Bloqueio de agenda, solicitação expirada, fora da grade (6.3) |

**As cores de estado são independentes de `--acao`, sem exceção.** `--acao` é escolhida pelo gestor e pode ser verde, vermelha ou amarela. Se as cores de estado derivassem dela, um tenant com marca verde perderia a distinção entre "confirmado" e "a ação primária desta tela".

**Estado nunca é distinguido só por cor.** Todo agendamento carrega rótulo textual, e os quatro estados temporais de 5.8 se distinguem também por forma — borda, ícone ou posição. São duas razões independentes: daltonismo, e o fato de a cor de marca do tenant competir visualmente com o sinal semântico em toda tela pública.

### 2.3 A cor do tenant

`estabelecimentos.cor_tema` é um `char(7)` escolhido por um gestor, sem curadoria. Pode ser `#FFFF00`. Três problemas decorrem disso:

1. Qual é o contraste de `--acao-conteudo` sobre ela?
2. De onde saem `--acao-forte` e `--acao-suave`?
3. E se ela colidir com uma cor de estado?

O terceiro está resolvido em 2.2. Os dois primeiros exigem **derivação**, não configuração: o gestor informa **uma** cor, e o sistema calcula a rampa.

```
derivarPaleta(hex) → { acao, acaoForte, acaoSuave, acaoConteudo }
```

Em OKLCH, para manter a percepção de luminosidade coerente entre matizes:

- `acao` — a cor informada, com **piso e teto de luminosidade**. Fora da faixa utilizável como fundo de botão, é comprimida para dentro dela. Sem isso, um amarelo claro produz um botão "Confirmar" invisível, e a página pública de um tenant fica quebrada sem que ninguém consiga apontar o quê.
- `acaoConteudo` — branco ou `--cinza-900`, o que tiver maior contraste sobre `acao`. Nunca fixo.
- `acaoForte` — mesma matiz e croma, luminosidade reduzida.
- `acaoSuave` — mesma matiz, croma reduzido, luminosidade próxima do branco.

A função é pura e vive em `packages/ui/marca/`. É presentacional, então não desce para `packages/dominio` (4.2 do stack).

**Onde a paleta é aplicada.** No `layout.tsx` do público, que já resolve o tenant no servidor (8.1 do stack), como um bloco `<style>` com as variáveis no `:root`. Aplicar no cliente produz um lampejo com a cor errada em toda primeira pintura.

**No painel, a cor do tenant não é aplicada.** O painel tem identidade fixa do produto. O gestor que atende em dois estabelecimentos não deve ver a interface mudar de cor ao trocar de contexto — isso confunde mais do que orienta. A `cor_tema` aparece no painel apenas como amostra, dentro da tela que a configura.

**Consequência de interface:** o campo de `cor_tema` não é um seletor de cor cru. É o componente `SeletorCorMarca`, que mostra a rampa derivada, um botão de exemplo, e um aviso quando a cor precisou ser comprimida. O gestor precisa ver o resultado antes de salvar.

### 2.4 Tipografia

**Fonte: Inter**, variável e auto-hospedada. Três razões: legibilidade em corpo pequeno, que é o regime do painel; numerais tabulares de verdade; e ausência de dependência de rede externa, que importa no público, onde o peso é crítico.

**Entrega** (encerra D-a): um único arquivo variável em `woff2`, subconjunto `latin` e `latin-ext`, eixo de peso 400–700, com `font-display: swap` e `preload` no documento. Pilha de fallback:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

Mais uma face de fallback com `size-adjust` calibrado contra as métricas da Inter. Sem ela, a troca da fonte de sistema pela Inter desloca o texto na primeira pintura — deslocamento pequeno, mas que acontece em **toda visita nova da página pública**, que é justamente onde a primeira impressão e o Core Web Vital importam.

**Regra dos numerais:** todo valor monetário e todo horário usa `font-variant-numeric: tabular-nums`. A lista de lançamentos e a grade de slots alinham verticalmente; sem numerais tabulares, as colunas dançam.

**Escala** (raiz de 16px):

| Token | Tamanho / entrelinha | Uso |
|---|---|---|
| `--texto-2xs` | 12 / 18 | Rótulo de coluna, selo |
| `--texto-xs` | 14 / 20 | Texto de apoio, hint |
| `--texto-sm` | 16 / 24 | Corpo do painel, rótulo de campo |
| `--texto-base` | 18 / 28 | Corpo do público |
| `--texto-lg` | 20 / 30 | Título de card |
| `--texto-xl` | 24 / 32 | Título de seção |
| `--texto-2xl` | 28 / 36 | Título de tela do público |
| `--texto-3xl` | 36 / 44 | Número de destaque do Resumo (9.8) |

**Pesos:** 400, 500 e 600. O 700 fica reservado ao `--texto-3xl`. Negrito pesado engrossa a interface densa do painel e não aparece na referência.

**Piso de 16px em input do público.** Qualquer campo de formulário com fonte menor que 16px faz o Safari no iOS dar zoom ao receber foco, deslocando a tela no meio do fluxo de agendamento. É um bug real, frequente, e invisível em desenvolvimento no desktop.

### 2.5 Espaçamento, raio e elevação

**Espaço:** escala de 4 — `4 8 12 16 20 24 32 40 48 64`. A do Tailwind, sem customização.

**Raio:**

| Token | Valor | Uso |
|---|---|---|
| `--raio-sm` | 6px | Selo, chip pequeno |
| `--raio-md` | 10px | Input, botão, chip de horário |
| `--raio-lg` | 14px | Card |
| `--raio-xl` | 20px | Diálogo, folha inferior |
| `--raio-completo` | 9999px | Avatar, pílula |

**Elevação:** três níveis apenas — nenhuma, `--sombra-1` (popover, menu) e `--sombra-2` (diálogo, folha inferior). **Sombra nunca substitui borda.** A referência separa planos por superfície e borda de 1px; sombra difusa em card é o desvio mais comum e o que mais rápido faz a interface parecer de outra família.

### 2.6 Densidade

As duas aplicações usam os mesmos componentes em densidades diferentes:

| | `confortavel` (público) | `compacta` (painel) |
|---|---|---|
| Corpo padrão | `--texto-base` | `--texto-sm` |
| Altura de controle | 48px | 36px, e 44px em ponteiro grosseiro |
| Padding de card | 20px | 16px |
| Largura máxima de conteúdo | 480px, coluna única | 1280px |

Implementado como `data-densidade` no elemento raiz, redefinindo tokens de componente. **Não** como componentes separados, nem como prop `tamanho` em cada chamada — a primeira alternativa duplica o inventário, e a segunda espalha a decisão de densidade por centenas de pontos do código.

Os 44px em ponteiro grosseiro vêm de `@media (pointer: coarse)`: o painel é usado no celular do gestor, às sete da manhã, para bloquear o dia em dois toques (5.9). Alvo de 36px ali é o que faz esse fluxo falhar.

### 2.7 Onde os tokens vivem

```
packages/ui/src/tokens/
├─ primitivos.css     valores crus — o único arquivo com hex
├─ semanticos.css     :root e [data-tema="publico"]
├─ densidade.css      [data-densidade]
└─ tailwind.css       @theme inline: token → classe utilitária
```

`@theme inline` do Tailwind v4 mantém a **referência** à variável em vez de copiar o valor, e é o que faz `bg-superficie` e `text-conteudo-suave` acompanharem a troca de tema e a cor do tenant. Sem `inline`, as classes congelam o valor do momento da compilação e a página pública sai toda navy.

**Nenhum hex literal fora de `primitivos.css`.** Verificado por script no CI, pelo mesmo raciocínio de T25: convenção baseada em memória erode em seis meses; regra executável, não.

### 2.8 Logo do tenant e ícone do PWA

Encerra D-f e D-d. `estabelecimentos.logo_url` tem o mesmo problema de `cor_tema`: é um arquivo enviado por um gestor, sem curadoria.

**Formatos aceitos:** PNG, JPEG, WebP e SVG. O SVG é **rasterizado no envio**, e só o raster é guardado. Aceitar SVG e servi-lo como veio abre toda a superfície de `script`, `foreignObject` e handler de evento embutidos — sanitizar é possível, mas vira manutenção permanente para um recurso em que ninguém precisa de vetor.

**Limites:** até 2 MB, dimensão mínima de 256×256, máxima de 4096×4096.

**Derivados gerados no envio**, guardados pela porta `Armazenamento`:

| Tamanho | Uso |
|---|---|
| 512 | Ícone do PWA e do manifest |
| 128 | Cabeçalho da página pública |
| 64 | E-mail e amostra no painel |

**Proporção: o sistema não recorta.** A logo é encaixada dentro do quadrado com preenchimento (`contain`). Recortar para quadrado corta o nome de toda logo horizontal, que é a maioria delas.

**O ícone do PWA é sempre composto, nunca a logo crua.** A rota do manifest devolve um quadrado com fundo em `--acao` derivada (2.3) e a logo centralizada a 60% da largura. Isso resolve dois problemas de uma vez: o ícone `maskable` do Android é recortado em círculo e exige zona de segurança de 80%, e uma logo branca sobre fundo transparente simplesmente desapareceria. Quando não há `logo_url`, o mesmo compositor desenha um **monograma** — a inicial, ou as duas primeiras iniciais de `estabelecimentos.nome`, em `--acao-conteudo` sobre `--acao`.

O painel tem ícone fixo do produto, nos mesmos tamanhos, mais `apple-touch-icon` de 180.

**Logo clara sobre fundo claro.** O cabeçalho público desenha a logo sobre `--superficie`, que é branca — e uma logo branca some. No envio, o sistema calcula a luminância média dos pixels não transparentes e **avisa** quando ela passa do limiar, exibindo a prévia sobre fundo claro na própria tela de configuração. A correção é enviar outro arquivo. Uma coluna de "fundo da logo" resolveria de vez, mas custa esquema, e fica para quando o aviso se mostrar insuficiente. No ícone do PWA o problema não existe, porque ali o fundo é sempre `--acao`.

---

## 3. Estrutura de `packages/ui`

```
packages/ui/src/
├─ tokens/         seção 2
├─ primitivos/     Botao, Campo, Selecao, Dialogo…
├─ padroes/        composições sem domínio: Cartao, ListaVazia, GradeDeHorarios
├─ marca/          derivarPaleta, ProvedorMarca, SeletorCorMarca
├─ icones/         reexport tipado do conjunto de ícones
├─ lib/            juntarClasses, hooks de UI sem domínio
└─ index.ts        único ponto de entrada público (regra 9 do stack)
```

### 3.1 `ui` não conhece o domínio

Não existe `CartaoAgendamento` em `packages/ui`. Ele vive em `apps/painel/funcionalidades/agenda/componentes/`, porque menciona agendamento, estado e transição.

O teste é literal: **se o nome ou as props do componente citam agendamento, serviço, profissional, cliente ou lançamento, ele não sobe.**

O contraexemplo vale registrar, porque o erro é atraente: `GradeDeHorarios` — os chips de slot — parece de domínio e não é. As duas aplicações a usam, e a assinatura é `{ inicio: string; disponivel: boolean }[]`. Fica em `padroes/`. Já `SeletorDeServicos` cita serviço, conhece `exibicao_valor` e o limite de cinco itens (6.2): fica no público.

### 3.2 Ícones

A referência usa **Iconsax**. Em código, o conjunto adotado é o **Lucide** — traço linear equivalente, tree-shaking real, cobertura ampla e manutenção ativa, o que o pacote React do Iconsax não tem.

Todo ícone é reexportado por `ui/icones`, nunca importado direto da biblioteca pelas aplicações. Trocar o conjunto passa a ser um arquivo, e o inventário de ícones em uso fica visível em um lugar só.

---

## 4. Convenções de componente

### 4.1 CVA e nomes

```tsx
const botao = cva(base, {
  variants: {
    variante: { solida, suave, contorno, fantasma, destrutiva },
    tamanho:  { pequeno, medio, grande },
  },
  defaultVariants: { variante: 'solida', tamanho: 'medio' },
})
```

Nomes de variante e de prop em português, seguindo a seção 9 do stack. O utilitário de junção de classes é `juntarClasses()`, não `cn()`.

### 4.2 API de todo primitivo

- **`asChild`** via `Slot` do Radix, para compor sem elemento extra — um botão que na verdade é um link não deve produzir `<a><button>`.
- **`ref` encaminhada, sempre.** Radix depende disso para posicionar overlay.
- **Props nativas repassadas** (`ComponentPropsWithoutRef<'button'>`). Um primitivo que engole `type`, `aria-*` ou `onKeyDown` obriga a abrir exceção na primeira tela difícil.
- **Nenhum primitivo aceita `className` que redefina cor, fundo ou borda.** Tailwind organiza o espaço **entre** os componentes; nunca reestiliza o que está **dentro** deles. Redefinir cor por fora é o que quebra a tematização por tenant e, mais tarde, o tema escuro.
- **Carregamento é prop** (`carregando`), não componente. Um botão que troca de identidade ao salvar perde o foco e a largura.

### 4.3 Os sete estados

Todo primitivo interativo entrega: **repouso, hover, foco-visível, ativo, desabilitado, carregando e erro** (onde se aplica).

Foco: anel de 2px em `--acao` com 2px de offset, via `:focus-visible`. `outline: none` sem substituto é proibido — é o defeito de acessibilidade mais comum e o mais fácil de evitar.

**Este é o critério de pronto de um componente** (seção 5): os sete estados visíveis no playground, nas duas densidades.

### 4.4 Formulário

O componente de maior alavancagem do inventário é `Campo`: rótulo + controle + texto de apoio + mensagem de erro, integrado ao react-hook-form via `Controller`. Ele elimina a repetição em todo cadastro do painel e em todo passo do fluxo público, e é o lugar onde `aria-describedby` e `aria-invalid` são ligados uma vez em vez de trinta.

**Erro de validação do servidor** precisa de um caminho único, ou cada formulário reimplementa o mapeamento. Um helper converte a resposta de erro em `setError` do react-hook-form; quando o erro não é de campo, devolve `false` e cai no tratamento global.

Isso **depende de o contrato de erro carregar erros por campo**. Resolvido em `definicao-stack.md`, 6.10: a resposta traz `campos`, com as chaves na notação de caminho do react-hook-form, o que dispensa qualquer conversor no formulário.

### 4.5 Acessibilidade — o piso

Não é uma etapa no fim; é critério de pronto de cada componente.

- Contraste AA: 4.5:1 em texto, 3:1 em controle e borda de campo. Verificado no playground contra a rampa derivada, não só contra o padrão.
- Alvo de toque de 44px no público, e em ponteiro grosseiro no painel (2.6).
- Diálogo com foco preso e devolvido ao gatilho — entregue pelo Radix, e metade da razão de ele estar na stack.
- `aria-live="polite"` na lista de slots: a disponibilidade muda sem navegação, e sem isso um leitor de tela não anuncia que os horários chegaram.
- Calendário navegável por teclado, com dias indisponíveis marcados `aria-disabled` e não removidos do foco.
- Estado nunca só por cor (2.2).

---

## 5. Playground

Aplicação Vite mínima em `apps/playground`, consumindo `packages/ui`. **Fora do build de produção** — não tem rota, não tem deploy, não entra no artefato de nenhuma das duas aplicações.

**Barra fixa no topo**, e é ela que justifica o playground ser um app próprio em vez de uma rota no painel: alterna `[data-tema]` entre painel e público, alterna `[data-densidade]`, e tem um campo de `cor_tema` que reaplica a paleta derivada ao vivo. É o que faz o playground **provar** as duas identidades em vez de afirmá-las.

| Rota | Conteúdo |
|---|---|
| `/tokens` | Cor, tipografia, espaço, raio e elevação, renderizados a partir dos tokens reais |
| `/primitivos` | Cada primitivo, todas as variantes × os sete estados de 4.3 |
| `/padroes` | Composições da seção 6 |
| `/marca` | Simulador: cola um hex, vê a rampa, o botão de exemplo e o aviso de compressão |
| `/telas` | Quatro telas de referência, montadas só com peças do sistema |

### 5.1 As quatro telas de referência

Não são protótipos. São as telas reais, montadas com os componentes reais, e existem para atender à exigência de não produzir algo distante da versão final. Foram escolhidas porque são exatamente os pontos que a **pendência 2 do funcional** manda vigiar, mais o momento visual mais denso do público:

1. **Etapa 1 do fluxo público** — seleção de serviço, com "adicionar outro serviço" sem custar um passo a quem agenda um só (5.1).
2. **Etapas 3 e 4** — calendário mensal com dias sem vaga desabilitados, e a grade de chips de horário. É onde o público concentra a maior parte da sua dificuldade visual.
3. **Lista do dia no painel** — os quatro estados temporais de 5.8 lado a lado, o contador de pendências no topo, e o bloqueio de dia em dois toques (5.9).
4. **Lista do caixa** — com estornos colapsados por padrão e o marcador de "corrigido" (7.4).

Montar essas quatro no playground fecha boa parte da pendência 2 do funcional, e o faz com componentes que vão para produção, em vez de com um arquivo de desenho que envelhece na primeira semana.

### 5.2 Os três pontos de atenção, decididos

A pendência 2 do funcional pede o desenho das duas aplicações e nomeia três pontos que exigem decisão explícita. O desenho completo é entregue etapa a etapa, no playground; **os três pontos são decididos aqui**, porque errá-los é caro e a correção é estrutural, não cosmética.

#### 1. Etapa 1 do público — múltiplos serviços sem custar um passo

Lista agrupada por categoria. **Tocar num serviço seleciona e avança para a etapa 2.** Não existe caixa de seleção, não existe botão "continuar".

Quando `permite_multiplos_servicos` está ativo, cada linha ganha um **alvo secundário à direita**, com área de toque própria, que adiciona o serviço à seleção **sem avançar**. A partir do primeiro item adicionado por esse caminho, aparece uma `BarraDeAcoes` fixa no rodapé com as `Etiqueta` dos itens escolhidos, a duração e o valor totais, e a ação "Continuar".

Quem quer um serviço só toca uma vez e avança, como se a funcionalidade não existisse. Quem quer três toca no alvo secundário duas vezes e na barra uma. O limite de cinco (6.2) desabilita o alvo secundário e diz por quê.

#### 2. Bloqueio de dia em dois toques

**Toque um:** "Bloquear" no cabeçalho do dia, na agenda. Abre uma `FolhaInferior` — não um diálogo centralizado, porque o caso real é mobile e a folha coloca a ação sob o polegar.

A folha mostra, já resolvido e sem exigir leitura: o dia, a contagem de agendamentos atingidos, e dois botões empilhados — **"Cancelar todos e avisar"** como ação primária, e "Resolver um a um" como texto secundário.

O campo de motivo é opcional e fica **abaixo** dos botões, não acima. Exigir motivo antes de agir é exatamente o atrito que faz o gestor desistir e resolver por WhatsApp (5.9).

**Toque dois:** a ação primária. A confirmação está no rótulo do próprio botão, sem um segundo diálogo — o texto de apoio da folha já disse que N clientes serão avisados.

O caminho "resolver um a um" leva ao `ResolucaoEmLote`, com uma linha por agendamento e ações individuais. Ele existe, e nunca é o caminho padrão.

#### 3. Lista do caixa com estornos colapsados

Uma linha por **resultado líquido**, não por lançamento. Um atendimento corrigido de R$ 80 para R$ 120 aparece como **uma** linha de R$ 120,00 com um marcador discreto de "corrigido" — não como três linhas de `+80`, `−80`, `+120`.

Tocar no marcador expande as linhas que compõem o resultado, com data e autor de cada uma. É o extrato respondendo sozinho "por que o total de ontem mudou" (7.4), sem depender da tabela de auditoria, que não tem interface.

O totalizador do período soma **todas** as linhas, sem filtro — inclusive as colapsadas, que se anulam. É a propriedade que torna o modelo à prova de erro, e a interface não pode introduzir um filtro que a quebre.

---

## 6. Inventário fechado

Cada linha nomeia a tela que exige o componente. **Um componente sem tela na coluna da direita não entra.** A coluna "lote" indica quando ele é construído — na fundação, ou puxado pela funcionalidade correspondente (ver `plano-implementacao.md`).

### 6.1 Primitivos

| Componente | Exigido por | Lote |
|---|---|---|
| `Botao` | Tudo | Fundação |
| `BotaoIcone` | Ações de card, cabeçalhos | Fundação |
| `Campo` | Todo formulário (4.4) | Fundação |
| `Entrada` | Nome, e-mail, slug, busca | Fundação |
| `AreaTexto` | Observações internas e do cliente | Fundação |
| `Selecao` | Segmento, fuso, papel, profissional | Fundação |
| `Alternancia` | As onze chaves booleanas de `configuracoes` (8.2) | Fundação |
| `Caixa` | Seleção múltipla na resolução em lote (5.9) | Fundação |
| `Selo` | Estados de agendamento; tipo de lançamento | Fundação |
| `Cartao` | Tudo | Fundação |
| `Aviso` | Retorno de toda mutação | Fundação |
| `Dialogo` | Concluir atendimento, confirmar transição | Fundação |
| `Esqueleto` | Agenda e caixa carregando | Fundação |
| `Separador` | Seções de formulário | Fundação |
| `Avatar` | Profissional, cliente | Fundação |
| `EntradaMascarada` | Telefone — obrigatório no público (9.5) | Catálogo |
| `EntradaMoeda` | `valor_centavos`, em centavos e BRL (8.1) | Catálogo |
| `EntradaHora` | Grade semanal, múltiplos intervalos por dia (8.5) | Catálogo |
| `Passo` | Granularidade, antecedência, janela — valores em minutos e dias | Catálogo |
| `SeletorCor` | `servicos.cor` | Catálogo |
| `Abas` | Lançamento manual em duas abas (5.3) | Catálogo |
| `Acordeao` | Grupos de configuração | Catálogo |
| `MenuSuspenso` | Ações do card de agendamento | Catálogo |
| `Tabela` | Caixa, clientes, exportação | Catálogo |
| `Paginacao` | Idem | Catálogo |
| `Confirmacao` | Cancelar, bloquear, estornar | Catálogo |
| `Combo` | Busca de cliente por nome ou telefone (4.1) | Agenda |
| `SeletorData` | Etapa 3 do fluxo público; filtro de período do Resumo | Agenda |
| `FolhaInferior` | Bloqueio de dia em dois toques, no celular (5.9) | Agenda |
| `Popover` | Detalhe rápido de agendamento na grade semanal | Agenda |
| `PainelLateral` | Formulários longos no painel desktop | Agenda |
| `Dica` | Explicação de campo de configuração | Agenda |
| `Radio` | Escolha de profissional; "qualquer profissional" (6.3) | Público |
| `Etiqueta` | Serviços selecionados na etapa 1 (5.1) | Público |
| `Progresso` | Wizard de onboarding de cinco passos (4.1) | Onboarding |

### 6.2 Padrões

| Componente | Exigido por | Lote |
|---|---|---|
| `CabecalhoTela` | Título, subtítulo e ação primária — todas as telas | Fundação |
| `ListaVazia` | Agenda sem agendamento, caixa sem lançamento, catálogo vazio | Fundação |
| `BarraDeAcoes` | Rodapé fixo com ação primária — o padrão do kit, usado em todo o público | Fundação |
| `ResumoDeValor` | Etapa 6 do fluxo; modal de conclusão. Trata `A_PARTIR_DE` e `OCULTO` (9.2) | Catálogo |
| `GradeDeHorarios` | Etapa 4 do fluxo; seletor de remarcação no painel | Agenda |
| `CalendarioDeDisponibilidade` | Etapa 3 — mês com dias sem vaga desabilitados (6.4) | Agenda |
| `Passos` | Casca do wizard de onboarding | Onboarding |

### 6.3 Marca

| Componente | Exigido por | Lote |
|---|---|---|
| `derivarPaleta` | Toda página pública (2.3) | Fundação |
| `ProvedorMarca` | `layout.tsx` do público | Fundação |
| `SeletorCorMarca` | Configurações do tenant — com aviso de contraste | Fundação |

### 6.4 Fica fora de `packages/ui`

Registrado para que a fronteira de 3.1 não precise ser rediscutida: `CartaoAgendamento`, `SeletorDeServicos`, `ResolucaoEmLote` (5.9, reaproveitado ao desativar profissional ou serviço, 6.3), `GradeSemanal`, `LinhaDeLancamento` e `ControlePermissao`. Todos citam domínio; todos vivem na aplicação que os usa.

### 6.5 Estado vazio: a receita

Encerra D-c. **Não haverá ilustrações.** Elas exigem um ilustrador, envelhecem mal, pesam no bundle do público — que é crítico (3.2) — e, com um desenvolvedor, terminam em três estilos diferentes. A alternativa não é ausência: é uma receita fixa, que sai coerente por construção.

```
ícone    Lucide de 24px, centralizado em círculo de 48px
         fundo --superficie-afundada, traço --conteudo-tenue
título   --texto-lg, peso 600, --conteudo
apoio    --texto-sm, --conteudo-suave, no máximo duas linhas
ação     Botao variante suave — só quando existe uma ação óbvia
```

O ícone vem do mesmo conjunto de toda a interface (3.2), o que já entrega a coerência que a ilustração tentaria comprar.

**Vazio por ausência de dados e vazio por filtro são variantes diferentes**, com ícone, texto e ação diferentes. Oferecer "Cadastrar serviço" a quem filtrou por uma categoria sem resultado responde a outra pergunta. O componente recebe a variante; o texto de cada caso é conteúdo, não design.

---

## 7. Decisões registradas

Numeração `D`, independente do funcional e do stack, pela mesma razão de T28.

| # | Decisão | Justificativa |
|---|---|---|
| D1 | Um contrato de tokens com dois temas, não dois sistemas de design | O que difere entre painel e público é o valor dos tokens e a densidade, não a API nem o comportamento. Dois sistemas divergem em seis meses sem ninguém ter decidido isso |
| D2 | Componente nunca lê primitivo, só semântico | É a única propriedade que torna a tematização por tenant, e o tema escuro futuro, troca de valores em vez de varredura em todos os componentes |
| D3 | `cor_tema` derivada em rampa, com piso e teto de luminosidade | O gestor escolhe um hex sem curadoria. Sem compressão, um amarelo claro produz botão primário invisível e uma página pública quebrada sem causa aparente |
| D4 | Cores de estado independentes de `--acao` | `--acao` pode ser verde ou vermelha. Derivar estado dela apagaria a distinção entre "confirmado" e "ação primária" |
| D5 | Estado nunca distinguido só por cor | Daltonismo, e a cor de marca do tenant competindo com o sinal semântico em toda tela pública |
| D6 | Radix Primitives + CVA, componentes próprios | Radix entrega foco, teclado e ARIA — a parte cara e a mais fácil de errar. CVA e a autoria própria mantêm a API em português e sem dependência de terceiro na camada visual |
| D7 | Densidade como atributo no elemento raiz | Como prop por chamada, a decisão se espalha por centenas de pontos; como componentes separados, duplica o inventário |
| D8 | `packages/ui` não conhece domínio | Teste literal: se o nome ou as props citam agendamento, serviço, profissional, cliente ou lançamento, não sobe. Espelha T16 no nível do pacote |
| D9 | Playground como app próprio, fora do build de produção | É o único formato que exibe as duas identidades lado a lado; rota dentro do painel herdaria o tema do painel e colocaria código de desenvolvimento no artefato de produção |
| D10 | Critério de pronto: sete estados × duas densidades no playground | Sem critério executável, "componente pronto" significa "funcionou na tela onde nasceu", e o estado de erro aparece pela primeira vez em produção |
| D11 | Inventário fechado, derivado das telas do funcional | Sistema de design construído cedo tende a produzir quarenta componentes e usar doze. Cada linha nomeia a tela que a exige, e o crescimento é puxado por tela |
| D12 | Lucide no lugar do Iconsax, reexportado por `ui/icones` | Traço equivalente ao da referência, com tree-shaking real e manutenção ativa. O reexport torna a troca um arquivo |
| D13 | Inter, com numerais tabulares em dinheiro e hora | Lista de lançamentos e grade de slots alinham verticalmente; sem numerais tabulares, as colunas dançam |
| D14 | Nenhum hex fora de `primitivos.css`, verificado no CI | Mesmo raciocínio de T25 |
| D15 | Tema escuro fora do MVP, tokens semânticos prontos desde o início | Ligar o escuro depois vira um segundo conjunto de valores. Entregá-lo agora dobraria a calibragem de contraste e ainda precisaria conciliar o escuro com uma `cor_tema` arbitrária |
| D16 | Piso de 16px em input do público | Abaixo disso o Safari no iOS dá zoom ao focar, deslocando a tela no meio do fluxo de agendamento. Invisível em desenvolvimento no desktop |
| D17 | Sombra nunca substitui borda | A referência separa planos por superfície e borda de 1px. Sombra difusa em card é o desvio que mais rápido tira a interface da família |
| D18 | A cor do tenant não é aplicada no painel | O gestor com dois estabelecimentos veria a interface mudar de cor ao trocar de contexto. `cor_tema` aparece no painel só como amostra, na tela que a configura |
| D19 | SVG de logo rasterizado no envio | Servir SVG como veio abre `script`, `foreignObject` e handler embutido. Sanitizar é manutenção permanente para um recurso em que ninguém precisa de vetor |
| D20 | O sistema não recorta a logo; encaixa com preenchimento | Recortar para quadrado corta o nome de toda logo horizontal, que é a maioria |
| D21 | Ícone do PWA sempre composto sobre `--acao`, com monograma na ausência de logo | O `maskable` do Android recorta em círculo e exige zona de segurança de 80%, e logo branca sobre transparente desapareceria. Compor resolve os dois de uma vez |
| D22 | Sem ilustrações em estado vazio | Exigem ilustrador, envelhecem mal, pesam no bundle crítico do público, e com um desenvolvedor terminam em três estilos. A receita fixa sai coerente por construção |
| D23 | Inter como arquivo variável único, com fallback de `size-adjust` calibrado | Sem a face calibrada, o texto desloca na primeira pintura de toda visita nova da página pública |
| D24 | Etapa 1 do público com alvo secundário de adicionar, nunca caixas de seleção | Caixa de seleção com botão "continuar" adiciona um passo para a maioria, que agenda um serviço só (5.1) |
| D25 | Bloqueio de dia em folha inferior, com o motivo abaixo dos botões | O caso real é mobile e sob pressão. Motivo acima da ação é o atrito que faz o gestor resolver por WhatsApp |
| D26 | Caixa lista o resultado líquido, com as linhas componentes atrás de um toque | Ninguém quer ver `+80, −80, +120` no fechamento do dia, e o totalizador continua somando tudo sem filtro (7.4) |

---

## 8. Pendências

**Encerradas na v1.1:** D-a, tipografia (2.4) · D-c, estados vazios (6.5) · D-d, ícone do PWA (2.8) · D-f, logo do tenant (2.8). A **D-b** passou para o `definicao-stack.md` (6.10), por ser decisão de contrato. A **D-e** ganhou documento próprio, `conteudo-e-microcopia.md`, junto com a pendência 1 do funcional.

| # | Pendência | Observação |
|---|---|---|
| D-g | Métricas do fallback tipográfico | O `size-adjust`, `ascent-override` e `descent-override` da face de fallback precisam ser medidos contra a Inter, não estimados (2.4) |
| D-h | Limiar de luminância do aviso de logo clara | Calibrar com logos reais. Rígido demais alarma sem motivo; frouxo demais deixa passar a logo que some (2.8) |
| D-i | Coluna de fundo da logo | Resolveria a logo clara de vez, ao custo de esquema. Só se o aviso de 2.8 se mostrar insuficiente |
