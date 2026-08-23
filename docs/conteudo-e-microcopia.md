# Sistema de Agendamento Multi-Tenant — Conteúdo e Microcópia

**Versão 1.0**

Todo texto que o sistema escreve. Templates de notificação, rótulos de enum, estados vazios, mensagens de erro e confirmações destrutivas.

**Entradas obrigatórias:** `planejamento-agendamento.md` (v1.4), `definicao-stack.md` (v1.1) e `sistema-de-design.md` (v1.1). Referências: `(7.6)` aponta para o funcional, `(T9)` para o stack, `(D5)` para o design.

**Encerra** a pendência 1 do funcional (conteúdo dos templates) e a D-e do sistema de design (microcópia).

**Referência de mão única.** Este cita os três anteriores; nenhum cita este. Reescrever um texto nunca exige nova versão de nenhum outro documento — e é por isso que o conteúdo tem documento próprio: é a camada que mais muda, e a que menos deve poluir o histórico de decisões.

---

## Sumário

1. [Voz](#1-voz)
2. [Rótulos canônicos](#2-rótulos-canônicos)
3. [Templates de notificação](#3-templates-de-notificação)
4. [Transacionais de conta](#4-transacionais-de-conta)
5. [Estados vazios](#5-estados-vazios)
6. [Mensagens de erro](#6-mensagens-de-erro)
7. [Confirmações destrutivas](#7-confirmações-destrutivas)
8. [Decisões registradas](#8-decisões-registradas)

---

## 1. Voz

Português brasileiro, segunda pessoa, direto.

| Regra | Em vez de | Escreva |
|---|---|---|
| Sem exclamação e sem interjeição | "Ops! Algo deu errado!" | "Não foi possível salvar." |
| O erro diz o que fazer | "Dados inválidos" | "Informe um telefone com DDD." |
| Nunca culpar quem lê | "Você preencheu errado" | "Este telefone já está cadastrado." |
| Verbo no botão, nunca "Sim" | "Confirmar? [Sim] [Não]" | "[Cancelar agendamento] [Voltar]" |
| Sem jargão do modelo | "Transição inválida" | "Este agendamento já foi concluído." |
| Números por extenso até dez, exceto valores e horas | "3 serviços" | "três serviços", mas "R$ 80,00" e "às 9h" |

### 1.1 O que o texto nunca revela

Quatro regras de segurança que valem em toda superfície — e-mail, tela, resposta de API:

- **Nunca o motivo interno do bloqueio.** `excecoes_agenda.motivo` é interno (5.9). "Consulta médica" e "aniversário da minha filha" não aparecem para o cliente em nenhuma hipótese.
- **Nunca `observacoes_internas`**, de `clientes` ou de `agendamentos`.
- **Nunca revelar que existe bloqueio de cliente.** O fluxo público recusa com mensagem genérica (8.3.1). Dizer "você está bloqueado" só ensina a contornar trocando o telefone.
- **Nunca distinguir "não existe" de "está errado"** em autenticação e OTP (10.4). "Se houver uma conta com este e-mail, o link foi enviado." Diferenciar entrega quais e-mails existem na base.

### 1.2 Datas e valores

- Data por extenso curto no fuso do estabelecimento: `sábado, 30 de junho`. Nunca `30/06/2026` em e-mail — no assunto e em espaço apertado, `30/06`.
- Hora sem segundos e sem zero à esquerda no dia a dia: `9h`, `14h30`. Em grade e em lista, com dois dígitos e numerais tabulares: `09:00`.
- Valor sempre com símbolo e duas casas: `R$ 80,00`. Quando `exibicao_valor` é `A_PARTIR_DE`, o prefixo é `a partir de R$ 80,00`. Quando é `OCULTO`, **não existe linha de valor** — não escrever "sob consulta", que é uma promessa a mais.
- Duração em minutos até 90, depois em horas: `45 min`, `1h30`.

---

## 2. Rótulos canônicos

Um enum tem **um** rótulo, definido aqui e importado de um só lugar. Rótulo inventado na tela é como "Faltou" vira "Não compareceu" em metade da interface.

**Estado do agendamento** (7.1) — a cor é sempre acompanhada do rótulo (D5):

| Enum | Rótulo | Família de cor |
|---|---|---|
| `AGUARDANDO` | Aguardando aprovação | `--atencao` |
| `CONFIRMADO` | Confirmado | `--positivo` |
| `CONCLUIDO` | Concluído | `--positivo` |
| `CANCELADO` | Cancelado | `--negativo` |
| `FALTOU` | Faltou | `--negativo` |

**Estado temporal** (5.8) — derivado do relógio, sem campo no banco:

| Condição | Rótulo |
|---|---|
| `agora < inicia_em` | Agendado |
| Dentro do intervalo | Em andamento |
| `agora > termina_em` | Pendente de fechamento |
| Anterior ainda aberto | Atrasado |

**Tipo de cancelamento:**

| Enum | Rótulo |
|---|---|
| `DESISTENCIA` | Cancelado pelo cliente |
| `REMARCACAO` | Remarcado |
| `INDISPONIBILIDADE` | Cancelado pelo estabelecimento |
| `EXPIRACAO` | Expirou sem aprovação |

**Tipo de lançamento** (8.6):

| Enum | Rótulo |
|---|---|
| `AGENDAMENTO` | Atendimento |
| `AVULSO` | Avulso |
| `TOTAL_DIA` | Total do dia |

**Papel** (2.1): Proprietário · Admin · Funcionário.
**Origem** (8.5): `PUBLICO` → "Pelo cliente" · `ADMIN` → "Pela equipe".

---

## 3. Templates de notificação

Os nove gatilhos de 7.6, mais um exigido por 8.3.1 e ausente daquela tabela (3.11). Canal único na v1: e-mail (decisão 35).

### 3.0 Regras de todos

- **Assunto com no máximo 60 caracteres**, e a informação decisiva antes do caractere 35 — é onde o celular corta.
- **Preheader sempre preenchido.** Vazio, o cliente de e-mail exibe o começo do HTML.
- **Alternativa em texto puro obrigatória.** O React Email gera; precisa ser conferida, porque link em texto puro não é `[rótulo]`, é a URL.
- **Um CTA por e-mail.** Dois botões competem e nenhum é clicado.
- **Remetente:** `{{estabelecimento.nome}} <nao-responda@envio.dominio.com>`. O nome de exibição é do tenant; o domínio é do sistema, e é o que sustenta a reputação de envio (`operacao.md`, 5). `Reply-To` fica no mesmo endereço — `estabelecimentos` não tem e-mail público, e por isso todo template que pede contato oferece `{{estabelecimento.telefonePublico}}`.

**Variáveis compartilhadas:**

```
{{cliente.nome}}  {{cliente.telefone}}
{{estabelecimento.nome}}  {{estabelecimento.telefonePublico}}  {{estabelecimento.enderecoPublico}}
{{agendamento.data}}       sábado, 30 de junho
{{agendamento.dataCurta}}  30/06
{{agendamento.hora}}       09:00
{{agendamento.servicos}}   Corte, Barba
{{agendamento.profissional}}
{{agendamento.duracao}}    1h15
{{agendamento.valorTotal}} respeita exibicao_valor (1.2)
{{links.gestao}}           token_gestao — um agendamento, com expiração (10.7)
{{links.reagendar}}        /agendar?servicos=… com os mesmos serviços
{{politica.prazoCancelamento}}  24 horas
```

---

### 3.1 `agendamento_confirmado` → cliente

Gatilho: criação com `CONFIRMADO`, e a transição 1.

**Assunto:** `Agendamento confirmado — {{agendamento.dataCurta}} às {{agendamento.hora}}`
**Preheader:** `{{estabelecimento.nome}} · {{agendamento.servicos}}`
**Anexo:** `.ics`

```
Olá, {{cliente.nome}}.

Seu agendamento em {{estabelecimento.nome}} está confirmado.

{{agendamento.data}}, às {{agendamento.hora}}
{{agendamento.servicos}}
com {{agendamento.profissional}}
{{agendamento.duracao}} · {{agendamento.valorTotal}}

[ Ver ou cancelar este agendamento ]  {{links.gestao}}

Cancelamentos são aceitos até {{politica.prazoCancelamento}} antes do horário.
Depois disso, fale direto com o estabelecimento: {{estabelecimento.telefonePublico}}.

{{estabelecimento.enderecoPublico}}
```

> **Este e-mail é crítico.** Na v1 ele é o único portador do `token_gestao` para quem agendou como convidado. Se não chegar, o cliente não tem como ver nem cancelar o próprio agendamento (decisão 35). É o e-mail que justifica o monitoramento de entrega de `operacao.md`, 5.4.

---

### 3.2 `aguardando_aprovacao` → cliente

Gatilho: criação com `AGUARDANDO`.

**Assunto:** `Recebemos seu pedido — {{agendamento.dataCurta}} às {{agendamento.hora}}`
**Preheader:** `Aguardando confirmação de {{estabelecimento.nome}}`

```
Olá, {{cliente.nome}}.

Recebemos seu pedido de agendamento em {{estabelecimento.nome}}.
Ele ainda não está confirmado — o estabelecimento tem até 24 horas
para responder, e avisamos você assim que houver uma decisão.

{{agendamento.data}}, às {{agendamento.hora}}
{{agendamento.servicos}}
com {{agendamento.profissional}}
{{agendamento.duracao}} · {{agendamento.valorTotal}}

[ Acompanhar este pedido ]  {{links.gestao}}
```

> A palavra "confirmado" não pode aparecer neste template a não ser negada. É o erro de copy mais caro do conjunto: o cliente aparece no horário de um pedido que nunca foi aprovado.

---

### 3.3 `nova_solicitacao` → gestor

Gatilho: criação com `AGUARDANDO`.

**Assunto:** `Nova solicitação — {{agendamento.dataCurta}} às {{agendamento.hora}}`
**Preheader:** `{{cliente.nome}} · {{agendamento.servicos}}`

```
{{cliente.nome}} pediu um horário.

{{agendamento.data}}, às {{agendamento.hora}}
{{agendamento.servicos}} · {{agendamento.duracao}}
com {{agendamento.profissional}}
Telefone: {{cliente.telefone}}

[ Abrir na agenda ]  {{links.agenda}}

Solicitações sem decisão em 24 horas são canceladas automaticamente,
e o horário volta a ficar disponível.
```

---

### 3.4 `cancelado_pelo_cliente` → gestor

Gatilho: transições 2 e 4 quando o ator é o cliente.

**Assunto:** `Cancelamento — {{agendamento.dataCurta}} às {{agendamento.hora}}`

```
{{cliente.nome}} cancelou o agendamento de
{{agendamento.data}}, às {{agendamento.hora}}.

{{agendamento.servicos}} · com {{agendamento.profissional}}

O horário está livre novamente.
```

---

### 3.5 `cancelado_pelo_estabelecimento` → cliente

Gatilho: transições 2 e 4 quando o ator é a equipe, inclusive o cancelamento em lote de 5.9.

**Assunto:** `Seu agendamento de {{agendamento.dataCurta}} foi cancelado`
**Preheader:** `{{estabelecimento.nome}} · escolha um novo horário`

```
Olá, {{cliente.nome}}.

Precisamos cancelar seu agendamento em {{estabelecimento.nome}}:

{{agendamento.data}}, às {{agendamento.hora}}
{{agendamento.servicos}}

Sentimos pelo transtorno. Você pode escolher outro horário agora,
com os mesmos serviços já selecionados:

[ Escolher novo horário ]  {{links.reagendar}}

Se preferir falar direto: {{estabelecimento.telefonePublico}}.
```

> **`motivo` nunca entra aqui** (1.1). E o link de reagendamento não é cortesia: é o que converte. "Entre em contato" transforma um cancelamento em uma perda; o deep link com os serviços pré-selecionados transforma em uma remarcação (5.9).

---

### 3.6 `solicitacao_expirada` → cliente e gestor

Gatilho: transição 2 por `SISTEMA` (5.7). Dois corpos, um template.

**Cliente · assunto:** `Seu pedido de {{agendamento.dataCurta}} expirou`

```
Olá, {{cliente.nome}}.

Seu pedido de horário em {{estabelecimento.nome}} para
{{agendamento.data}}, às {{agendamento.hora}}, não foi confirmado a tempo
e o horário foi liberado.

Você pode tentar outro horário:

[ Escolher novo horário ]  {{links.reagendar}}
```

**Gestor · assunto:** `Solicitação expirada — {{agendamento.dataCurta}} às {{agendamento.hora}}`

```
A solicitação de {{cliente.nome}} para {{agendamento.data}}, às {{agendamento.hora}},
ficou 24 horas sem decisão e foi cancelada automaticamente.

O horário está livre novamente, e o cliente foi avisado.
```

---

### 3.7 `agendamento_remarcado` → a outra parte

Gatilho: remarcação (5.4).

**Assunto:** `Novo horário — {{novo.dataCurta}} às {{novo.hora}}`

```
Olá, {{cliente.nome}}.

Seu agendamento em {{estabelecimento.nome}} mudou de horário.

Antes:  {{antigo.data}}, às {{antigo.hora}}
Agora:  {{novo.data}}, às {{novo.hora}}

{{agendamento.servicos}} · com {{agendamento.profissional}}

[ Ver ou cancelar este agendamento ]  {{links.gestao}}
```

> O link é o **novo** `token_gestao`. A remarcação cria outro agendamento e cancela o antigo (5.4), então o token anterior deixa de valer. Reaproveitar o link antigo neste template leva o cliente a uma tela de agendamento cancelado.

---

### 3.8 `lembrete_24h` → cliente

**Assunto:** `Amanhã às {{agendamento.hora}} — {{estabelecimento.nome}}`

```
Olá, {{cliente.nome}}. Lembrete do seu agendamento amanhã.

{{agendamento.data}}, às {{agendamento.hora}}
{{agendamento.servicos}} · com {{agendamento.profissional}}
{{estabelecimento.enderecoPublico}}

Precisa desmarcar? Dá tempo até {{politica.prazoCancelamento}} antes.

[ Ver ou cancelar ]  {{links.gestao}}
```

---

### 3.9 `lembrete_2h` → cliente

**Assunto:** `Hoje às {{agendamento.hora}} — {{estabelecimento.nome}}`

```
Seu agendamento é daqui a pouco.

{{agendamento.hora}} · {{agendamento.servicos}}
{{estabelecimento.enderecoPublico}}

Imprevisto? Avise: {{estabelecimento.telefonePublico}}.
```

> Sem link de cancelamento. A duas horas do horário, o prazo de cancelamento já passou na configuração padrão (1440 minutos), e oferecer um botão que vai recusar é pior do que não oferecer. O caminho aqui é o telefone.

---

### 3.10 Cancelamento de lembretes

Não é template: é a regra que os governa. **Ao sair de um estado ativo, todo `notificacoes` pendente daquele agendamento passa a `CANCELADA`** (7.6). Lembrete de consulta cancelada é a falha que mais gera reclamação neste tipo de sistema, e a única desta seção que merece teste dedicado.

---

### 3.11 `tentativa_cliente_bloqueado` → gestor

**Exigido por 8.3.1 e ausente da tabela de 7.6.** Registrado aqui como lacuna preenchida; se o funcional for revisado, a linha deve subir para aquela tabela.

**Assunto:** `Tentativa de agendamento de um cliente bloqueado`

```
{{cliente.nome}} ({{cliente.telefone}}), que está bloqueado,
tentou agendar {{agendamento.servicos}} para
{{agendamento.data}}, às {{agendamento.hora}}.

O agendamento não foi criado. O cliente recebeu apenas uma mensagem
genérica, sem menção ao bloqueio.

[ Ver ficha do cliente ]  {{links.cliente}}
```

---

## 4. Transacionais de conta

Necessários na etapa 5, e fora da tabela de 7.6 porque não são notificações de agendamento.

| Template | Assunto | Expira | Regra |
|---|---|---|---|
| `verificacao_email` | `Confirme seu e-mail` | 24 h | Um CTA. Sem conteúdo além do link |
| `convite_equipe` | `{{convidadoPor}} convidou você para {{estabelecimento.nome}}` | 7 dias | Diz o papel: "como Administrador". Quem recebe precisa saber o que está aceitando |
| `recuperacao_senha` | `Redefinir sua senha` | 1 h | Termina com "Se não foi você, ignore este e-mail — sua senha continua a mesma." Sem esse fecho, o e-mail assusta |

Nenhum dos três revela se a conta existe (1.1). A tela sempre responde "Se houver uma conta com este e-mail, enviamos as instruções."

---

## 5. Estados vazios

Recipe em `sistema-de-design.md`, 6.5. Aqui, o conteúdo.

**A distinção que quase todo sistema erra:** vazio por **ausência de dados** e vazio por **filtro** são situações diferentes, com ações diferentes. Oferecer "Cadastrar serviço" a quem filtrou por uma categoria sem resultado é responder outra pergunta.

| Onde | Título | Apoio | Ação |
|---|---|---|---|
| Agenda do dia, sem nada | Nada marcado para hoje | Os agendamentos aparecem aqui conforme forem chegando. | Novo agendamento |
| Agenda, dia bloqueado | Dia bloqueado | Nenhum horário disponível nesta data. | Remover bloqueio |
| Catálogo vazio | Nenhum serviço cadastrado | Seu link público só mostra serviços ativos. Cadastre o primeiro. | Novo serviço |
| Equipe com um só | Só você por enquanto | Adicione profissionais para dividir a agenda entre eles. | Adicionar profissional |
| Clientes vazio | Nenhum cliente ainda | Clientes são criados automaticamente no primeiro agendamento. | Cadastrar cliente |
| Caixa sem lançamento | Nenhum lançamento no período | Atendimentos concluídos entram aqui automaticamente. | Novo lançamento |
| Resumo sem dado | Sem movimento no período | Escolha outro período para comparar. | — |
| **Qualquer filtro sem resultado** | Nenhum resultado | Nenhum registro corresponde a esses filtros. | Limpar filtros |
| Busca de cliente sem resultado | Nenhum cliente encontrado | Verifique o telefone, ou cadastre um novo. | Cadastrar cliente |
| Público: catálogo vazio | Agendamento indisponível | Este estabelecimento ainda não publicou serviços. | — |
| Público: mês sem vaga | Nenhum horário neste mês | Tente o mês seguinte, ou fale com o estabelecimento. | Próximo mês |
| Público: dia sem vaga | Nenhum horário nesta data | Escolha outro dia no calendário acima. | — |

> As três últimas são as mais delicadas do conjunto. Um cliente que chega pelo link e encontra "Agendamento indisponível" precisa de um caminho — daí o telefone estar sempre no rodapé do público, e não só nestes textos.

---

## 6. Mensagens de erro

Cada código de `ErroDominio` (definicao-stack, 6.10) tem uma mensagem exibível. A mensagem é gerada no servidor e vai no campo `mensagem` da resposta — o frontend nunca traduz código em texto, ou os dois lados divergem.

| Código | HTTP | Mensagem |
|---|---|---|
| `VALIDACAO` | 422 | Verifique os campos destacados. |
| `NAO_AUTENTICADO` | 401 | Sua sessão expirou. Entre novamente. |
| `SEM_PERMISSAO` | 403 | Você não tem permissão para esta ação. |
| `NAO_ENCONTRADO` | 404 | Não encontramos este registro. |
| `SLOT_OCUPADO` | 409 | Este horário acabou de ser ocupado. Escolha outro. |
| `TRANSICAO_INVALIDA` | 422 | Esta ação não é possível no estado atual do agendamento. |
| `GUARDA_FALHOU` | 422 | *(específica da guarda — ver abaixo)* |
| `CONFLITO` | 409 | Já existe um registro com estes dados. |
| `LIMITE_EXCEDIDO` | 429 | Muitas tentativas. Tente de novo em alguns minutos. |
| `FORA_DO_PRAZO` | 422 | O prazo de cancelamento já passou. Fale com o estabelecimento. |
| `RECURSO_EM_USO` | 409 | Existem agendamentos futuros. Resolva antes de desativar. |
| `INTERNO` | 500 | Algo falhou do nosso lado. Tente de novo em instantes. |

**`GUARDA_FALHOU` carrega a mensagem da guarda que reprovou**, porque "guarda falhou" não diz nada a ninguém:

| Guarda | Mensagem |
|---|---|
| `slot_livre` | Este horário não está mais disponível. |
| `dentro_do_prazo` | O prazo de cancelamento já passou. |
| `apos_termino` | Só é possível marcar falta depois do horário de término. |
| `dentro_de_30_dias` | Atendimentos concluídos há mais de 30 dias não podem ser reabertos. |
| `agendamento_proprio` | Você só pode alterar agendamentos da sua própria agenda. |

**No fluxo público, dois erros mentem por segurança** (1.1):

| Situação real | O que o cliente lê |
|---|---|
| Cliente bloqueado (8.3.1) | Não foi possível concluir. Entre em contato com o estabelecimento. |
| Código OTP errado, expirado ou inexistente | Código inválido ou expirado. |

---

## 7. Confirmações destrutivas

**Padrão:** o título é a pergunta, o corpo é a consequência irreversível, o botão é o verbo. Nunca "Sim" e "Não" — quem lê rápido clica no primeiro botão, e o rótulo precisa ser a última defesa.

| Ação | Título | Corpo | Botão |
|---|---|---|---|
| Cancelar agendamento | Cancelar este agendamento? | O cliente será avisado por e-mail e o horário voltará a ficar disponível. | Cancelar agendamento |
| Bloquear o dia com agendamentos | Bloquear {{data}}? | {{n}} agendamentos serão cancelados e os clientes avisados, com link para escolher outro horário. | Cancelar todos e avisar |
| Marcar falta | Marcar como falta? | Nenhum lançamento é criado no caixa. Você pode desfazer depois. | Marcar falta |
| Reabrir concluído | Reabrir este atendimento? | O lançamento de {{valor}} será estornado no caixa, com registro. | Reabrir e estornar |
| Corrigir valor lançado | Corrigir o valor? | O lançamento de {{valorAntigo}} será estornado e um de {{valorNovo}} será criado. Nenhuma linha é apagada. | Corrigir valor |
| Desativar profissional com agenda | Não é possível desativar | {{n}} agendamentos futuros. Transfira ou cancele antes. | Ver agendamentos |
| Remover serviço | Remover este serviço? | Ele sai do catálogo público. Agendamentos e histórico não mudam. | Remover serviço |
| Bloquear cliente | Bloquear {{nome}}? | Novos agendamentos pelo link público serão recusados sem explicação. Você ainda pode agendar por aqui. | Bloquear cliente |
| Sair da equipe / revogar | Remover {{nome}} da equipe? | O acesso é encerrado imediatamente. A agenda e o histórico permanecem. | Remover acesso |

Três observações que o padrão esconde:

- **"Marcar falta" tem tom leve de propósito.** É a marcação mais frequentemente equivocada do sistema (transição 7) e precisa ser trivialmente reversível — um diálogo severo desencoraja a correção, não o erro.
- **"Reabrir" e "Corrigir valor" dizem que nada é apagado.** É a tradução do caixa append-only (7.4) para quem não leu o documento. Sem essa frase, o gestor acredita que está editando, e estranha ao ver três linhas no extrato.
- **Desativar profissional não é uma confirmação, é uma recusa** (6.3). O diálogo não oferece o caminho destrutivo; oferece o caminho de resolução.

---

## 8. Decisões registradas

Numeração `C`, independente das demais.

| # | Decisão | Justificativa |
|---|---|---|
| C1 | Conteúdo em documento próprio | É a camada que mais muda. Dentro do funcional, cada ajuste de vírgula viraria bump de versão de um documento de regras de negócio |
| C2 | Um enum, um rótulo, importado de um lugar só | Rótulo inventado na tela é como "Faltou" vira "Não compareceu" em metade da interface |
| C3 | Vazio por ausência e vazio por filtro são textos diferentes | Oferecer "Cadastrar serviço" a quem filtrou por categoria responde outra pergunta |
| C4 | Botão de confirmação destrutiva é o verbo, nunca "Sim" | Quem lê rápido clica no primeiro botão; o rótulo é a última defesa |
| C5 | `lembrete_2h` não oferece cancelamento | No prazo padrão de 1440 minutos, o botão já recusaria. Oferecer e negar é pior que não oferecer |
| C6 | `agendamento_remarcado` carrega o token novo | A remarcação cria outro agendamento; o token anterior leva a uma tela de cancelado |
| C7 | `aguardando_aprovacao` nunca contém "confirmado" afirmativamente | É o erro de copy mais caro: o cliente aparece no horário de um pedido nunca aprovado |
| C8 | Mensagem de erro gerada no servidor, nunca traduzida no cliente | Dois dicionários divergem; e o servidor é quem sabe qual guarda reprovou |
| C9 | `tentativa_cliente_bloqueado` adicionado à lista de templates | Exigido por 8.3.1 e ausente da tabela de 7.6. Lacuna do funcional, preenchida aqui |
| C10 | `OCULTO` não vira "sob consulta" | Não escrever a linha de valor é honesto; "sob consulta" é uma promessa de atendimento que ninguém fez |
