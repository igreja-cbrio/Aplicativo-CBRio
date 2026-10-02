# servir · escala · conhecimento operacional do app

Movido **na íntegra** do `CLAUDE.md` em 2026-10-01 (o arquivo tinha 268 KB e era carregado em toda chamada). Referência VIVA: leia o índice e a seção do assunto antes de mexer. Seção nova entra no FIM deste arquivo, datada, com uma linha a mais no índice.

**Escopo:** Servir e escala: montar escala por time, Pessoas do Servir, leitor/líder/admin, preferência de domingo, check-in do supervisor.

## Índice de seções

- ⚠️⚠️ SERVIR · "Pessoas do Servir" abre pra LÍDER, recortada aos times dele (24/09/2026)
- ⚠️ SERVIR · o "Adicionar" separa QUEM É DA VAGA do resto do time (24/09/2026)
- ⚠️⚠️ SERVIR · "PESSOAS DO SERVIR" — o ADMIN vincula pessoa × time × cultos pelo app (24/09/2026)
- ⚠️⚠️ SERVIR · LEITOR só lê, lista do TIME ordenada pela PREFERÊNCIA de domingo, "Meu domingo de preferência" (24/09/2026)
- ⚠️⚠️ MONTAR ESCALA · por TIME, em duas etapas, num carrossel (23/09/2026)
- ⚠️⚠️ SERVIR · a tela mandava quem JÁ SERVE pro formulário (11/08/2026)
- ⚠️⚠️ SERVIR · seções recolhidas + o calendário que não abria (2026-08-14)
- ⚠️⚠️ CHECK-IN DOS VOLUNTÁRIOS PELO SUPERVISOR (25/08/2026)
- Check-in do supervisor · por ÁREA, com avatar, e OTIMISTA (26/08/2026)

---

## ⚠️⚠️ SERVIR · "Pessoas do Servir" abre pra LÍDER, recortada aos times dele (24/09/2026)

Decisão do Marcos: em vez de dar **admin** aos líderes do staff (que daria escala e
estrutura de TODOS os times), abrir a tela pra quem é **Líder**, só nos times que
lidera. Par do ERP #3040.

- **Card**: acende com `gere_pessoas` de `/voluntariado/supervisor` (admin OU líder de
  time/área **sem recorte** de subárea/rodízio). Fallback `papel === "admin"` pra
  servidor antigo. Leitor e supervisor de turno (as concessões da Ariel) não veem.
- **Ficha** (`escopo: "lider"`): vínculos e "Vincular a um time seu" só com os times
  dele; os outros times da pessoa são **DECLARADOS** (`vinculos_fora`), nunca somem
  calados. Domingo de preferência só se a pessoa está num time dele
  (`pode_rodizio`) — senão os chips ficam apagados com o porquê.
- ⚠️ A trava é o servidor (`exigirGestorServir` + `_gerenciaTime` em cada escrita).

## ⚠️ SERVIR · o "Adicionar" separa QUEM É DA VAGA do resto do time (24/09/2026)

Pedido do Marcos: *"estou escalando um saxofonista, aparecem primeiro separados os
saxofonistas da igreja, abaixo aparece outras pessoas do time"*. Par do ERP #3034
(`escala-pool?team_id=` devolve `posicoes: [{id, name}]` por pessoa).

- **`lib/escalaTimes.dividirPorVaga(pool, vaga)`** (pura · 5 testes · 1 mutante):
  casa pelo `position_id` da vaga OU pelo nome sem acento; **só separa, não
  reordena** — a preferência de semana continua mandando dentro de cada seção.
  Sem vaga em foco (Adicionar no time, ou função digitada livre) não separa nada.
- Na tela: cabeçalho `"Sax · 3"` → os da vaga; `"Outras pessoas do time · 40"` → o
  resto. Quando ninguém do time tem a função, o cabeçalho diz isso em vez de sumir.
  A linha da pessoa virou `renderCandidato` (uma só, usada pelas 2 seções e pela
  busca geral).
