# Sistema de Agendamento Multi-Tenant — Definição de Stack e Arquitetura

**Versão 1.1**

Documento técnico. Define linguagem, bibliotecas, arquitetura de camadas, fronteiras de import e convenções de código.

> **Alteração da v1.0 para a v1.1:** acrescentada a seção 6.10 (formato de erro, encerrando a pendência D-b do sistema de design) e a decisão T30; corrigido o piso de versão do PostgreSQL em 2.5; encerradas as pendências T-a a T-e. Nenhuma escolha de biblioteca ou fronteira de camada foi alterada.

**Entrada obrigatória:** `planejamento-agendamento.md` (v1.3). Este documento não redefine regra de negócio, modelo de dados ou fluxo — apenas escolhe com o que construí-los. Toda referência no formato `(8.5)` ou `(decisão 31)` aponta para lá.

**Referência de mão única.** Este documento cita o funcional constantemente; o funcional cita este uma vez, na lista de pendências encerradas. Alterar a stack nunca exige nova versão do funcional.

**Fronteira entre os dois documentos**

| Vai para o funcional | Vai para este documento |
|---|---|
| O que o sistema faz e por quê | Com o que é construído e por quê |
| Modelo de dados, campos, constraints | ORM, migrações, pools, roles de banco |
| Regras, fluxos, estados, permissões | Camadas, pastas, fronteiras de import |
| "Precisa de execução agendada" (3.5) | "pg-boss, worker como processo separado" |
| Contratos de comportamento | Bibliotecas e ferramentas |

O teste: se a frase sobreviveria a uma reescrita completa em outra linguagem, é funcional.

---

## Sumário

