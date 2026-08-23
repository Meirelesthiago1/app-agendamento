# Sistema de Agendamento Multi-Tenant — Operação e Infraestrutura

**Versão 1.0**

Onde o sistema roda, como sobrevive a uma falha e como muda sem parar.

**Entradas obrigatórias:** `planejamento-agendamento.md` (v1.4) e `definicao-stack.md` (v1.1). Referências: `(9.6)` aponta para o funcional, `(T8)` para o stack.

**Encerra** as pendências T-a a T-e do stack e a pendência 5 do funcional (provedor de e-mail).

**Referência de mão única.** Este cita os anteriores; nenhum cita este. Trocar de provedor nunca exige nova versão de nenhum outro documento — e essa portabilidade é justamente o que as cinco portas da seção 3 do stack compraram.

---

## Sumário

1. [As restrições herdadas](#1-as-restrições-herdadas)
2. [Hospedagem](#2-hospedagem)
3. [Domínios e TLS](#3-domínios-e-tls)
4. [Backup e restauração](#4-backup-e-restauração)
5. [E-mail transacional](#5-e-mail-transacional)
6. [Observabilidade](#6-observabilidade)
7. [Migração em produção](#7-migração-em-produção)
8. [Ambientes e variáveis](#8-ambientes-e-variáveis)
9. [Decisões registradas](#9-decisões-registradas)

---

## 1. As restrições herdadas

A arquitetura impõe cinco condições à escolha de plataforma. Elas eliminam mais opções do que preço ou preferência.

| # | Restrição | Origem | Elimina |
|---|---|---|---|
| 1 | PostgreSQL com `btree_gist` | 8.5, T-a | Bancos gerenciados que não permitem extensões |
| 2 | **Processo persistente** para API e worker | 6.9, T22 | Serverless por função — sem pool, sem variável de sessão, sem pg-boss de longa duração |
| 3 | TLS curinga em `*.dominio.com` | Decisão 15, T-b | Plataformas sem certificado curinga ou sem DNS-01 |
| 4 | Uma instância da API enquanto cache e rate limit forem em memória | T22 | Autoescalonamento horizontal ligado por padrão |
| 5 | Latência baixa para o Brasil | Mercado nacional, decisão 28 | Regiões fora de São Paulo, na prática |

### 1.1 Uma correção útil sobre a restrição 1

O stack fixa **PostgreSQL 18 ou superior** e atribui isso a duas necessidades: `btree_gist` e `security_invoker` em views (2.5 do stack).

As duas têm pisos bem mais baixos. `btree_gist` é módulo `contrib` disponível em todas as versões suportadas, e `security_invoker` em views existe desde o **PostgreSQL 15**. O piso real da arquitetura é, portanto, **15**, não 18.

Isso não muda a preferência — versão nova é melhor, e a recomendação continua sendo a mais recente disponível no provedor. Muda o que acontece quando o provedor escolhido ainda oferece 16 ou 17: **não é um bloqueio**, e não deve ser tratado como tal na hora de contratar. Era a restrição que mais estreitava a decisão, e ela é mais frouxa do que parecia.

O que **precisa** ser verificado antes de contratar continua sendo um comando só, e vale rodá-lo na etapa 1, não na etapa 14:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

---

## 2. Hospedagem

> **Nada aqui precisa ser contratado agora.** O que esta seção fecha é o *formato* da hospedagem e os filtros que a decisão precisa respeitar — não a assinatura de um contrato. As etapas 0 a 13 rodam inteiras contra o `docker-compose.yml`, e nenhuma linha de código muda conforme o provedor. Ver 2.5.

### 2.1 A recomendação

| Peça | Escolha | Região |
|---|---|---|
| Banco | **Neon** (PostgreSQL gerenciado) | São Paulo |
| API e worker | **Fly.io**, dois processos do mesmo Dockerfile | GRU |
| Armazenamento (porta `Armazenamento`) | **Cloudflare R2** | — |
| DNS | **Cloudflare** | — |

**Verificar na contratação, não presumir:** a região São Paulo e a versão do PostgreSQL oferecida por Neon, e a disponibilidade de GRU no plano escolhido do Fly. Ambas mudam com o tempo, e nenhuma delas é bloqueante à luz de 1.1 — mas descobrir tarde custa uma migração de dados.

### 2.2 Por que assim

**Banco gerenciado, e não Postgres em container.** Point-in-time recovery e atualização de versão são as duas coisas que não se quer estar aprendendo às três da manhã com dado de cliente dentro. É o único item da infraestrutura em que pagar é claramente mais barato que operar.

Neon especificamente por dois motivos que importam para um desenvolvedor sozinho: **branch de banco por pull request**, que torna testar uma migração contra dados realistas uma operação de segundos; e o pooler em modo `transaction`, que é exatamente o modo em que `set_config(..., true)` funciona (T5) — o isolamento entre tenants não precisa de configuração especial.

O scale-to-zero do Neon, que costuma ser a objeção, não se aplica aqui: o worker mantém conexão permanente (6.9), então o banco nunca dorme.

**Fly.io para a aplicação.** A restrição 2 exige processo persistente, o que já elimina a maior parte das plataformas modernas. O Fly resolve os dois processos com o mesmo artefato, que é literalmente o que 6.9 do stack descreve:

```toml
[processes]
  api    = "node dist/servidor.js"
  worker = "node dist/worker.js"
```

E resolve a restrição 4 sem esforço, porque escalar é explícito: `api` fica em **uma** instância enquanto cache e rate limit forem em memória (T22). Isso precisa estar escrito no `fly.toml` e não em uma lembrança — o dia em que alguém subir a segunda réplica, o rate limit do OTP dobra em silêncio e o cache de disponibilidade passa a discordar de si mesmo.

**R2 para armazenamento** por causa do padrão de acesso: logo de tenant é escrita rara e leitura constante, servida em toda página pública. Egress gratuito é a diferença entre um custo previsível e uma surpresa proporcional ao sucesso.

### 2.3 A alternativa mais barata, registrada

Uma VPS única — Hetzner ou similar — com Docker Compose, Postgres em container e **Caddy** na frente resolve tudo isto por uma fração do custo, e o Caddy ainda faz o certificado curinga sozinho (seção 3). É uma opção legítima, e para o volume do MVP é tecnicamente suficiente.

O que ela custa está inteiro na seção 4: backup, teste de restauração e atualização de versão do Postgres passam a ser trabalho seu, recorrente, e o tipo de trabalho que se adia até o dia em que faz falta. Se o custo do caminho de 2.1 incomodar antes do primeiro cliente pagante, esta é a troca — **mas então a seção 4 deixa de ser configuração e vira rotina agendada**.

### 2.4 O que a arquitetura protege

Nada disto é irreversível, e é bom que seja assim de propósito. Nenhum SDK de plataforma existe fora de `apps/api/src/infra/` (T26), e as cinco portas isolam e-mail, OTP, cache, rate limit e armazenamento. Trocar Fly por outra coisa é trocar um Dockerfile de lugar; trocar R2 por S3 é uma implementação de porta.

O único item com custo real de troca é o banco, e é por isso que ele é o único que merece a verificação de 2.1 antes de assinar.

### 2.5 Quando isso vence

**Etapa 14.** Até lá, nada depende da escolha.

O que está decidido e não deve esperar é o **formato**, não o fornecedor — e o formato já está fixado pela arquitetura, não por esta seção:

| Decidido | Onde |
|---|---|
| Banco gerenciado, não container em produção | O1 |
| Processo persistente para API e worker | 6.9 do stack, restrição 2 |
| Uma instância da API enquanto cache e rate limit forem em memória | T22, O4 |
| Certificado curinga único, não TLS sob demanda | O7 |
| Duas camadas de backup, uma delas fora do provedor | O8 |

**A decisão que precisa estar tomada desde já é negativa**, e são dois filtros:

1. **Nada de serverless por função.** Incompatível com pool de conexão, com a variável de sessão que sustenta o RLS (T5) e com o pg-boss de longa duração. É a armadilha real do conjunto, porque é a escolha moderna por padrão.
2. **Nada de Postgres que proíba extensões.** Sem `btree_gist`, a constraint de exclusão de 8.5 não existe, e com ela vai embora a garantia de que duplo agendamento é impossível.

Fora esses dois filtros, a escolha é livre e reversível: as cinco portas da seção 3 do stack e a regra de T26 fazem com que trocar de plataforma seja trocar implementações, não reescrever.

**O que pode antecipar a decisão não é técnico.** É querer um endereço real — mostrar para alguém, colher opinião, testar a instalação do PWA num celular de verdade. Localhost é isento da exigência de HTTPS, então até isso adia bastante.

---

## 3. Domínios e TLS

### 3.1 O mapa

| Endereço | Aplicação |
|---|---|
| `app.dominio.com` | Painel do gestor |
| `auth.dominio.com` | Autenticação centralizada (10.6) |
| `{slug}.dominio.com` | Página pública de cada tenant |
| `api.dominio.com` | API |
| `envio.dominio.com` | Domínio de envio de e-mail (seção 5) — **não recebe tráfego web** |

### 3.2 Certificado curinga

`*.dominio.com` **exige DNS-01**. O desafio HTTP-01 não emite curinga, e é o primeiro tropeço de quem monta este modelo.

**Decisão: um certificado curinga único, renovado por DNS-01 com token do Cloudflare** escopado a `DNS:Edit` naquela zona e em nenhuma outra.

A alternativa é TLS sob demanda — o Caddy emite um certificado por hostname na primeira requisição. É atraente e tem uma armadilha: sem um endpoint `ask` que valide que o slug existe, qualquer pessoa força emissão de certificado apontando um subdomínio inventado, e a conta bate no **limite de 50 certificados por semana por domínio registrado** da Let's Encrypt. Nesse ponto, nenhum tenant novo consegue subir.

O curinga único não tem essa exposição, não cresce com o número de tenants, e cobre `app.`, `auth.` e `api.` no mesmo certificado.

**Uma limitação a conhecer:** o curinga cobre **um nível**. `{slug}.dominio.com` está coberto; `{slug}.publico.dominio.com` não estaria. Isso fecha a porta a subdomínios aninhados por tenant — o que não é um requisito, mas é bom saber antes de alguém propor.

### 3.3 A consequência do cookie no domínio pai

O cookie de sessão vive em `.dominio.com` (10.6), o que significa que **é enviado para toda origem sob esse domínio**, incluindo a página pública de qualquer tenant.

Isso é intencional e é o que faz a sessão do cliente atravessar subdomínios. As duas propriedades que o mantêm seguro:

- O cookie é `HttpOnly`, então nenhum JavaScript de nenhuma origem o lê.
- Tenants controlam **nome, logo e cor** — nunca HTML, JavaScript ou cabeçalho de resposta. Enquanto isso for verdade, uma página de tenant não é um vetor.

**Se algum dia um tenant puder injetar conteúdo próprio** — um campo de descrição que aceite HTML, um script de analytics dele —, esta decisão precisa ser revista antes, não depois. É a linha que separa o modelo atual de um problema sério.

---

## 4. Backup e restauração

### 4.1 Duas camadas, porque protegem de coisas diferentes

| Camada | Cobre | Retenção | RPO |
|---|---|---|---|
| PITR do provedor | Falha do banco, `DELETE` acidental, migração ruim | 7 dias no início; 30 antes do primeiro cliente pagante | Minutos |
| **Dump lógico diário, fora do provedor** (R2) | O provedor sumir, a conta ser encerrada, a região cair | 30 dias | 24 h |

A segunda camada é a que quase ninguém tem, e é a única que responde à pergunta que importa: *se a conta do provedor for encerrada amanhã de manhã, o que sobra?* PITR mora dentro do provedor; um backup que só existe lá dentro não é backup contra o provedor.

O dump é um `pg_dump` no formato custom, cifrado, escrito em um bucket **de outra conta** que não a de produção.

### 4.2 A parte que não é configuração

> **Restauração é testada, não configurada.** Um backup nunca restaurado é uma suposição com nome bonito.

Exercício trimestral, e uma vez antes do primeiro cliente real:

1. Restaurar o dump mais recente em um banco vazio.
2. Aplicar as migrações pendentes.
3. Subir a API contra ele.
4. **Rodar o teste de leitura cruzada** (10.1 do stack) — porque um restore que perde as policies de RLS restaura os dados e destrói o isolamento, em silêncio.
5. Anotar quanto tempo levou.

O passo 4 é o que torna este exercício diferente de "o dump abriu". Papéis, GRANTs e policies são exatamente o que um restore mal parametrizado deixa para trás.

**RTO alvo: 4 horas.** Não é ambicioso de propósito — é um número que dá para cumprir sozinho, e um RTO que não se cumpre é pior que nenhum.

### 4.3 O que fica de fora, deliberadamente

- `codigos_verificacao` — efêmero, expurgado diariamente (decisão 42). Perder é irrelevante.
- Logos em R2 — não entram no dump. Ficam cobertas por **versionamento de objeto no bucket**, que é a ferramenta certa para isso.
- `auditoria` além de 24 meses — já expurgada por política.

---

## 5. E-mail transacional

Encerra a pendência 5 do funcional. **Crítico no MVP**, não na fase 2: sem ele o convidado não recebe o `token_gestao` e perde o acesso ao próprio agendamento (decisão 35).

### 5.1 Provedor

**Resend.** O plano gratuito cobre o volume inicial com folga, e o React Email — já escolhido no stack (2.3) — é do mesmo time, então o template renderizado é o template enviado, sem uma etapa de conversão no meio.

A alternativa é **Amazon SES**: bem mais barato em escala, e bem mais trabalho — sair do sandbox, montar o tratamento de bounce e de reclamação, cuidar da reputação do IP. A troca compensa em volume alto, e é uma implementação da porta `EnviadorEmail`, não uma migração.

Em desenvolvimento nada muda: **Mailpit cobre o ciclo inteiro** (T21). Esta decisão bloqueia o lançamento, não a etapa 5.

### 5.2 Domínio de envio

**Subdomínio dedicado: `envio.dominio.com`.** Nunca o domínio raiz.

O motivo é isolamento de reputação. Se o transacional tiver um problema de entrega — um pico de bounce, uma denúncia —, o estrago fica contido naquele subdomínio e não contamina o e-mail corporativo do domínio principal. O caminho inverso também vale.

### 5.3 SPF, DKIM e DMARC

Os três, no subdomínio de envio. Faltando qualquer um, o Gmail entrega em spam e o cliente jura que "o sistema não mandou e-mail".

| Registro | Valor | Observação |
|---|---|---|
| SPF | `v=spf1 include:<provedor> -all` | `-all`, não `~all`. Meio-termo não protege |
| DKIM | Chave de 2048 bits fornecida pelo provedor | Duas chaves publicadas, para permitir rotação sem janela de falha |
| DMARC | `v=DMARC1; p=none; rua=mailto:dmarc@dominio.com` | **Começa em `p=none`** |

**A progressão do DMARC importa e é onde as pessoas se apressam.** `p=none` durante duas semanas, lendo os relatórios agregados. Só depois de duas semanas limpas, `p=quarantine`. `p=reject` antes do primeiro cliente pagante. Publicar `p=reject` no primeiro dia, com o alinhamento ainda errado, derruba os próprios e-mails silenciosamente — e é a falha mais difícil de diagnosticar, porque nada erra no lado do sistema.

**Alinhamento de Return-Path:** o provedor cuida disso quando o subdomínio é delegado a ele. Conferir explicitamente — SPF que passa mas não alinha reprova no DMARC.

### 5.4 Bounce, reclamação e o monitor que importa

`notificacoes` já tem `status` e `erro` (8.6), e é onde a falha é registrada. O webhook do provedor marca `FALHOU` com o motivo.

**Hard bounce não é retentado.** Reenviar para um endereço inexistente queima reputação em troca de nada. Marcar o endereço como inválido em `clientes` exigiria uma coluna nova; na v1, o `FALHOU` em `notificacoes` é suficiente, e a coluna fica como refinamento da fase 2.

**O único alerta de e-mail que precisa existir no MVP:** taxa de `FALHOU` acima do normal em `agendamento_confirmado`. É o e-mail que carrega o `token_gestao` (3.1 do conteúdo), e a falha dele é silenciosa — ninguém reclama de um e-mail que não sabe que deveria ter recebido.

---

## 6. Observabilidade

### 6.1 Log

`pino` estruturado em JSON desde a etapa 3, com `requestId` correlacionado por `AsyncLocalStorage` — **para log, nunca para transportar tenant** (T13).

Em toda requisição: `requestId`, `estabelecimentoId`, `usuarioId`, `rota`, `status`, `duracaoMs`.

**Redação obrigatória**, configurada no `redact` do pino e não deixada à disciplina de quem escreve o log:

```
senha  senha_hash  refresh_token  refresh_token_hash
codigo  codigo_hash          — o OTP em log é acesso a qualquer conta (10.4)
token_gestao                 — um log vazado é acesso a agendamentos
observacoes_internas  motivo — internos por definição (1.1 do conteúdo)
authorization  cookie  set-cookie
```

E-mail e telefone completos não vão em nível `info`. Em `error`, mascarados.

### 6.2 Rastreamento de erro

**Sentry** nas três aplicações, com `tracesSampleRate` baixo — é o único que entrega stack trace de browser com source map sem trabalho de montagem, e é onde o erro do painel de um cliente vira algo diagnosticável.

O mesmo `requestId` do log vai como tag, para que um erro do Sentry leve ao log do servidor em um clique.

### 6.3 Quatro números, e um alerta

Observabilidade completa é desperdício para um sistema de um desenvolvedor. Estes quatro respondem tudo que importa no MVP:

| # | Métrica | Por que ela |
|---|---|---|
| 1 | p95 de `slots` e de `dias_com_vaga` | A query mais cara do sistema, exposta em endpoint público sem autenticação (6.4) |
| 2 | Taxa de `SLOT_OCUPADO` | Se subir, a janela de colisão ficou grande demais e a decisão 34 merece revisão |
| 3 | **`notificacoes` com `status = PENDENTE` e `agendada_para` vencido** | Ver abaixo |
| 4 | 5xx por rota | O básico |

> **A métrica 3 é o alerta mais importante do sistema, e o único que existe no MVP.**
>
> Quando o worker morre, **nada quebra**. A API responde, a agenda abre, o cliente agenda, o gestor trabalha. Só que nenhum lembrete sai, nenhuma solicitação expira e o slot de um pedido esquecido fica bloqueado até a data chegar. A descoberta acontece dias depois, por um cliente que não foi lembrado — e lembrete é metade do valor percebido do produto (12.1 do stack).
>
> A fila crescente é o único sintoma, e é por isso que ela merece o alerta em vez de CPU, memória ou latência.

**Um alerta só, de propósito.** Alertas demais no início treinam a ignorá-los, e aí o que importa também passa batido.

### 6.4 Health check

`/saude` responde com o estado de duas coisas: conectividade com o banco, e **quando o worker executou pela última vez**. A segunda é o que transforma a métrica 3 em algo verificável de fora, inclusive por um monitor externo gratuito.

---

## 7. Migração em produção

Encerra T-e. A política precisa existir **antes do primeiro cliente real**, não depois — depois, ela é escrita sob pressão e com dado de gente dentro.

### 7.1 A regra única

> **Toda migração é compatível com a versão anterior do código.**

O deploy é sempre em duas fases: **migrar, depois trocar o código.** Nunca simultâneo, porque durante a troca as duas versões coexistem por alguns segundos — e uma migração que quebra a versão antiga derruba a aplicação exatamente nesse intervalo.

Isso é *expand and contract*, e as consequências práticas são todas mecânicas:

| Operação | Como |
|---|---|
| Adicionar coluna | Anulável, ou com default. `NOT NULL` só numa **segunda** migração, depois que o código já preenche |
| Renomear coluna | Quatro deploys: adiciona a nova → o código escreve nas duas → backfill → o código lê a nova → remove a antiga. Nunca em um passo |
| Remover coluna | Só depois de um deploy em que nenhum código a referencia |
| Criar índice | `CREATE INDEX CONCURRENTLY`, **fora de transação**. O drizzle-kit gera SQL editável à mão (T4), então isso é editar a migração |
| Backfill de tabela grande | Em lotes, como tarefa do worker, fora da migração. `UPDATE` de tabela inteira dentro de uma migração trava a tabela |

### 7.2 Os dois `timeout` que evitam o desastre

Toda migração começa com:

```sql
SET lock_timeout = '3s';
SET statement_timeout = '30s';
```

Sem `lock_timeout`, uma migração que precisa de `ACCESS EXCLUSIVE` fica esperando atrás de uma transação longa — e, enquanto espera, **enfileira todas as conexões que chegarem depois dela**, porque o pedido de lock exclusivo bloqueia até os `SELECT`. O resultado é a aplicação inteira parada por causa de um `ALTER TABLE` que ninguém achou arriscado.

Com `lock_timeout`, a migração falha em três segundos e é retentada. Falhar rápido é o comportamento correto aqui.

### 7.3 Ensaio

Antes do primeiro cliente real: aplicar uma migração destrutiva contra a cópia restaurada de 4.2, medir o tempo e confirmar que o rollback existe. É o mesmo exercício de restauração, aproveitado — e é a única forma de saber se a política acima é praticável antes de precisar dela.

---

## 8. Ambientes e variáveis

### 8.1 Três ambientes

| Ambiente | Banco | E-mail | OTP |
|---|---|---|---|
| Local | Postgres em Docker Compose | Mailpit | `LOG` |
| Preview (por PR) | Branch do Neon | Mailpit ou modo de captura do provedor | `LOG` |
| Produção | Neon, região São Paulo | Resend | **Nenhum canal ativo na v1** |

### 8.2 A restrição de segurança que precisa ser executável

10.4 do funcional determina que a implementação `LOG` do OTP e qualquer rota que exponha o código **não podem existir no build de produção**. "Atrás de uma variável de ambiente" não basta: uma variável mal configurada em produção vira acesso irrestrito a qualquer conta.

Duas camadas:

1. O módulo `LOG` é importado condicionalmente e **eliminado do bundle** quando `NODE_ENV=production`.
2. O `config.ts` **recusa subir** se `NODE_ENV=production` e o canal de OTP configurado for `LOG`.

A segunda existe porque a primeira depende do bundler estar configurado certo, e isso é o tipo de coisa que se quebra numa atualização sem ninguém notar.

### 8.3 Variáveis

Todas validadas por Zod no boot, e **variável ausente impede o processo de subir** (seção 3 do stack). Falhar no start é melhor que falhar no primeiro cliente.

```
BANCO_URL              DIRETO_BANCO_URL (migração, sem pooler)
BANCO_URL_PUBLICO      role restrito do fluxo público (9.6)
SESSAO_SEGREDO
APP_URL  PUBLICO_DOMINIO_BASE  API_URL  AUTH_URL
EMAIL_PROVEDOR  EMAIL_CHAVE  EMAIL_REMETENTE
OTP_CANAL              recusado como LOG em produção (8.2)
ARMAZENAMENTO_*        endpoint, bucket, chaves
SENTRY_DSN             LOG_NIVEL
```

`DIRETO_BANCO_URL` é separado de propósito: migração não passa pelo pooler em modo `transaction`, porque `CREATE INDEX CONCURRENTLY` e comandos fora de transação não funcionam através dele.

---

## 9. Decisões registradas

Numeração `O`, independente das demais.

**O2, O3 e O5 nomeiam fornecedores e são recomendações, não contratos** (2.5). O que está de fato decidido nelas é o formato — banco gerenciado, processo persistente, armazenamento com egress barato. Trocar o nome do fornecedor não invalida nenhuma outra decisão desta tabela.

| # | Decisão | Justificativa |
|---|---|---|
| O1 | Banco gerenciado, não Postgres em container | PITR e atualização de versão são as duas coisas que não se quer aprender às três da manhã com dado de cliente dentro. O único item em que pagar é claramente mais barato que operar |
| O2 | Neon | Branch por PR torna testar migração contra dado realista uma operação de segundos, e o pooler em modo `transaction` é exatamente onde `set_config(…, true)` funciona (T5) |
| O3 | Fly.io, dois processos do mesmo artefato | A restrição de processo persistente elimina a maior parte das plataformas modernas. Os dois processos são literalmente o que 6.9 do stack descreve |
| O4 | `api` travada em uma instância no `fly.toml` | Cache e rate limit em memória (T22). A segunda réplica dobra o rate limit do OTP e faz o cache discordar de si mesmo, em silêncio |
| O5 | R2 para armazenamento | Logo de tenant é leitura constante em toda página pública. Egress gratuito separa custo previsível de surpresa proporcional ao sucesso |
| O6 | Piso real do Postgres é 15, não 18 | `btree_gist` é contrib de toda versão suportada; `security_invoker` em views existe desde a 15. Era a restrição que mais estreitava a escolha de hospedagem |
| O7 | Certificado curinga único via DNS-01 | TLS sob demanda sem endpoint `ask` deixa qualquer um forçar emissão até bater no limite de 50 certificados por semana — e aí nenhum tenant novo sobe |
| O8 | Dump lógico diário fora do provedor | PITR mora dentro do provedor. Um backup que só existe lá dentro não é backup contra o provedor |
| O9 | Restauração testada trimestralmente, com o teste de RLS incluído | Um restore mal parametrizado devolve os dados e perde as policies, em silêncio. Sem o passo do teste de leitura cruzada, o exercício só prova que o dump abre |
| O10 | Resend, com SES registrado como troca em escala | React Email é do mesmo time, então o template renderizado é o enviado. E a troca é uma implementação da porta `EnviadorEmail`, não uma migração |
| O11 | Subdomínio dedicado de envio | Isola a reputação do transacional do e-mail corporativo, nos dois sentidos |
| O12 | DMARC progressivo, começando em `p=none` | `p=reject` no primeiro dia, com alinhamento ainda errado, derruba os próprios e-mails sem nada errar do lado do sistema |
| O13 | Um alerta no MVP: fila de notificações atrasada | Worker morto não quebra nada visível. Só o lembrete não sai, e a descoberta vem dias depois pelo cliente. Alertas demais treinam a ignorá-los |
| O14 | Redação de segredos no pino, não por disciplina | OTP em log é acesso a qualquer conta; `token_gestao` em log é acesso a agendamentos |
| O15 | Expand and contract, com deploy em duas fases | Durante a troca as duas versões coexistem. Migração incompatível derruba a aplicação exatamente nesse intervalo |
| O16 | `lock_timeout` em toda migração | Um pedido de lock exclusivo enfileira até os `SELECT` que chegarem depois. Sem timeout, um `ALTER TABLE` inofensivo para a aplicação inteira |
| O17 | Config recusa subir com OTP em `LOG` em produção | A eliminação do bundle depende do bundler estar certo, e isso quebra numa atualização sem ninguém notar. A segunda camada é a que sobra |
| O18 | URL direta de banco, separada, para migração | `CREATE INDEX CONCURRENTLY` não funciona através de pooler em modo `transaction` |

---

## 10. Pendências

| # | Pendência | Observação |
|---|---|---|
| O-a | **Escolher a hospedagem** | Aberta de propósito. A seção 2 é recomendação; os dois filtros de 2.5 são o que precisa valer desde já. Vence na etapa 14, ou antes se surgir a necessidade de um endereço real |
| O-b | Verificar `btree_gist`, região e versão do Postgres | Verificação de contratação, no dia em que houver provedor. Não bloqueante à luz de O6 |
| O-c | Conta separada para o bucket de backup | Decorre de O8. Backup na mesma conta de produção não protege do encerramento da conta |
| O-d | Endereço `dmarc@dominio.com` e quem lê os relatórios | Duas semanas de leitura antes de subir para `p=quarantine` (5.3) |
