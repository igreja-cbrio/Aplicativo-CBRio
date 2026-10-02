# grupos · conhecimento operacional do app

Movido **na íntegra** do `CLAUDE.md` em 2026-10-01 (o arquivo tinha 268 KB e era carregado em toda chamada). Referência VIVA: leia o índice e a seção do assunto antes de mexer. Seção nova entra no FIM deste arquivo, datada, com uma linha a mais no índice.

**Escopo:** Grupos: gerenciar grupo (abas, editar, recusar), ajustes dos líderes, tela do supervisor, inscrição, NEW HEART.

## Índice de seções

- ⚠️⚠️ GRUPOS · os 3 ajustes pedidos pelos LÍDERES na reunião (21/09/2026)
- ⚠️⚠️ GERENCIAR GRUPO · o botão "Recusar" NÃO FAZIA NADA há 7 semanas (23/09/2026)
- ✅ NEW HEART · o "só homens" era INTENCIONAL (Marcos · 11/08/2026)
- ⚠️⚠️ TELA DO SUPERVISOR · `/grupo-visita` (2026-08-07 · PRs #2339/#2340 + app)
- ⚠️ GERENCIAR GRUPO · 4 abas + editar (2026-08-05)
- ⚠️ Grupos · UMA tela, e o CPF que travava a inscrição (05/08/2026)
- ⚠️⚠️ Grupos · 6 mudanças na tela de gerenciar (2026-08-25 · ERP #migration `20260825170000`)

---

## ⚠️⚠️ GRUPOS · os 3 ajustes pedidos pelos LÍDERES na reunião (21/09/2026)

Trazidos pelo Marcos no dia seguinte à reunião de lançamento do app pros ~100
líderes de grupo — os três vieram de líder usando a tela na frente dele.

### 1 · O atalho da Home abria OUTRA tela que a barra de baixo

*"Quando apertamos no atalho de grupos, ele não abre a tela de grupos padrão, ele
abre outra; tem que ser o mesmo atalho o do menu com o da tela principal."*

O atalho ia pra `/grupos` (o buscador) e a barra pra `/meu-grupo`. **Mesmo nome,
destinos diferentes** — o líder tocava em "Grupos" e caía no buscador sem achar o
próprio grupo. E `/meu-grupo` é a ÚNICA porta que leva à seção "Grupos que você
gerencia", de onde o supervisor alcança a tela de visita.

⚠️⚠️ **Isto ABRE EXCEÇÃO na regra "não repetir a barra de baixo"** (o bloco do
`index.tsx` explica a regra inteira e a exceção). Não era descuido: o comentário
antigo defendia o buscador com o argumento de que apontar pra `/meu-grupo`
duplicaria a barra. A reunião mostrou que **duas portas homônimas discordando é
pior que duplicar**. Decisão dele, registrada no arquivo.

### 2 · ⚠️⚠️ "Frequência de hoje" mentia — e a chamada podia nascer no FUTURO

*"Quando você coloca preencher frequência, ali em cima ele coloca 'frequência de
hoje'; deve mostrar o dia do grupo que a frequência está sendo registrada. E aí,
não deve criar o dia de hoje como a presença, deve atrelar ao dia do grupo
correto."*

Eram **dois defeitos**, e o segundo é o grave:

1. O título era string fixa. Quem registrava o encontro atrasado do dia 15 lia
   "hoje" e ficava na dúvida se gravou certo — a mesma dúvida que o Marcos já
   tinha relatado em agosto, e que o `chamadaData` consertou no POST **e não no
   texto**.
2. O herói oferece "Registrar presença" TAMBÉM quando o próximo encontro ainda
   não chegou ("Próximo encontro · em 3 dias"). Ali a chamada abria com a data
   **futura**, o servidor recusava com 400 ("Não dá pra registrar encontro no
   futuro") e a tela mostrava o alerta seco **"Não deu"**. Medido no código em
   20/09: **não havia guarda nenhuma no app**.

⇒ `lib/chamadaData.ts` (`dataDaChamada`, no portão, com mutante): a chamada
**nunca** nasce numa data futura — cai na ocorrência ANTERIOR do grupo (a que
aconteceu) e, sem anterior conhecida, devolve `null`, que é "o servidor decide".
⚠️ `null` continua sendo a lei de 10/08: o app **não** calcula fuso.
⚠️ Hoje continua dizendo "hoje" no título — é o caso comum (o líder registrando
no fim do encontro) e uma data ali seria ruído.

### 3 · A lista de pessoas vinha na ordem do IMPORT

*"Deixar por ordem alfabética padrão, mas ter uma pequena opção de classificar
por ordem de permissão; aí se você toca vira permissão e se você toca vira
alfabética."*

O servidor manda `order('created_at')` — num grupo que virou de temporada, isso é
a ordem em que o import gravou, ou seja ordem nenhuma pra quem procura um nome
(o maior roster tem 57 pessoas).

⇒ `lib/rosterOrdem.ts` (`ordenarRoster`/`proximaOrdem`, no portão, com mutante).
⚠️ **Sem `localeCompare` com locale**: o Hermes nem sempre traz ICU completo e a
ordem mudaria de aparelho pra aparelho — usa `normalizarBusca`, a régua de texto
que a casa já tem, que ignora acento e caixa.
⚠️ **Na ordem por permissão a LÍDER PRINCIPAL vem primeiro mesmo com `funcao`
de frequentador**: em 86 dos 102 grupos ela não tem função de líder na própria
linha do roster, e sem essa regra cairia no meio da lista.
⚠️ Ordenar é **só exibição** — a chamada lê a mesma lista e também fica
alfabética, que é o que o líder quer conferindo nome por nome no encontro.

### ⏳ O 4º pedido NÃO entrou (é decisão de produto)

Os líderes pediram **adicionar visitante na tela de frequência**, criando a
pessoa como temporária/etiquetada, sem o contrato inteiro (hoje "Adicionar
pessoa" exige CPF com DV, e-mail, nascimento e sexo — justamente a barreira que
eles querem evitar com quem chegou de visita), mais alguns dados base (adulto,
casado, homem/mulher). **Espera a régra do Marcos** sobre o que acontece com
essa pessoa se ela nunca se inscrever — sem isso a base enche de cadastro pela
metade.

## ⚠️⚠️ GERENCIAR GRUPO · o botão "Recusar" NÃO FAZIA NADA há 7 semanas (23/09/2026)

*"A opção de recusar a Maria não funciona, não consigo apertar."* (Marcos,
Android, tentando desfazer o pedido de demonstração da reunião de 20/09.)

**Não era Android, não era toque, não era permissão.** Em `grupo-membros.tsx` o
botão "Recusar" do card de pendentes fazia `setRecusaAlvo(p)`, o handler
`confirmarRecusa` continuava inteiro no arquivo… e o **`<Modal
visible={!!recusaAlvo}>` tinha sido apagado no refactor f246407 (05/08,
"hierarquia visual v2")**. Estado gravado, folha nenhuma. O `tsc` não reclama
(a variável É lida, pelo handler morto), o lint não reclama, e o líder vê um
botão que "não aperta".

Medido antes de mexer: das recusas de líder registradas em produção, **UMA só
veio do app** (Jane, 21/08) — e veio da OUTRA tela, `grupo-inscricoes.tsx`, que
tem a folha. Todas as demais foram pelo link do WhatsApp. Ou seja: a tela que
todo líder usa pra gerenciar o grupo nunca recusou ninguém desde 05/08.

**Conserto**: a folha voltou, no molde exato da folha de saída vizinha
(`TecladoSeguro` + `fundoSeguro`, mesmo texto da `grupo-inscricoes`).

### ⚠️⚠️ A régua nova: FOLHA ÓRFÃ (`test/folhaOrfa.test.ts`)

Todo estado `*Alvo` / `*Aberto` / `*Aberta` cujo setter é chamado com algo que
não é `null`/`false` (alguém ABRE) precisa ser **lido em alguma linha** fora da
declaração e fora do `const p = X;` do handler. `visible={!!X}`, `visivel={X}`,
`prop={X}`, `{X && …}`, `!X ? … :` e `if (X)` valem — a régua não impõe a
forma da folha, só que exista uma. Comentário citando o estado **não** vale
(passa por `semComentarios`). Varre `app/` e `components/` inteiros.

O mutante em `scripts/mutantes.mjs` é a **AUSÊNCIA do bloco** — byte a byte o
que estava em produção — e não um operador trocado (ver a lei do mutante fiel).

⚠️ Se um dia um estado `*Alvo` legitimamente só alimentar lógica (sem render),
renomeie-o: a régua é por SUFIXO de propósito, porque é o sufixo que a casa usa
pra folha.

## ✅ NEW HEART · o "só homens" era INTENCIONAL (Marcos · 11/08/2026)

A auditoria tratava como **bloqueio de dado** o grupo `categoria='Homens'` com 4
mulheres no roster e 6 pedidos de mulheres aprovados. **Não é erro:** *"era um
grupo de solteiros, misto, mas só se inscreveram mulheres e as líderes queriam que
tivessem homens também, então colocaram assim para vetar novas inscrições de
mulheres. Decisão local entre a líder e a Natasha."*

⚠️⚠️ **LEI QUE FICA: gênero/categoria do grupo é TORNEIRA DE INSCRIÇÃO, não
descrição do grupo.** Roster incompatível com a categoria pode ser exatamente a
intenção da liderança. **Não "alinhar" categoria ao roster** — quebraria a
alavanca que elas usam de propósito. A trava do `POST /app/inscricoes` (ERP
#2361) está CERTA justamente porque barra inscrição NOVA e não expulsa quem já
entrou.

## ⚠️⚠️ TELA DO SUPERVISOR · `/grupo-visita` (2026-08-07 · PRs #2339/#2340 + app)

Pedido do Marcos: *"podemos deixar uma tela apenas para Registrar Frequência e
comentários sobre aquele grupo… o supervisor não precisa ver estudos, pedidos de
aprovação. No máximo Pessoas, Frequência e comentários"* + *"a plataforma entende
que quando supervisor preenche a frequência é porque fez uma visita e conta
isso"*. Eu levantei o risco de o indicador passar a medir "digitou" em vez de
"foi lá" e ele **aprovou o interruptor "estive presente no encontro"**, ligado
por padrão.

### ⚠️⚠️ O interruptor só funciona porque DESLIGADO NÃO GRAVA LINHA

Levantamento de 07/08 derrubou a premissa: o KPI real é a função SQL
**`_kpi_agregar_dado`** (ramo `lideres_acompanhados`), que conta
`DISTINCT lider_id` das visitas do período e **NÃO filtra `status`** — 'agendada'
e 'cancelada' contam igual a 'realizada'. O coletor JS
`kpiAutoCollector.js:432` que parecia a fonte é **código morto** (nenhum
indicador tem `fonte_auto` apontando pra ele).

⇒ Gravar a visita com outro status faria o interruptor virar **puro enfeite**.
Por isso `presente:false` **não grava visita nenhuma** (a frequência vai pro
líder normalmente). É o que lhe dá efeito real, sem depender de migration.
⚠️ Consequência assumida: com o interruptor desligado o comentário não tem onde
morar (não existe estado "acompanhei à distância" no CHECK), então a TELA esconde
o campo. Se um dia for preciso, o caminho é `grupo_supervisao_observacoes`
(tabela irmã, existe, vazia) + decisão do Marcos.

### As decisões que sustentam a tela

- **Rota própria** (`/grupo-visita`), não aba condicional: a escrita é OUTRA
  (frequência **+** visita, dois endpoints) e `grupo-membros.tsx` tem 1.070
  linhas e 5 modais. As 3 linhas de amarração entraram (`lib/hierarquia.ts`,
  `BottomBar.tsx` e o array do invariante em `test/reguas.test.ts`).
- **Precedência: LIDERAR GANHA.** Medido: **7 dos 87 grupos ativos têm
  `supervisor_id == lider_id`** — sem isso esses líderes cairiam na tela enxuta e
  perderiam Pedidos, Estudos e Editar do próprio grupo. Quem decide o papel é o
  **servidor** (`papel` em `/app/grupos/meus`, `meu_papel` no roster); o app não
  cruza ids. Papel ausente → tela COMPLETA (o comportamento de sempre).
- ⚠️⚠️ **ESCONDER ABA NÃO TIRA PODER.** O servidor autoriza líder E supervisor
  nos mesmos ~8 endpoints de gerenciar grupo — foi assim que a Onda 1b deu ao
  supervisor o save que ele não tinha. `lib/papelGrupo.ts` é régua de
  NAVEGAÇÃO, não trava de segurança.
- ⚠️⚠️ **O COMENTÁRIO NÃO É PRIVADO** — a premissa "apenas para o supervisor" não
  se sustenta: `grupo_supervisao_visitas` tem SELECT `USING(true)` pra qualquer
  autenticado e a observação já aparece na aba Visitas do /grupos. A tela **diz a
  verdade** ("fica no registro de supervisão — a coordenação lê") em vez de
  prometer sigilo que o schema não garante.
- **`23505` do encontro virou 409**: `mem_grupo_encontros` tem UNIQUE
  `(grupo_id, data)` e a RPC faz INSERT puro. Com esta tela, líder e supervisor
  registrando o MESMO dia deixa de ser exceção. ⚠️ A mensagem é **neutra** — o
  409 não diz quem registrou (pode ser encontro soft-deletado ainda ocupando a
  data, porque a UNIQUE não é parcial).
- **O encontro do supervisor vai marcado `(supervisor)`** no
  `registrado_por_nome`: o card "Grupos sem relatório de encontro" do /grupos
  conta QUALQUER encontro e afirma que o relato veio do líder.

### ⚠️ O que a revisão adversarial (18 agentes) pegou depois de eu implementar

- **QUEBRAVA no iPhone**: copiei o esqueleto de "tela de barra"
  (`edges={["left","right"]}`) numa tela de PROFUNDIDADE — título e subtítulo
  renderizavam **por baixo do notch**, e não havia seta de voltar. As 5 telas
  irmãs de grupo usam `["top","left","right"]` + `chevron-back`.
- **`"Sua última visita"` mostrava visita de OUTRA pessoa**: o GET não recortava
  por pessoa e o `POST /api/grupos/:id/visitas` do web deixa a coordenação
  registrar em qualquer grupo. O supervisor seria **dispensado de visitar** por
  uma visita que não fez. Corte por `responsavel_id`/`registrado_por`, **não** por
  `supervisor_id` (que, quando quem registra não tem `membro_id`, cai no
  supervisor DO GRUPO).
- **Visita duplicada**: a tabela não tem UNIQUE nenhuma e o retry é caminho real
  → idempotência por (grupo, pessoa, dia) no servidor.
- **Falha só na VISITA dizia "não conseguimos salvar"** com a frequência já
  gravada — a pessoa repetiria tudo e levaria 409. Agora a mensagem diz o que
  JÁ foi gravado.
- **Falha de rede virava "Ainda não registrada"** no herói (o `.catch(() => [])`
  colapsava "não carregou" com "não existe") e o erro convivia com o spinner.
- Aba Pessoas mostrava o **enum cru** (`co_lider`, `lider_treinamento`).
- Badge de pendentes aparecia pra supervisor, cuja tela **não tem** aba Pedidos.

### Encontro é CARTÃO CLICÁVEL, e a visita mora dentro dele (07/08 · fecha o escopo)

Ele viu a v1 e disse: *"não separaria os encontros de 'Suas visitas', faz um
quadradinho clicável do encontro, aí quando clico vejo os comentários e a
presença em um lugar só"*. A seção separada **saiu**: cada encontro é um cartão,
o dia em que o supervisor esteve ganha o selo **"Você visitou"**, e o toque abre
presença (com NOME), comentário do encontro, comentário da SUA visita e quem
registrou.

- `GET /app/grupos/:grupoId/encontros/:encontroId` traz os nomes **sob demanda** —
  na lista seriam 24 encontros × N pessoas a cada abertura de tela.
- ⚠️ **NÃO listamos AUSENTES**: a RPC `registrar_encontro_grupo` não cria linha
  pra ausente, e deduzi-los do roster de HOJE afirmaria ausência de quem talvez
  nem estivesse no grupo naquele dia. O que não se sabe, não se afirma.
- ⚠️ **Visita sem encontro no mesmo dia continua aparecendo** — acontece quando o
  encontro é apagado depois (a UNIQUE de data **não é parcial**, então ele some
  da lista e a visita fica). Perder o comentário em silêncio seria o pior desfecho.
- ⚠️ Falha ao abrir o detalhe cai no que a LISTA já tinha, com aviso.

### ✅ Teste em aparelho da tela (07/08 · grupo "teste 2")

Medido em produção: visita `realizada` com `supervisor_id` + `responsavel_id` +
`registrado_por`; encontro com `registrado_por_nome = "Marcos Paulo (supervisor)"`;
`vw_grupos_supervisao` já com `ultima_visita=07/08` e `visitas_mes_atual=1`;
telemetria `grupo_visita_registrada` com `label:"presente"`.
⚠️ O **"0 presenças" NÃO era bug** — o grupo está com **roster vazio**. Mas o
modal mostrava "Quem esteve presente — 0/0" com lista em branco (lia como tela
quebrada) e os 2 tipos de push novos **não tinham destino no `notifTap`** (o
toque não navegava). Os dois corrigidos.

### ⏳ Reportado e NÃO consertado (é decisão, não código)

- `_kpi_agregar_dado` não filtra `status` nem `deleted_at`/`ativo` no ramo
  `lideres_acompanhados` — bug pré-existente; nada aqui depende dele.
- Os 4 KPIs (SED-04/AMI-09/BRG-08/ONL-10) são `delta_pct` com
  `meta_valor_absoluto=90` ⇒ a view cobra **7,5%**. Mesma doença já corrigida em
  22/07 pra outros KPIs: o 2º mês de uso pintaria 4 áreas de verde com 2 visitas.
- **Só 2 dos 14 supervisores têm conta no app** ⇒ a feature alcança **9 dos 87
  grupos** hoje.

### ⏳ O que este teste NÃO cobre

O portão (55 testes · 14/14 mutantes) garante a REGRA, **não a tela**. Nada da
onda 2b foi executado em aparelho por mim — calendário, modal, seção nova, o
carimbo do cadastro e a máscara de telefone precisam de teste humano. Os defeitos
de hoje são justamente da classe que só o aparelho pega.

## ⚠️ GERENCIAR GRUPO · 4 abas + editar (2026-08-05)

Pedido do Marcos: *"ao apertar gerenciar grupo, ali devem ter TODAS as opções
para se fazer em um grupo"*. `grupo-membros.tsx` virou a tela de gerenciamento:
**Membros · Frequência · Pedidos · Estudos** + **Editar** no cabeçalho (abre
`/grupo-editar`, que já existia — é a única ação que troca de tela, e por isso
NÃO é aba: viraria promessa de que o formulário está aqui dentro).

- **O botão "Inscrições do grupo" SAIU do `/meu-grupo`** — duas portas pra
  aprovar pedido era o que fazia parecer que existiam dois lugares. A rota
  `/grupo-inscricoes` **continua viva** (link antigo e push apontam pra ela).
- **Membros**: menu de ações por pessoa → função (frequentador · em treinamento ·
  co-líder · **líder (cadastro)**), transferir, registrar saída.
  ⚠️⚠️ **São DUAS coisas** (corrigido 05/08 por esclarecimento dele — eu tinha
  confundido): `funcao='lider'` é **CADASTRO** (podem ser vários, e nenhum recebe
  mensagem por isso) · **`mem_grupos.lider_id` é a LÍDER PRINCIPAL**, a única que
  recebe o WhatsApp do grupo e a única **sem menu de ações** (badge "Líder
  principal"). Palavras dele: *"só o líder principal recebe mensagem e ele não
  pode remover a si mesmo, os outros seria apenas para sabermos no cadastro"*.
  Marcar líder aqui **NÃO** faz a mensagem do grupo passar a ir pra essa pessoa —
  a tela diz isso no próprio menu.
  ⚠️ O roster passou a trazer **`grupo.lider_id`**: sem ele a tela comparava
  `funcao === "lider"` e escondia o menu de **todos** os líderes.
  ⚠️ Em 30 dos 97 grupos ativos a principal está **fora do roster** (medido
  05/08) — nesses ela não aparece na aba Membros, e o servidor segue protegendo.
- **Frequência**: chamada começa com **todos marcados** (o líder desmarca quem
  faltou — muito menos toque) + tema + **comentário do líder** + histórico. Usa a
  RPC canônica no servidor. E o **"Preciso de ajuda"** manda pra coordenação
  (notificação + push · não é ticket com "resolvido", e a tela não promete isso).
- **Transferência** é PEDIDO no grupo de destino, não mudança direta; só oferece
  grupos que o próprio líder gerencia; a saída é passo separado.
  ⚠️ **No web ela NÃO virou fila nova**: o pedido cai na **Caixa de entrada** que
  a triagem já usa, e o `/grupos` ganhou só um histórico **recolhido** de
  "Entradas e saídas" (leitura pura, nenhuma ação) — formato que o Marcos pediu
  em 05/08: *"uma tela pequena, com pouco destaque, sem muita interação"*.
  ⚠️ **A frequência do app já aparece no web** ("Encontros recentes" no detalhe do
  grupo, com data, presentes, tema e o **comentário do líder**) porque o app grava
  pela RPC canônica — não foi preciso construir tela de relatório lá.
- **Estudos**: materiais do grupo + os gerais, com selo de "Estudo da semana".
- ⚠️ **Só `materiais` é lazy.** Os ENCONTROS saíram do lazy na v2: o herói precisa
  deles pra saber se faltou registrar, e carregar ao abrir a aba faria ele afirmar
  "próximo encontro" num grupo atrasado. Enquanto `encontros === null` o herói
  **não afirma atraso** — dizer a coisa errada com confiança é pior que esperar
  300 ms.

### ⚠️ HIERARQUIA VISUAL · a v2 da tela (05/08 · aprovada pelo Marcos)

Ele viu a v1 e apontou: *"tem muitas informações em uma página e a pessoa que abre
não vê um destaque nenhum muito claro, então ela pode acabar ficando confusa"*.
Estava certo, e o defeito era meu: **dois protagonistas** (nome do grupo em 25/800
e os três números em 25/800) mais **teal em quatro papéis** (botão + pílula da aba
+ 5 avatares) = nada significava "aqui". O conserto **não foi aumentar o herói,
foi rebaixar os concorrentes**. Três zonas:

| zona | o que é | como se distingue |
|---|---|---|
| 1 · AÇÃO | o próximo encontro | **único** elemento em 27/800 · **único** bloco com moldura · **único** teal cheio |
| 2 · APOIO | os números | UMA linha de 13,5 px (`12 membros · 85% de presença` + pastilha âmbar de pedidos) |
| 3 · DETALHE | abas + lista | abas com **sublinhado** de 2 px (não pílula cheia) · avatar NEUTRO · **26 dp** de respiro acima |

- ⚠️ **O nome do grupo aparece UMA vez**, na barra (16/700), com dia e local na 2ª
  linha. Repetir em 25/800 no corpo criava o 2º protagonista — e "que grupo é
  esse" é *confirmação*, não informação: a pessoa acabou de tocar nele.
- ⚠️ **A ação do herói MUDA com o estado** — grupo sem ninguém: o botão é
  **convidar** (não há quem marcar presença); já registrou: o botão fica **ghost**,
  porque quando nada é preciso, nada grita.
- ⚠️ **`lib/proximoEncontro.ts` decide qual estado é** (atrasado · registrado ·
  próximo · sem dia). Régua PURA no portão, com **mutante próprio** pra armadilha
  do `dia_semana = 0` (domingo é falsy: `!diaSemana` jogaria todo grupo de domingo
  em "sem dia").
- ⚠️ **`warning` entrou no `constants/theme.ts`** (`#E0A24E` escuro · `#A86A12`
  claro). A paleta tinha só `danger`/`success`, então "espera por você" era pintado
  de vermelho (assusta) ou de teal (não chama). Usar **só** pra o que precisa de
  ação de gente.
- ⚠️ **Convidar compartilha `/inscricao-grupos`** (link geral), porque a página
  pública **não aceita parâmetro de grupo** — só `?temporada=`. A mensagem cita o
  nome pra pessoa achar na lista; inventar um `?grupo=` daria link morto.
- ⚠️ O portão (37 testes · 7/7 mutantes) garante a REGRA, **não a tela**: nada da
  v2 foi executado em aparelho — isso segue sendo o passo humano.
- ⚠️ `GrupoMembro` ganhou **`membro_id`** (id da PESSOA) além do `id` (id da
  LINHA do roster): a chamada de frequência manda ids de pessoa pra RPC, e as
  ações usam o id da linha. Confundir os dois quebra as duas coisas.

## ⚠️ Grupos · UMA tela, e o CPF que travava a inscrição (05/08/2026)

Varredura de telas mortas/ambíguas pedida pelo Marcos. O que virou código:

- **`/meu-grupo` é a tela ÚNICA de grupos**, com 2 abas: **Meus grupos** |
  **Encontrar**. Barra de baixo e menu caem os dois aqui — antes "Grupos" na
  barra e "grupos" no menu abriam telas diferentes, que foi a queixa dele.
- **`BuscadorGrupos`** (lista/mapa/busca/filtros) virou COMPONENTE exportado de
  `app/(app)/grupos.tsx`, com prop `embutido`. A rota `/grupos` continua
  existindo como casca fina (`export default`) — é o que mantém vivo o card de
  Grupos no hub de Inscrições, deep links e a Jornada de quem ainda não tem
  grupo. Importar de arquivo de ROTA é o padrão que já existia aqui
  (`grupo-detalhe` e `GruposMapa` importam `diaHorario` dele).
- ⚠️ O buscador entra **IRMÃO do ScrollView** de `/meu-grupo`, nunca dentro: ele
  tem scroll próprio e um mapa — aninhar trava o gesto e o mapa. Só monta quando
  a aba abre (o mapa também só carrega aí).
- **`/inscricao-grupos` APAGADA** — órfã (nenhuma navegação apontava pra ela) e
  fazia o mesmo que buscador + `/grupo-detalhe`, pelo mesmo endpoint.
  `lib/temporadaGrupos.ts` segue vivo (o gate de temporada é do
  `/grupo-detalhe`, o caminho real).

### 2 de cada 3 contas do app nao conseguiam pedir entrada em grupo

`POST /app/inscricoes` **recusa inscricao sem CPF** (Contrato de porta · desde
24/07/2026: 400 "CPF e obrigatorio pra se inscrever"). O `pedirEntrarGrupo` nao
manda CPF — quem salva e o backfill do backend a partir de `mem_membros`. Medido
em 05/08/2026: **50 das 75 contas do app apontam pra cadastro SEM CPF (67%)**,
entao a maioria tocava em "Quero participar" e levava um erro seco.
`/grupo-detalhe` agora checa `membro.cpf` ANTES (estado `sem_cpf`) e oferece
**"Completar meu cadastro"** -> `/completar-cadastro`.
⚠️ **O mesmo gate vale pra batismo, next e voluntariado** (mesmo endpoint, mesma
regra) — essas tres telas ainda mostram so a mensagem do servidor, sem botao.
⚠️ E o `/completar-cadastro` trata **CPF como opcional**: da pra "completar" o
cadastro e continuar bloqueado na inscricao. Alinhar as duas reguas e decisao de
produto pendente.

## ⚠️⚠️ Grupos · 6 mudanças na tela de gerenciar (2026-08-25 · ERP #migration `20260825170000`)

Marcos avaliando a tela de grupos do app. Seis pedidos numa mensagem, terminando
com *"alinhe todas essas mudanças com o sistema web"* — então **toda régua nova
mora no backend/serviço compartilhado, e o app é casca fina**.

| # | pedido | precisa OTA? |
|---|---|---|
| 1 | "Co-líder" MORRE · quem tinha vira `lider_treinamento` | tela sim, dado não |
| 2 | **Líder em treinamento GERENCIA o grupo** | **NÃO** — é servidor |
| 3 | Encontros à vista · semana sem chamada = "presença não registrada" | sim |
| 4 | "Remover do grupo" (era "Registrar saída") + folhas mais altas | sim |
| 5 | Transferência SEM destino · o líder solicita, a coordenação decide | sim |
| 6 | "Adicionar pessoa" no fim do roster · nasce aprovada, sem WhatsApp | sim |

### ⚠️⚠️ ITEM 3 · o "bug" era a TELA NÃO MANDAR A DATA

Relato dele: *"quando eu não preencho uma semana e preencho a outra ele dá meio
que um bug — ele provavelmente ficou em dúvida se eu estava registrando a presença
do dia 18, aí ele marcou que o encontro foi dia 24."*

**Nada ficou em dúvida.** `POST /app/grupos/:id/encontros` sempre aceitou `data` e
caía em `hojeBRT()` quando ela não vinha — e `salvarChamada` **nunca mandava
data**. O servidor gravou o único dia que recebeu. Somado a isso, a aba Encontros
listava só o que JÁ estava registrado: a semana pulada não existia na tela, e o
único caminho de registro era o botão do herói, que grava hoje.

- **A aba agora renderiza `ocorrencias`** (do servidor · régua
  `backend/utils/agendaGrupo.ocorrenciasPassadas`), com `status` `registrado` /
  `nao_registrado` / `cancelado`. A pendente tem botão "Registrar" que abre a
  chamada **naquela data**.
- ⚠️⚠️ **`ocorrencias === null` cai na LISTA CRUA** (o comportamento de antes):
  cobre backend antigo e falha da agenda. A tela **nunca** afirma "não houve
  encontro" por não ter conseguido montar a timeline — e o aviso aparece quando o
  servidor manda um motivo.
- ⚠️ **`abrirChamada(dataAlvo)`**: o parâmetro NÃO pode se chamar `data` — esse é
  o nome do estado do ROSTER nesta tela, e sombreá-lo faz a chamada nascer VAZIA
  (`presentes` vem de `data.membros`). **O typecheck pegou**; sem tipos, teria
  virado "a chamada não marca ninguém".
- ⚠️ Quando a data não é hoje, a confirmação **diz a data** — é o que dá ao líder
  a prova de que a chamada atrasada foi gravada no dia certo, que é exatamente a
  dúvida que gerou o relato.
- ⚠️ `data: chamadaData || undefined` (nunca `null`): sem data, quem decide é a
  régua BRT do SERVIDOR. Calcular "hoje" no aparelho reintroduziria risco de fuso.
- ⚠️ Chamada gravada fora da recorrência aparece marcada (`avulso`) — inclusive as
  que nasceram com a data errada ANTES deste conserto. Esconder faria o trabalho
  do líder desaparecer da tela, pior que o defeito original.

### ⚠️ ITEM 4 · `fundoSeguro` é PISO, e é o conserto monotônico

*"Subir um pouco pois esse botão fica onde está os botões do android,
dificultando."* As 5 folhas desta tela usavam o inset cru + respiro pequeno;
agora todas usam `spacing.lg + Math.max(insets.bottom, spacing.lg)`.

⚠️ Dentro de um `<Modal>` do Android o inset pode vir **0** (a folha é outra
janela), e diagnosticar QUAL das três causas é (inset 0 · gesture bar de 24 dp ·
barra de 3 botões de 48 dp) exigiria o aparelho dele. **Piso é monotônico: mais
folga embaixo = botão mais alto, valha qual valer a causa.** De quebra, a opção
"Co-líder" saindo do menu encurtou a folha em uma linha.
⚠️ **NÃO acrescentei `navigationBarTranslucent`** nas 5 folhas: mudaria o
comportamento da JANELA de todas de uma vez, e o piso resolve sem isso.

### ⚠️ ITENS 1 e 2 · o termo morreu; o treinamento passou a gerenciar

- `FUNCOES_QUE_O_APP_DA` = `["frequentador", "lider_treinamento", "lider"]`. O
  banco recusa `co_lider` (CHECK), então mandá-lo daqui só produziria erro.
- ⚠️ **`co_lider`/`colider` FICAM nos mapas de LEITURA** (`FUNCAO` em
  `grupo-membros`/`grupo-visita`, `gerencia()` e `rotuloPapel()` em `meu-grupo`),
  apontando pro rótulo NOVO: bundle/cache antigo e resposta de backend antigo não
  podem virar `"co_lider"` cru na tela.
- ⚠️⚠️ **Quem autoriza a gestão é o SERVIDOR** (`gruposPapelApp` responde 403).
  `gerencia()` existe só pra não MOSTRAR botão que vai dar 403 — divergir dela
  reproduz o defeito de 21/08 ao contrário (tela oferece, servidor recusa).
- A nota do menu de função passou a dizer que líder **e** líder em treinamento
  gerenciam: sem isso o líder não tem como saber que está dando acesso de gestão.

### ⚠️ ITEM 5 · a lista de grupos SAIU do modal de transferência

`transferirMembroGrupo(grupoId, rowId, motivo?)` — o `destinoGrupoId` **morreu**.
O modal virou uma solicitação com motivo opcional (e o placeholder dá exemplos,
porque o motivo é o insumo de quem vai escolher o destino).

⚠️ A tela DIZ que a pessoa **continua no grupo** até a coordenação resolver, e que
**ninguém recebe mensagem automática**. Dois toques devolvem `ja_pedido` e a tela
diz isso em vez de fingir que abriu outro pedido.

### ⚠️⚠️ ITEM 6 · "Adicionar pessoa" é PORTA DE PESSOA

Linha no FIM do roster (`+` no avatar), como ele pediu — de propósito uma linha da
lista e não um botão flutuante: o líder está olhando o roster e percebendo quem
falta nele. Aparece também no grupo VAZIO, onde é mais útil.

- ⚠️ Obrigatórios só **nome + celular**; o resto é opcional. Exigir 6 campos faz o
  líder não usar a tela — e aí a pessoa não entra em lugar nenhum. Cadastro
  incompleto cai na fila de "faltam dados" da coordenação.
- ⚠️⚠️ **Sexo em branco fica em branco** — NUNCA chutado pelo nome (lei de 10/08),
  e só `masculino|feminino` (vocabulário da coluna · Contrato de Inscrição).
- ⚠️ A máscara é **`mascararTelefoneBR` de `lib/telefone`** — **não existe
  `lib/inscricao` neste repo** (esse é o nome do helper do ERP). Ela TRUNCA no
  limite, que é o que impede o campo aceitar 20 dígitos e o servidor recusar lá na
  frente sem a pessoa saber por quê.
- ⚠️ `inputLinha` é estilo NOVO: o `styles.input` desta tela é multiline
  (`minHeight: 70`, nasceu pro campo de motivo) e reusá-lo daria 5 caixas de 70 px
  num formulário que não caberia na folha.
- ⚠️⚠️ **A confirmação DIZ quando o matcher LIGOU** numa pessoa que já existia
  (`pessoa_nova === false`). Sem isso o líder acha que não funcionou e tenta de
  novo com outro nome — o comportamento que fabrica duplicata na base.
- ⚠️ `visitante` só quando o líder MARCA a caixa (lei de 14/08); o default é
  `frequentador`, porque adicionar de propósito é participação.

### Traduções

⚠️ **6 chaves que eu ia acrescentar JÁ EXISTIAM** e o `tsc` pegou (TS1117). As
pré-existentes ficaram como estavam — sobrescrever mudaria texto de telas que não
têm nada a ver com esta leva. Em especial `"Encontros"` continua `"Gatherings"` em
inglês. E `"Co-líder"` **fica no dicionário**: bundle antigo em cache ainda pode
pedir a chave, e sem ela o app mostra a chave crua a quem usa en/es.

### ⚠️⚠️ 2ª rodada no MESMO dia (25/08) · ele corrigiu duas decisões minhas

#### "Adicionar pessoa" agora pede CADASTRO COMPLETO

*"Queremos cadastro completo, os mesmos campos que solicitam a inscrição de
grupos."* A 1ª versão pedia nome + telefone; agora pede o que o formulário
público pede: **nome completo sem abreviar · celular · CPF · e-mail ·
nascimento · sexo** (+ endereço opcional) e **dois consentimentos**.

- ⚠️⚠️ **Quem valida é o SERVIDOR** (`inscricaoContrato.validarCamposPadrao`).
  `addPodeEnviar` só decide quando o botão acende, pra a pessoa não tocar e levar
  erro — as duas réguas podem discordar em borda (DV do CPF, nome abreviado) e aí
  **manda o 400 do servidor**, que devolve o campo.
- ⚠️⚠️ **LGPD · o texto do aceite DIZ que você está declarando por outra
  pessoa** ("Confirmo que a pessoa está aqui comigo e autorizou…"). O servidor
  grava o consentimento com o prefixo `DECLARADO PRESENCIALMENTE POR <líder>`.
  O opt-in de WhatsApp é opt-in de verdade: default **false**.
- ⚠️ **`lib/cpf.ts` é NOVO e é a fonte única da máscara de CPF** — ela era função
  local em `completar-cadastro.tsx`, e uma 3ª cópia é exatamente o que a lei do
  Contrato de Inscrição proíbe. `completar-cadastro` passou a delegar (zero-diff,
  o corpo é byte a byte o que estava lá).
- ⚠️ `chipTxtQuebra` (`flex: 1`) existe porque o texto do consentimento é longo
  DE PROPÓSITO (é prova legal, não rótulo) e sem isso ele estoura o chip.

#### ⚠️⚠️ O ENCONTRO PASSADO virou gerenciável — e a aba mostra TODAS as datas

*"Sobre os encontros de grupos quinzenais ou mensais, devem aparecer na aba de
encontros todas as datas que os grupos deveriam ter feito o encontro, e deve ser
gerenciável: a pessoa clica em um encontro passado, altera data ou registra que
encontro não aconteceu, registra presença e fica naquele encontro. Isso também
para encontros semanais."*

Eu havia feito o histórico do quinzenal/mensal ficar VAZIO sem âncora real (pra
não cobrar chamada de encontro que talvez não tenha existido). **Medido: dos 108
grupos ativos, 35 são não-semanais e só 1 tem encontro registrado** — "sem
âncora" era o caso NORMAL, então aqueles 34 grupos tinham a aba permanentemente
vazia. Sem lista não há o que corrigir.

- **Cada linha da timeline é TOCÁVEL** e abre o **MESMO** `ModalAgendaEncontro`
  do box "Próximo encontro", em `modo="passado"`. Um modal, dois modos: as duas
  escrevem no MESMO endpoint, e duas telas divergiriam no primeiro ajuste ("no
  futuro deu, no passado não").
- Dentro dele: **Registrar presença deste dia** (abre a chamada NAQUELA data) ·
  **Corrigir a data** · **Não aconteceu** · e **Voltar ao normal** quando há
  exceção.
- ⚠️⚠️ **Data ESTIMADA é dita na LINHA, não só no modal**: em grupo quinzenal/
  mensal sem encontro registrado ela foi calculada pelo início da temporada, e
  apresentá-la como fato seria afirmar o que não se sabe. O texto da linha muda
  ("Data estimada — toque para corrigir ou registrar").
- ⚠️ **Ocorrência `avulso` NÃO abre o modal**: ela não vem da recorrência, então
  não existe `data_original` pra escrever exceção — o POST recusaria.
- ⚠️ **Afordância ESCRITA** ("Gerenciar" + chevron), não um ícone cinza sozinho:
  a lição de 18/08 é que *"nem quem pediu achou"* o lápis de 18 px.
- ⚠️ **`as any` MORREU no mapeamento pro modal.** Os dois vocabulários de
  `status` são diferentes (aqui é "a chamada foi feita?"; no modal é "há exceção
  de agenda?"). O cast compilava e escondia o efeito real: o modal **nunca veria
  `remarcado`** e o botão de DESFAZER a correção não apareceria. Virou mapeamento
  campo a campo, com `remarcado`/`cancelado` vindos do servidor em campos
  próprios.
- ⚠️ No modo passado o calendário **não tem piso em hoje** — seria o mês inteiro
  cinza.

#### Traduções

⚠️ Das 26 chaves novas, **2 já existiam** (`Data de nascimento`, `E-mail`) e
ficaram como estavam — sobrescrever mudaria texto de outras telas. O script de
acréscimo agora **pula chave existente** em vez de duplicar (o `tsc` pegou 6
duplicatas na 1ª rodada, com TS1117).

#### Verificação

`npx tsc --noEmit` limpo · `npm test` (**210 verdes**). No ERP: build, **2.374**
testes e os 16 scripts do gate; **11 mutantes** rodados e mortos na régua de
agenda; e o caminho de ESCRITA da agenda exercitado contra produção com resíduo
zero.

### Verificação

`npx tsc --noEmit` limpo · `npm test` (**210 verdes**). No ERP: build, 2.374
testes do vitest e os 16 scripts do gate.


### ⚠️⚠️ 3ª rodada no mesmo dia (25/08) · os becos sem saída fecharam

*"Precisamos corrigir essas coisas que você falou que valem saber, não podem
acontecer."* — sobre as ressalvas que a 2ª rodada deixou. **Ressalva que tranca o
líder não é ressalva, é defeito.**

#### "Não aconteceu" num dia que TEM chamada · dois passos, no próprio modal

Antes o servidor recusava e a tela mostrava o erro em vermelho — o líder concluía
que quebrou e desistia. Agora o 409 `tem_chamada` **não é tratado como erro**: é
a pergunta da 2ª etapa, com o número de presenças que se perdem, e o botão
reenvia com `confirmar_apagar_chamada`.

- ⚠️ A pergunta é **CONCRETA** ("a presença de 3 pessoas") porque é isso que se
  perde — inclusive o contador de presenças de cada uma, que a régua de
  visitante→frequentador usa. `presentes` pode vir `null` (o servidor não
  conseguiu contar): a pergunta fica mais vaga, **nunca ausente**.
- ⚠️ Quem decide é o SERVIDOR: o app só reenvia o que ele pediu. Nada de o app
  apagar chamada por conta própria.

#### O calendário apaga o dia que já tem chamada · `bloqueadasISO`

`CalendarioBR` ganhou a prop. ⚠️ Diferente de `minimoISO`/`maximoISO`, que
descrevem uma FAIXA: aqui são **buracos no meio dela**. Nasceu do UNIQUE
(grupo_id, data) de `mem_grupo_encontros` — escolher um dia ocupado levantava
23505 e o líder só descobria **depois de salvar**.
⚠️ A lista vem pronta do servidor (`corrigir_bloqueadas`) — o app **não** calcula
qual dia está ocupado, pela mesma razão de não recalcular a janela: duas contas
apareceriam como *"o calendário deixou escolher e o servidor recusou"*.

#### ⚠️⚠️ `lib/api.ts` · o erro passou a carregar o CORPO

O helper devolvia **só a string** e o resto do JSON era DESCARTADO — então
resposta de negócio que carrega dado ("tem chamada com 3 presenças: confirma
apagar?") chegava na tela como texto solto, e a tela não tinha como fazer a
pergunta nem reenviar a confirmação. Agora vem em **`err.corpo`**, ao lado do
`err.status` que já vinha, e os **6 blocos duplicados** dos verbos viraram um
helper só (`erroDaResposta`).
⚠️ `corpo` pode ser `null` (resposta sem JSON) — quem usa checa antes.

#### Verificação da 3ª rodada

`npx tsc --noEmit` limpo · `npm test` (**210 verdes**). No ERP: `tsc -b` sem
cache, build, os **16 scripts** do gate (16/16) e **5 mutantes novos** rodados e
mortos (3 na régua de janela, 2 na guarda estática dos becos).

⏳ **PENDENTE: publicar o OTA** (`npm run ota -- "msg"` — **NUNCA `eas update`
cru**, ver a lei no topo deste arquivo). Os itens 3, 4, 5 e 6 são tela; o item 2
já vale sem OTA porque é servidor.
