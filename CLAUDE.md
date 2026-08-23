# Sistema de Agendamento Multi-Tenant

SaaS multi-tenant de agendamento de consultas e atendimentos, para nichos variados
(saúde, nutrição, beleza, barbearia, estética, consultoria). Mercado nacional, BRL
e pt-BR fixos. O sistema **não processa pagamento** — registra valores para controle
gerencial.

**Estado: planejamento concluído, implementação não iniciada.** Não existe código
ainda. A etapa 0 (fundação do monorepo) é o próximo passo.

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

## Decisões ainda abertas

**Bloqueiam a etapa 0:**

- **Nome definitivo e escopo dos pacotes** (`@algo/dominio`). A pasta se chama
  `agendamento` porque é o que a §4.1 do stack especifica — não é uma decisão de
  marca. Enquanto não houver nome, renomear é barato.
- **Onde vive o repositório e qual CI.** O critério de pronto da etapa 0 é CI verde
  em PR vazio.

**Lacunas conhecidas, cada uma vencendo numa etapa específica:**

| Lacuna | Vence na |
|---|---|
| `slug` sem regra de validação nem lista de reservados — `app`, `auth`, `api` e `envio` são endereços do sistema | Etapa 7/8 |
| `segmento` sem lista fechada, embora a janela de agendamento seja sugerida por segmento (6.6) | Etapa 8 |
| Rate limit de `slots` e `dias_com_vaga` sem número definido | Etapa 11 |
| `token_gestao_expira_em` definido como "alguns dias" — não implementável | Etapa 11 |
| Como testar `{slug}.dominio.com` localmente (hosts do Windows não aceita curinga) | Etapa 11 |
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
