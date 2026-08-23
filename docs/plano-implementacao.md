# Sistema de Agendamento Multi-Tenant — Plano de Implementação

**Versão 1.1**

Roteiro de execução. Define a ordem das etapas, o que cada uma entrega e o critério que a declara pronta.

**Entradas obrigatórias:** `planejamento-agendamento.md` (v1.4), `definicao-stack.md` (v1.1), `sistema-de-design.md` (v1.1), `conteudo-e-microcopia.md` (v1.0) e `operacao.md` (v1.0). Este documento não decide o que o sistema faz, nem com o que é construído, nem como se parece, nem o que escreve, nem onde roda. Decide apenas **em que ordem**, e por quê.

Referências: `(5.1)` aponta para o funcional, `(T14)` para o stack, `(D6)` para o design, `(C7)` para o conteúdo, `(O13)` para a operação.

> **Alteração da v1.0 para a v1.1:** a seção 8 deixou de listar pendências bloqueantes — todas foram resolvidas. Acrescentadas as referências aos dois documentos novos. A ordem das etapas não mudou.

**Substitui** a seção 12 do `definicao-stack.md`, que fica como o resumo de sete linhas que era. Este documento é a versão executável dela, com o sistema de design incorporado.

**Referência de mão única.** Este cita os três anteriores; nenhum deles cita este. Reordenar etapas nunca exige nova versão de nenhum outro documento.

---

## Sumário

