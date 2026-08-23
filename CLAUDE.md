# Sistema de Agendamento Multi-Tenant

SaaS multi-tenant de agendamento de consultas e atendimentos, para nichos variados
(saúde, nutrição, beleza, barbearia, estética, consultoria). Mercado nacional, BRL
e pt-BR fixos. O sistema **não processa pagamento** — registra valores para controle
gerencial.

**Estado: etapas 0 a 5 concluídas. A etapa 6 (casca do painel) é o próximo
passo.** O detalhe está em "Onde a
implementação está", no fim deste arquivo.

---

## Leia isto antes de agir

Toda decisão de produto, stack, interface, texto e infraestrutura já foi tomada e
está em `docs/`. **Nunca decidir de novo o que já está decidido lá** — e quando algo
parecer errado, dizer, em vez de contornar em silêncio.

### Os seis documentos

Ordem de leitura, e também a hierarquia de dependência:

| # | Documento | O que decide | Prefixo |
|---|---|---|---|
| 1 | `docs/planejamento-agendamento.md` | Funcional: atores, fluxos, motor de disponibilidade, máquina de estados, modelagem de dados | sem prefixo |
| 2 | `docs/definicao-stack.md` | Linguagem, bibliotecas, camadas, fronteiras de import, convenções | `T` |
| 3 | `docs/sistema-de-design.md` | Tokens, primitivos, playground, identidade das duas aplicações | `D` |
| 4 | `docs/conteudo-e-microcopia.md` | Templates de e-mail, rótulos de enum, erros, confirmações | `C` |
| 5 | `docs/operacao.md` | Hospedagem, TLS, backup, observabilidade, migração | `O` |
| 6 | `docs/plano-implementacao.md` | **Roteiro: 15 etapas, com critério de pronto** | — |

**Referência de mão única.** Cada documento cita os anteriores; nenhum cita os
posteriores, exceto na lista de pendências encerradas. Ao alterar qualquer um,
respeitar isso — e o prefixo de numeração das decisões.

Referências no texto: `(8.5)` é o funcional, `(T14)` o stack, `(D6)` o design,
`(C7)` o conteúdo, `(O13)` a operação.

**Numeração de pendências é estável.** Encerrada, sai da tabela e vai para o
parágrafo "Encerradas", sem renumerar — os outros documentos citam esses números.

### Por onde começar qualquer tarefa

`docs/plano-implementacao.md`. Ele diz em que etapa o trabalho está, o que a etapa
entrega, e o critério que a declara pronta. A seção 5 diz quais componentes de UI
cada etapa puxa; a seção 7 lista os pontos sem retorno.

---

## Stack

| Camada | Escolha |
|---|---|
| Linguagem | TypeScript `strict`, em todas as camadas |
| Monorepo | pnpm workspaces + Turborepo |
| Banco | PostgreSQL (piso 15) + `btree_gist`, Drizzle ORM |
| Backend | Fastify + `fastify-type-provider-zod` |
| Fila e agendamento | pg-boss, worker em processo separado |
| Contratos | Zod + ts-rest |
| Datas e fuso | Luxon |
| Painel | React + Vite + TanStack Router/Query |
| Público | Next.js App Router |
| UI | Tailwind + CVA + Radix Primitives, ícones Lucide |
| Testes | Vitest, Testcontainers, Playwright |
| Lint | Biome |

```
agendamento/
├─ apps/       api · painel · publico · playground
├─ packages/   dominio · contratos · db · ui
└─ docs/
```

**O princípio único:** a dependência aponta para dentro. `packages/dominio` é puro,
depende só de `luxon`, e roda no backend e no browser — é o que permite o motor de
disponibilidade existir uma vez só. Uma função de domínio que importe Drizzle quebra
isso, e há um script no CI que falha o build por causa disso.

---

## Convenções que não se negociam

**Português sem acento nem cedilha** em pastas, arquivos, funções, tipos e variáveis
— código e modelo de dados. Exceções fechadas: `app/`, `src/`, `public/`, `hooks/`,
`providers/`, `components/` quando impostos por framework. Estrangeirismos aceitos,
lista fechada: `slug`, `token`, `uuid`, `jsonb`, `status`, `hook`, `props`, `state`,
`cache`, `worker`, `pool`.