- ⚠️ Pessoa sem `posicoes` (servidor antigo) cai no resto — nunca some.

## ⚠️⚠️ SERVIR · "PESSOAS DO SERVIR" — o ADMIN vincula pessoa × time × cultos pelo app (24/09/2026)

Pedido do Marcos depois de aplicar as migrations do #3027: *"para as pessoas que
forem admin, uma opção na aba de servir de buscar as pessoas que tem no app, clicar
no perfil, vincular ele em um time, selecionar quais cultos ele vai servir naquele
time"*. Par do ERP #3031 (rotas `/app/voluntariado/admin/*`, só `papel === 'admin'`).

- **Porta:** card "Pessoas do Servir" na aba Servir, só com `papel === "admin"` em
  `/voluntariado/supervisor` (Marcos e Matheus). A trava é o servidor (403).
- **Tela `app/(app)/servir-pessoas.tsx`:** busca (2+ letras) → linha com os times da
  pessoa → folha com: **Domingo de preferência** (chips) · **Times** (um card por
  time; funções em linhas com × pra tirar — `is_active=false`, reversível, com
  diálogo da casa; chips de **cultos em que serve** naquele time) · **Vincular a um
  time** (chip do time → função opcional → botão).
- ⚠️⚠️ **Cultos são por (PESSOA, TIME):** um PATCH em qualquer linha do time espalha
  pra todas (lei do servidor). Todos marcados = NULL = "serve em todos". **Desmarcar
  o último é BLOQUEADO na tela** — no servidor viraria NULL (= todos), o oposto do
  gesto; a tela avisa "use o × ao lado da função".
- ⚠️ `agir()` serializa as ações (uma por vez, `ocupado`) e recarrega a ficha depois
  de cada uma — a lista da busca é atualizada a partir da ficha, sem nova busca.
- ⚠️ Gotcha do portão i18n: `fn: () => Promise<void>` conta como string solta
  (`>Promise<` casa o regex de JSX). Escrever `() => void | Promise<void>`.
- ⏳ Nada rodou em aparelho.

## ⚠️⚠️ SERVIR · LEITOR só lê, lista do TIME ordenada pela PREFERÊNCIA de domingo, "Meu domingo de preferência" (24/09/2026)

Par do ERP #3027 (papéis `leitor|lider|admin` + escopo por time/dia do culto +
`vol_profiles.rodizio_semana`). Pedido do Marcos (23/09): *"cada um tem um
domingo de preferência e ao clicar para escalar naquela posição, ele filtra as
pessoas que estão naquele time priorizando quem colocou aquele domingo como
rodízio"*.

- **Leitor** (`somente_leitura` em `/voluntariado/supervisor`, `escala/servicos`
  e `escala/:id`): a `escala-supervisor.tsx` esconde FAB, "Adicionar a", vaga
  "preencher", botão de remover e o arraste (`Gesture.Pan().enabled(false)`), e
  mostra a faixa "Você acompanha esta escala como leitor". O card da aba Servir
  vira "Ver escalas" e o card de check-in some. ⚠️ É cortesia — a trava é o
  servidor (403 `somente_leitura`).
- **"Adicionar" já no time** (`abrirAdd` → `carregarPoolDoTime(team_id)`):
  `buscarEscalaPool("", { service_id, team_id })` traz as pessoas do TIME já
  **ordenadas pelo servidor** (prefere esta semana → sem preferência → outra).
  Digitar filtra **localmente** (`filtrarPool`, sem acento, preservando a ordem).
  "Buscar fora do time" volta pra busca geral de 2+ letras. ⚠️ **Preferência
  ORDENA, nunca filtra** — todo mundo do time continua na lista. Linha da pessoa
  diz "prefere este domingo" / "prefere o 2º domingo" (ou "semana do mês" quando
  o culto não é domingo — `ehDomingo`).