1. [Princípios de ordenação](#1-princípios-de-ordenação)
2. [Escopo adotado](#2-escopo-adotado)
3. [Mapa das etapas](#3-mapa-das-etapas)
4. [As etapas](#4-as-etapas)
5. [Como o sistema de design cresce](#5-como-o-sistema-de-design-cresce)
6. [Trilhas paralelas](#6-trilhas-paralelas)
7. [Pontos sem retorno](#7-pontos-sem-retorno)
8. [Pendências que bloqueiam etapas](#8-pendências-que-bloqueiam-etapas)

---

## 1. Princípios de ordenação

Cinco regras produziram a ordem da seção 3. Quando uma etapa parecer fora de lugar, a razão está aqui.

**1. Primeiro o que custa migração.** Constraint de exclusão, RLS, dois papéis de banco e o modelo de `agendamento_itens` (decisão 31) são as únicas escolhas cujo erro só aparece com dado de cliente real e cobra reescrita. Vêm antes de qualquer tela. As três primeiras etapas não produzem interface e parecem lentas — são a única parte em que ir devagar é ir rápido.

**2. Domínio antes de infraestrutura de aplicação.** O motor de disponibilidade e a máquina de estados são funções puras (5.2 do stack). Escrevê-los antes do Fastify significa escrevê-los sem a tentação de deixar um `select` escapar para dentro deles — que é exatamente como `packages/dominio` deixa de rodar no browser.

**3. Sistema de design cedo, mas em dois tempos.** Os tokens custam pouco e destravam tudo; construir quarenta componentes antes de existir tela é o erro clássico. A fundação entra na etapa 4, e o resto cresce puxado por tela (seção 5).

**4. Autenticação antes das telas que dependem dela.** O painel precisa de usuário, papel e vínculo reais para sair do mock. Deixar auth para o fim significa construir tudo contra dados falsos e descobrir os problemas de uma vez só.

**5. Uma funcionalidade completa cedo, para validar as abstrações.** A etapa 7 é a primeira que atravessa contrato, caso de uso, repositório, hooks e formulário. Só depois dela se sabe se `Campo`, o cliente ts-rest e as key factories estão certos. Construir três funcionalidades antes disso multiplica o retrabalho por três.

---

## 2. Escopo adotado

O MVP é o da seção 11 do funcional, com os dois adiamentos propostos em 12.1 do stack:

| Adiado | Por quê | Custo de adicionar depois |
|---|---|---|
| Login com Google (decisões 20 e 22) | E-mail e senha cobre 100% do caso de uso | Uma linha no enum `provedores`, uma rota, um botão. `identidades_externas` já existe no esquema |
| Offline-first no painel (9.7) | É a parte mais difícil de acertar e a que menos bloqueia o lançamento | Trocar a configuração do TanStack Query e adicionar a whitelist de persistência (7.3 do stack). Nenhuma migração |

Ambas as aplicações nascem **network-first**, com service worker registrado e instaláveis. O PWA entra; o cache offline da agenda, não.

**Não adiados, e o registro de por quê:** múltiplos serviços por agendamento (decisão 31 — migrar de 1:1 para 1:N depois atinge motor, snapshots, caixa e relatórios ao mesmo tempo) e o worker (sem ele não sai lembrete, e lembrete é metade do valor percebido do produto).

**Tema escuro** fica fora, com os tokens semânticos prontos para recebê-lo (D15).

---

## 3. Mapa das etapas

| # | Etapa | Entrega | Não produz tela |
|---|---|---|:-:|
| 0 | Fundação do repositório | Monorepo, Docker Compose, CI, regras executáveis | ● |
| 1 | Banco, isolamento e concorrência | Esquema, RLS, dois papéis, `EXCLUDE` | ● |
| 2 | `packages/dominio` | Motor de slots, transições, permissões, tempo, dinheiro | ● |
| 3 | Contratos e casca da API | Zod + ts-rest, Fastify, plugins, `Contexto`, transação | ● |
| 4 | **Sistema de design: fundação** | Tokens, playground, marca, primeiro lote de primitivos | |
| 5 | Autenticação e sessão | Usuários, vínculos, sessões, convite, e-mail | |
| 6 | Casca do painel | Rotas, layout, guarda, permissão, cache por estabelecimento | |
| 7 | Configuração, catálogo, equipe e horários | A primeira funcionalidade completa, ponta a ponta | |
| 8 | Onboarding | Wizard de cinco passos, com link e QR ao final | |
| 9 | Agenda do painel | Nove transições, quatro estados temporais, bloqueio em dois toques | |
| 10 | Clientes | Cadastro, busca, histórico, bloqueio, reconciliação | |
| 11 | Aplicação pública | Fluxo de sete etapas, marca do tenant, token de gestão | |
| 12 | Worker, notificações e e-mail | pg-boss, outbox, lembretes, expiração, expurgo | |
| 13 | Caixa e Resumo | Livro append-only, estorno, três blocos, CSV | |
| 14 | PWA e acabamento | Instalável nas duas, acessibilidade, telas de erro | |

**Caminho mínimo para uma demonstração ponta a ponta:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 11. Ao final da 11, um gestor cria a conta, sai do onboarding com um link, e um cliente agenda por ele. É o menor conjunto que prova o produto, e vale como marco intermediário — sem caixa, sem lembrete, sem relatório.

---

## 4. As etapas

### Etapa 0 — Fundação do repositório

**Entrega.** Monorepo pnpm + Turborepo com `apps/` e `packages/` da seção 4.1 do stack, mais `apps/playground` (D9). TypeScript `strict`, Biome, `docker-compose.yml` com PostgreSQL 18 e Mailpit. `config.ts` com validação de ambiente por Zod. CI rodando lint, `tsc --noEmit`, testes e build em todo PR.

**As três regras executáveis nascem aqui**, vazias mas ligadas, porque adicioná-las depois significa corrigir violações acumuladas em vez de preveni-las:

- fronteira de `packages/dominio` — nenhum import fora de `luxon` (T25)
- nenhum hex fora de `primitivos.css` (D14)
- `packages/ui` não importa de `apps/`, e funcionalidade não importa de funcionalidade (T16)

**Pronto quando:** `pnpm dev` sobe Postgres e Mailpit; o CI passa em um PR vazio; e uma violação deliberada de cada uma das três regras quebra o build.

---

### Etapa 1 — Banco, isolamento e concorrência

**Entrega.** Esquema Drizzle completo da seção 8 do funcional — todas as tabelas, índices, checks e chaves únicas parciais. Extensão `btree_gist`. A constraint `EXCLUDE USING gist` de 8.5. Policies RLS em toda tabela de tenant, inclusive nas de junção. Os dois papéis de banco de 9.6, com GRANTs distintos, expostos como `poolGestor` e `poolPublico`. Seed com dois estabelecimentos.

**Pronto quando:** os dois testes de 10.1 do stack passam no CI, sobre PostgreSQL real via Testcontainers.

1. **Leitura cruzada** — dois tenants, `set_config` apontando para o primeiro, consulta ao segundo. Deve retornar vazio, não erro.
2. **Corrida no mesmo slot** — duas inserções concorrentes na mesma faixa do mesmo profissional. Uma commita; a outra recebe `23P01`, traduzido em `SLOT_OCUPADO` pelo repositório (T12).

**Por que os dois aqui, e não mais tarde.** São de nível SQL: não dependem de caso de uso, rota ou tela. Antecipá-los fecha os dois riscos de migração do projeto na primeira semana, que é exatamente o que a decisão 41 e a 34 pedem. Também vale verificar aqui, e não na contratação da hospedagem, que `CREATE EXTENSION btree_gist` funciona — é a única restrição herdada da pendência T-a.

---

### Etapa 2 — `packages/dominio`

**Entrega.** As sete pastas de 5.1 do stack:

- `disponibilidade/` — `calcularSlots` e `diasComVaga`, com a separação entre carregar e calcular de 5.2. As duas partem da mesma função; muda só o critério de parada (6.4)
- `agendamento/` — `TRANSICOES` como dado, guardas, `acoesDisponiveis` (7.8)
- `permissoes/` — a matriz de 2.3 como constante, com escopo `GLOBAL` / `PROPRIOS` (decisão 33)
- `tempo/` — conversão de grade local para UTC por data, com Luxon (6.3, 9.4)
- `dinheiro/` — centavos e formatação BRL (8.1, 9.2)
- `erros/` — `ErroDominio` e a lista de códigos
- `portas/` — as cinco interfaces da seção 3 do stack

**Pronto quando:** os cinco casos de 10.2 do stack estão cobertos — DST com dias de 23 e 25 horas, folga excedendo a janela nos dois valores da configuração, agendamento com 1 e com 5 itens com override por profissional, grade com múltiplos intervalos no mesmo dia, e as duas semânticas de vigência de 6.5. Zero I/O, e o script de fronteira passando.

---

### Etapa 3 — Contratos e casca da API

**Entrega.** `packages/contratos` com os schemas Zod e o contrato ts-rest. `apps/api` com Fastify, `fastify-type-provider-zod`, os quatro plugins de 6.1 do stack, `unidadeDeTrabalho`, `pino`, e as implementações locais das cinco portas.

**Fecha a pendência D-b.** O formato de erro precisa carregar erros por campo antes do primeiro formulário, ou o mapeamento é reescrito em cada tela. É uma decisão de contrato, e este é o momento dela.

**Pronto quando:** uma rota real atravessa o caminho de 6.3 do stack — autenticação (ainda stub), `Contexto` montado, `set_config` transaction-local, caso de uso, repositório recebendo o executor, e `ErroDominio` traduzido em status HTTP pelo único plugin que conhece HTTP.

---

### Etapa 4 — Sistema de design: fundação

**Entrega.** Toda a seção 2 do `sistema-de-design.md`: as três camadas de token, `@theme inline`, densidade por atributo. `apps/playground` com a barra de tema, densidade e `cor_tema`, e as rotas `/tokens`, `/primitivos` e `/marca`. `derivarPaleta`, `ProvedorMarca` e `SeletorCorMarca`. `ui/icones`. Inter auto-hospedada.

Mais o **lote de fundação** do inventário (6.1 e 6.2 do sistema de design): `Botao`, `BotaoIcone`, `Campo`, `Entrada`, `AreaTexto`, `Selecao`, `Alternancia`, `Caixa`, `Selo`, `Cartao`, `Aviso`, `Dialogo`, `Esqueleto`, `Separador`, `Avatar`, `CabecalhoTela`, `ListaVazia`, `BarraDeAcoes`.

**Pronto quando:** cada componente do lote aparece em `/primitivos` com todas as variantes × os sete estados de 4.3, nas duas densidades (D10); `/marca` avisa corretamente ao receber `#FFFF00` e ao receber `#FFFFFF`; e a auditoria de contraste AA passa nos dois temas.

**Deliberadamente para aqui.** O resto do inventário não é construído nesta etapa — é puxado pelas etapas 7, 9, 8 e 11, conforme a seção 5. Essa é a mitigação concreta do risco de 1.3 do sistema de design.

---

### Etapa 5 — Autenticação e sessão

**Entrega.** `usuarios`, `vinculos`, `sessoes`. argon2id. Sessão opaca em tabela, com hash armazenado (T19), cookie no domínio pai com `HttpOnly`, `Secure` e `SameSite=Lax` (10.6). Convite de equipe por token, com `vinculos` nascendo `CONVIDADO` (10.2). Recuperação de senha. `EnviadorEmail` sobre Mailpit, com templates em React Email. Plugin de autenticação real, resolvendo usuário, vínculo e papel. A porta `CanalOtp` com a implementação `LOG`, atrás de variável de ambiente e **ausente do artefato de produção** (10.4, decisão 30).

Sem Google (seção 2).

**Pronto quando:** cadastro → verificação de e-mail → sessão de 30 dias funciona; revogar uma linha de `sessoes` derruba o acesso imediatamente; o convite de equipe fecha o ciclo até `ATIVO`; e os e-mails aparecem no Mailpit.

---

### Etapa 6 — Casca do painel

**Entrega.** `apps/painel` com Vite, TanStack Router e TanStack Query. Layout de navegação nas duas larguras. Guarda de rota. `ControlePermissao` lendo a matriz de `packages/dominio` — para esconder ação, nunca para autorizar (5.4 do stack). Tratamento global de erro e error boundary. `useParametrosTabela`, com filtro, ordenação e página **na URL**.

**Seletor de estabelecimento.** `vinculos` tem chave única em `(usuario_id, estabelecimento_id)`, ou seja, o gestor pode ter vínculo com mais de um. O seletor aparece quando há mais de um e some quando há um só.

**Consequência que precisa ser garantida por construção, não por disciplina:** `estabelecimentoId` entra no `queryKey` de **toda** listagem escopada, através de key factories por funcionalidade. Sem isso, trocar de estabelecimento mostra dados em cache do anterior — bug silencioso e caro de achar depois. E nunca `queryClient.clear()` ao trocar: com o id na chave, cada estabelecimento já é uma entrada distinta, e voltar é instantâneo. `clear()` fica reservado ao logout.

**O estado da tabela na URL é decisão desta etapa, não da etapa 13.** O gestor filtra o caixa, abre um lançamento, volta — e espera o filtro ainda estar lá. Ele copia o link e manda para o contador. Ele dá F5. Nada disso funciona com o estado em `useState`, e retrofitar depois é mexer em toda tela de listagem.

**Pronto quando:** rota protegida redireciona e volta para a origem após o login; trocar de estabelecimento não vaza cache; uma permissão ausente esconde a ação; e um filtro sobrevive ao F5.

---

### Etapa 7 — Configuração, catálogo, equipe e horários

**A etapa que valida as abstrações.** É a primeira que atravessa contrato, caso de uso, repositório, hooks, formulário e tabela. Qualquer atrito aqui é defeito de abstração das etapas 3, 4 e 6, e é mais barato corrigir agora.

**Entrega.**

- **Configurações do tenant** — nome, slug, segmento, fuso, logo, `cor_tema` com `SeletorCorMarca`, telefone e endereço públicos
- **Políticas** — as doze chaves de `configuracoes` (8.2), com `Alternancia` e `Passo`
- **Catálogo** — `categorias_servico` e `servicos`, com `exibicao_valor` nos quatro modos, cor, ordenação e ativo/inativo
- **Equipe** — `profissionais` nas três combinações de 2.4, `profissionais_servicos` com override de duração e valor, convite de usuário
- **Horários** — grade semanal com múltiplos intervalos por dia, versionada por vigência (6.5), mais `excecoes_agenda` dos dois tipos

**Regra de 6.3 a implementar aqui:** desativar profissional ou serviço com agenda futura é **bloqueado** até resolver, oferecendo transferência em lote ou cancelamento com notificação.

**Lote de componentes puxado:** `EntradaMascarada`, `EntradaMoeda`, `EntradaHora`, `Passo`, `SeletorCor`, `Abas`, `Acordeao`, `MenuSuspenso`, `Tabela`, `Paginacao`, `Confirmacao`, `ResumoDeValor`.

**Pronto quando:** um profissional autônomo configura um horário e um serviço, e a rota de disponibilidade já devolve slots corretos para os próximos dias.

---

### Etapa 8 — Onboarding

**Entrega.** O wizard de cinco passos de 4.1: dados do negócio → horário de trabalho → primeiro serviço → bloqueios já conhecidos (pulável) → link e QR code. Criação automática do registro em `profissionais` vinculado ao proprietário (decisão 4). Sugestão de `janela_agendamento_dias` por segmento (6.6).

**Lote puxado:** `Progresso`, `Passos`.

**Pronto quando:** uma conta nova sai do wizard com um link público funcional. Esse é o critério literal do funcional, e ele não pode ser cumprido pela metade — o link tem que abrir e mostrar o catálogo, o que amarra esta etapa à 11.

**Por que aqui, e não depois do público.** O onboarding é o consumidor mais exigente da etapa 7: passa por configuração, horário e serviço em cinco telas seguidas. Se alguma dessas telas ficou difícil de compor, o wizard revela imediatamente.

---

### Etapa 9 — Agenda do painel

A tela mais densa do produto.

**Entrega.**

- Lista cronológica do dia (padrão mobile) e grade semanal (desktop)
- `CartaoAgendamento` renderizando botões a partir de `acoes_disponiveis` vindo do servidor (7.8), **sem replicar a regra no cliente**
- Os quatro estados temporais de 5.8, derivados do relógio na renderização — sem campo, sem estado, sem transição (decisão 45)
- Contadores de pendentes de fechamento e de solicitações aguardando, no topo (5.6)
- As nove transições de 7.2, cada uma respeitando papel e guarda
- Criação manual com múltiplos serviços; remarcação na ordem exata de 5.4; encaixe com confirmação explícita e marcação visual
- **Bloqueio de dia em dois toques**, com `ResolucaoEmLote` e "cancelar todos e avisar" como ação primária (5.9)
- Transferência individual no card (decisão 44)

**Lote puxado:** `Combo`, `SeletorData`, `FolhaInferior`, `Popover`, `PainelLateral`, `Dica`, `GradeDeHorarios`, `CalendarioDeDisponibilidade`.

**Pronto quando:** as nove transições estão acessíveis pela interface e recusam corretamente quem não tem papel; e bloquear o dia com doze agendamentos leva dois toques e uma confirmação, no celular.

---

### Etapa 10 — Clientes

**Entrega.** Cadastro, busca por nome ou telefone, histórico, observações internas e bloqueio com motivo. A reconciliação de 8.3.1: buscar por `(estabelecimento_id, telefone)`, **nunca sobrescrever o nome**, exibir "informado: {nome}" no card quando divergir, e registrar a divergência em auditoria.

**Pronto quando:** um cliente bloqueado é recusado no fluxo público com mensagem genérica — sem revelar que existe bloqueio — e o gestor recebe notificação da tentativa; e o gestor consegue agendar para ele pelo painel, com confirmação explícita.

---

### Etapa 11 — Aplicação pública

**Entrega.** `apps/publico` em Next.js App Router. `middleware.ts` resolvendo o slug do subdomínio. `layout.tsx` resolvendo o tenant uma vez e injetando a paleta derivada no servidor, sem lampejo de cor errada (2.3 do sistema de design). Home do tenant como Server Component. Manifest dinâmico por tenant (9.7, decisão 15).

O fluxo de sete etapas de 5.1, com:

- **Etapa 1** — toque único que avança, e "adicionar outro serviço" como ação secundária quando `permite_multiplos_servicos`. Nunca uma lista de caixas de seleção com botão continuar
- **Etapa 2** pulada quando há um só profissional elegível; "qualquer profissional" com a união das disponibilidades (6.3)
- **Etapas 3 e 4** — disponibilidade sempre buscada no cliente, `staleTime: 0`, nunca Server Component com revalidação (T15). É a regra mais fácil de violar por omissão no App Router
- **Etapa 5** — identificação só aqui (decisão 16); nome, telefone e e-mail obrigatórios (decisão 35)
- **Etapa 6** — revisão com duração e valor totais, tratando `A_PARTIR_DE` e `OCULTO` (9.2), e a política de cancelamento
- **Etapa 7** — link de gestão, `.ics`, e sugestão de instalar na tela de início

Mais `agendamento/[token]` com cancelamento self-service dentro do prazo, nunca por `GET` (10.7), e o deep link `?servicos={slug},{slug}`.

**Colisão de slot:** a constraint recusa, e a interface devolve o cliente à etapa 4 com a lista já atualizada, informando que o horário acabou de ser ocupado (5.1).

**Lote puxado:** `Radio`, `Etiqueta`, `SeletorDeServicos`.

**Pronto quando:** o link gerado no onboarding leva a um agendamento gravado; a colisão devolve à etapa 4 sem erro genérico; e a página é instalável com o nome, o ícone e a cor do tenant.

---

### Etapa 12 — Worker, notificações e e-mail

**Entrega.** `worker.ts` como processo separado, do mesmo Dockerfile e importando os mesmos casos de uso (T10). pg-boss com as três frequências de 3.5. Os nove templates de 7.6 em React Email. A tarefa de minuto drenando `notificacoes` com `agendada_para` vencido — o outbox de 6.5 do stack.

- Ao sair de um estado ativo, os lembretes futuros são marcados `CANCELADA`. **Lembrete de consulta cancelada é a falha que mais gera reclamação neste tipo de sistema**, e é a única linha desta etapa que precisa de teste dedicado
- Expiração de `AGUARDANDO` em 24h reusando `transicionar` com `origem: SISTEMA` (5.7)
- Expurgo diário de `codigos_verificacao` e de `auditoria` fora dos 24 meses (decisão 42)
- O link de reagendamento em `cancelado_pelo_estabelecimento`, com os mesmos serviços pré-selecionados (5.9)

Os textos, assuntos, variáveis e regras de cada template estão em `conteudo-e-microcopia.md`, seção 3 — inclusive o décimo, `tentativa_cliente_bloqueado`, exigido por 8.3.1 e ausente da tabela de 7.6.

**Pronto quando:** o lembrete de 24h sai; cancelar marca os lembretes futuros como `CANCELADA`; e uma solicitação não decidida expira em 24 horas, notificando as duas partes.

---

### Etapa 13 — Caixa e Resumo

**Entrega.**

- `lancamentos` **append-only**, sem `UPDATE` e sem exclusão. A única mutação permitida no livro é preencher `estornado_por_lancamento_id` uma vez (7.4)
- Conclusão de atendimento criando o lançamento, com valor previsto editável no ato (5.2)
- Estorno como linha de sinal contrário, com `quantidade` **também** negativa — senão a contagem de atendimentos não fecha enquanto o valor fecha (7.5)
- `data_lancamento` recebendo `date(inicia_em)` no fuso do tenant, nunca a data da conclusão
- Lista do caixa exibindo o **líquido** com marcador de "corrigido", e as linhas componentes atrás de um toque (7.4)
- Lançamento manual nas duas abas de 5.3, com a restrição de um `TOTAL_DIA` por data e profissional
- **Resumo** — os três blocos de 9.8, com o terceiro aparecendo só com dois ou mais profissionais ativos
- Exportação CSV de `lancamentos`, `agendamentos` e `agendamento_itens`, com colunas cruas

**A regra de 9.1 é a de maior risco do sistema:** métrica operacional vem de `agendamentos`; faturamento vem de `lancamentos`, somando **todas** as linhas do período, sem filtro. Misturar as duas origens produz um número silenciosamente errado. Na interface, as áreas se chamam **Agenda** e **Caixa**, e todo relatório financeiro mostra quanto veio de dentro e quanto veio de fora do sistema.

**Pronto quando:** reabrir um atendimento concluído gera o estorno e o extrato mostra o líquido correto; a soma sem filtro fecha com o total exibido; e o CSV abre no Excel com os acentos certos.

---

### Etapa 14 — PWA e acabamento

**Entrega.** `vite-plugin-pwa` no painel e Serwist no público. Network-first nas duas (seção 2). Instalabilidade verificada nos dois. Telas de 403, 404 e 500. Revisão de acessibilidade do playground contra as telas reais — teclado, foco, contraste sobre a rampa derivada, `aria-live` na lista de slots.

**Pronto quando:** ambas instalam; o público instala com a marca do tenant; e uma passada completa por teclado atravessa o fluxo de agendamento e a agenda do dia sem armadilha de foco.

---

## 5. Como o sistema de design cresce

Esta tabela é o mecanismo que mantém o inventário honesto (D11). A etapa 4 entrega a fundação; o resto entra **quando existe tela esperando**.

| Etapa | Componentes que ela puxa |
|---|---|
| 4 | `Botao`, `BotaoIcone`, `Campo`, `Entrada`, `AreaTexto`, `Selecao`, `Alternancia`, `Caixa`, `Selo`, `Cartao`, `Aviso`, `Dialogo`, `Esqueleto`, `Separador`, `Avatar`, `CabecalhoTela`, `ListaVazia`, `BarraDeAcoes`, `derivarPaleta`, `ProvedorMarca`, `SeletorCorMarca` |
| 7 | `EntradaMascarada`, `EntradaMoeda`, `EntradaHora`, `Passo`, `SeletorCor`, `Abas`, `Acordeao`, `MenuSuspenso`, `Tabela`, `Paginacao`, `Confirmacao`, `ResumoDeValor` |
| 8 | `Progresso`, `Passos` |
| 9 | `Combo`, `SeletorData`, `FolhaInferior`, `Popover`, `PainelLateral`, `Dica`, `GradeDeHorarios`, `CalendarioDeDisponibilidade` |
| 11 | `Radio`, `Etiqueta` |

**A regra de entrada é a mesma em toda etapa:** o componente nasce em `packages/ui`, aparece no playground com os sete estados nas duas densidades, e só então é usado na tela. Nascer na tela e "subir depois" é como a API acaba moldada pelo primeiro caso de uso.

**As quatro telas de referência de `/telas`** (5.1 do sistema de design) são montadas à medida que as peças existem: a 1 e a 2 na etapa 9, quando o calendário e a grade de horários ficam prontos; a 3 na etapa 9; a 4 na etapa 13.

---

## 6. Trilhas paralelas

Não são etapas. São coisas que acompanham todas elas, e que degradam silenciosamente se virarem "uma fase no fim".

| Trilha | Regra |
|---|---|
| **Teste de domínio** | Escrito junto com a função, na etapa 2 e sempre que o domínio crescer. Sem banco, rápido, e é onde vive a maior parte da confiança do sistema |
| **Teste de integração** | Todo caso de uso que abre transação e atravessa dois repositórios ganha um teste com Testcontainers. Os dois da etapa 1 nunca saem do CI |
| **Playwright** | Dois fluxos apenas: o agendamento público de ponta a ponta (etapa 11) e o fechamento de um atendimento no painel (etapa 13). Mais que isso, em projeto de um desenvolvedor, custa mais manutenção do que entrega |
| **Auditoria** | Gravada **em toda transição, sem exceção** (7.7), desde a etapa 9. Adicionar depois deixa um buraco no histórico que nunca se preenche |
| **Log estruturado** | `pino` desde a etapa 3, com correlação por `AsyncLocalStorage` — para log, nunca para transportar tenant (T13) |
| **Acessibilidade** | Critério de pronto de cada componente (4.5 do sistema de design), não uma revisão na etapa 14. A etapa 14 confere; não conserta |

---

## 7. Pontos sem retorno

Decisões cuja reversão custa migração ou varredura ampla. Cada uma já está decidida nos documentos de origem; a lista existe para que nenhuma seja adiada "para simplificar agora".

| Ponto | Etapa | Custo de reverter depois |
|---|---|---|
| `EXCLUDE USING gist` e `btree_gist` | 1 | Duplo agendamento em produção, e a alternativa é lock pessimista em todo o motor |
| RLS com `set_config` transaction-local | 1 | Vazamento entre tenants, silencioso. Descoberto pelo cliente |
| `agendamento_itens` de 1 a 5 (decisão 31) | 1 | Atinge motor, snapshots, caixa e relatórios ao mesmo tempo |
| `lancamentos` append-only (decisão 38) | 1 e 13 | Todo relatório passa a precisar de um filtro que alguém vai esquecer |
| Tokens semânticos, componente sem primitivo (D2) | 4 | Varredura em todos os componentes das duas aplicações |
| `Contexto` explícito como primeiro parâmetro (T13) | 3 | Toda assinatura de caso de uso |
| Estado da tabela na URL | 6 | Toda tela de listagem |
| `estabelecimentoId` no `queryKey` | 6 | Bug de cache cruzado, intermitente e difícil de reproduzir |

---

## 8. Pendências que bloqueiam etapas

**Nenhuma pendência bloqueia mais uma etapa.** As oito que bloqueavam foram resolvidas: o contrato de erro em `definicao-stack.md` 6.10; tipografia, estados vazios, ícone do PWA e logo do tenant em `sistema-de-design.md` 2.4, 2.8 e 6.5; templates e microcópia em `conteudo-e-microcopia.md`; e-mail, hospedagem, TLS, backup, observabilidade e migração em `operacao.md`.

O que sobrou são verificações e calibragens, nenhuma delas capaz de parar uma etapa.

| Quando | Item | Origem |
|---|---|---|
| Etapa 1 | Confirmar `CREATE EXTENSION btree_gist` — no Postgres local, e depois no provedor, quando houver um | O-a |
| Etapa 4 | Medir as métricas do fallback tipográfico — `size-adjust` e overrides, contra a Inter | D-g |
| Etapa 7 | Calibrar o limiar de luminância do aviso de logo clara, com logos reais | D-h |
| Antes do lançamento | Conta separada para o bucket de backup; endereço e leitor dos relatórios DMARC | O-b, O-c |
| Fase 2 | Provedor de mensagens e cota por plano; coluna de fundo da logo, se o aviso não bastar | Funcional 3 e 4, D-i |

**A hospedagem não precisa ser escolhida agora, e não bloqueia nada até a etapa 14** (`operacao.md`, 2.5). As etapas 0 a 13 rodam inteiras contra o `docker-compose.yml`, e nenhuma linha de código muda conforme o provedor: as cinco portas da seção 3 do stack e a regra de T26 tornam a troca uma questão de implementação.

O que precisa estar valendo desde já são **dois filtros negativos**, não uma escolha: nada de serverless por função — incompatível com pool, com a variável de sessão do RLS e com o pg-boss — e nada de Postgres que proíba extensões. Fora isso, a decisão fica aberta sem custo.

O piso arquitetural do PostgreSQL, aliás, é **15**, não 18 (`operacao.md`, 1.1). Era a restrição que mais estreitava a escolha, e ela é bem mais frouxa do que parecia.