`useCriarFilial`, não `useCreateFilial`. `listar`, `criar`, `atualizar`, `remover`.

**Outras regras estruturais:**

- `Contexto` é o primeiro parâmetro de todo caso de uso, sem exceção (T13). Tenant
  implícito é a origem do vazamento silencioso entre tenants.
- Transação vive no caso de uso; todo método de repositório recebe o executor como
  primeiro parâmetro (T11).
- Erro é sempre `ErroDominio` com código, nunca `Error` genérico. Um lugar só traduz
  para HTTP.
- Nenhum SDK de plataforma fora de `apps/api/src/infra/` (T26).
- Nenhum hex literal fora de `packages/ui/src/tokens/primitivos.css` (D14).
- Funcionalidade não importa de funcionalidade (T16). `packages/ui` não conhece
  domínio (D8).
- Toda variável de ambiente validada por Zod no boot.

---

## Como trabalhar aqui

**Comentários enxutos.** Comentar só o *porquê* não óbvio e durável — decisão
contraintuitiva, armadilha de biblioteca, restrição externa. Nada de marcador de
momento ("ETAPA 4: aqui entra o X"), bloco de código futuro comentado, ou parágrafo
que restate o documento de planejamento. Se o comentário deixa de ser verdade quando
a próxima etapa entrar, não escrever. Preferir nome bom a comentário explicativo.

**Nunca commitar sem pedido explícito.** Terminar a tarefa, rodar a verificação,
relatar o que mudou e **parar**, deixando tudo no working tree. Vale para `git push`
e qualquer coisa que altere histórico. Oferecer, no máximo; nunca executar.

---

## Onde a implementação está

| Etapa | Branch | O que ficou de pé |
|---|---|---|
| 0 — Fundação | `main` | Monorepo, Docker Compose, CI, as três regras executáveis |
| 1 — Banco | `main` | 19 tabelas, RLS, dois papéis, `EXCLUDE`, semente, os dois testes de 10.1 |
| 2 — Domínio | `main` | As sete pastas de 5.1, puras; os cinco casos de 10.2 cobertos |
| 3 — API | `main` | `contratos` com `ROTAS` e cliente próprio, Fastify com os quatro plugins, `unidadeDeTrabalho`, as cinco portas locais, e quatro rotas reais |
| 4 — Design | `main` | Tokens em três camadas, `derivarPaleta` em OKLCH, os 18 componentes do lote de fundação, e o playground com `/tokens`, `/primitivos` e `/marca` |
| 5 — Autenticação | `etapa-5-auth` | argon2id, sessão opaca de 30 dias, os três transacionais em React Email, cadastro, convite de equipe e recuperação de senha |

Levantar o ambiente do zero:

```
pnpm install
pnpm servicos                                        # Postgres 18 e Mailpit
pnpm --filter @agendamento/db exec drizzle-kit migrate
pnpm --filter @agendamento/db semear                 # dois estabelecimentos
pnpm verificar                                       # lint, tipos, regras, build, testes
```

As migrações criam os papéis sem senha. Para rodar a API local, defina uma vez:

```sql
ALTER ROLE agendamento_gestor  WITH PASSWORD 'agendamento';
ALTER ROLE agendamento_publico WITH PASSWORD 'agendamento';
```

e aponte `BANCO_URL` e `BANCO_URL_PUBLICO` para esses papéis — não para o dono do
banco, que ignora RLS. Depois, `node --env-file-if-exists=.env apps/api/src/servidor.ts`.

`DIRETO_BANCO_URL` precisa estar no ambiente ou em `.env` — ver `.env.exemplo`.

**Decidido durante a implementação, fora dos seis documentos:**

- Escopo dos pacotes: `@agendamento/*`. Repositório no GitHub, CI em Actions,
  verificando **toda branch enviada** — não só PR.
- `dominio`, `contratos` e `db` compilam para `dist/`; `ui` exporta fonte, e Vite
  e Next a transpilam.
- Driver `pg`, porque o pg-boss (T8) já o usa — evita dois drivers.
- Os dois papéis de banco nascem `LOGIN` sem senha; a senha é de ambiente, nunca
  de migração.
