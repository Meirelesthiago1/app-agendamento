# Sistema de Agendamento Multi-Tenant — Planejamento Funcional

**Versão 1.4 — Fase de planejamento**

Este documento consolida as definições de produto, atores, fluxos, papéis, arquitetura de aplicações e modelagem de dados. Não define linguagem, framework, estrutura de pastas ou camadas da aplicação: essas decisões foram tomadas com este documento como entrada e vivem em `definicao-stack.md`.

A referência é de mão única. O documento técnico cita este constantemente; este cita aquele apenas aqui e na lista de pendências encerradas. Trocar biblioteca, camada ou plataforma nunca exige nova versão deste arquivo.

> **Alteração da v1.2 para a v1.3:** apenas o encerramento da pendência 5 e este ponteiro. Nenhuma regra, campo, fluxo ou decisão de produto foi modificado.
>
> **Alteração da v1.3 para a v1.4:** apenas o encerramento das pendências 1 e 5, a redução da 2 ao que resta dela, e a regra de numeração estável em 13. O conteúdo dos templates, o provedor de e-mail e os três pontos de atenção do desenho de telas passaram para os documentos citados ali. Nenhuma regra, campo, fluxo ou decisão de produto foi modificado.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Atores e papéis](#2-atores-e-papéis)
3. [Separação das aplicações](#3-separação-das-aplicações)
4. [Funcionalidades](#4-funcionalidades)
5. [Fluxos principais](#5-fluxos-principais)
6. [Motor de disponibilidade](#6-motor-de-disponibilidade)
7. [Máquina de estados do agendamento](#7-máquina-de-estados-do-agendamento)
8. [Modelagem de dados](#8-modelagem-de-dados)
9. [Regras transversais](#9-regras-transversais)
10. [Autenticação e sessão](#10-autenticação-e-sessão)
11. [Escopo do MVP](#11-escopo-do-mvp)
12. [Decisões registradas](#12-decisões-registradas)
13. [Pendências](#13-pendências)

---

## 1. Visão geral

Plataforma SaaS multi-tenant de agendamento de consultas e atendimentos, aplicável a diferentes nichos profissionais (saúde, nutrição, beleza, barbearia, estética, consultoria). Cada tenant é um negócio independente com sua própria configuração, catálogo de serviços, equipe, agenda e controle de faturamento.

**Princípios de produto**

- **Baixo atrito para o cliente final.** Agendar sem cadastro é o caminho padrão; login é opcional.
- **Configurável por nicho, sem exigir configuração.** Um profissional autônomo deve conseguir usar o sistema sem tocar em nada além do horário de trabalho e um serviço.
- **Mobile-first, instalável.** PWA em ambas as interfaces.
- **O sistema não movimenta dinheiro.** Registra valores para controle gerencial; não processa pagamentos.

**Princípio técnico central**

> Grade de horário é **regra**. Agendamento é **fato**. Alterar a regra nunca reescreve o fato.

Esse princípio resolve a maior parte dos casos de borda: mudança de horário de trabalho, mudança de duração ou preço de serviço, desativação de profissional.

---

## 2. Atores e papéis

### 2.1 Atores

| Ator | Escopo | Descrição |
|---|---|---|
| Super admin | Plataforma | Provisiona tenants, gerencia planos e suporte. Fora do escopo do MVP. |
| Proprietário | Tenant | Dono da conta. Acesso total, inclusive plano e exclusão do tenant. |
| Admin | Tenant | Gestão operacional completa, exceto plano e transferência de propriedade. |
| Funcionário | Tenant | Acesso à própria agenda, próprios lançamentos e próprios relatórios. |
| Cliente identificado | Tenant | Agenda, remarca, cancela e consulta histórico com login. |
| Cliente convidado | Sessão | Agenda sem cadastro; gerencia via link com token. |

### 2.2 Hierarquia

Superconjunto estrito: **Proprietário ⊇ Admin ⊇ Funcionário**. Tudo que um funcionário pode fazer, o admin também pode; tudo que o admin pode fazer, o proprietário também pode.

### 2.3 Matriz de permissões

| Capacidade | Proprietário | Admin | Funcionário |
|---|:-:|:-:|:-:|
| Configurações do tenant, marca, políticas | ✓ | ✓ | — |
| Gerenciar usuários e papéis | ✓ | ✓ | — |
| Cadastrar e editar serviços e preços | ✓ | ✓ | — |
| Cadastrar profissionais | ✓ | ✓ | — |
| Editar horário de qualquer profissional | ✓ | ✓ | — |
| Editar o próprio horário | ✓ | ✓ | ✓ |
| Bloquear a própria agenda | ✓ | ✓ | ✓ |
| Bloquear a agenda de outro profissional ou do estabelecimento | ✓ | ✓ | — |
| Ver agenda de todos | ✓ | ✓ | condicional¹ |
| Ver e gerenciar a própria agenda | ✓ | ✓ | ✓ |
| Criar agendamento manual | ✓ | ✓ | ✓ (próprios) |
| Concluir atendimento e informar valor | ✓ | ✓ | ✓ (próprios) |
| Corrigir valor de lançamento já criado (estorno) | ✓ | ✓ | — |
| Reabrir atendimento concluído | ✓ | ✓ | — |
| Criar lançamento manual (avulso / total do dia) | ✓ | ✓ | ✓ (próprios) |
| Forçar encaixe em horário ocupado | ✓ | ✓ | ✓ (próprios) |
| Bloquear cliente | ✓ | ✓ | — |
| Relatórios financeiros globais | ✓ | ✓ | — |
| Relatórios próprios | ✓ | ✓ | ✓ |
| Excluir ou transferir o tenant | ✓ | — | — |

¹ Controlado por `configuracoes.staff_ve_agenda_completa`. Faz sentido em operações com recepção compartilhada; não faz em modelos com comissão individual.

**Implementação:** as permissões vivem em uma **constante versionada no pacote de domínio compartilhado**, nunca como verificações de papel espalhadas pelo código. A estrutura é `papel → conjunto de permissões`, com o escopo (`GLOBAL` ou `PROPRIOS`) declarado junto:

```
PERMISSOES = {
  FUNCIONARIO: [
    { permissao: "agendamentos.escrever",  escopo: PROPRIOS },
    { permissao: "lancamentos.criar",      escopo: PROPRIOS },
    { permissao: "relatorios.ler",         escopo: PROPRIOS },
    …
  ],
  ADMIN:        [ … ],
  PROPRIETARIO: [ … ]
}
```

Não existe tabela de permissões. Como `vinculos.papel` é um enum fixo de três valores, criar um papel novo já exigiria migração de qualquer forma — a tabela daria a ilusão de flexibilidade, adicionaria um acesso a banco em todo request e ainda deixaria o escopo condicional (`PROPRIOS`) fora dela, no código. Uma constante entrega o mesmo desacoplamento, é testável sem I/O e falha em tempo de compilação quando alguém escreve uma permissão inexistente. A migração para tabela só se paga com papéis customizados por tenant, que não está previsto em nenhuma fase.

### 2.4 Profissional ≠ usuário

Conceitos deliberadamente separados. Três combinações válidas:

| Combinação | Registro | Uso |
|---|---|---|
| Profissional sem login | `profissionais` sem `vinculo_id` | Cadastrado pelo gestor; não acessa o sistema |
| Profissional com login | `profissionais` com `vinculo_id` | Acessa e gerencia a própria agenda |
| Usuário sem ser profissional | `vinculos` sem `profissionais` | Recepção ou financeiro; não recebe agendamentos |

**Regra de criação:** ao criar um tenant, o sistema cria automaticamente um registro em `profissionais` vinculado ao proprietário. Assim o caso autônomo funciona sem configuração, `agendamentos.profissional_id` é sempre obrigatório e a interface apenas esconde o seletor de profissional quando existe um único ativo.

---

## 3. Separação das aplicações

São três decisões independentes.

### 3.1 Backend — único

Mesmo domínio, mesmas regras, mesmo banco. Separar exigiria duplicar o motor de disponibilidade, a peça mais complexa do sistema. Quando as cópias divergissem, o cliente veria disponibilidade diferente da que o gestor vê.

### 3.2 Frontend — dois

As duas interfaces têm requisitos que se contradizem:

| | App do gestor | Página do cliente |
|---|---|---|
| Frequência de uso | Diária | Esporádica |
| Estratégia de cache | Offline-first (agenda do dia) | Network-first |
| Peso do bundle | Tolerante | Crítico |
| Manifest PWA | Fixo, marca do sistema | Dinâmico, marca do tenant |
| Renderização / SEO | Irrelevante | Relevante |
| Autenticação | Sempre exigida | Opcional |

O fator decisivo é o cache: servir agenda a partir do service worker é desejável no painel e perigoso na página pública, onde disponibilidade em cache leva a agendamento sobre horário já ocupado.

### 3.3 Repositório — único

Repositórios separados obrigam a versionar contratos entre eles e transformam qualquer mudança de campo em coordenação de dois ciclos. Manter junto permite compartilhar:

- **Contratos** — tipos e schemas de validação usados pelas três aplicações.
- **Domínio** — regras puras, sem dependência de framework ou banco: cálculo de slots, transições de estado, matriz de permissões, formatação de valores e datas com fuso. A mesma função roda no backend (fonte de verdade) e no frontend (feedback imediato), testada uma vez.
- **UI** — tokens de design e componentes base.

### 3.4 Domínios

| Aplicação | Endereço |
|---|---|
| App do gestor | `app.dominio.com` |
| Página pública do cliente | `{slug}.dominio.com` |

Origens distintas resolvem sem esforço o conflito de service worker e de manifest, e dão a cada tenant um PWA instalável com nome e ícone próprios.

**Consequência a resolver antes de implementar o login:** cliente que atende em vários tenants terá sessão por origem. Solução em 10.6.

### 3.5 Processo de segundo plano

O MVP depende de um worker, não apenas do servidor web:

| Tarefa | Frequência |
|---|---|
| Envio de notificações agendadas (`notificacoes` com `agendada_para` vencido) | Minuto |
| Expiração de solicitações `AGUARDANDO` não aprovadas | Hora |
| Expurgo de `codigos_verificacao` e `auditoria` fora da retenção | Diária |

É a peça de infraestrutura mais subestimada em sistemas de agendamento. A escolha da stack precisa contemplar fila e execução agendada desde o início — sem isso, lembrete não sai.

---

## 4. Funcionalidades

### 4.1 App do gestor

**Onboarding** — wizard de cinco passos no primeiro acesso: dados do negócio → horário de trabalho → primeiro serviço → datas em que já sabe que não vai atender (opcional, pulável) → link e QR code prontos para compartilhar. O gestor precisa sair do wizard com um link funcional.

O quarto passo custa uma tela e previne o problema mais comum do primeiro mês: viagem, casamento ou feriado prolongado já marcados há meses, que ninguém pensa em registrar até o cliente agendar em cima deles. A janela de agendamento reduz a exposição a imprevistos desconhecidos; o evento já conhecido só o bloqueio preventivo resolve.

**Configurações do tenant** — nome, slug, segmento, fuso horário, logo, cor, telefone e endereço públicos.

**Políticas de agendamento** — granularidade dos slots, antecedência mínima, janela máxima, prazo de cancelamento, confirmação automática, permitir agendamento sem cadastro, permitir múltiplos serviços por agendamento, verificação por OTP, visibilidade da agenda para funcionários, limite de agendamentos ativos por cliente.

**Serviços** — categorias, nome, descrição, duração, folgas antes e depois, valor, forma de exibição do valor, cor, ativo/inativo, ordenação, quais profissionais executam com override de duração e valor.

**Horários** — grade semanal por profissional com múltiplos intervalos por dia; exceções de bloqueio (férias, feriado, compromisso) e de disponibilidade extra (sábado pontual).

**Agenda** — lista cronológica do dia (padrão mobile) e grade semanal no desktop. Criar, remarcar, cancelar, concluir, marcar falta, bloquear horário ou dia inteiro, forçar encaixe. Contador de atendimentos pendentes de fechamento e de solicitações aguardando decisão no topo. Criação manual aceita múltiplos serviços, como o fluxo público. Bloquear o dia é ação de dois toques, com resolução em lote dos agendamentos atingidos (5.9).

**Clientes** — cadastro, busca por nome ou telefone, histórico, observações internas, bloqueio.

**Equipe** — cadastrar profissionais (com ou sem login), convidar usuários, definir papéis.

**Caixa** — livro de lançamentos com período, totalizador separando origem interna e externa, lançamento avulso e lançamento de total do dia.

**Notificações** — templates por evento e canais ativos.

**Resumo** — tela única de acompanhamento na v1: faturamento do período com quebra por origem, agendamentos por desfecho e, quando houver mais de um profissional ativo, quebra por profissional. Exportação CSV de lançamentos e agendamentos. Detalhamento em 9.7.

### 4.2 Página pública do cliente

- Home do tenant com identidade visual, informações de contato e catálogo de serviços.
- Fluxo de agendamento em etapas, uma por tela.
- Área "meus agendamentos" — por sessão autenticada ou por token de gestão.
- Cancelamento self-service dentro do prazo configurado.
- Arquivo `.ics` e sugestão de instalação na tela de início após confirmar.
- Deep link por serviço (`/agendar?servicos={slug}` ou `?servicos={slug},{slug}`) para divulgação em redes sociais e para o link de reagendamento do e-mail de cancelamento, entrando direto na escolha de data com os serviços pré-selecionados.

---

## 5. Fluxos principais

### 5.1 Agendamento pelo cliente

```
Home do tenant
  └─ Agendar
       1. Serviço          categorias; valor conforme exibicao_valor
                           adicionar outro serviço (se habilitado, até 5)
       2. Profissional     apenas quem executa TODOS os itens
                           etapa pulada se houver apenas um elegível
       3. Data             calendário; dias sem vaga desabilitados
       4. Horário          slots do dia
       5. Identificação    login | cadastro | continuar sem cadastro
       6. Revisão          resumo, duração e valor totais + política de cancelamento
       7. Confirmação      link de gestão, .ics, instalar na tela de início
```

**Regra de ouro:** identificação apenas na etapa 5. Exigir login antes de exibir disponibilidade é a maior causa de abandono neste tipo de sistema — o cliente precisa ver que existe vaga antes de investir em cadastro.

**Seleção de serviços.** O padrão continua sendo toque único que avança para a etapa seguinte. Quando `permite_multiplos_servicos` está ativo, existe uma ação secundária "adicionar outro serviço", com duração e valor totais atualizando na tela. A primeira tela nunca vira uma lista de caixas de seleção com botão "continuar": isso adiciona um passo para a maioria, que agenda um serviço só.

**Concorrência.** Não existe reserva temporária. O slot é disputado até a confirmação; a constraint de exclusão do banco (8.5) recusa a segunda gravação e a interface informa que o horário acabou de ser ocupado, devolvendo o cliente à etapa 4 com a lista já atualizada. Para o volume de um tenant típico, a janela de colisão é de segundos, e o hold não eliminava esse erro — apenas o tornava menos frequente, ao custo de uma tabela, um job de limpeza e um ramo a mais no motor.

**Estado inicial:**

| Condição | Estado |
|---|---|
| `confirmacao_automatica = true` | `CONFIRMADO` |
| `confirmacao_automatica = false` | `AGUARDANDO` |
| Criado pelo gestor (`origem = ADMIN`) | `CONFIRMADO` sempre |

### 5.2 Conclusão do atendimento

```
CONFIRMADO
  └─ gestor toca em "Concluir"
       └─ modal: valor previsto (editável) + observação
            ├─ agendamentos.status ← CONCLUIDO
            └─ INSERT lancamentos (tipo = AGENDAMENTO)
```

O valor previsto vem de `valor_total_snapshot` — a soma dos itens — e é editável no ato, o que cobre procedimento adicional e desconto. Ajustes posteriores ocorrem diretamente em `lancamentos`, sem alterar o agendamento.

### 5.3 Lançamento manual

Tela única com duas abas, para registrar atendimentos que não passaram pelo sistema:

| Aba | Campos | Tipo |
|---|---|---|
| Atendimento avulso | data, profissional (opcional), serviço (opcional), nome do cliente (livre), valor, observação | `AVULSO` |
| Total do dia | data, profissional (opcional), quantidade de atendimentos, valor total, observação | `TOTAL_DIA` |

Restrição: um único lançamento `TOTAL_DIA` por data e profissional, para impedir duplicação acidental.

### 5.4 Remarcação

Ação única no card do agendamento, disponível ao gestor na v1. Abre o seletor de horário e executa em uma transação:

```
1. INSERT novo agendamento (nova data/hora, status CONFIRMADO,
                            cliente / profissional herdados)
2. INSERT agendamento_itens (mesmos serviços, snapshots recopiados
                             do catálogo atual)
3. antigo.status ← CANCELADO
   antigo.tipo_cancelamento ← REMARCACAO
4. cancela notificações pendentes do antigo
5. agenda notificação: agendamento_remarcado
```

**A ordem importa.** O novo agendamento é inserido primeiro: se o horário de destino tiver sido ocupado nesse intervalo, a constraint aborta a transação inteira e o agendamento original permanece intacto. Na ordem inversa, o slot antigo seria liberado antes de garantir o novo.

O botão precisa existir na interface. Sem ele, o gestor cancela e cria manualmente, e a distinção entre desistência e remarcação se perde na origem.

### 5.5 Cancelamento pelo cliente

```
Link de gestão (token) ou área logada
  └─ verifica agora + prazo_cancelamento_min ≤ inicia_em
       ├─ dentro do prazo  → cancela, tipo DESISTENCIA, notifica gestor
       └─ fora do prazo    → orienta contato direto com o estabelecimento
```

### 5.6 Fechamento de pendências

Não existe marcação automática de falta. Um job que converte agendamentos vencidos em `FALTOU` captura, na prática, o gestor que esqueceu de fechar — produzindo receita não lançada e taxa de falta inventada.

Em vez disso, a agenda destaca os agendamentos `CONFIRMADO` cujo `termina_em` já passou, com contador no topo e dois botões no card: concluir ou marcar falta.

```sql
SELECT count(*) FROM agendamentos
WHERE estabelecimento_id = ?
  AND status = 'CONFIRMADO'
  AND termina_em < now()
```

Se a automação vier a ser desejada, deve ficar atrás de configuração desligada por padrão, com carência de algumas horas.

### 5.7 Expiração de solicitações pendentes

Com `confirmacao_automatica = false`, um agendamento `AGUARDANDO` ocupa o slot. Sem prazo, um pedido que o gestor não viu bloqueia o horário até a data chegar.

O worker cancela automaticamente as solicitações `AGUARDANDO` que atingirem **24 horas sem decisão** ou cuja data de início tenha passado, o que vier primeiro:

```
status            ← CANCELADO
tipo_cancelamento ← EXPIRACAO
cancelado_por     ← SISTEMA
notifica          → cliente (solicitacao_expirada) e gestor
```

Isso não contradiz a decisão de não marcar falta automaticamente (decisão 11). Marcar falta inventa um fato sobre o comportamento do cliente; expirar uma solicitação registra a inação do próprio estabelecimento e libera um slot que ninguém garantiu. A agenda também destaca as solicitações pendentes no topo, para que a expiração seja o caminho raro.

### 5.8 Indicação visual de progresso e atraso

Não existe estado intermediário de atendimento em curso, nem registro de duração real. A posição no tempo já produz todas as leituras necessárias:

| Condição (status = `CONFIRMADO`) | Exibição |
|---|---|
| `agora < inicia_em` | Agendado |
| `inicia_em ≤ agora ≤ termina_em` | Em andamento (destaque sutil) |
| `agora > termina_em` | Pendente de fechamento (destaque de ação) |
| `agora > inicia_em` e o anterior ainda não foi fechado | Atrasado (marcador no card seguinte) |

**Atraso é decisão de interface, não de modelo.** Nenhum campo, estado ou transição corresponde a ele: é derivado da comparação entre o relógio e os horários já gravados, calculado na renderização. Um procedimento de 30 minutos que levou uma hora simplesmente mantém o card como pendente de fechamento, e o próximo aparece marcado como atrasado.

**O sistema não empurra a agenda.** Deslocar os agendamentos seguintes parece a solução óbvia e não é: cada deslocamento pode colidir com um bloqueio ou estourar a janela de trabalho, a constraint recusaria no meio do lote deixando o dia pela metade, e cada cliente afetado receberia uma mensagem de mudança de horário — cascata cara e confusa a partir de um toque. Na prática, o gestor atrasado já sabe que está atrasado, e o cliente na cadeira também.

O bloco reservado tem fim porque sem `termina_em` e `ocupacao_fim` não existe motor de disponibilidade nem constraint de exclusão. Esse fim é um **plano**, nunca uma medição. `folga_depois_min` é o amortecedor: serviço que estoura sistematicamente não é problema de atraso, é duração mal configurada, e a correção é ajustar o cadastro — apoiada pelo relatório de duração real vs. configurada, adiado para a fase 2.

`concluido_em` não pode ser usado como fim real do atendimento. Pela mesma razão da decisão 11, ele mede quando o gestor lembrou de fechar, não quando o cliente saiu.

### 5.9 Fechar a agenda: bloqueios e indisponibilidade

Cobre desde o imprevisto do dia ("passei mal") até o compromisso pontual ("casamento às 15h") e a ausência planejada (férias). Um único mecanismo: `excecoes_agenda` com `tipo = BLOQUEIO`, com ou sem `dia_inteiro`, referente a um profissional ou ao estabelecimento inteiro.

**Bloqueio não é redução de grade.** Reduzir a grade muda a regra para frente, e por isso os agendamentos existentes continuam válidos, apenas marcados como fora da grade (6.3). Um bloqueio afirma que aquele intervalo **não vai acontecer** — manter agendamentos dentro dele seria mentir para o gestor e para o cliente. Por isso os fluxos são diferentes.

```
Gestor cria bloqueio
  └─ sistema busca agendamentos que intersectam o intervalo
       (qualquer sobreposição de ocupacao_inicio/fim, inclusive parcial;
        status AGUARDANDO ou CONFIRMADO)
       ├─ nenhum      → cria o bloqueio
       └─ existem N   → tela de resolução
                          ├─ Cancelar todos e avisar   (ação primária)
                          └─ Resolver individualmente  (secundária)
```

O cancelamento em lote grava `tipo_cancelamento = INDISPONIBILIDADE`, `cancelado_por = EQUIPE`, e dispara `cancelado_pelo_estabelecimento` para cada cliente, em uma única transação com a criação do bloqueio.

**Precisa ser rápido.** O caso mais comum é mobile, sob pressão, às sete da manhã: dois toques, "bloquear hoje" e "cancelar todos e avisar". Se a tela exigir resolver doze agendamentos um a um, o gestor resolve por WhatsApp e o sistema fica com uma agenda que não corresponde à realidade — pior do que não ter sistema.

**A notificação leva o caminho de volta.** O template inclui link de reagendamento com os mesmos serviços pré-selecionados (`/agendar?servicos=…`), que converte muito melhor do que "entre em contato".

**`motivo` é interno.** "Consulta médica", "aniversário da minha filha" nunca aparecem para o cliente. Comunicar o motivo, se um dia fizer sentido, exige um segundo campo, opcional e explicitamente público.

**Transferir para outro profissional é ação individual**, feita no card. Em lote seria um mini-solver — precisa de alguém que execute todos os itens, com o bloco livre no mesmo horário, e o cliente pode ter escolhido aquele profissional de propósito. Lote fica para a fase 2, se houver demanda.

**Exibição.** Na agenda do gestor, faixa hachurada com o motivo, para que o dia vazio tenha explicação visível. Na página pública, nada: simplesmente não há slots, sem revelar ausência nem motivo.

---

## 6. Motor de disponibilidade

### 6.1 Algoritmo

```
função slots(tenant, itens[], profissionais[], data_inicio, data_fim):
  cfg   ← configuracoes(tenant)
  agora ← now()
  tz    ← tenant.fuso_horario

  elegiveis ← profissionais que executam TODOS os itens

  para cada profissional P em elegiveis:
    duracao     ← Σ duracao_efetiva(item, P)     -- override por profissional
    folga_ini   ← itens[primeiro].folga_antes_min
    folga_fim   ← itens[último].folga_depois_min

    para cada data D em [data_inicio, data_fim]:
      janelas ← horarios_trabalho(P, dia_semana(D), vigentes em D)
                → converte para UTC usando tz e D
      janelas += excecoes_agenda(P ou tenant, tipo = EXTRA, em D)
      janelas -= excecoes_agenda(P ou tenant, tipo = BLOQUEIO, em D)

      ocupado ← agendamentos(P, D, status ativo)   -- ocupacao_inicio / ocupacao_fim

      passo ← cfg.granularidade_slot_min

      para cada janela J, para cada início T em J a cada passo:
        fim_atend   ← T + duracao
        ocup_inicio ← T - folga_ini
        ocup_fim    ← fim_atend + folga_fim

        descarta se:
             fim_atend > J.fim
          ou (¬cfg.folga_pode_exceder_janela e ocup_fim > J.fim)
          ou [ocup_inicio, ocup_fim] intersecta ocupado
          ou T < agora + cfg.antecedencia_minima_min
          ou D > hoje + cfg.janela_agendamento_dias

        senão emite (T, P)

  agrupa por T   -- se "qualquer profissional", união dos profissionais
```

### 6.2 Múltiplos serviços

| Aspecto | Regra |
|---|---|
| Duração | Soma das durações efetivas dos itens, com override por profissional aplicado item a item |
| Folgas | `folga_antes` do primeiro item e `folga_depois` do último. Folgas intermediárias são ignoradas |
| Profissional elegível | Apenas quem executa **todos** os itens. Filtra a etapa 2 e o cálculo de slots |
| Limite | 1 a 5 itens por agendamento. Constante fixa, não configurável |
| Horário do item | Não existe. Os itens ocupam o bloco do agendamento em sequência, entre `inicia_em` e `termina_em` |
| Valor | Soma dos snapshots. `OCULTO` ou `A_PARTIR_DE` em qualquer item torna o total "a partir de" |

**Limitação aceita:** um serviço com `folga_depois` alta por natureza técnica — química, secagem — colocado no meio da sequência perde essa folga. A alternativa seria somar todas as folgas intermediárias, o que infla o bloco em todo agendamento múltiplo para cobrir um caso raro. Se algum nicho tornar isso frequente, a correção é somar as folgas apenas de serviços marcados com um sinalizador próprio.

Dar horário próprio a cada item permitiria intervalo entre serviços e profissional diferente por item. Isso é outro produto, e fica fora de todas as fases previstas.

### 6.3 Regras e casos de borda

| Situação | Comportamento |
|---|---|
| Gestor reduz horário com agendamentos futuros fora da nova grade | Nada é cascateado. Ao salvar, o sistema lista os agendamentos afetados e oferece manter, notificar ou remarcar. Eles permanecem válidos, marcados visualmente como fora da grade. |
| Gestor bloqueia intervalo com agendamentos dentro | Tratamento distinto do anterior: o intervalo não vai acontecer. Tela de resolução com cancelamento em lote como ação primária (5.9). |
| Alteração de grade | Nunca `UPDATE` retroativo. Fecha `vigencia_fim` da linha atual e insere nova. Semântica em 6.5. |
| Serviço muda de duração ou valor | Snapshots dos itens não se movem. Apenas novas reservas usam o valor novo. |
| Desativar profissional ou serviço com agenda futura | Ação bloqueada até resolver. Oferece transferência em lote ou cancelamento com notificação. `servicos.ativo = false` afeta apenas o catálogo público, nunca o histórico. |
| Fuso e horário de verão | `horarios_trabalho` em hora local, convertido por data. Nunca pré-calcular intervalos UTC para uma semana — em transição de DST o dia tem 23 ou 25 horas. |
| Folga excedendo a janela de trabalho | O atendimento precisa caber na janela; a folga pode transbordar, por ser preparo e não atendimento. Configurável em `folga_pode_exceder_janela`. |
| "Qualquer profissional" | Exibe a união das disponibilidades entre os elegíveis. Define o profissional na confirmação: o menos ocupado no dia, desempate determinístico por id. Grava `qualquer_profissional = true`. |
| Encaixe | Agendamento com `encaixe = true` fica fora da constraint de sobreposição. Exclusivo do painel, com confirmação explícita e marcação visual. Nunca disponível no fluxo público. |
| Cache | Sob demanda, com cache curto (30–60s) por tenant + profissional + data, invalidado a cada escrita em agendamentos, exceções ou grade. Não materializar tabela de slots. |

### 6.4 Duas consultas distintas

O calendário da etapa 3 precisa saber apenas **quais dias têm alguma vaga**, para um mês inteiro. Rodar o algoritmo completo para 30 dias e descartar o resultado é a query mais cara do sistema, exposta em endpoint público e sem autenticação.

| Endpoint | Retorno | Comportamento |
|---|---|---|
| `dias_com_vaga(mês)` | Conjunto de datas | Saída antecipada no primeiro slot válido de cada dia |
| `slots(data)` | Lista de horários | Algoritmo completo, um dia só |

Ambos partem da mesma função de domínio; muda apenas o critério de parada. Os dois merecem rate limit por IP.

### 6.5 Vigência da grade

- `vigencia_inicio` e `vigencia_fim` são **inclusivas**.
- Toda alteração vale **a partir da data em que foi feita**. Não existe, na v1, interface para agendar mudança futura de grade.
- Ao alterar: fecha as linhas vigentes com `vigencia_fim = hoje - 1 dia` e insere as novas com `vigencia_inicio = hoje`.
- Alterações no mesmo dia sobrescrevem as linhas criadas hoje (`UPDATE` ou delete e insert), em vez de gerar versões de vigência vazia. Corrigir um erro de digitação não é uma versão da grade.

### 6.6 Janela de agendamento

`janela_agendamento_dias` define quantos dias à frente o cliente enxerga. É configuração de tenant, não de serviço, e o wizard sugere o valor pelo segmento escolhido:

| Segmento | Sugestão |
|---|---|
| Barbearia, salão | 7 dias |
| Estética, procedimentos | 14 dias |
| Nutrição, saúde, consultoria | 30 dias |

Janela longa aumenta a exposição a imprevistos e tende a aumentar a falta — quanto mais distante a reserva, menos presente ela é na cabeça do cliente. Janela curta tem custo simétrico: quem planeja com antecedência não agenda. Os defaults acima são deliberadamente curtos, porque errar para menos é recuperável (o cliente volta, ou liga) e errar para muito só aparece semanas depois, na forma de falta e de cancelamento em massa. Como o ponto ótimo varia por negócio e não por tecnologia, o gestor ajusta.

A janela mitiga apenas o imprevisto **desconhecido** na data da reserva. Compromisso já marcado é responsabilidade do bloqueio preventivo, oferecido no onboarding e disponível a qualquer momento (5.9).

Janela por serviço — a mesma estética que aceita "dia da noiva" com seis meses e limpeza de pele com trinta dias — é coluna anulável em `servicos` mais um `min()` no motor, sem migração dolorosa. Fica para a fase 2, quando houver demanda concreta.

### 6.7 Estratégia de slots

| Estratégia | Comportamento | Avaliação |
|---|---|---|
| `GRADE` | Candidatos alinhados à granularidade (09:00, 09:15, 09:30…) | **Padrão.** Previsível para o cliente. |
| `COMPACTO` | Próximo slot imediatamente após o fim do último agendamento | Maximiza ocupação, mas o horário disponível muda sozinho e confunde. |

---

## 7. Máquina de estados do agendamento

### 7.1 Estados

| Estado | Significado | Ocupa a agenda |
|---|---|:-:|
| `AGUARDANDO` | Criado, pendente de aprovação do gestor | Sim |
| `CONFIRMADO` | Vaga garantida | Sim |
| `CONCLUIDO` | Atendimento realizado | Sim |
| `CANCELADO` | Desfeito antes de acontecer | Não |
| `FALTOU` | Cliente não compareceu | Não |

```
AGUARDANDO ──confirma──► CONFIRMADO ──conclui──► CONCLUIDO
     │                        │
     └────cancela─────────────┼──────► CANCELADO
                              └──────► FALTOU
```

`CONCLUIDO` ocupa a agenda: sem isso seria possível agendar sobre um atendimento já realizado.

### 7.2 Transições

Papéis: **P** proprietário · **A** admin · **F** funcionário · **C** cliente · **S** sistema

| # | De → Para | Quem | Guardas | Efeitos |
|---|---|---|---|---|
| 1 | `AGUARDANDO` → `CONFIRMADO` | P A F | Slot ainda livre | Notifica cliente; grava `confirmado_em` |
| 2 | `AGUARDANDO` → `CANCELADO` | P A F C S | Cliente: dentro do prazo. Sistema: 24h sem decisão ou data vencida (5.7) | Notifica a outra parte |
| 3 | `CONFIRMADO` → `CONCLUIDO` | P A F | — | **Cria lançamento**; grava `concluido_em` |
| 4 | `CONFIRMADO` → `CANCELADO` | P A F C | Cliente: dentro do prazo | Notifica; cancela lembretes pendentes |
| 5 | `CONFIRMADO` → `FALTOU` | P A F | Somente após `termina_em` | Nenhuma notificação por padrão |
| 6 | `CONCLUIDO` → `CONFIRMADO` | P A | Até 30 dias após a conclusão | **Estorna lançamento** (linha de sinal contrário); auditoria |
| 7 | `FALTOU` → `CONFIRMADO` | P A F | — | Auditoria |
| 8 | `FALTOU` → `CONCLUIDO` | P A F | — | **Cria lançamento** |
| 9 | `CANCELADO` → `CONFIRMADO` | P A | Slot precisa estar livre | Notifica cliente |

A transição 7 existe porque `FALTOU` é a marcação mais frequentemente equivocada do sistema, e alimenta métrica sensível. Precisa ser trivialmente reversível.

### 7.3 Transições bloqueadas

| Bloqueio | Motivo |
|---|---|
| `CONCLUIDO` → `CANCELADO` direto | Force passar pela transição 6, para que o estorno do lançamento seja explícito e auditado |
| `AGUARDANDO` → `CONCLUIDO` | Registraria receita de atendimento nunca aprovado |
| Funcionário sobre agendamento de outro profissional | Salvo `staff_ve_agenda_completa = true` |

### 7.4 O caixa é append-only

**Nenhuma linha de `lancamentos` é apagada ou tem o valor alterado.** Correção é sempre um lançamento novo: uma linha de estorno, de sinal contrário, apontando para a original, seguida — quando for o caso — do lançamento correto.

```
Concluiu por R$ 80, deveria ser R$ 120

  +8000  lançamento original
  -8000  estorno  → estorna_lancamento_id = original
 +12000  lançamento correto
  -----
 +12000  saldo
```

Livro-caixa é registro de fatos financeiros, e o padrão desse tipo de sistema é não mutar fato passado. Três consequências práticas, além da rastreabilidade:

- **Somar é à prova de erro.** Com exclusão lógica, todo relatório, exportação e totalizador precisaria lembrar de filtrar as linhas mortas, e esquecer infla o faturamento silenciosamente. Somar todas as linhas não tem como dar errado.
- **Um mecanismo em vez de dois.** Ajuste de valor e reabertura de atendimento passam a usar o mesmo primitivo.
- **O extrato responde sozinho.** "Por que o total de ontem mudou" deixa de depender da tabela de auditoria, que não tem interface.

Ajustar o valor de um atendimento concluído continua **não sendo uma transição de estado**: o agendamento permanece `CONCLUIDO` e apenas o caixa recebe as duas linhas novas. Tratar ajuste como transição poluiria o histórico com idas e voltas que não ocorreram. A auditoria registra o motivo:

```json
{ "acao": "estorno", "valor_centavos": [8000, 12000], "motivo": "procedimento adicional" }
```

**Exibição.** A lista do caixa mostra por padrão o valor líquido, com um marcador de "corrigido"; um toque revela as linhas que compõem o resultado. Ninguém quer ver `+80, −80, +120` no fechamento do dia.

### 7.5 Efeitos no caixa

Apenas três transições tocam o livro de lançamentos:

| Transição | Efeito |
|---|---|
| 3 e 8 | `INSERT lancamentos` (tipo `AGENDAMENTO`, valor informado no modal) |
| 6 | `INSERT lancamentos` de estorno: `valor_centavos` e `quantidade` negativos, `estorna_lancamento_id` apontando para o original |

O estorno replica `data_lancamento`, `profissional_id`, `servico_id` e `cliente_id` da linha original, para que qualquer agrupamento se anule exatamente. `quantidade` negativa é obrigatória, senão a contagem de atendimentos não fecha enquanto o valor fecha.

**A única mutação permitida no livro** é preencher `estornado_por_lancamento_id` na linha original, uma vez, nunca revertida. Existe para viabilizar a chave única parcial de 8.6 e não deve virar precedente para nenhum outro `UPDATE` na tabela.

`data_lancamento` recebe `date(inicia_em)` no fuso do tenant, não a data da conclusão: atendimento noturno fechado no dia seguinte pertence ao dia em que ocorreu. Caso contrário o fechamento diário nunca fecha.

`FALTOU` não gera lançamento. Cobrança de taxa de falta é lançamento avulso.

Nada disso torna o sistema uma contabilidade: continua sem partida dobrada, sem plano de contas e sem obrigação fiscal. É um livro append-only, que entrega a parte barata do benefício.

### 7.6 Notificações

| Gatilho | Template | Destinatário |
|---|---|---|
| Criação com `CONFIRMADO` | `agendamento_confirmado` | Cliente |
| Criação com `AGUARDANDO` | `aguardando_aprovacao` / `nova_solicitacao` | Cliente / gestor |
| Transição 1 | `agendamento_confirmado` | Cliente |
| Transições 2 e 4 por cliente | `cancelado_pelo_cliente` | Gestor |
| Transições 2 e 4 por gestor | `cancelado_pelo_estabelecimento` | Cliente |
| Transição 2 por sistema | `solicitacao_expirada` | Cliente e gestor |
| Remarcação | `agendamento_remarcado` | A outra parte |
| 24h antes | `lembrete_24h` | Cliente |
| 2h antes | `lembrete_2h` | Cliente |

Ao sair de um estado ativo, os lembretes futuros devem ser marcados como `CANCELADO`. Lembrete de consulta cancelada é a falha que mais gera reclamação neste tipo de sistema.

### 7.7 Auditoria

Toda transição, sem exceção:

```json
{
  "entidade": "agendamentos",
  "acao": "transicao",
  "diff": { "status": ["CONFIRMADO", "CANCELADO"] },
  "ator_usuario_id": "…",
  "criado_em": "…"
}
```

Ação do cliente via token de gestão: `ator_usuario_id` nulo, `ator_tipo = CLIENTE` e `cliente_id` preenchido. Ação do worker: `ator_tipo = SISTEMA`, ambos nulos.

### 7.8 Forma de implementação

As transições devem ser declaradas como dado, não como condicionais espalhadas:

```
TRANSICOES = [
  { de: AGUARDANDO, para: CONFIRMADO, papeis: [P,A,F],
    guardas: [slot_livre], efeitos: [notificar_cliente, marcar_confirmado] },
  …
]

função transicionar(agendamento, destino, ator):
  em transação:
    t ← busca(agendamento.status, destino)   ou erro TRANSICAO_INVALIDA
    verifica papel do ator em t.papeis       ou erro SEM_PERMISSAO
    se ator = FUNCIONARIO e ¬staff_ve_agenda_completa:
       exige agendamento.profissional_id = ator.profissional_id
    executa t.guardas                        ou erro GUARDA_FALHOU
    UPDATE status        -- a constraint de exclusão valida sobreposição
    executa t.efeitos
    grava auditoria
```

Tudo em transação única: se a constraint recusar, lançamento e notificação não podem ter ocorrido.

Dois ganhos: o backend expõe as transições válidas para o agendamento e o ator atual em um campo `acoes_disponiveis`, e o frontend renderiza os botões a partir dele, sem replicar regra. E adicionar um papel novo é editar uma lista.

---

## 8. Modelagem de dados

### 8.1 Convenções

- Nomenclatura em português, **sem acentos ou cedilha** nos identificadores.
- Timestamps também em português: `criado_em`, `atualizado_em`, `excluido_em`.
- Estrangeirismos permitidos (lista fechada): `slug`, `token`, `uuid`, `jsonb`, `status`.
- Todo `id` é `uuid`.
- Toda tabela de tenant tem `estabelecimento_id` indexado, com RLS ativo — inclusive tabelas de junção.
- Valores monetários em `int`, em centavos. Moeda fixa em BRL e idioma fixo em pt-BR — mercado nacional apenas, sem configuração regional.
- `excluido_em` (soft delete) onde há histórico dependente. Exceção: `lancamentos` é append-only e não tem exclusão nem edição (7.4).
- Isolamento: banco único compartilhado com `estabelecimento_id` e Row-Level Security (ver 9.6).
- `*` marca campo obrigatório.
- Enum não recebe valor sem funcionalidade correspondente em alguma fase planejada.

### 8.2 Estabelecimento e configuração

```
estabelecimentos
  id*                uuid PK
  slug*              varchar(50) UK        -- subdomínio e URL pública
  nome*              varchar(120)
  segmento           varchar(50)
  fuso_horario*      varchar(50)           -- America/Sao_Paulo, America/Manaus, America/Rio_Branco
  logo_url           text
  cor_tema           char(7)
  telefone_publico   varchar(20)
  endereco_publico   text
  plano*             varchar(30)
  status*            enum(ATIVO, SUSPENSO, TESTE, CANCELADO)
  criado_em*         timestamptz
  atualizado_em*     timestamptz
  excluido_em        timestamptz
```

`plano` e `status` existem como registro, sem cobrança nem bloqueio automático na v1 — o super admin está fora do escopo do MVP. Suspender um tenant é operação manual no banco.

```
configuracoes                              -- 1:1 com estabelecimentos
  estabelecimento_id*          uuid PK FK→estabelecimentos
  granularidade_slot_min*      int   default 15
  estrategia_slot*             enum(GRADE, COMPACTO) default GRADE
  antecedencia_minima_min*     int   default 60
  janela_agendamento_dias*     int   default 14      -- wizard ajusta por segmento (6.6)
  prazo_cancelamento_min*      int   default 1440
  confirmacao_automatica*      bool  default true
  permite_sem_cadastro*        bool  default true
  permite_multiplos_servicos*  bool  default true
  exige_otp_telefone*          bool  default false
  staff_ve_agenda_completa*    bool  default false
  folga_pode_exceder_janela*   bool  default true
  max_ativos_por_cliente       int   NULL
  criado_em* / atualizado_em*
```

Não existe tabela de permissões: a matriz de 2.3 é constante versionada no pacote de domínio.

### 8.3 Identidade e acesso

```
usuarios                                   -- identidade global, cross-tenant
  id*                     uuid PK
  nome*                   varchar(120)
  email*                  citext UK          -- gestor e cliente com conta
  telefone                varchar(20) NULL
  senha_hash              text NULL          -- NULL quando a conta é só Google
  email_verificado_em     timestamptz
  telefone_verificado_em  timestamptz        -- exigido para vincular histórico de convidado
  ultimo_login_em         timestamptz
  criado_em* / atualizado_em*
  UK (telefone) WHERE telefone_verificado_em IS NOT NULL
```

```
identidades_externas                       -- login social
  id*           uuid PK
  usuario_id*   uuid FK→usuarios
  provedor*     enum(GOOGLE)
  provedor_id*  varchar(120)
  email         citext
  criado_em*
  UK (provedor, provedor_id)
```

```
codigos_verificacao                        -- OTP e link mágico
  id*           uuid PK
  destino*      varchar(160)               -- telefone ou e-mail
  canal*        enum(SMS, WHATSAPP, EMAIL)
  codigo_hash*  text                       -- nunca o código em texto
  tentativas*   int default 0
  expira_em*    timestamptz
  consumido_em  timestamptz
  ip            inet
  criado_em*
  IDX (destino, expira_em)
```

```
sessoes
  id*                  uuid PK
  usuario_id*          uuid FK→usuarios
  refresh_token_hash*  text
  user_agent           text
  ip                   inet
  ultimo_uso_em        timestamptz
  expira_em*           timestamptz
  revogada_em          timestamptz
  IDX (usuario_id, expira_em)
```

A tabela `sessoes` permite revogar imediatamente o acesso de um funcionário desligado, sem esperar o token expirar.

```
vinculos                                   -- usuário × estabelecimento
  id*                  uuid PK
  usuario_id*          uuid FK→usuarios
  estabelecimento_id*  uuid FK→estabelecimentos
  papel*               enum(PROPRIETARIO, ADMIN, FUNCIONARIO)
  status*              enum(CONVIDADO, ATIVO, DESATIVADO)
  convidado_em         timestamptz
  criado_em* / atualizado_em*
  UK (usuario_id, estabelecimento_id)
  -- regra: exatamente um PROPRIETARIO ativo por estabelecimento
```

```
profissionais                              -- quem recebe agendamentos
  id*                  uuid PK
  estabelecimento_id*  uuid FK→estabelecimentos
  vinculo_id           uuid FK→vinculos NULL      -- NULL = sem login
  nome_exibicao*       varchar(120)
  bio                  text
  avatar_url           text
  ativo*               bool default true
  posicao              int
  criado_em* / atualizado_em* / excluido_em
  UK (vinculo_id) WHERE vinculo_id IS NOT NULL
```

O profissional herda sempre o fuso do estabelecimento. Fuso por profissional foi descartado: em atendimento presencial no mercado nacional o caso não ocorre, e é a variável que mais complica o motor, por impedir tratar a data inteira em um fuso só.

```
clientes                                   -- escopo do estabelecimento
  id*                  uuid PK
  estabelecimento_id*  uuid FK→estabelecimentos
  usuario_id           uuid FK→usuarios NULL   -- NULL = convidado ou cadastro do gestor
  nome*                varchar(120)
  telefone*            varchar(20)
  email                citext
  data_nascimento      date
  observacoes_internas text                    -- nunca exposto ao cliente
  bloqueado*           bool default false
  motivo_bloqueio      varchar(200)
  criado_em* / atualizado_em* / excluido_em
  UK (estabelecimento_id, telefone)
  UK (estabelecimento_id, email) WHERE email IS NOT NULL
```

### 8.3.1 Reconciliação de cliente no agendamento

O telefone é a chave de identidade do cliente dentro do tenant. Ao receber um agendamento público:

```
busca clientes por (estabelecimento_id, telefone)
  ├─ não existe → INSERT com nome, telefone e e-mail informados
  └─ existe
       ├─ bloqueado = true → recusa (ver abaixo)
       ├─ nome informado ≠ nome cadastrado
       │     → mantém o nome cadastrado, NÃO sobrescreve
       │       registra o nome divergente em auditoria
       └─ e-mail informado e cadastro sem e-mail → preenche
```

**O nome nunca é sobrescrito automaticamente.** O gestor pode ter corrigido a grafia ou anotado algo que o distingue de outro cliente, e um agendamento feito pelo cônjuge com o mesmo telefone renomearia a ficha inteira. A divergência aparece no card do agendamento como "informado: {nome}", e o gestor decide.

**Isso não conflita com a decisão 23.** Reconciliar por telefone não verificado dentro do tenant é aceitável porque não concede leitura de nada: o acesso ao histórico continua sendo por `token_gestao`, um por agendamento. A exigência de OTP existe apenas para **expor histórico anterior** a uma conta, que é o que permitiria alguém digitar o número de outra pessoa e ver os agendamentos dela.

**Cliente bloqueado.** No fluxo público, a confirmação é recusada com mensagem genérica ("não foi possível concluir, entre em contato com o estabelecimento") — nunca revelando que existe bloqueio, o que só ensinaria a contorná-lo. O gestor recebe notificação da tentativa. No painel, o gestor pode agendar para um cliente bloqueado com confirmação explícita. O bloqueio é contornável trocando o telefone; é uma medida de atrito, não de segurança, e a interface não deve prometer mais do que isso.

### 8.4 Catálogo

```
categorias_servico
  id*                  uuid PK
  estabelecimento_id*  uuid FK→estabelecimentos
  nome*                varchar(80)
  posicao              int
  criado_em* / atualizado_em*
```

```
servicos
  id*                  uuid PK
  estabelecimento_id*  uuid FK→estabelecimentos
  categoria_id         uuid FK→categorias_servico NULL
  slug*                varchar(60)           -- deep link /agendar?servico=
  nome*                varchar(120)
  descricao            text
  duracao_min*         int
  folga_antes_min*     int default 0
  folga_depois_min*    int default 0
  valor_centavos       int NULL
  exibicao_valor*      enum(FIXO, A_PARTIR_DE, OCULTO, GRATUITO) default FIXO
  cor                  char(7)
  ativo*               bool default true     -- false remove do catálogo público
  posicao              int
  criado_em* / atualizado_em* / excluido_em
  UK (estabelecimento_id, slug)
```

Serviços representam unidades atômicas de atendimento, nunca combinações. "Cabelo + Barba" como serviço torna "quantos cortes fiz no mês" uma pergunta sem resposta e multiplica o trabalho de reajustar preço. Combinação é responsabilidade de `agendamento_itens`.

```
profissionais_servicos                     -- N:N com override
  estabelecimento_id*      uuid FK→estabelecimentos
  profissional_id*         uuid FK→profissionais
  servico_id*              uuid FK→servicos
  duracao_override_min     int NULL
  valor_override_centavos  int NULL
  PK (profissional_id, servico_id)
  IDX (estabelecimento_id)
```

`estabelecimento_id` é redundante em relação às duas FKs, mas necessário para que a política de RLS se aplique à tabela de junção sem join.

### 8.5 Disponibilidade e agenda

```
horarios_trabalho                          -- grade semanal recorrente
  id*                  uuid PK
  estabelecimento_id*  uuid FK→estabelecimentos
  profissional_id*     uuid FK→profissionais
  dia_semana*          smallint            -- 0 = domingo … 6 = sábado
  hora_inicio*         time                -- hora LOCAL
  hora_fim*            time
  vigencia_inicio*     date                -- inclusiva
  vigencia_fim         date NULL           -- inclusiva; NULL = vigente
  criado_em*
  IDX (profissional_id, dia_semana, vigencia_inicio)
  -- múltiplas linhas no mesmo dia representam intervalos (08–12, 13–18)
  -- semântica de alteração em 6.5
```

```
excecoes_agenda                            -- bloqueios e disponibilidades extras
  id*                  uuid PK
  estabelecimento_id*  uuid FK→estabelecimentos
  profissional_id      uuid FK→profissionais NULL   -- NULL = todo o estabelecimento
  tipo*                enum(BLOQUEIO, EXTRA)
  inicia_em*           timestamptz
  termina_em*          timestamptz
  dia_inteiro*         bool default false
  motivo               varchar(120)                 -- interno, nunca exposto ao cliente
  criado_em*
  IDX (estabelecimento_id, inicia_em, termina_em)
```

```
agendamentos
  id*                        uuid PK
  estabelecimento_id*        uuid FK→estabelecimentos
  cliente_id*                uuid FK→clientes
  profissional_id*           uuid FK→profissionais
  inicia_em*                 timestamptz     -- atendimento
  termina_em*                timestamptz
  ocupacao_inicio*           timestamptz     -- com folgas; base do anti-conflito
  ocupacao_fim*              timestamptz
  status*                    enum(AGUARDANDO, CONFIRMADO, CONCLUIDO, CANCELADO, FALTOU)
  valor_total_snapshot       int NULL        -- Σ itens, congelado na reserva
  duracao_total_min_snapshot* int            -- Σ itens
  origem*                    enum(PUBLICO, ADMIN)
  qualquer_profissional*     bool default false
  encaixe*                   bool default false
  observacoes_cliente        text
  observacoes_internas       text
  token_gestao               varchar(64) UK NULL
  token_gestao_expira_em     timestamptz NULL
  tipo_cancelamento          enum(DESISTENCIA, REMARCACAO, INDISPONIBILIDADE, EXPIRACAO) NULL
  criado_por_usuario_id      uuid FK→usuarios NULL
  confirmado_em              timestamptz
  concluido_em               timestamptz
  cancelado_em               timestamptz
  cancelado_por              enum(CLIENTE, EQUIPE, SISTEMA) NULL
  motivo_cancelamento        varchar(200)
  criado_em* / atualizado_em*

  IDX (estabelecimento_id, profissional_id, inicia_em)
  IDX (estabelecimento_id, inicia_em) WHERE status IN ('AGUARDANDO','CONFIRMADO')
  IDX (estabelecimento_id, cliente_id, inicia_em DESC)

  EXCLUDE USING gist (
    profissional_id WITH =,
    tstzrange(ocupacao_inicio, ocupacao_fim) WITH &&
  ) WHERE (status IN ('AGUARDANDO','CONFIRMADO','CONCLUIDO') AND encaixe = false)
```

Os totais são denormalizados de propósito: a listagem da agenda e o Resumo precisam deles sem join, e são imutáveis após a criação — o risco habitual de denormalização não existe aqui.

A constraint de exclusão torna o duplo agendamento impossível no nível do banco, independentemente de condição de corrida na aplicação. Requer a extensão `btree_gist` no PostgreSQL. Em outro SGBD, será necessário resolver com lock pessimista ou chave única sobre slots materializados — ponto a considerar na escolha da stack.

```
agendamento_itens                          -- serviços do agendamento, em sequência
  id*                       uuid PK
  estabelecimento_id*       uuid FK→estabelecimentos
  agendamento_id*           uuid FK→agendamentos
  servico_id*               uuid FK→servicos
  posicao*                  int
  duracao_min_snapshot*     int
  valor_centavos_snapshot   int NULL
  criado_em*
  UK (agendamento_id, posicao)
  IDX (estabelecimento_id, servico_id)
  -- 1 a 5 itens por agendamento, validado na aplicação
  -- itens não têm horário próprio: ocupam o bloco em sequência
```

### 8.6 Financeiro, notificações e auditoria

```
lancamentos                                -- livro-caixa append-only: fonte única do financeiro
  id*                          uuid PK
  estabelecimento_id*          uuid FK→estabelecimentos
  data_lancamento*             date
  profissional_id              uuid FK→profissionais NULL
  tipo*                        enum(AGENDAMENTO, AVULSO, TOTAL_DIA)
  agendamento_id               uuid FK→agendamentos NULL
  servico_id                   uuid FK→servicos NULL   -- apenas quando tipo = AVULSO
  cliente_id                   uuid FK→clientes NULL
  nome_cliente                 varchar(120) NULL       -- nome livre, sem cadastro
  quantidade*                  int default 1           -- negativa no estorno
  valor_centavos*              int                     -- negativo no estorno
  observacao                   text
  estorna_lancamento_id        uuid FK→lancamentos NULL  -- esta linha estorna aquela
  estornado_por_lancamento_id  uuid FK→lancamentos NULL  -- aquela foi estornada por esta
  criado_por_usuario_id*       uuid FK→usuarios
  criado_em*

  UK (agendamento_id) WHERE agendamento_id IS NOT NULL
                        AND estorna_lancamento_id IS NULL
                        AND estornado_por_lancamento_id IS NULL
  UK (estabelecimento_id, data_lancamento, profissional_id)
     WHERE tipo = 'TOTAL_DIA'
       AND estorna_lancamento_id IS NULL
       AND estornado_por_lancamento_id IS NULL
  UK (estorna_lancamento_id) WHERE estorna_lancamento_id IS NOT NULL
  CHECK ((tipo = 'AGENDAMENTO') = (agendamento_id IS NOT NULL))
  CHECK (servico_id IS NULL OR tipo = 'AVULSO')
  IDX (estabelecimento_id, data_lancamento)
```

Sem `atualizado_em` e sem `excluido_em`: linha de caixa não é editada nem apagada (7.4). A única exceção é `estornado_por_lancamento_id`, preenchido uma vez na linha original.

As chaves únicas parciais consideram apenas linhas **originais e não estornadas** — assim reconcluir um atendimento após estorno funciona, e um `TOTAL_DIA` corrigido pode ser relançado na mesma data. `UK (estorna_lancamento_id)` impede estornar a mesma linha duas vezes.

`servico_id` não se aplica a `tipo = AGENDAMENTO`, porque o agendamento pode ter vários serviços. Faturamento por serviço sai de `agendamento_itens` — com a ressalva de 9.3.

**Toda leitura financeira soma todas as linhas do período, sem filtro.** É a propriedade que torna o modelo à prova de erro: não existe cláusula que alguém possa esquecer.

```
notificacoes
  id*                  uuid PK
  estabelecimento_id*  uuid FK→estabelecimentos
  agendamento_id       uuid FK→agendamentos NULL
  canal*               enum(EMAIL, SMS, WHATSAPP, PUSH)
  template*            varchar(60)
  destinatario*        varchar(160)
  agendada_para*       timestamptz
  enviada_em           timestamptz
  status*              enum(PENDENTE, ENVIADA, FALHOU, CANCELADA)
  erro                 text
  criado_em*
  IDX (status, agendada_para)
```

```
auditoria
  id*                  uuid PK
  estabelecimento_id*  uuid FK→estabelecimentos
  ator_usuario_id      uuid FK→usuarios NULL
  ator_tipo            enum(USUARIO, CLIENTE, SISTEMA)
  cliente_id           uuid FK→clientes NULL
  entidade*            varchar(60)
  entidade_id*         uuid
  acao*                varchar(40)      -- criacao, transicao, valor_alterado, exclusao
  diff                 jsonb            -- { campo: [antes, depois] }
  ip                   inet
  criado_em*
  IDX (estabelecimento_id, entidade, entidade_id)
  IDX (criado_em)                       -- expurgo
```

**Retenção: 24 meses.** A tabela cresce mais rápido que `agendamentos` e é a que mais surpreende na fatura do banco. O expurgo diário do worker remove o que ultrapassa a janela. Se a tabela particionada por mês estiver disponível na stack escolhida, particionar em vez de deletar.

### 8.7 Glossário de campos recorrentes

| Conceito | Campo |
|---|---|
| Tenant | `estabelecimento_id` |
| Início e fim | `inicia_em` / `termina_em` |
| Ocupação com folgas | `ocupacao_inicio` / `ocupacao_fim` |
| Folga antes / depois | `folga_antes_min` / `folga_depois_min` |
| Duração | `duracao_min` / `duracao_total_min_snapshot` |
| Valor | `valor_centavos` / `valor_total_snapshot` |
| Dia da semana | `dia_semana` |
| Vigência | `vigencia_inicio` / `vigencia_fim` |
| Origem | `origem` |
| Tipo | `tipo` |
| Papel | `papel` |
| Token de gestão | `token_gestao` |
| Data do lançamento | `data_lancamento` |
| Fuso horário | `fuso_horario` |

---

## 9. Regras transversais

### 9.1 Separação entre métricas operacionais e financeiras

Regra de maior risco do sistema. As duas origens **não podem** ser misturadas:

| Métrica | Fonte |
|---|---|
| Taxa de falta | `agendamentos` |
| Taxa de cancelamento | `agendamentos`, excluindo `tipo_cancelamento` `REMARCACAO` e `EXPIRACAO` |
| Taxa de remarcação | `agendamentos`, apenas `tipo_cancelamento = REMARCACAO` |
| Taxa de ocupação | `agendamentos`, excluindo `encaixe = true` |
| Clientes novos vs. recorrentes | `agendamentos` |
| Horários de pico | `agendamentos` |
| Serviços mais executados | `agendamento_itens` |
| Faturamento | `lancamentos`, soma de todas as linhas do período |
| Ticket médio | `lancamentos`, soma de valores ÷ soma de quantidades |

Somar lançamento agregado do dia em taxa de ocupação produz um número silenciosamente errado — e ninguém percebe até tomar uma decisão ruim com base nele.

Na interface, rotular as áreas como **Agenda** e **Caixa**, e exibir em todo relatório financeiro quanto veio de dentro e quanto veio de fora do sistema.

### 9.2 Três valores distintos

| Campo | Onde | Significado |
|---|---|---|
| `servicos.valor_centavos` | Catálogo | Referência exibida ao cliente |
| `agendamento_itens.valor_centavos_snapshot` | Item | Congelado no momento da reserva |
| `agendamentos.valor_total_snapshot` | Agendamento | Soma dos itens, congelada |
| `lancamentos.valor_centavos` | Caixa | O que efetivamente foi cobrado |

`exibicao_valor` permite `FIXO`, `A_PARTIR_DE`, `OCULTO` e `GRATUITO`. Sem isso, nichos que não publicam preço fechado ficam sem alternativa honesta. Em agendamento com múltiplos itens, basta um item `OCULTO` ou `A_PARTIR_DE` para o total ser exibido como "a partir de".

### 9.3 Faturamento por serviço é aproximado

O valor efetivo vive em `lancamentos`, no agendamento inteiro, e o gestor pode editá-lo na conclusão. Quando há mais de um item, não existe forma exata de saber quanto do total coube a cada serviço.

Qualquer relatório de receita por serviço precisará ratear o valor do lançamento proporcionalmente aos snapshots dos itens — número útil para comparação relativa, impróprio para conferência contábil. **Contagem** de execuções por serviço, essa sim, é exata e sai direto de `agendamento_itens`.

Registrar isso agora evita que alguém construa o relatório na fase 2 assumindo uma precisão que o modelo não tem. Capturar valor por item exigiria pedir ao gestor a quebra na conclusão — atrito diário para uma informação que quase ninguém usa.

### 9.4 Fuso horário

Todos os timestamps em `timestamptz` (UTC). Grade de trabalho em hora local mais o fuso do estabelecimento, convertida por data. Não existe fuso por profissional.

### 9.5 Agendamento sem cadastro

**Nome, telefone e e-mail são obrigatórios na v1.** O telefone é a chave de identidade dentro do tenant (8.3.1); o e-mail é o único canal de entrega existente antes da fase 2, e sem ele o convidado sai da tela de confirmação sem nenhuma forma de alcançar o próprio agendamento — não recebe o `token_gestao`, não recebe lembrete e não consegue cancelar.

`exige_otp_telefone` permite ao tenant exigir verificação do telefone, mas permanece inerte na v1, que não tem provedor de mensagens. Sem verificação, o sistema acumula agendamento fantasma; com verificação obrigatória, adiciona atrito onde talvez não seja necessário. A decisão fica com o tenant a partir da fase 2.

Quando houver canal de mensagem (fase 2), o e-mail pode voltar a ser opcional para quem informar telefone verificado.

### 9.6 Isolamento entre tenants

O RLS é a **segunda** linha de defesa, não a única:

- Toda query da camada de acesso a dados filtra `estabelecimento_id` explicitamente. O filtro é responsabilidade do código; a política de banco existe para conter o erro humano, não para substituí-lo.
- A variável de sessão que alimenta a política precisa ser definida no início de cada request **e limpa ao devolver a conexão ao pool**. Esquecer isso é o bug clássico do modelo: vaza dados de outro tenant sem lançar erro.
- O fluxo público usa um papel de banco separado, com acesso somente a leitura de catálogo, grade e existência de ocupação, e escrita restrita a `clientes`, `agendamentos` e `agendamento_itens`. A página pública nunca deve alcançar `lancamentos`, `observacoes_internas` ou `auditoria`.
- Testes automatizados de isolamento — dois tenants, uma tentativa de leitura cruzada — devem existir desde a primeira semana, porque a falha é silenciosa.

### 9.7 PWA

- Manifest dinâmico por tenant na página pública: o cliente instala o nome e o ícone do estabelecimento, não o do sistema.
- App do gestor: offline-first para leitura da agenda do dia. Escrita apenas online — fila de sincronização em agendamento gera conflitos difíceis de resolver.
- Página pública: network-first, sem exceção.
- Push funciona em Android e desktop; no iOS exige que o usuário adicione à tela de início (16.4+). O canal principal de lembrete deve ser e-mail ou WhatsApp.

### 9.8 Escopo de relatórios da v1

**Critério de corte:** um relatório só entra se responder a uma decisão concreta do gestor. Números consultados por curiosidade ficam de fora.

A v1 tem **uma única tela, chamada "Resumo"** — plural criaria expectativa de um menu com opções que não existem. Seletor de período (hoje, semana, mês, personalizado) e três blocos.

**Bloco 1 — Faturamento.** O único relatório indispensável: o gestor precisa fechar o dia e fechar o mês.

```sql
SELECT tipo, sum(valor_centavos), sum(quantidade)
FROM lancamentos
WHERE estabelecimento_id = ?
  AND data_lancamento BETWEEN ? AND ?
GROUP BY tipo
```

Sem filtro de exclusão: estornos são linhas negativas e se anulam na soma (7.4).

Exibe o total, a quebra entre `AGENDAMENTO`, `AVULSO` e `TOTAL_DIA` e a quantidade de atendimentos. A separação entre origem interna e externa exigida pela regra 9.1 sai da própria query.

**Bloco 2 — Agendamentos por desfecho.** Cinco contadores: concluídos, cancelados, faltas, remarcações e expirados.

```sql
SELECT status, tipo_cancelamento, count(*)
FROM agendamentos
WHERE estabelecimento_id = ? AND inicia_em::date BETWEEN ? AND ?
GROUP BY status, tipo_cancelamento
```

Sem percentual calculado. Ver 4 faltas em 30 atendimentos já basta para o gestor agir.

**Bloco 3 — Por profissional.** Exibido apenas quando houver dois ou mais profissionais ativos. Mesma query do bloco 1, agrupada por `profissional_id`. Em modelo de comissão isso deixa de ser relatório e passa a ser operação — daí a exceção.

**Exportação CSV** de `lancamentos`, `agendamentos` e `agendamento_itens` do período, com colunas cruas. É a válvula de escape: em vez de adivinhar quais cruzamentos o gestor vai querer, oferece-se o dado bruto e observa-se o que os primeiros clientes de fato exportam e pedem. Mais barato de construir e mais informativo do que decidir antecipadamente.

**Adiado para a fase 2:**

| Relatório | Motivo |
|---|---|
| Taxa de ocupação | Exige calcular capacidade a partir da grade menos exceções — o cálculo mais caro do conjunto. O gestor já vê a agenda cheia ou vazia olhando para ela. |
| Horários de pico | Precisa de volume para significar algo; com poucos meses de dados, mostra ruído. |
| Clientes novos vs. recorrentes | Não gera ação nos primeiros meses. |
| Ranking de serviços | Barato, mas já resolvido pelo CSV. Receita por serviço é aproximada (9.3); contagem é exata. |
| Duração média real vs. configurada | Depende do hábito de fechar atendimento estar consolidado. |
| Gráficos e séries temporais | Números em texto respondem tudo no início; gráfico com poucos pontos engana mais do que informa. |

**Por que adiar não custa nada:** todos os campos necessários já estão sendo capturados — `status`, `tipo_cancelamento`, `encaixe`, `origem`, `qualquer_profissional`, `data_lancamento`, `tipo`, além dos itens com seus snapshots. Nenhum relatório da fase 2 exigirá migração ou reprocessamento, apenas escrever a query. E `horarios_trabalho` versionado por vigência (decisão 18) é o que tornará a taxa de ocupação **retroativa** possível.

---

## 10. Autenticação e sessão

### 10.1 Princípio

Gestor e cliente têm necessidades opostas. Unificar a autenticação produz o pior dos dois mundos.

| | Gestor / equipe | Cliente |
|---|---|---|
| Frequência de acesso | Diária | A cada semanas ou meses |
| Consequência de perder acesso | Trabalho parado | Nenhuma — agenda como convidado |
| Identificador de login | E-mail | E-mail |
| Chave de deduplicação | — | Telefone |
| Precisa de conta | Sempre | Quase nunca |
| Acesso sem conta | Não existe | `token_gestao` por agendamento |

### 10.2 Gestor e equipe

- **E-mail e senha** como método base. Conta de trabalho, uso diário, precisa funcionar em qualquer dispositivo sem depender do celular.
- **Google como alternativa**, nunca substituto. Reduz atrito no cadastro e corta boa parte do suporte de recuperação de senha.
- **Sessão longa** (30 dias) com refresh. Pedir login semanalmente em PWA de uso diário é hostil.
- **Convite de equipe** por e-mail com token: `vinculos` nasce `CONVIDADO`, o convidado define senha ou entra com Google, passa a `ATIVO`.
- **Vinculação de contas:** cadastro por senha seguido de login Google no mesmo e-mail deve resolver para o **mesmo** registro em `usuarios`. Vincular pelo e-mail verificado, nunca criar duplicata.
- Apple Sign-In só faz sentido com app nativo. Fora do escopo, e por isso ausente do enum de provedores.

### 10.3 Cliente

Para o cliente, a melhor autenticação é **não ter autenticação**.

O `token_gestao` cobre todo o caso de uso real — ver e cancelar o próprio agendamento. Chega no e-mail de confirmação e funciona com um toque. Conta só agrega valor para quem quer histórico e preenchimento automático em agendamentos futuros.

A conta de cliente é, portanto, **opt-in**, oferecida na tela de confirmação ("quer acompanhar seus agendamentos?"), nunca exigida antes.

**Método: e-mail e senha, ou Google.** Mesmo mecanismo do gestor, o que evita construir dois sistemas de autenticação.

**Consequência a tratar:** o telefone é a chave de deduplicação em `clientes`. O e-mail da conta — sobretudo via Google — frequentemente não coincide com o informado no agendamento, e o Google não devolve telefone. Isso significa que criar conta **não vincula automaticamente** o histórico feito como convidado.

**Vincular o histórico exige telefone verificado por OTP.** Não como método de login, mas como confirmação de posse do número. Reconciliar por telefone não verificado permitiria que qualquer pessoa digitasse o número de outra e visse os agendamentos dela.

Na v1, sem provedor de mensagens, a ação "vincular meus agendamentos anteriores" não existe. Isso não prejudica o uso: cada agendamento continua acessível pelo seu próprio `token_gestao`, e a conta serve para preenchimento automático e histórico dali em diante.

**Custo assumido:** recuperação de senha também para o cliente — e-mail, token, expiração e tela.

### 10.4 Como funciona o OTP

Usado para **verificar posse de telefone**, não para autenticar. Dois casos: `exige_otp_telefone` ativo no agendamento de convidado, e vinculação de histórico à conta.

```
1. Cliente informa o telefone
2. Backend gera código de 6 dígitos
   - guarda o HASH (nunca o código em texto)
   - expira_em = agora + 5 min
   - registra destino, canal e IP
3. Envia pelo canal configurado
4. Cliente digita o código
5. Backend valida:
   - registro existe, não consumido, não expirado
   - hash(digitado) == codigo_hash
   - tentativas < 5
   ├─ ok    → marca consumido_em, grava telefone_verificado_em
   └─ falha → incrementa tentativas, mensagem genérica
```

**Proteções obrigatórias:**

| Proteção | Valor | Evita |
|---|---|---|
| Expiração curta | 5 min | Janela de uso de código interceptado |
| Limite de tentativas | 5, depois invalida | Força bruta — 6 dígitos são 1 milhão de combinações |
| Uso único | `consumido_em` | Replay do mesmo código |
| Rate limit de envio | 1/min e 5/hora por telefone | Uso do sistema para floodar um número, e custo descontrolado de mensagens |
| Rate limit por IP | 10/hora | Enumeração de telefones válidos |

Respostas sempre genéricas: "código enviado" mesmo para telefone inexistente, e erro de validação sem distinguir "não cadastrado" de "código incorreto". Diferenciar entrega quais números existem na base.

**Entrega abstraída desde o início.** A lógica é independente do canal:

```
enviar_codigo(destino, canal)
validar_codigo(destino, codigo)
```

Na v1 existe apenas a implementação `LOG`, que registra o código sem enviar nada. Testes e desenvolvimento leem o código do log ou do banco.

> **Restrição de segurança:** a implementação `LOG` e qualquer rota que exponha o código não podem existir no build de produção. Devem estar atrás de variável de ambiente e ausentes do artefato final. Um endpoint de desenvolvimento esquecido em produção é acesso irrestrito a qualquer conta.

Provedores reais (SMS ou WhatsApp) entram na fase 2, atrás da mesma interface. Custo de referência no Brasil: WhatsApp R$ 0,04–0,08 por mensagem (exige template aprovado pela Meta), SMS R$ 0,08–0,15.

### 10.5 Reconciliação de identidade

Ocorre quando o cliente verifica o telefone, não no cadastro:

```
Cliente verifica telefone por OTP
  ├─ existe outro usuarios com esse telefone verificado?
  │    ├─ sim  → conflito: exige resolução manual, não mescla automaticamente
  │    └─ não  → grava telefone_verificado_em na identidade atual
  └─ no tenant atual, existe clientes com esse telefone e usuario_id nulo?
       ├─ sim  → vincula: clientes.usuario_id ← usuarios.id
       │          (o histórico feito como convidado aparece)
       └─ não  → cria clientes vinculado
```

Como `usuarios` é global e `clientes` é por tenant, quem atende em três estabelecimentos tem **uma identidade e três fichas**. Cada gestor enxerga apenas a sua, com suas próprias observações internas.

Não confundir com 8.3.1: aquela reconciliação acontece dentro do tenant, por telefone não verificado, e não expõe histórico a ninguém. Esta expõe, e por isso exige OTP.

### 10.6 Sessão entre subdomínios

- **Autenticação centralizada** em `auth.dominio.com`, que emite o token para o subdomínio de destino.
- **Cookie de sessão no domínio pai** (`.dominio.com`), com `HttpOnly`, `Secure` e `SameSite=Lax`.
- **O tenant só enxerga o cliente quando existe um registro em `clientes` naquele tenant.** Estar logado não expõe a pessoa a estabelecimentos onde nunca agendou.

Na prática: cliente logado que abre a página de um tenant novo permanece anônimo para aquele tenant, mas o formulário já vem preenchido com nome e telefone — dado vindo da sessão, não do banco do estabelecimento.

### 10.7 Segurança do token de gestão

O link circula por WhatsApp e é encaminhável. Portanto:

- **Escopo de um único agendamento.** Nunca dá acesso ao histórico completo nem às observações internas.
- **Expiração** (`token_gestao_expira_em`): validade até alguns dias após o atendimento. Link permanente encaminhado em grupo é acesso permanente.
- **Aleatório e longo** (32 bytes), com rate limit por IP.
- **Ações destrutivas confirmadas na tela.** Nunca aceitar cancelamento por `GET` — preview de link em mensageiro dispara sozinho.

### 10.8 Fluxos

```
GESTOR — cadastro
  e-mail + senha  ou  Google
    → verifica e-mail  → cria estabelecimento  → wizard de onboarding

GESTOR — convite de equipe
  admin informa e-mail e papel
    → vinculos (CONVIDADO)  → e-mail com token
    → convidado define senha ou entra com Google  → vinculos (ATIVO)

CLIENTE — sem conta (padrão)
  agenda como convidado (nome, telefone, e-mail)
    → recebe link com token_gestao por e-mail
    → vê ou cancela aquele agendamento

CLIENTE — cria conta (opt-in)
  e-mail + senha  ou  Google
    → sessão  → passa a ter histórico dali em diante

CLIENTE — vincula histórico de convidado (fase 2)
  informa telefone  → recebe código  → valida
    → clientes.usuario_id preenchido  → histórico anterior aparece

CLIENTE — retorna
  já logado   → formulário preenchido, pula a etapa de identificação
  não logado  → e-mail e senha, Google, ou segue como convidado
```

---

## 11. Escopo do MVP

| Fase | Escopo |
|---|---|
| **MVP** | Estabelecimento e configurações, serviços, profissionais (com ou sem login), horários e exceções, **bloqueio de agenda com resolução em lote**, motor de disponibilidade, **agendamento com múltiplos serviços (1 a 5 itens)**, agendamento público com e sem cadastro, agenda do gestor com sinalização de atraso, cinco estados e nove transições, expiração automática de solicitações pendentes, **livro-caixa append-only** com lançamento manual, e-mail de confirmação e lembrete, worker de segundo plano, ambos os PWAs instaláveis. **Autenticação:** e-mail e senha com Google como alternativa, para gestor e cliente; convite de equipe por token; link de gestão por agendamento; lógica de OTP implementada sem provedor real |
| **Fase 2** | Verificação de telefone por OTP com provedor real, vinculação de histórico de convidado, WhatsApp, remarcação self-service pelo cliente (com `prazo_remarcacao_min`), pacotes promocionais (combinação de itens com preço próprio), janela de agendamento por serviço, transferência em lote de agendamentos entre profissionais, papel de recepção, fila de espera, e os relatórios adiados em 9.8 (ocupação, horários de pico, clientes novos vs. recorrentes, ranking de serviços, duração real vs. configurada, gráficos) |
| **Fase 3** | Recorrência, integração com Google Calendar, atendimento em grupo, API pública, agendamento por janela de chegada |

**Fora de escopo em todas as fases:** recurso físico (sala, equipamento), horário próprio por item de agendamento, fuso por profissional, deslocamento automático da agenda por atraso, antecedência mínima por serviço, registro de duração real do atendimento, processamento de pagamento, 2FA, moeda e idioma configuráveis.

---

## 12. Decisões registradas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Multi-tenant com banco compartilhado, `estabelecimento_id` e RLS | Melhor custo-benefício para SaaS multi-nicho. Schema por tenant só compensa com poucos clientes grandes. |
| 2 | Identidade global (`usuarios`) separada do vínculo por tenant (`vinculos`) | Mesma pessoa pode ser cliente de vários tenants e gestora de um. |
| 3 | Profissional desacoplado de usuário | Nem todo profissional acessa o sistema. |
| 4 | Profissional criado automaticamente para o proprietário | Faz o caso autônomo funcionar sem configuração e mantém `profissional_id` sempre obrigatório. |
| 5 | Recurso físico (sala, equipamento) descartado | Não é necessário para os nichos-alvo e a conta de disponibilidade compartilhada não compensa a complexidade. |
| 6 | Sistema não processa pagamento | Valor é referência e registro gerencial. |
| 7 | Livro-caixa unificado (`lancamentos`) como fonte única | O total do dia não é um agendamento; forçá-lo em `agendamentos` poluiria a agenda e distorceria toda métrica operacional. |
| 8 | Remoção do estado `EM_ATENDIMENTO` e do campo `checkin_em` | Dependiam de alguém lembrar de clicar no momento exato; a posição no tempo já produz a mesma informação. Campo sem tela e sem regra é dívida — adicionar coluna depois é barato. |
| 9 | Remoção do estado `REMARCADO`, mantendo `tipo_cancelamento` | O estado era complexidade sem uso; a distinção entre desistência e remarcação é indispensável para o relatório e para o texto da notificação. |
| 10 | Sem `remarcado_de_id` | A única pergunta que o encadeamento responderia não é feita na prática. |
| 11 | Sem marcação automática de falta | Capturaria o gestor que esqueceu de fechar, produzindo receita não lançada e taxa de falta inventada. |
| 12 | Encaixe fora da constraint de sobreposição, exclusivo do painel | Caso de uso legítimo do gestor; a proteção no fluxo público permanece absoluta. |
| 13 | Não pedir duração real na conclusão | Mesmo problema do check-in. A informação útil é duração média por serviço, tratada como relatório na fase 2. |
| 14 | Backend único, dois frontends, repositório único | Motor de disponibilidade não pode ser duplicado; requisitos de cache das duas interfaces se contradizem; contratos compartilhados evitam coordenação entre repositórios. |
| 15 | Domínios separados (`app.` e `{slug}.`) | Resolve conflito de service worker e permite PWA instalável com a marca de cada tenant. |
| 16 | Identificação do cliente apenas na etapa 5 | Exigir login antes de exibir disponibilidade é a maior causa de abandono. |
| 17 | Estratégia de slot `GRADE` como padrão | Horário previsível para o cliente; `COMPACTO` maximiza ocupação mas confunde. |
| 18 | `horarios_trabalho` versionado por vigência | Preserva a grade histórica sem custo adicional. Vigência sempre a partir de hoje; correções do mesmo dia sobrescrevem. |
| 19 | Autenticação diferente para gestor e cliente | Frequência de uso, identificador natural e tolerância a atrito são opostos entre os dois públicos. |
| 20 | Gestor: e-mail e senha, com Google como alternativa | Conta de trabalho de uso diário precisa funcionar em qualquer dispositivo, sem depender do celular. |
| 21 | Cliente: link de gestão como método padrão, conta opt-in | Cobre todo o caso de uso real sem exigir nada do cliente. |
| 22 | Cliente com conta: e-mail e senha, ou Google | Mesmo mecanismo do gestor, evitando construir dois sistemas de autenticação. |
| 23 | Vinculação de histórico de convidado exige telefone verificado por OTP | Reconciliar por telefone não verificado permitiria a qualquer pessoa ver os agendamentos de outra digitando o número dela. |
| 24 | Código OTP armazenado como hash, com rate limit no envio | Vazamento de banco não deve permitir sequestro de sessão; rate limit no envio protege contra custo descontrolado de mensagens. |
| 25 | Token de gestão com escopo de um agendamento e expiração | O link circula por mensageiro e é encaminhável. |
| 26 | Nomenclatura `estabelecimentos` mantida | Termo simples e imediatamente compreensível. |
| 27 | Relatórios da v1 reduzidos a uma tela, com exportação CSV | Um relatório só entra se responder a uma decisão concreta. O CSV cobre os cruzamentos imprevistos e revela, pelo uso real, o que de fato falta. |
| 28 | Sem moeda e idioma configuráveis | Mercado nacional apenas. BRL e pt-BR fixos. `fuso_horario` permanece por estabelecimento: o Brasil tem quatro fusos. |
| 29 | 2FA descartado | Complexidade sem demanda para o perfil de usuário do sistema. |
| 30 | OTP implementado sem provedor na v1 | A lógica é independente do canal de entrega. Implementação `LOG` para desenvolvimento, ausente do build de produção. |
| 31 | Múltiplos serviços por agendamento via `agendamento_itens`, não combos no catálogo | Combo exige que o gestor antecipe cada combinação, quebra "quantos cortes fiz no mês" e multiplica o trabalho de reajustar preço. Barbearia e estética estão no escopo inicial, e migrar de 1:1 para 1:N depois atingiria motor, snapshots, caixa e relatórios. |
| 32 | Itens sem horário próprio; folgas apenas nas bordas do bloco | Horário por item permitiria intervalo entre serviços e profissional diferente por item — outro produto. Folga intermediária é preparo do bloco, não de cada serviço. |
| 33 | Permissões como constante versionada em código, não tabela | Papel é enum fixo de três valores: papel novo exigiria migração de qualquer forma. A tabela adicionaria I/O em todo request e deixaria o escopo condicional fora dela. |
| 34 | Reserva temporária removida do MVP | Não eliminava o erro de colisão, apenas o tornava mais raro, ao custo de tabela, job e ramo no motor. A constraint de exclusão já garante a integridade. |
| 35 | E-mail obrigatório no agendamento público da v1 | Sem provedor de SMS ou WhatsApp, é o único canal de entrega do `token_gestao` e dos lembretes. Sem ele, o convidado perde o acesso ao próprio agendamento. Volta a ser opcional na fase 2, para quem verificar telefone. |
| 36 | Reconciliação de cliente por telefone dentro do tenant, sem sobrescrever nome | Não concede leitura de nada — o acesso continua por `token_gestao` — e por isso não conflita com a decisão 23. Sobrescrever o nome apagaria correção do gestor e renomearia a ficha quando outra pessoa usa o mesmo telefone. |
| 37 | Solicitações `AGUARDANDO` expiram em 24h | Sem prazo, o pedido não visto bloqueia o slot até a data chegar. Não contradiz a decisão 11: expirar registra a inação do estabelecimento, não inventa um fato sobre o cliente. |
| 38 | Caixa append-only: correção é lançamento novo, nunca `UPDATE` ou exclusão | Padrão de livro financeiro. Somar todas as linhas é à prova de erro, enquanto exclusão lógica exige um filtro que alguém vai esquecer, inflando o faturamento em silêncio. Ajuste de valor e reabertura passam a usar o mesmo primitivo, e o extrato responde sozinho o que antes só a auditoria respondia. |
| 39 | Fuso por profissional removido | Caso inexistente em atendimento presencial no mercado nacional, e a variável que mais complica o motor. |
| 40 | Receita por serviço assumida como aproximada | O valor efetivo é do agendamento inteiro e editável na conclusão. Pedir a quebra por item seria atrito diário para informação que quase ninguém usa. Contagem de execuções continua exata. |
| 41 | RLS como segunda linha de defesa, com filtro explícito no código | A falha de isolamento por variável de sessão não limpa no pool é silenciosa. Teste automatizado de leitura cruzada desde a primeira semana. |
| 42 | Retenção de auditoria em 24 meses | Cresce mais rápido que `agendamentos` e é o maior custo surpresa de banco em sistemas desse tipo. |
| 43 | Bloqueio de agenda cancela os agendamentos atingidos, com lote como ação primária | Bloqueio afirma que o intervalo não vai acontecer — diferente de reduzir a grade, que muda a regra para frente. O caso real é mobile e sob pressão: se exigir resolver um a um, o gestor resolve por WhatsApp e a agenda deixa de refletir a realidade. |
| 44 | Transferência de agendamento entre profissionais apenas individual na v1 | Em lote vira um mini-solver (quem executa todos os itens, com bloco livre no mesmo horário) e ignora que o cliente pode ter escolhido aquele profissional de propósito. |
| 45 | Atraso é sinalização de interface, sem campo, estado ou transição | Derivável do relógio e dos horários já gravados. O fim do bloco é plano, não medição; `folga_depois_min` é o amortecedor e duração mal configurada se corrige no cadastro. |
| 46 | Sistema não empurra a agenda por atraso | O deslocamento em lote colide com bloqueios e com a janela de trabalho, a constraint recusaria no meio deixando o dia pela metade, e dispararia uma cascata de mensagens de mudança de horário a partir de um toque. |
| 47 | Janela de agendamento apenas por tenant, com defaults por segmento | Cobre a esmagadora maioria dos casos, e o override por serviço é coluna anulável mais um `min()` no motor — barato de adicionar depois. Antecedência mínima por serviço foi descartada em definitivo: é combinação que o profissional resolve fora do sistema, e não justifica a complexidade. |

---

## 13. Pendências

A numeração é **estável a partir da v1.4**: pendência encerrada sai da tabela, entra no parágrafo abaixo e **não é renumerada** — os outros documentos citam esses números, e renumerar quebra as citações em silêncio. Nenhum número é reaproveitado.

A regra começa aqui porque a v1.3 já renumerou uma vez: a antiga pendência 5 era a escolha da stack, e o número 5 passou a ser o provedor de e-mail. É exatamente a colisão que a regra existe para não repetir — `definicao-stack.md`, seção 11, precisou passar a citar aquela pendência pelo nome.

| # | Pendência | Observação |
|---|---|---|
| 2 | Desenho de telas — restante | Os três pontos de atenção estão decididos (ver encerradas). O restante das duas aplicações é entregue etapa a etapa, no playground de componentes, e não bloqueia nenhuma decisão de produto. |
| 3 | Provedor de mensagens | SMS ou WhatsApp. Necessário apenas na fase 2, para `exige_otp_telefone` e vinculação de histórico. Manter atrás da interface de 10.4. |
| 4 | Cota de mensagens por plano | Definir junto com o provedor e com o preço do plano, na fase 2. |

**Encerradas:** escolha da stack, em `definicao-stack.md` — os três requisitos verificados (constraint de exclusão sobre intervalos, RLS com pool de conexões e execução agendada em segundo plano) estão na seção 11 daquele documento · conteúdo dos templates de notificação, em `conteudo-e-microcopia.md`, seção 3 — inclusive `solicitacao_expirada`, o link de reagendamento em `cancelado_pelo_estabelecimento` e um décimo template exigido por 8.3.1 e ausente da tabela de 7.6 · provedor de e-mail transacional, com domínio de envio, SPF, DKIM e DMARC, em `operacao.md`, seção 5 · os três pontos de atenção do desenho de telas, em `sistema-de-design.md`, seção 5.2 · nomenclatura `estabelecimentos` (decisão 26) · escopo de relatórios da v1 (seção 9.8) · sessão entre subdomínios (seção 10.6) · múltiplos serviços por agendamento (decisão 31) · modelo de permissões (decisão 33) · fechamento de agenda e indisponibilidade (seção 5.9) · tratamento de atraso (decisões 45 e 46) · janela de agendamento (decisão 47) · modelo do livro-caixa (decisão 38).