- **`lib/escalaTimes.ts`**: `semanaDoCulto` (BRT = UTC−3 fixo; **5ª vira 1ª**
  como `rodizioCulto.semanaDoRodizio` do servidor — divergir faria a tela
  anunciar uma semana e a lista vir por outra) · `ehDomingo` · `filtrarPool`.
  2 mutantes novos (5ª→1ª · acento). 99/99.
- **`components/voluntariado/DomingoPreferido.tsx`** na aba Servir (abaixo da
  Disponibilidade, só pra quem tem `vol_profile`): chips Nenhum · 1º–4º, salva
  no toque via `PATCH /app/voluntariado/me/rodizio`; texto diz que **não é
  bloqueio**. Só aparece quando `/me` manda `rodizio_semana` (servidor antigo
  não manda ⇒ `undefined` ⇒ sem card).
- ⏳ Nada rodou em aparelho. ⏳ As 2 migrations do ERP (`20260924120000` ·
  `20260924120100`) são do Marcos aplicar; sem elas o servidor responde no
  formato antigo e o app se comporta como antes (todo mundo líder, sem preferência).

## ⚠️⚠️ MONTAR ESCALA · por TIME, em duas etapas, num carrossel (23/09/2026)

O redesenho que o Marcos pediu em vídeo (03/09), comparando com o Planning
Center Services, e que ficou parado três semanas atrás da loja. Os pedidos dele,
na ordem da voz: **(1)** a aba Servir em si NÃO muda — ele recusou reordenar a
hierarquia dela, não reintroduzir; **(2)** culto em DUAS ETAPAS, tipo → data, só
os nossos cultos; **(3)** CARROSSEL horizontal de equipes; **(4)** agrupar por
TIME, não por cargo; **(5)** aba Ordem de Culto — **fica pra um PR próprio**;
**(6)** NÃO criar TIMES/NOTES/FILES. Mais o que eu levantei e ele aprovou: a
VAGA visível ("faltam 2") e manter o arrastar.

### ⚠️⚠️ O que estava errado, medido (Domingo - Manhã de 27/09 · 69 escalas)