- A política de RLS usa `nullif(current_setting('app.estabelecimento_id', true), '')`.
  Sem o `nullif`, a variável volta como string vazia depois do commit e `''::uuid`
  levanta 22P02 na conexão seguinte do pool — "sem tenant" viraria erro onde 10.1
  exige resultado vazio.
- Aritmética de calendário em `dominio/tempo` é ancorada em UTC. Interpretar
  `AAAA-MM-DD` no fuso da máquina faz somar um dia cair em `01:00` na entrada do
  horário de verão, e o resultado passa a depender do fuso do servidor.
- `totalizar` devolve `OCULTO` quando **todos** os itens são ocultos — 9.2 só
  trata do caso misto, e "a partir de R$ 0,00" seria pior que não exibir.
- A folga presa à janela (`folga_pode_exceder_janela = false`) é verificada nas
  **duas** pontas. O pseudocódigo de 6.1 checa só `ocup_fim`, mas a folga da
  frente transborda igual.
- A regra de fronteira de `dominio` ignora `*.teste.ts`: ela garante que o pacote
  rode no browser, e teste não entra no `dist/`.
- **ts-rest saiu.** `@ts-rest/fastify` exige Fastify 4 e `@ts-rest/core` exige
  Zod 3; com Zod 4 o ts-rest infere `any` **em silêncio**, sem erro de
  compilação. `packages/contratos` passa a ter `ROTAS` (mapa Zod tipado) e um
  cliente próprio de ~180 linhas. `definicao-stack.md` §2.1 ainda diz ts-rest e
  precisa de uma v1.2. Há teste de tipo que reprova se a inferência degradar
  para `any` de novo.
- `SLUGS_RESERVADOS` foi fechada em `packages/contratos/src/comuns.ts`, junto do
  formato do slug. Fecha cedo a lacuna que venceria na etapa 7/8; a lista é
  editável.
- `apps/api` usa `rewriteRelativeImportExtensions`: imports relativos com sufixo
  `.ts`, que o `tsc` reescreve para `.js` no emit. É o que permite ao Node rodar
  o fonte direto em desenvolvimento. Os pacotes seguem com `.js`, porque são
  consumidos pelo `dist/`.
- Encaixe **ocupa** para efeito de disponibilidade. A constraint de exclusão o
  dispensa porque é sobreposição autorizada (5.4), mas o tempo do profissional
  continua tomado, e oferecer o horário de novo geraria um segundo encaixe
  involuntário.
- Limites de taxa provisórios: 60/min em `slots` e 30/min em `dias-com-vaga`. A
  etapa 11 calibra os números; o mecanismo já está de pé.
- **Nada de `Promise.all` sobre a mesma transação.** A transação vive numa
  conexão só, que executa uma consulta por vez: o `Promise.all` não paraleliza,
  enfileira, e o `pg` avisa que vai deixar de aceitar isso na versão 9. Dentro de
  `unidadeDeTrabalho`, consultas em série.
- Um repositório por módulo, dono das consultas do seu domínio. Atravessar
  módulos é trabalho do caso de uso, que é quem orquestra (6.2) — `disponibilidade`
  compõe `estabelecimentos`, `servicos`, `profissionais`, `horarios` e
  `agendamentos`.
- O plugin de contexto entrega o estabelecimento **inteiro**, não só o id. Há
  teste contando as resoluções por requisição, porque a busca duplicada não
  aparece em teste de comportamento.
- **A fonte dos valores de cor é `packages/ui/src/tokens/primitivos.ts`**;
  `primitivos.css` é gerado por `pnpm --filter @agendamento/ui tokens`, com teste
  reprovando divergência. Arquivo gerado fica fora do Biome.
- D14 não vale para `*.teste.ts` nem para `apps/playground`: a regra protege o
  artefato de produção, e nenhum dos dois entra nele.
- Os sete estados de 4.3 aparecem no playground sem interação porque
  `estilos.css` **redefine** as variantes `hover:`, `focus-visible:` e `active:`
  para valerem sob `[data-forcar]`. Exibe o estilo real do componente; recriar os
  estados na demonstração produziria uma cópia que diverge no primeiro ajuste.