1. [Premissa](#1-premissa)
2. [Stack](#2-stack)
3. [Portas e independência de plataforma](#3-portas-e-independência-de-plataforma)
4. [Monorepo](#4-monorepo)
5. [Pacote de domínio](#5-pacote-de-domínio)
6. [Aplicação `api`](#6-aplicação-api)
7. [Aplicação `painel`](#7-aplicação-painel)
8. [Aplicação `publico`](#8-aplicação-publico)
9. [Convenções de código](#9-convenções-de-código)
10. [Estratégia de testes](#10-estratégia-de-testes)
11. [Requisitos críticos verificados](#11-requisitos-críticos-verificados)
12. [Ordem de implementação](#12-ordem-de-implementação)
13. [Decisões registradas](#13-decisões-registradas)
14. [Pendências](#14-pendências)

---

## 1. Premissa

### 1.1 A restrição que decide a linguagem

A seção 3.3 do funcional exige um pacote de **domínio puro** — cálculo de slots, transições de estado, matriz de permissões, formatação de valores e datas com fuso — rodando no backend como fonte de verdade e no frontend para feedback imediato, **testado uma vez**.

Isso elimina Go, Elixir, Python, PHP e qualquer outra linguagem no backend: todas obrigariam a reimplementar o motor de disponibilidade em JavaScript para o frontend, exatamente a duplicação que a decisão 3.1 proíbe entre backend e frontend. O argumento vale igual dos dois lados da fronteira.

**Conclusão: TypeScript em todas as camadas, monorepo único.**

### 1.2 Contexto de execução

Desenvolvedor único, com experiência prévia em Node e TypeScript em produção. Isso pesa nas escolhas: frameworks que existem para impor convenção entre muitas mãos custam cerimônia sem entregar o benefício correspondente.

### 1.3 O que este documento não decide

**Hospedagem.** Deliberadamente adiada. A seção 3 lista as cinco portas que isolam a decisão, todas com implementação local funcionando desde o primeiro dia. A escolha de plataforma passa a ser troca de implementação, não reescrita.

---

## 2. Stack

### 2.1 Núcleo

| Camada | Escolha |
|---|---|
| Linguagem | TypeScript em modo `strict` |
| Runtime | Node LTS ativo |
| Monorepo | pnpm workspaces + Turborepo |
| Banco | PostgreSQL 18 + extensão `btree_gist` |
| Acesso a dados | Drizzle ORM + drizzle-kit |
| Backend | Fastify + `fastify-type-provider-zod` |
| Fila e agendamento | pg-boss |
| Contratos | Zod + ts-rest |
| Datas e fuso | Luxon |

### 2.2 Frontends

| Camada | Painel do gestor | Página pública |
|---|---|---|
| Framework | React + Vite | Next.js (App Router) |
| Roteamento | TanStack Router | App Router, file-based |
| Estado de servidor | TanStack Query | TanStack Query (só no cliente) |
| PWA | vite-plugin-pwa | Serwist |
| Estilo | Tailwind + CVA | Tailwind + CVA |
| Formulários | react-hook-form + resolver Zod | react-hook-form + resolver Zod |

### 2.3 Segurança e integrações

| Necessidade | Escolha |
|---|---|
| Hash de senha | argon2id (`@node-rs/argon2`) |
| OAuth Google | `arctic` |
| Sessão | token opaco em tabela, hash armazenado |
| E-mail (transporte) | `nodemailer` sobre SMTP |
| E-mail (template) | React Email |

### 2.4 Ferramentas

| Necessidade | Escolha |
|---|---|
| Teste unitário | Vitest |
| Teste de integração | Vitest + Testcontainers |
| Teste ponta a ponta | Playwright |
| Lint e formatação | Biome |
| Ambiente local | Docker Compose (Postgres + Mailpit) |
| Log | pino |

### 2.5 Versões

Este documento **não fixa versões de biblioteca**. Versão é responsabilidade do `package.json` e do lockfile, que são a fonte de verdade e mudam a cada trimestre. Fixar aqui produziria um documento desatualizado em três meses e um segundo lugar para conferir.

As duas exceções são arquiteturais, não de manutenção:

- **PostgreSQL 15 ou superior.** `security_invoker` em views existe desde a 15, e é o que fixa o piso; `btree_gist` é módulo `contrib` disponível em toda versão suportada, e não restringe nada. A recomendação continua sendo a versão mais recente que o provedor oferecer — mas o **piso arquitetural é 15**, e tratá-lo como 18 estreitava a escolha de hospedagem sem necessidade.
- **Node LTS ativo** — nunca versão ímpar em produção.

---

## 3. Portas e independência de plataforma

Cinco dependências externas ficam atrás de interface declarada em `packages/dominio/portas`, com implementação local hoje.

| Porta | Implementação hoje | Substituição futura | Origem no funcional |
|---|---|---|---|
| `EnviadorEmail` | SMTP → Mailpit | Resend, SES, Postmark | Pendência 5 |
| `CanalOtp` | `LOG` | SMS ou WhatsApp | 10.4, decisão 30 |
| `Cache` | `Map` com TTL | Redis | 6.3 |
| `LimitadorTaxa` | memória | Redis | 6.4, 10.4, 10.7 |
| `Armazenamento` | disco local | S3, R2, Blob | Logo do tenant (4.1) |

O funcional já previa `CanalOtp`. As outras quatro seguem o mesmo raciocínio da decisão 30: a lógica é independente do canal de entrega.

**Mailpit** substitui o provedor de e-mail em desenvolvimento — SMTP falso com interface web. O e-mail de `token_gestao` (decisão 35) é visível e testável sem contratar nada, e a escolha do provedor real fica isolada atrás da porta, sem bloquear a implementação.

**Regra que mantém a portabilidade:** nenhum SDK de plataforma fora de `apps/api/src/infra/`. Toda configuração por variável de ambiente, validada por Zod no boot — variável ausente impede o processo de subir, em vez de produzir falha silenciosa em produção.

**Consequência a monitorar.** `Cache` e `LimitadorTaxa` em memória funcionam enquanto houver **uma** instância da API. Na segunda instância, cache incoerente entre processos e rate limit multiplicado pelo número de réplicas. A porta existe para que a troca seja de uma linha, mas a decisão de escalar horizontalmente exige trocá-las **antes**, não depois.

---

## 4. Monorepo

### 4.1 Estrutura

```
agendamento/
├─ apps/
│  ├─ api/            Fastify — servidor HTTP e worker
│  ├─ painel/         React + Vite
│  └─ publico/        Next.js
├─ packages/
│  ├─ dominio/        regras puras, zero I/O
│  ├─ contratos/      schemas Zod e contrato ts-rest
│  ├─ db/             schema Drizzle, migrações, policies RLS
│  └─ ui/             tokens de design e componentes base
├─ docker-compose.yml
├─ turbo.json
└─ pnpm-workspace.yaml
```

### 4.2 Grafo de dependências

| Pacote | Importado por | Depende de |
|---|---|---|
| `dominio` | `api`, `painel`, `publico`, `contratos` | `luxon` |
| `contratos` | `api`, `painel`, `publico` | `zod`, `dominio` |
| `db` | `api` | `drizzle-orm`, `dominio` |
| `ui` | `painel`, `publico` | React, Tailwind |

`db` nunca é importado por frontend. `dominio` nunca importa nenhum dos outros.

### 4.3 O princípio único

> **A dependência aponta para dentro. `dominio` não conhece ninguém.**

Camada externa importa de interna; nunca o contrário. Não é dogma arquitetural: é o que torna literal o requisito de 3.3. Uma função de domínio que importe Drizzle não roda no browser, e o motor de disponibilidade volta a ser duplicado.

Isto **não** é Clean Architecture com porta e adaptador para cada entidade. É monólito modular organizado por domínio no primeiro nível e por camada no segundo.

---

## 5. Pacote de domínio

### 5.1 Estrutura

```
packages/dominio/src/
├─ disponibilidade/   calcularSlots, diasComVaga        (6.1, 6.4)
├─ agendamento/       TRANSICOES, guardas, acoesDisponiveis  (7.8)
├─ permissoes/        MATRIZ, podeExecutar              (2.3, decisão 33)
├─ tempo/             conversão de grade local para UTC (6.3, 9.4)
├─ dinheiro/          centavos, formatação BRL          (8.1, 9.2)
├─ erros/             ErroDominio e códigos
└─ portas/            interfaces das cinco portas
```

### 5.2 Separação entre carregar e calcular

O pseudocódigo de 6.1 mistura duas responsabilidades: buscar dados e decidir. A separação é obrigatória para que a mesma função rode nos dois lados.

```ts
// apps/api — busca (I/O)
const contexto = { janelas, ocupacoes, config, agora: DateTime.utc() };

// packages/dominio — pura, testável sem banco, executável no browser
calcularSlots(contexto, itens, profissionais);
```

Sem isso, `dominio` vira uma pasta com nome bonito e o motor acaba reimplementado no frontend.

### 5.3 Fronteira verificada por teste

Um teste de arquitetura no CI falha o build se qualquer arquivo de `packages/dominio` importar algo fora de `luxon` e do próprio pacote. Convenção que depende de memória erode em seis meses; regra executável, não.

### 5.4 Uso no frontend

| Uso | Onde |
|---|---|
| Somar duração e valor dos itens ao montar agendamento manual (6.2) | Painel e público |
| Formatar valor em centavos e converter fuso na grade | Painel e público |
| Renderizar botões de ação | **Não.** Vem de `acoes_disponiveis` (7.8) |

A distinção importa: o frontend usa `dominio` para feedback imediato de cálculo, nunca para replicar autorização. Permissão é decidida no servidor e transportada como dado.

---

## 6. Aplicação `api`

### 6.1 Estrutura

```
apps/api/src/
├─ servidor.ts              entrypoint HTTP
├─ worker.ts                entrypoint pg-boss
├─ config.ts                variáveis de ambiente validadas por Zod
├─ plugins/
│  ├─ autenticacao.ts       resolve usuario, vinculo, papel
│  ├─ contexto.ts           monta Contexto e escolhe o pool
│  ├─ erros.ts              ErroDominio → status HTTP
│  └─ limite-taxa.ts
├─ infra/                   implementações das portas
│  ├─ db/                   poolGestor, poolPublico, unidadeDeTrabalho
│  ├─ email/  otp/  cache/  armazenamento/
├─ modulos/
│  ├─ agendamentos/
│  │   ├─ rotas.ts
│  │   ├─ casos-de-uso/     criar.ts, transicionar.ts, remarcar.ts
│  │   └─ repositorio.ts
│  ├─ disponibilidade/  estabelecimentos/  servicos/
│  ├─ profissionais/    horarios/          clientes/
│  ├─ caixa/            notificacoes/      auth/
└─ tarefas/                 handlers do worker (3.5)
```

### 6.2 Responsabilidade das camadas

| Camada | Faz | Nunca faz |
|---|---|---|
| `rotas` | Valida entrada, monta `Contexto`, chama caso de uso, serializa saída | Regra de negócio, SQL |
| `casos-de-uso` | Abre transação, carrega dados, chama `dominio`, persiste, grava auditoria | Conhecer `request`, `reply` ou status HTTP |
| `repositorio` | SQL. Recebe o executor como parâmetro | Decidir, validar, orquestrar |
| `packages/dominio` | Decide | Qualquer I/O |

### 6.3 Caminho de uma requisição

```
POST /agendamentos/:id/transicoes

  plugin autenticacao  → usuario, vinculo, papel
  plugin contexto      → { estabelecimentoId, usuarioId, papel,
                           profissionalId, origem, pool }
  rotas                → valida corpo com schema de `contratos`

  caso de uso transicionar(ctx, id, destino):
    unidadeDeTrabalho(ctx, async (tx) => {
      set_config('app.estabelecimento_id', ctx.estabelecimentoId, true)

      agendamento ← repositorio.buscar(tx, id)
      transicao   ← dominio.buscarTransicao(agendamento.status, destino)
      dominio.verificarPapel(transicao, ctx)
      dominio.executarGuardas(transicao, agendamento, ctx)

      repositorio.atualizarStatus(tx, ...)        -- EXCLUDE valida aqui
      repoCaixa.lancar(tx, ...)                   -- efeito (7.5)
      repoNotificacoes.agendar(tx, ...)           -- efeito (7.6)
      repoAuditoria.gravar(tx, ...)               -- (7.7)
    })

  plugin erros         → ErroDominio.codigo → status HTTP
```

### 6.4 A transação vive no caso de uso

Não na rota, que não sabe o que é atômico, nem no repositório, que enxergaria apenas um pedaço. É a única forma de cumprir a exigência de 7.8: se a constraint recusar, lançamento e notificação não podem ter ocorrido.

**Consequência obrigatória:** todo método de repositório recebe o executor como primeiro parâmetro.

```ts
repositorio.atualizarStatus(tx, id, destino)   // correto
repositorio.atualizarStatus(id, destino)       // usa `db` global — proibido
```

Sem isso não existe transação atravessando repositórios diferentes, e caixa, notificações e auditoria estão em módulos distintos de propósito.

### 6.5 Efeito é escrita, não envio

O `efeitos: [notificar_cliente]` de 7.8 grava uma linha em `notificacoes` com `agendada_para`. A tarefa de minuto (3.5) drena a tabela e entrega.

O funcional já desenhou um **outbox transacional** sem nomeá-lo: a notificação nasce e morre com a transação, e nenhuma mensagem sai de uma transação revertida. O pg-boss atua como agendador sobre o mesmo Postgres, então o enfileiramento também participa da transação — o problema clássico de job enfileirado para um registro que não existe não chega a ocorrer.

Com fila em Redis isso seria impossível: o `send` estaria fora da transação do banco, e a constraint recusando depois do enfileiramento produziria notificação de agendamento inexistente.

### 6.6 Tradução de erro de banco

A violação de `EXCLUDE USING gist` (8.5) chega como `SQLSTATE 23P01`. Quem conhece esse código é o repositório, que o converte em `ErroDominio('SLOT_OCUPADO')`. A partir dali nenhuma camada sabe que existe PostgreSQL. O plugin de erros é o único lugar do sistema que conhece status HTTP.

### 6.7 Contexto explícito

`Contexto` é o primeiro parâmetro de todo caso de uso, sem exceção.

```ts
type Contexto = {
  estabelecimentoId: string;
  usuarioId: string | null;
  clienteId: string | null;
  papel: Papel | null;
  profissionalId: string | null;
  origem: 'PUBLICO' | 'ADMIN' | 'SISTEMA';
};
```

É verboso, e isso é intencional: o caso de uso fica testável sem servidor HTTP, e o TypeScript impede chamá-lo sem tenant. `AsyncLocalStorage` é permitido apenas para correlacionar log — **nunca** para transportar tenant. Tenant implícito é a origem do vazamento silencioso descrito em 9.6.

Os três valores de `origem` cobrem os três atores de auditoria de 7.7.

### 6.8 Isolamento entre tenants

Duas camadas, conforme a decisão 41.

**Filtro explícito.** Toda query de repositório carrega `estabelecimento_id` no `WHERE`. Além da defesa em profundidade, o planner usa a cláusula para escolher índice; depender apenas da policy piora o plano em algumas consultas.

**Variável de sessão transaction-local.**

```ts
await tx.execute(
  sql`SELECT set_config('app.estabelecimento_id', ${ctx.estabelecimentoId}, true)`
);
```

O terceiro argumento `true` torna a configuração local à transação: o PostgreSQL a descarta no commit ou no rollback. O bug descrito em 9.6 — variável não limpa ao devolver a conexão ao pool — deixa de ser possível por construção, não por disciplina. Compatível com PgBouncer em modo `transaction`.

**Dois pools, dois roles.** `infra/db/` expõe `poolGestor` e `poolPublico`, com GRANTs distintos conforme 9.6. O plugin de contexto escolhe pela rota: tudo sob `/publico/*` usa `poolPublico`, que não alcança `lancamentos`, `observacoes_internas` nem `auditoria` mesmo se alguém escrever a query errada.

### 6.9 O worker

`worker.ts` sobe do mesmo Dockerfile, com comando diferente, e importa os **mesmos** casos de uso.

| Tarefa | Frequência | Implementação |
|---|---|---|
| Drenar `notificacoes` com `agendada_para` vencido | Minuto | `tarefas/enviar-notificacoes.ts` |
| Expirar solicitações `AGUARDANDO` (5.7) | Hora | `transicionar(ctxSistema, id, CANCELADO)` |
| Expurgar `codigos_verificacao` e `auditoria` (decisão 42) | Diária | `tarefas/expurgo.ts` |

A expiração reusa o caso de uso da rota, com `origem: 'SISTEMA'`. Reimplementar a transição no worker é como `tipo_cancelamento = EXPIRACAO` acaba divergindo do resto da máquina de estados.

### 6.10 Formato de erro

O formato precisa existir **antes do primeiro formulário**: sem erros por campo no contrato, cada tela reimplementa o mapeamento para o `setError` do react-hook-form.

```ts
// packages/contratos/erros.ts
export const respostaErro = z.object({
  erro: z.object({
    codigo:   codigoErro,                                  // enum fechado
    mensagem: z.string(),                                  // exibível, já em pt-BR
    campos:   z.record(z.string(), z.array(z.string())).optional(),
  }),
});
```

Três propriedades, cada uma resolvendo um problema concreto.

**`codigo` é um enum fechado**, exportado de `contratos` e compartilhado pelas três aplicações. Escrever um código inexistente falha em tempo de compilação, e o mapa de código para status HTTP (6.6) vive em um lugar só.

**`mensagem` é gerada no servidor e sempre exibível.** O frontend nunca traduz código em texto — dois dicionários divergem, e o servidor é o único que sabe qual guarda reprovou. Ela nunca contém SQL, stack, identificador interno ou nome de tabela.

**As chaves de `campos` usam a notação de caminho do react-hook-form** — `nome`, `itens.0.servicoId`, `horarios.2.horaFim`. Isso não é detalhe de formatação: é o que permite ao helper do frontend chamar `setError(caminho, …)` direto. Qualquer outra notação obriga a um conversor em cada formulário, que é exatamente o que o campo existe para evitar.

**A conversão acontece uma vez, no plugin de erros.** Um `ZodError` vira `campos` mapeando `issue.path.join('.')` para as mensagens — então **toda rota validada por schema ganha erro por campo sem escrever nada**. Um `ErroDominio` de regra que é sobre um campo (slug já em uso, telefone duplicado no tenant) constrói `campos` explicitamente.

Do lado do cliente, um helper aplica e informa se tratou:

```ts
aplicarErrosServidor(erro, setError): boolean
```

Quando devolve `false`, o erro não é de campo e cai no tratamento global — um aviso, nunca uma tela em branco.

---

## 7. Aplicação `painel`

### 7.1 Estrutura

```
apps/painel/src/
├─ rotas/                    TanStack Router, file-based
├─ funcionalidades/
│  ├─ agenda/
│  │   ├─ componentes/       GradeSemanal, ListaDoDia, CartaoAgendamento
│  │   ├─ hooks/             useAgendaDoDia, useTransicionar
│  │   └─ api.ts             cliente ts-rest tipado
│  ├─ onboarding/  servicos/  horarios/
│  ├─ clientes/    caixa/     equipe/    resumo/
├─ componentes/              compartilhados entre funcionalidades
├─ lib/                      cliente http, query client, formatadores
└─ providers/
```

Três camadas: **rota** compõe layout → **funcionalidade** contém componentes e hooks → **`api.ts`** é o único arquivo que fala HTTP. Nenhum componente chama `fetch` diretamente.

### 7.2 Fronteira entre funcionalidades

**Funcionalidade não importa de funcionalidade.** Se `agenda` precisa de algo de `clientes`, o item sobe para `componentes/` ou para `packages/ui`. Import cruzado horizontal é o mecanismo pelo qual duas funcionalidades viram uma só em três meses.

### 7.3 Cache e offline

TanStack Query com `persistQueryClient` sobre IndexedDB, com **whitelist explícita**: apenas agenda do dia e catálogo persistem. Escrita sempre online, conforme 9.7 — mutation offline em agendamento produz conflito sem resolução aceitável.

### 7.4 Renderização

SPA sem SSR. SEO é irrelevante e autenticação é sempre exigida (3.2), e o offline-first é significativamente mais simples sem servidor de renderização no caminho.

---

## 8. Aplicação `publico`

### 8.1 Estrutura

```
apps/publico/
├─ middleware.ts                       resolve o slug do subdomínio
├─ app/
│  ├─ layout.tsx                       resolve o tenant uma vez
│  ├─ page.tsx                         home do tenant — Server Component
│  ├─ agendar/page.tsx                 fluxo — Client Component
│  ├─ agendamento/[token]/page.tsx     gestão por token_gestao (10.7)
│  ├─ manifest.webmanifest/route.ts    manifest dinâmico por tenant (9.7)
│  └─ api/                             apenas o que exige servidor
└─ src/funcionalidades/agendar/        etapas do fluxo (5.1)
```

### 8.2 A divisão é do dado, não da tecnologia

| Dado | Onde busca | Por quê |
|---|---|---|
| Tenant, marca, catálogo | Server Component, com revalidação | SEO e primeira pintura (3.2) |
| `dias_com_vaga`, `slots` | Cliente, `staleTime: 0` | Network-first sem exceção (3.2, 9.7) |
| Criação do agendamento | Cliente, direto para a API | Escrita |

**Disponibilidade nunca passa por cache de servidor nem por Server Component com revalidação.** É o cenário que 3.2 classifica como perigoso — disponibilidade em cache leva a agendamento sobre horário ocupado. No App Router esse erro acontece por omissão, não por escolha deliberada, o que o torna mais provável, não menos.

### 8.3 Subdomínio e manifest

`middleware.ts` extrai o slug de `{slug}.dominio.com` e o injeta em um header; o layout resolve o tenant a partir dele. O mesmo slug alimenta a rota do manifest, que devolve nome, ícone e cor do estabelecimento — o cliente instala a marca do tenant, não a do sistema (9.7, decisão 15).

---

## 9. Convenções de código

| Regra | Motivo |
|---|---|
| Português sem acento ou cedilha em pastas, arquivos, funções, tipos e variáveis | Estende 8.1 ao código. Metade em inglês e metade em português é pior que qualquer um dos dois isoladamente |
| Exceções fechadas: `app/`, `src/`, `public/`, `hooks/`, `providers/`, `components/` quando imposto por framework | Não vale brigar com convenção de ferramenta |
| Estrangeirismos permitidos: os de 8.1 mais `hook`, `props`, `state`, `cache`, `worker`, `pool` | Lista fechada, mesma lógica de 8.1 |
| Um `index.ts` por pacote, exportando apenas o que é público | Import profundo entre pacotes é acoplamento invisível |
| Erro sempre `ErroDominio` com código; nunca `Error` genérico | Um único lugar traduz para HTTP |
| Nenhum SDK de plataforma fora de `apps/api/src/infra/` | Portabilidade (seção 3) |
| Toda variável de ambiente validada por Zod no boot | Falha no start é melhor que falha no primeiro cliente |

---

## 10. Estratégia de testes

| Alvo | Ferramenta | Sem banco |
|---|---|---|
| `packages/dominio` | Vitest | Sim |
| Casos de uso e repositórios | Vitest + Testcontainers | Não |
| Fluxos das duas aplicações | Playwright | Não |
| Fronteira de import de `dominio` | Script no CI | Sim |

### 10.1 Os dois testes que justificam a arquitetura

**Isolamento entre tenants** (9.6, decisão 41). Dois estabelecimentos, uma tentativa de leitura cruzada, com a variável de sessão apontando para o primeiro. Deve retornar vazio, não erro. Exigido desde a primeira semana porque a falha é silenciosa.

**Corrida no mesmo slot** (8.5, decisão 34). Duas inserções concorrentes na mesma faixa do mesmo profissional. Uma commita, a outra recebe `23P01` e é traduzida em `SLOT_OCUPADO`.

Ambos exigem PostgreSQL real. Nem `EXCLUDE USING gist`, nem RLS, nem `btree_gist` existem em mock ou SQLite — a peça mais crítica do sistema seria a única sem cobertura.

### 10.2 Casos que o teste de domínio precisa cobrir

Derivados de 6.3 e 6.2:

- Transição de horário de verão: dia com 23 e com 25 horas (o Brasil não observa DST hoje, mas a regra é política e reversível).
- Folga que excede a janela de trabalho, com `folga_pode_exceder_janela` nos dois valores.
- Agendamento com 1 e com 5 itens, com override de duração por profissional.
- Grade com múltiplos intervalos no mesmo dia (manhã e tarde).
- Vigência de grade: alteração no mesmo dia sobrescreve; alteração posterior versiona (6.5).

---

## 11. Requisitos críticos verificados

Fecha a pendência de **escolha da stack** do funcional, que listava três requisitos independentes. (Ela era a de número 5 antes da renumeração da v1.3 daquele documento; o número 5 hoje é outra pendência, e por isso a referência aqui é pelo nome.)

| # | Requisito | Resolução |
|---|---|---|
| 1 | Constraint de exclusão sobre intervalos (8.5) | Nativo no PostgreSQL, escrito em migração SQL editável à mão. Exige `CREATE EXTENSION btree_gist` — **confirmar disponibilidade no provedor gerenciado antes de contratá-lo** |
| 2 | RLS com pool de conexões (9.6) | `set_config(..., true)` dentro da transação, compatível com PgBouncer em modo `transaction`. Limpeza garantida pelo commit ou rollback |
| 3 | Execução agendada em segundo plano (3.5) | pg-boss em **processo separado** do servidor web, com cron nativo para as três frequências |

A verificação 1 é a única que restringe a decisão de hospedagem adiada. Não é uma restrição severa — Neon, Supabase e RDS permitem a extensão —, mas elimina Postgres gerenciados mais fechados.

---

## 12. Ordem de implementação

| # | Etapa | Critério de pronto |
|---|---|---|
| 0 | Monorepo, Docker Compose, schema mínimo, `btree_gist`, RLS, dois roles | Teste de leitura cruzada passando no CI |
| 1 | `dominio`: motor de slots e `TRANSICOES` | Casos de 10.2 cobertos |
| 2 | Persistência de agendamento com `EXCLUDE` | Teste de corrida passando |
| 3 | Auth do gestor, tenant, catálogo, horários | Onboarding de cinco passos completo (4.1) |
| 4 | Fluxo público de agendamento | Link gerado no onboarding funciona ponta a ponta |
| 5 | Worker, notificações, e-mail | Lembrete de 24h sai; cancelamento marca lembretes futuros como `CANCELADO` (7.6) |
| 6 | Caixa, resumo, exportação CSV | 9.8 atendido |
| 7 | PWA nas duas aplicações | Ambas instaláveis |

As etapas 0 a 2 não produzem tela e parecem lentas. São a única parte cuja escolha errada custa migração: constraint frouxa ou RLS incompleto se descobrem com dado de cliente real e sobreposição em produção. Tudo depois é CRUD sobre uma base confiável.

### 12.1 Ajuste de escopo sugerido

O MVP de 11 é grande para um desenvolvedor. Dois itens podem sair sem migração futura e sem contrariar decisão nenhuma:

| Item | Justificativa para adiar |
|---|---|
| Google como alternativa de login (decisões 20 e 22) | E-mail e senha cobre 100% do caso de uso. Adicionar depois é uma linha em `provedores` e uma rota |
| Offline-first no painel (9.7) | Começar network-first nos dois, com service worker registrado e app instalável. O cache offline da agenda é a parte mais difícil de acertar e a que menos bloqueia o lançamento |

**Não adiar:** múltiplos serviços por agendamento (a decisão 31 está correta — migrar de 1:1 para 1:N atinge motor, snapshots, caixa e relatórios simultaneamente) e o worker (sem ele não sai lembrete, e lembrete é metade do valor percebido do produto).

---

## 13. Decisões registradas

Numeração `T`, independente da numeração do funcional. Numeração contínua entre os dois documentos criaria dependência invisível: inserir decisão funcional futura deslocaria o significado das técnicas.

| # | Decisão | Justificativa |
|---|---|---|
| T1 | TypeScript em todas as camadas | 3.3 exige domínio compartilhado entre backend e frontend, testado uma vez. Qualquer outra linguagem no backend duplicaria o motor de disponibilidade |
| T2 | Monorepo com pnpm workspaces e Turborepo | Consequência direta da decisão 14. Alternativa Nx traz gerador e plugin que não se pagam com um desenvolvedor |
| T3 | Fastify em vez de NestJS | O funcional define transição como dado (7.8) e permissão como constante (decisão 33) — o oposto da DI por decorators, que puxa regra para dentro do framework. Nest existe para impor convenção entre muitas mãos; com um desenvolvedor, é cerimônia sem contrapartida |
| T4 | Drizzle em vez de Prisma | Três razões: `EXCLUDE USING gist` não existe no modelo do Prisma e o schema divergiria do introspect; migração no Drizzle é SQL editável à mão; RLS tem representação nativa (`pgPolicy`, `pgRole`), então a policy nasce versionada com o schema |
| T5 | `set_config(..., true)` dentro da transação | Torna a variável transaction-local. O PostgreSQL limpa no commit ou rollback, e o bug de 9.6 deixa de depender de disciplina |
| T6 | Dois pools com roles distintos | 9.6 exige papel separado para o fluxo público. Escolher o pool pela rota garante o isolamento mesmo com query mal escrita |
| T7 | Filtro explícito mantido junto da policy | Decisão 41. Além da defesa em profundidade, o planner usa o `WHERE` para escolher índice |
| T8 | pg-boss em vez de BullMQ | 7.8 exige transação única. Com fila em Redis o enfileiramento fica fora da transação do banco, e a constraint recusando depois produz notificação de agendamento inexistente. No mesmo Postgres, o outbox é gratuito. Um serviço a menos para provisionar, monitorar e pagar |
| T9 | Notificação é linha em tabela; fila apenas agenda | Preserva o outbox de 7.6 e mantém `agendada_para` como fonte de verdade, não o estado interno da fila |
| T10 | Worker como processo separado, mesmo código | 3.5 exige execução contínua. Reusar os casos de uso impede que a expiração (5.7) divirja da máquina de estados |
| T11 | Transação no caso de uso; repositório recebe o executor | Única forma de atravessar módulos (caixa, notificações, auditoria) numa transação só, como 7.8 exige |
| T12 | Erro de banco traduzido no repositório | `23P01` vira `SLOT_OCUPADO`. Acima dessa camada, nada sabe que existe PostgreSQL |
| T13 | `Contexto` explícito como primeiro parâmetro | Torna o tenant impossível de esquecer, com verificação em tempo de compilação. `AsyncLocalStorage` apenas para log |
| T14 | Painel em SPA com Vite; público em Next | 3.2 lista requisitos opostos. SEO e bundle crítico pedem SSR; offline-first e autenticação obrigatória pedem SPA |
| T15 | Disponibilidade sempre buscada no cliente | 3.2 classifica disponibilidade em cache como perigosa. No App Router, cachear é o comportamento padrão — o erro precisa ser evitado ativamente |
| T16 | Funcionalidade não importa de funcionalidade | Import horizontal é o mecanismo pelo qual módulos se fundem silenciosamente |
| T17 | Luxon para data e fuso | 6.3 exige conversão de grade local por data, com dias de 23 e 25 horas. Precisa de IANA real e do mesmo comportamento em Node e browser |
| T18 | Autenticação própria | O modelo de 8.3 e 10 (identidade global, vínculo por tenant, `token_gestao`, convite, OTP abstraído, cookie no domínio pai) não é o que biblioteca pronta assume. Contornar o schema imposto custaria mais que construir |
| T19 | Sessão opaca em tabela, não JWT | Sessão de 30 dias (10.2) sem revogação é inaceitável quando alguém sai da equipe. Guardar o hash, nunca o token |
| T20 | Cinco portas para dependências externas | Estende a decisão 30 a e-mail, cache, rate limit e armazenamento. Permite adiar a escolha de plataforma sem custo |
| T21 | Mailpit como SMTP de desenvolvimento | A decisão 35 torna o e-mail crítico no MVP. Mailpit torna o `token_gestao` testável sem contratar provedor, e mantém a escolha do provedor real fora do caminho crítico |
| T22 | Cache e rate limit em memória na v1 | Uma instância. Atrás de porta, para que a segunda instância seja troca de implementação — mas a troca precisa preceder o escalonamento, não segui-lo |
| T23 | Versões de biblioteca fora deste documento | `package.json` e lockfile são a fonte de verdade e mudam a cada trimestre. Fixar aqui produz documento desatualizado e um segundo lugar para conferir |
| T24 | Testcontainers para casos de uso | `EXCLUDE`, RLS e `btree_gist` não existem em mock. Sem banco real, a peça mais crítica é a única sem cobertura |
| T25 | Fronteira de `dominio` verificada por script no CI | Convenção baseada em memória erode; regra executável, não |
| T26 | Nenhum SDK de plataforma fora de `infra/` | Torna a decisão de hospedagem reversível |
| T27 | Português no código, seguindo 8.1 | Coerência com o modelo de dados. Lista de exceções fechada, para não virar negociação a cada arquivo |
| T28 | Numeração `T` independente | Numeração contínua entre documentos faria inserção futura no funcional deslocar o significado das decisões técnicas |
| T29 | Documento separado do funcional | Ritmos de mudança opostos, e a linha 5 do funcional o define como entrada para esta decisão. Fundir tornaria o documento autorreferente e faria bump de versão de biblioteca poluir o histórico das decisões de produto |
| T30 | Contrato de erro com `codigo`, `mensagem` e `campos`, na notação de caminho do react-hook-form | Sem erros por campo no contrato, cada formulário reimplementa o mapeamento. A notação idêntica à do RHF é o que dispensa o conversor, e a conversão do `ZodError` no plugin dá erro por campo a toda rota validada por schema, de graça |

---

## 14. Pendências

**Encerradas na v1.1:** T-a a T-e, em `operacao.md` — hospedagem (2), TLS curinga (3), backup e restauração (4), observabilidade (6) e migração em produção (7). O mesmo documento encerra a pendência de provedor de e-mail herdada do funcional (5). A pendência D-b do sistema de design foi encerrada aqui, em 6.10.

**Herdadas do funcional, ainda abertas:** provedor de mensagens para a fase 2 (pendência 3) e cota de mensagens por plano (pendência 4). Nenhuma das duas bloqueia o MVP — a porta `CanalOtp` as isola, e `exige_otp_telefone` é inerte na v1.