- A tela agrupava pela string **`team_name` de cada linha** — e nas linhas
  importadas do Planning Center ela é o nome da **POSIÇÃO** ("Vocal", "Chat
  9:30", "Câmeras"), porque lá o "team" é o nosso cargo. **21 valores distintos
  que não são time nenhum** ⇒ 21 "equipes" de uma pessoa. Era exatamente a
  queixa do pedido 4.
- A tela lia `resposta.equipes` pra mostrar área vazia. **Esse campo nunca
  existiu na resposta** — o servidor manda `composicao` (equipe × posição ×
  quantidade) desde 25/08. "Área vazia" nunca apareceu no app.

### A régua · `lib/escalaTimes.ts` (pura · 14 testes · 5 mutantes)

- **A que time a linha pertence, nesta ordem:** `team_name` que É nome de time
  conhecido (a escrita mais recente — o `PATCH` do app gravava só o nome) →
  `team_id` (as linhas do PCO) → o próprio nome (`n:`), pra não sumir.
- **Vaga = `quantidade` − quem conta**, e **quem recusou NÃO conta** (a régua de
  21/08 de `volCobertura.js`, repetida aqui de propósito). A pessoa recusada
  continua listada — sumir com ela faria o supervisor perder quem repor.
- Posição casa por `position_id`, senão pelo nome normalizado; o que não casa
  cai em "Sem função", no fim do time. Dois itens pra mesma posição SOMAM (split).
- Tipos de culto na ordem do **próximo culto**, não alfabética — o supervisor da
  quarta abre a tela na quarta.

### A tela · `escala-supervisor.tsx`

- Etapa 1 = chips de TIPO · etapa 2 = chips de DATA (com "N esc."). Abre no
  tipo do culto mais próximo, já com a data dele. Culto que saiu da janela volta
  pro mais próximo do tipo.
- Barra de TIMES (chip = nome + badge vermelho com o `faltam`, ou o total)
  **é a navegação do carrossel E o alvo do arraste**. O carrossel é um
  `ScrollView` horizontal `pagingEnabled`, uma página por time, cada página com
  seu scroll vertical: cabeçalho (ÁREA · nome · `i/n`), contadores ✓ ✗ ?,
  "faltam N"/"completa", posições com `preenchidas/alvo`, pessoas, e a linha
  tracejada **"N vaga(s) em aberto · preencher"** que abre o Adicionar já no
  time e na função.
- **Arraste:** soltar num chip de time move pra lá **zerando a função**
  ("Vocal" não existe na Integração); soltar num cabeçalho de função da página
  aberta muda a função. `destinoDoArraste` devolve `null` no próprio time ⇒
  nenhuma chamada. Otimista; erro recarrega.
- Adicionar: equipe = chips dos times do culto · função = chips das posições do
  time (com "faltam N" nas abertas) + texto livre. **Saiu o "…ou nova equipe"**:
  time é dado do catálogo, não texto.
- Foto real quando `foto_url` vem (a régua de 26/08 do servidor); iniciais senão.
- O `remover()` usa o diálogo da casa (`useDialogo`) — veio do #163 na mesma
  tarde, mesclado por cima deste redesenho; os outros `Alert.alert` da tela são
  erros de rede e ficam nativos até o teste em aparelho.

### ⚠️ Lado do ERP (mesma leva)

`POST`/`PATCH /app/voluntariado/escala` passaram a gravar **`team_id` e
`position_id`** junto com os nomes (só equipe ATIVA resolve; mudança só de
função não re-resolve o time). Sem isso quem o app escalava caía em "sobrando"
na web e quem o app movia continuava no time antigo lá. A régua do app tolera as
duas gerações de dado.

### ⏳ O que NÃO está aqui

Ordem de culto (pedido 5 · precisa antes conferir se o roteiro da Produção é
dado estruturado) · o horário do time split acima do time (0 times com
`split_por_horario` hoje) · elegibilidade por tipo de culto (0 vínculos com
restrição). A máquina existe no banco e está desligada — ver a memória.

⚠️ Nada disto foi executado em aparelho por mim: o portão (362 testes) cobre a
RÉGUA, não a tela nem o gesto do arraste.

## ⚠️⚠️ SERVIR · a tela mandava quem JÁ SERVE pro formulário (11/08/2026)

Relato do Marcos: *"Pedro Fernandes, nosso responsável da produção que está
escalado em todos os cultos, ao abrir o app e entrar em servir apareceu as áreas
para ele escolher e o pedido de quero ser voluntário."*

**A causa era do APP, e o servidor sempre soube a resposta.**

`lib/useVoluntariadoSync.ts` lia **as tabelas direto** e nunca chamava
`GET /app/voluntariado/me`. O sinal de "esta pessoa está no time" vinha de
**`mem_membros.voluntario`** — coluna `true` em **0 de 4.072** membros vivos
(medido). Logo `voluntario_ativo` era **sempre false pra todo mundo**, e quem não
tinha linha em `vol_inscricoes` caia no formulário. O Pedro tem **57 escalas** e
**zero inscrição** — ele nunca precisou se inscrever, já servia.

⚠️ No servidor, `resolverVolProfile` (`backend/routes/app.js` · **Matheus,
25/06**) resolve o perfil por `auth_user_id` → CPF → `membresia_id` → e-mail,
faz backfill do vínculo e já devolve `voluntario_ativo`. Conferido: o perfil do
Pedro está **vinculado** e **não arquivado**. **A tela só nunca perguntou.**

⚠️⚠️ **ERAM DUAS VERDADES NO MESMO APP.** `lib/jornada.ts` e
`lib/inscricoesStatus.ts` **já chamavam** `getVoluntariadoMe()` — a Jornada e o
hub de Inscrições mostravam o Pedro como quem serve enquanto a aba Servir oferecia
a ele "quero ser voluntário". É a mesma divergência que `lib/volStatus.ts` matou
em 05/08: a **RÉGUA** foi unificada, a **FONTE** não. Quando aparecer divergência
entre duas telas sobre o mesmo dado, conferir **de onde cada uma lê**, não só como
cada uma decide.

### Os dois vazamentos no caminho

1. **O cast silencioso.** `getVoluntariadoMe()` fazia `return obj as VoluntariadoMe`.
   Campo ausente chega `undefined`, a régua cai no status da inscrição e o
   formulário volta — **sem erro de TypeScript e sem falhar teste nenhum**. A
   conferência virou **`lib/voluntariadoMe.ts`** (pura, no portão, 2 mutantes).
   ⚠️ `=== true` de propósito: truthy frouxo aceitaria a **string `"false"`**.
2. **O curto-circuito do `membro_id`.** Conta sem `membro_id` respondia
   `voluntario_ativo: false` **sem perguntar**. Mas o servidor resolve por
   `auth_user_id` e e-mail — não precisa do `membro_id`. Medido: **21 das 125
   contas** não têm `membro_id`, e **1 delas tem perfil de voluntário vivo com 5
   escalas**. Decisão tomada no cliente sobre dado que o cliente não tem.

⚠️ **Falha de rede NÃO vira "você não é voluntário"** — mostrar o formulário a
quem serve é o estado enganoso que esta correção existe pra matar (mesma família do
`meu-grupo` e do `evento` na Onda 2).

⚠️ O bloco **"Já sirvo — informe seu CPF"** saiu da tela: o servidor resolve
sozinho agora. **Não reintroduzir busca por CPF DIGITADO** — "CPF identifica, não
autentica" é lei do projeto, e aqui ela entregaria escalas, telefone e e-mail de
quem tivesse o CPF conhecido. (`POST /app/voluntariado/vincular-cpf` existe no
backend desde 09/07 e continua lá — só não é mais chamado por esta tela.)

### ⏳ Follow-up medido, NÃO feito (é do ERP, e é 1 linha)

`/app/voluntariado/me` calcula `const ativo = vp?.allocation_status === 'active'`.
**`allocation_status` é `'active'` em 928 de 928 perfis** — não discrimina
ninguém. O sinal que separa é **`arquivado`** (793 false × 135 true). Hoje **2
perfis arquivados** que a cadeia resolve apareceriam como "ativo". Trocar por
`vp?.arquivado === false` conserta; deixei pro Matheus porque é o código dele e
ele volta nessa área.

## ⚠️⚠️ SERVIR · seções recolhidas + o calendário que não abria (2026-08-14)

Três apontamentos do Matheus na aba Servir, testando no iPhone.

### 1 · "Minhas escalas" e "Histórico de check-in" abrem RECOLHIDAS

Pedido dele: a aba abria com uma parede de cartões (ele tem 8 escalas
confirmadas + histórico). `components/ui/SecaoRecolhivel.tsx` é o padrão —
fechada por padrão, e os filhos **nem renderizam** enquanto está fechada.

⚠️⚠️ **Recolher só é honesto se o cabeçalho disser o que ficou lá dentro.** O
cabeçalho leva a contagem e, quando há escala esperando resposta, uma pastilha
âmbar (`3 aguardam você`). Régua em **`lib/resumoEscalas.ts`** (pura, no portão,
com mutante): pendente é o que a pessoa **ainda pode responder** —
`confirmed`/`declined` não pendem (ela já respondeu) e escala que passou também
não (a tela nem oferece confirmar depois do culto). ⚠️ Data ausente ou ilegível
conta como **pendente**: abrir à toa é barato, perder a escala não.

⚠️ O estado dura enquanto a tela vive (a barra reaproveita a instância, por
`navigate`). Não é persistido: quem abre e volta na mesma sessão encontra aberto;
quem entra do zero encontra fechado, que foi o pedido.

### 2 · 🔴 O calendário do "Bloquear datas" NÃO ABRIA no iPhone

Relato: *"não consigo clicar na data para adicionar o período indisponível;
quando clico não abre calendário nenhum"*.

**A causa é de camada nativa, não de toque.** `<Modal>` é container **nativo**,
apresentado a partir do view controller da tela — e o `CalendarioBR` era um
`<Modal>` **irmão** do modal do formulário. Pedir o segundo enquanto o primeiro
está apresentado o faz nascer **atrás**: o toque funcionava, o calendário abria,
e ninguém via.

⚠️⚠️ **E este repo tinha registrado o oposto**: o CLAUDE.md dizia que dois
`<Modal>` irmãos simultâneos funcionam "desde 07/08", citando este mesmo arquivo.
O que provou aquilo foi um teste em **Android**, onde a pilha de `Dialog`
perdoa. **A premissa valia pra uma plataforma só.**

⇒ `CalendarioBR` ganhou a prop **`embutido`**: renderiza só o cartão, sem
`<Modal>`. Quem abre calendário de dentro de um modal o desenha **na janela que
já está aberta**, no lugar do formulário (o formulário não perde nada — as datas
e o motivo moram no estado do componente pai). Aninhar `<Modal>` em `<Modal>`
seria a outra saída, e é justamente a que não tem precedente aqui.

⚠️ **O mesmo defeito estava em `/grupo-visita`** (a tela do supervisor), com o
mesmo padrão — corrigido junto. Era o único outro consumidor do calendário.

### 3 · O "Recusar" da escala confirmada era invisível

Era um link cinza sublinhado ao lado do "Confirmada". Virou botão de verdade
(borda e texto em `danger`, ícone, área de toque de botão), **embaixo** do
status em vez de espremido ao lado. Quem não pode ir precisa avisar a
coordenação — e avisar tarde custa a vaga do domingo.

⚠️ Nada disto foi executado em aparelho por mim: o portão (193 testes · 56/56
mutantes) cobre a RÉGUA do resumo, não a tela nem a camada de modal.

## ⚠️⚠️ CHECK-IN DOS VOLUNTÁRIOS PELO SUPERVISOR (25/08/2026)

Pedido do Matheus: *"no app de membros os supervisores devem ter a funcionalidade
de fazer check-in também dos voluntários das suas respectivas áreas. E só podem
mexer nessa funcionalidade nos dias de culto. Isso ajuda a gente não ficar refém
de apenas um local de check-in (que hoje é na sala de voluntários)."*

**Onde:** card na **aba Servir** (`/voluntariado`, ao lado de "Montar escala") →
tela `/checkin-voluntarios`. Ele escolheu que a entrada fica na aba, não em menu
próprio. Registrado em `lib/hierarquia.ts` (pai = `/voluntariado`), senão a seta
de voltar não leva a lugar nenhum — invariante do portão.

⚠️⚠️ **QUEM MANDA É O SERVIDOR.** O ERP decide a **janela** (dia do culto em BRT)
e o **escopo** (área + subárea da concessão) e responde **403**
(`backend/routes/app.js` + `backend/utils/janelaCulto.js`). A régua local
(`lib/janelaCheckin.ts`) existe pra o **card não aparecer** fora da janela — nunca
pra substituir a checagem. Se as duas discordarem, o toque falha, e **botão que
falha é pior que botão que não existe**.

⚠️ **A lista NÃO é refiltrada no cliente.** `getEscala` já vem recortada pelo
escopo do supervisor (o backend filtra composição e escalas). Refiltrar aqui
criaria uma segunda régua pra divergir da primeira.

⚠️⚠️ **A ARMADILHA DE FUSO — é o mutante 62.** Culto de domingo 19h é **22h UTC**;
das 21h BRT em diante `toISOString().slice(0,10)` já devolve o dia seguinte e a
janela **FECHA NO MEIO DO CULTO DA NOITE**, com o supervisor de mão na massa e
gente na porta. Mesma classe do bug de 05/08 que criou o `dataBRT.ts` ("21h no
Rio ainda é hoje") — e reapareceu num arquivo novo. Régua pura em
`lib/janelaCheckin.ts`, 7 casos em `test/reguas.test.ts`, 2 mutantes (UTC e
"janela sempre aberta"). **63/63.**

⚠️ `janelaCheckin` usa **`Intl` (timeZone)**, não o offset fixo de −3h do
`hojeBRT()` vizinho. O comentário do `dataBRT.ts` já registra o offset como dívida
("se o horário de verão voltar, isto tem que virar Intl") — código NOVO não entra
aumentando essa dívida, e o backend também usa `Intl`, então os dois lados
calculam pelo mesmo mecanismo.

**Presença é resolvida por ESCALA *e* por PESSOA**: o backend deduplica por BLOCO
de culto (a manhã inteira cobre com 1 check-in), então a mesma pessoa pode estar
marcada sem ter linha de check-in NESTE `service_id`. A tela olha os dois mapas —
com um só, a mesma pessoa apareceria "não marcada" e o toque levaria 409.

**Desfazer** existe (decisão dele: "sim, dentro da janela"), com confirmação
mostrando a hora do check-in. Fora do dia, o servidor recusa.

⚠️ Quem apareceu **sem estar na escala** não aparece na lista — e a tela **declara
isso** no pé, em vez de esconder. O endpoint aceita check-in avulso, mas oferecer
busca de pessoa aqui abriria uma segunda porta de escalação sem a régua da escala.

## Check-in do supervisor · por ÁREA, com avatar, e OTIMISTA (26/08/2026)

Três pedidos do Matheus na mesma tela (`/checkin-voluntarios`):

**1. Separado por ÁREA.** Cabeçalho por área com a conta do turno
(`marcados/total`), que é o que o supervisor confere de relance na porta do culto.
⚠️ A `area` vem do **servidor** (PR #2733 do ERP): ela mora em `vol_teams.area`, e
remontar o mapa equipe→área aqui criaria uma segunda fonte pra divergir na
primeira equipe que trocasse de área. Quem não tem área cai num grupo próprio no
FIM, rotulado — em vez de sumir ou se misturar a uma área de verdade.

**2. Avatar quando a pessoa tem foto.** ⚠️ Só quando o servidor manda `foto_url`.
MEDIDO no ERP: **352 dos 619** escalados têm em `vol_profiles.avatar_url` um
**placeholder de iniciais do Planning Center** (`/uploads/initials/MS.png`), não
uma foto. O servidor já descarta; se não descartasse, o app trocaria as iniciais
desenhadas (que combinam com o tema) por um PNG cinza — mais bytes, resultado
pior. **269 de 619 (43%) mostram foto**; o resto fica nas iniciais.
⚠️ A foto real do PCO pesa (~156 KB a que eu medi). Se pesar no wifi da igreja, o
caminho é guardar o `photo_thumbnail` que o PCO já devolve no sync — hoje o sync
prefere o avatar cheio.

**3. ⚠️⚠️ Marcar ficou OTIMISTA** — *"quando marca a pessoa, achei o carregamento
meio lento; deixe mais suave e mais rápido"*. A primeira versão fazia
`await registrarCheckin()` e **depois** `await carregarLista()`, que refaz DOIS
pedidos (escala + check-ins): **três idas ao servidor antes de a linha mudar de
cor**, com a fila esperando na porta. Agora a linha muda na hora e persiste em
background — o mesmo padrão que o ERP usa em `Batismos.tsx`.

- ⚠️ **NÃO recarrega no sucesso.** A resposta do POST já é a linha criada;
  recarregar tudo pra confirmar o que o servidor acabou de confirmar era a
  lentidão em pessoa.
- ⚠️ **REVERTE no erro.** Sem isso o otimismo vira mentira: a pessoa ficaria
  marcada na tela e ausente no banco — pior que o carregamento lento.
- O provisório é trocado pelo real quando o POST responde, porque **o id
  importa**: é ele que o desfazer usa.
- `emAcao` foi removido: com a marcação otimista o spinner por linha não existe
  mais, e deixar o estado morto só confundiria quem ler depois.