- `ui/icones` nomeia pelo **desenho**, nunca pelo significado no produto:
  `IconePessoa`, não `IconeCliente` (D8).
- A Inter mora em `packages/ui/src/tokens/fontes/`, com as faces declaradas à
  mão para `latin` e `latin-ext`. O `url()` com especificador de pacote não
  resolve no build do Vite.
- **`apps/api` pode importar `@agendamento/ui/paleta`** — emenda a 4.2. Cliente de
  e-mail não suporta custom property, então template precisa dos valores de cor
  embutidos; sem a aresta, a paleta seria copiada para dentro da API, que é o que
  D14 impede. O ponto de entrada `paleta` é só matemática de cor, sem React nem
  DOM: a API não arrasta a biblioteca de componentes.
- **`codigos_verificacao.finalidade` entra na busca, não só no registro.** Sem
  ela, um token emitido para confirmar e-mail seria aceito como redefinição de
  senha: o hash é o mesmo. `referencia_id` é `usuario_id` na verificação e na
  recuperação, e `estabelecimento_id` no convite — porque aceitar acontece sem
  sessão e sem tenant, e é esse valor que abre o contexto de RLS.
- O estabelecimento corrente do painel vem do cabeçalho `x-estabelecimento`,
  conferido contra os vínculos. Pedir um que não é seu responde "não
  encontrado", igual a não existir (1.1 do conteúdo).
- Redefinir senha revoga **todas** as sessões do usuário.
- Teste de autenticação precisa injetar `limitador` permissivo: o limite real de
  cinco cadastros por minuto barra o próprio arquivo de teste. Quem verifica o
  limitador é `caminho-completo.teste.ts`.
- O `dev` da API usa `node --import tsx`. O Node executa `.ts` nativamente mas
  **não** `.tsx` — ele remove tipos, não transforma JSX, e os templates de e-mail
  são JSX. O build por `tsc` segue igual.

## Decisões ainda abertas

**Lacunas conhecidas, cada uma vencendo numa etapa específica:**

| Lacuna | Vence na |
|---|---|
| `slug` sem regra de validação nem lista de reservados — `app`, `auth`, `api` e `envio` são endereços do sistema | Etapa 7/8 |
| `segmento` sem lista fechada, embora a janela de agendamento seja sugerida por segmento (6.6) | Etapa 8 |
| Rate limit de `slots` e `dias_com_vaga` — provisório em 60/min e 30/min | Etapa 11 |
| `token_gestao_expira_em` definido como "alguns dias" — não implementável | Etapa 11 |
| Como testar `{slug}.dominio.com` localmente (hosts do Windows não aceita curinga) | Etapa 11 |
| Criar estabelecimento antes de existir contexto de tenant — a RLS de `estabelecimentos` cobre leitura e alteração, não criação | Etapa 8 |
| "Existência de ocupação" é mais estrito do que GRANT de coluna expressa; pede view com `security_invoker`, que é o que fixa o piso do Postgres em 15 | Etapa 11 |
| Expurgo da auditoria atravessa tenants, e a RLS o zera — decidir entre papel dono e laço por tenant | Etapa 12 |
| Hospedagem — recomendação em `docs/operacao.md` §2, decisão em aberto por §2.5 | Etapa 14 |

**LGPD: adiada por decisão do usuário.** Nenhum dos seis documentos trata do
assunto. O produto coleta dados pessoais de terceiros (clientes dos tenants) em
formulário público, sem política de privacidade, sem base legal declarada e sem
procedimento de exclusão. Tem consequência técnica em três pontos — link na etapa 5
do fluxo público, procedimento de exclusão versus `lancamentos` append-only, e
tensão com a retenção de 24 meses da auditoria. **Não levantar de novo sem que o
usuário traga o assunto**, mas não tratar como resolvido.

---

## Contexto do ambiente

- Windows 11, PowerShell. Docker Desktop é pré-requisito para Testcontainers
  (etapa 1).
- Idioma de trabalho e da interface: português.
- `c:\projetos\plano-arquitetura-frontend.md`, fora desta pasta, é de **outro
  projeto** (swnet-frontend, PrimeReact) e contradiz o `definicao-stack.md`. Não é
  referência para este sistema.
