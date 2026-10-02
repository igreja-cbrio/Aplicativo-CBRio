# devocional · conhecimento operacional do app

Movido **na íntegra** do `CLAUDE.md` em 2026-10-01 (o arquivo tinha 268 KB e era carregado em toda chamada). Referência VIVA: leia o índice e a seção do assunto antes de mexer. Seção nova entra no FIM deste arquivo, datada, com uma linha a mais no índice.

**Escopo:** Devocional: casa nova (Bíblia, Planos, Comentários, Anotações, Leituras), check-in, vídeo, planos por inscrição.

## Índice de seções

- ⚠️⚠️ DEVOCIONAL · UMA tela pra TODO plano + YouTube dentro do app (25/09/2026 · 2ª leva)
- ⚠️⚠️ DEVOCIONAL · VÍDEO na leitura + SEMANAS no plano longo (25/09/2026)
- ⚠️ DEVOCIONAL · voltar da leitura abria "Plano não encontrado" (24/09/2026 · 3ª leva)
- ⚠️⚠️ DEVOCIONAL · o check-in caía em 42P10 há 15 dias · papel, parágrafos e A−/A+ (24/09/2026 · 2ª leva)
- ⚠️ DEVOCIONAL · "Planos sugeridos" + plano POR INSCRIÇÃO (24/09/2026)
- ⚠️⚠️ DEVOCIONAL · a casa nova (Bíblia · Planos · Comentários · Anotações · Leituras) RESTAURADA (23/09/2026)

---

## ⚠️⚠️ DEVOCIONAL · UMA tela pra TODO plano + YouTube dentro do app (25/09/2026 · 2ª leva)

Pedido do Marcos: *"essa nossa estética de Valores de Cristo universal para
todos os planos, inclusive o de Quarta com Deus"* e *"não quero link do YouTube,
quero que a pessoa clique para ver mas não saia do app"*.

- **Todo plano abre em `/devocional-plano`** (home do Devocional, carrossel e
  `/devocional-planos`). `/devocional-diario` ficou sem porta — segue no mapa só
  por link antigo.
- ⚠️⚠️ **O RITMO vem do DADO** (`ritmoDoPlano`): datas sentinela (ano 2000) =
  no seu ritmo (inscrição, dia N depois do N-1, semanas por posição); datas reais
  = CALENDÁRIO. **Não é `continuo`**: as edições antigas do Devocional da semana
  têm `continuo=false` e datas reais.
- Calendário (`edicoesDoCalendario`/`edicaoEmFoco`): abas = EDIÇÕES
  (`edicao_slug`, senão a semana da data), mais nova primeiro; hoje e antes
  abrem (atraso NÃO tranca), futuro trancado com "Abre em DD/MM" (mutante).
  Sem inscrição — o diário nunca pediu. Foco = edição de hoje → a última que
  começou. Comparação de STRING `YYYY-MM-DD`, com o hoje do APARELHO
  (`hojeISO`), como o check-in.
- **YouTube** (`idDoYoutube` + IFrame API em `htmlDoVideo`): toca embutido.
  ⚠️⚠️ A página do WebView carrega com `baseUrl: https://cbrio.org` — sem
  origem o YouTube responde "Erro 153". ⚠️ `navegacaoPermitida` barra o frame
  PRINCIPAL de navegar pra fora (tocar no logo não abre o YouTube; mutante);
  `setSupportMultipleWindows={false}` pro `_blank` do Android cair na mesma
  régua. Pausar/retomar entre inline e tela cheia por `window.pausar/irPara`,
  iguais nos dois players.
- O dia do plano diz "Voltar ao plano" (no calendário o próximo pode estar
  trancado — prometer "o próximo dia" mentiria).

## ⚠️⚠️ DEVOCIONAL · VÍDEO na leitura + SEMANAS no plano longo (25/09/2026)

Pedido do Marcos: *"subir vídeos nas devocionais, ter uma boa visualização,
colocar fullscreen; para devocionais mais longos do que uma semana, separar ali
em cima em semana 1, 2, 3… e quando todos de uma semana são finalizados eles vão
para o próximo"*. Par do ERP #3052 (upload no "Editar item").

- **Player = `<video>` do HTML no WebView** (`components/devocional/VideoDevocional.tsx`
  + régua pura `lib/videoDevocional.ts`). ⚠️ `react-native-webview` está em
  TODOS os binários publicados (entrou 08/06); `expo-video` seria nativo e não
  sairia por OTA. Aparece acima da passagem, no diário e no dia do plano.
- **"Tela cheia" é um Modal NOSSO** (player ocupando a tela, tempo passado de um
  player pro outro), não o fullscreen do player — o do WebView varia por
  plataforma. ⚠️ O app é travado em RETRATO: girar pra paisagem exige
  `expo-screen-orientation` (nativo ⇒ build de loja).
- ⚠️⚠️ **`video_url` chega por migration do ERP (`20260925120000`).** Pedir
  coluna inexistente recusa a query INTEIRA (42703) e o devocional sumiria, então
  `comVideo()` em `lib/devocional.ts` pede com vídeo e, se `faltaColuna`, repete
  sem ele. Só 42703 com o nome da coluna conta (mutante).
- `videoSeguro`: só `https` sem aspas/`<>` — a URL vai DENTRO do HTML.
- **Semanas** (`semanasDoPlano`/`semanaEmFoco` em `lib/planoRitmo.ts`): por
  POSIÇÃO (dias 1–7, 8–14…), só com mais de 7 dias. A tela abre na 1ª semana não
  completa; quando o foco muda, a escolha manual é descartada — é isso que "vai
  pro próximo" sozinho (mutante).

## ⚠️ DEVOCIONAL · voltar da leitura abria "Plano não encontrado" (24/09/2026 · 3ª leva)

Relato do Marcos: *"quando eu aperto o botão de voltar dentro de uma leitura, ele
abre uma tela escrito 'Plano não encontrado'"*. `subirUmNivel` fazia
`navigate("/devocional-plano")` **sem `planoId`** — o pai certo, sem saber qual
plano. O mesmo valia pro "Próximo dia" e pro back físico do Android.

- **`PARAMS_QUE_SOBEM` + `paramsDoPai`** em `lib/hierarquia.ts`: a rota filha
  declara QUAIS parâmetros o pai precisa; só esses sobem (o `itemId` do dia não
  vai junto). O layout passa `useGlobalSearchParams()` pro `registrarRotaAtual`.
- ⚠️ Tela nova cujo pai depende de parâmetro = **uma linha** nesse mapa, ao lado
  da linha do `PAI`. Sem ela o pai abre vazio. Teste + mutante no portão.

## ⚠️⚠️ DEVOCIONAL · o check-in caía em 42P10 há 15 dias · papel, parágrafos e A−/A+ (24/09/2026 · 2ª leva)

Relato do Marcos testando o Valores de Cristo no aparelho: *"apertei para me
inscrever e consegui, mas quando apertei para registrar a leitura deu erro 'não
foi possível registrar'"*. A telemetria tinha o evento — com `reason:
"[object Object]"`, porque o erro do PostgREST é objeto plano, não `Error`.
Reproduzido com service role: **`42P10 there is no unique or exclusion
constraint matching the ON CONFLICT specification`**.

⚠️⚠️ **LEI: `mem_devocionais` NÃO aceita `upsert`.** O índice único
`uq_mem_devocionais_dia` virou **PARCIAL** em 09/09 (`WHERE deleted_at IS
NULL`, migration `20260909140000` do ERP, pra o soft-delete liberar a chave) —
e o `ON CONFLICT` do PostgREST **não infere índice parcial**. Desde então
**todo check-in do devocional falhava**, do diário e do plano: a 1ª metade
(`devocional_leituras_planos`) gravava, a 2ª (`mem_devocionais`, o KPI do
Investir) estourava. Ninguém viu porque o conteúdo semanal parou em 04/09 e
não havia check-in pra fazer. Agora `checkInDevocional` faz **select →
update/insert**; `test/checkinSemUpsert.test.ts` é guarda estática (com
mutante) de que nenhum bloco `from("mem_devocionais")` chama `upsert`.
⚠️ Vale pra qualquer tabela cujo unique seja parcial — antes de `upsert`,
conferir se o índice tem `WHERE`.

- **`lib/erroMensagem.ts` · `mensagemDoErro(e)`**: a telemetria e o Alert
  passam a carregar `code · message · details` do PostgREST. `String(e)` num
  objeto plano é o que escondeu a causa.
- **Passagem bíblica em "papel"** (`components/devocional/TextoLeitura.tsx` ·
  `PassagemBiblica`): fundo `#FBFAF7`, serifa, cores FIXAS — a mesma estética
  e a mesma decisão da aba Bíblia (não segue o tema escuro). As ações do
  versículo (Salvar · Comentários · Marcar) vivem dentro do papel.
- **Parágrafos curtos** (`lib/paragrafos.ts`, puro, no portão): linha em
  branco do autor sempre separa; bloco com 4+ frases é partido de 2 em 2.
  ⚠️ Corta só em fim de frase + MAIÚSCULA, e **"Pr.", "Dr.", "Ap."** não são
  fim de frase (mutante). A reflexão do plano continua um bloco no banco — a
  quebra é de LEITURA.
- **A−/A+ das telas de leitura** (`lib/fonteLeitura.ts` puro + hook
  `useFonteLeitura` + `components/devocional/ControleFonte`): passos
  `0.85 · 1 · 1.15 · 1.3 · 1.5`, travado nas pontas (mutante), persistido em
  `cbrio.fonteLeitura` e **compartilhado** entre Bíblia, diário e dia do
  plano. ⚠️ É SEPARADO da escala global de Configurações (`cbrio.fontScale`,
  que multiplica todo `<Text>` e só vale ao reabrir) — as duas se multiplicam.
  `fontSize` e `lineHeight` escalam juntos.
- `FONTE_SERIF` (`lib/fonteSerif.ts`): Georgia no iOS, `serif` no Android —
  "Georgia" não existe no Android e caía na Roboto em silêncio (a Bíblia já
  fazia isso). Fica em arquivo próprio porque importa `react-native`, e
  `fonteLeitura.ts` é puro pro portão.
- ⏳ **O check-in do Marcos de 24/09 (dia 1) está pela metade no banco**: a
  leitura do plano existe, a linha de `mem_devocionais` não (o script
  `insere_checkin.js` da sessão faz o INSERT; eu fui barrado de escrever em
  produção). Na tela ele aparece como lido, então ninguém vai tocar de novo.

## ⚠️ DEVOCIONAL · "Planos sugeridos" + plano POR INSCRIÇÃO (24/09/2026)

Pedido do Marcos: *"abaixo do bloco guardar e revisitar, uma nova sessão de
planos sugeridos, seria um carrossel com os planos, aí você clica nele e se
inscreve. Coloque uma devocional de 'Valores de Cristo', 1 dia para cada valor
da igreja, 5 dias usando como base Atos 2:42."*

**Dois tipos de plano convivem em `devocional_planos`, e a diferença é a
coluna `continuo`:**

| tipo | exemplo | quem manda no "hoje" | tela |
|---|---|---|---|
| por CALENDÁRIO (`continuo=true`) | Devocional da semana · Quarta com Deus | a DATA do item = hoje | `/devocional-diario` |
| por INSCRIÇÃO (`continuo=false`) | **Valores de Cristo** (5 dias) | a pessoa: dia N abre depois do N-1 lido | `/devocional-plano` → `/devocional-plano-dia` |

- **A home** (`devocional.tsx`) ganhou o carrossel `PLANOS SUGERIDOS` =
  `planosSugeridos()` (ativo + `inscricao_habilitada`), com badge "Inscrito" e
  o ritmo ("5 dias" · "Contínuo"). Contínuo abre o diário; por inscrição abre
  a tela do plano. Erro **não vira lista vazia** (caixa com "Tentar de novo").
- ⚠️⚠️ **Os itens do plano por inscrição têm `data` SENTINELA `2000-01-0N`.**
  É o que faz o push das 7h30 (`notify-lembretes` · `data = hoje`) e o
  Devocional da semana **não os enxergarem** — eles não são "o devocional de
  hoje" de ninguém. A ORDEM vem de **`ordem_no_ciclo`**; `itensDoPlano` ordena
  por `data desc` (herança do diário), então **nunca desenhar a lista sem passar
  por `ordenarItensDoPlano`** (`lib/planoRitmo.ts`).
- **A régua é PURA em `lib/planoRitmo.ts`** (`diasDoPlano` · `progressoDoPlano`
  · `podeAbrirDia`, no portão, **2 mutantes**): `lido` · `atual` (o PRIMEIRO
  não lido — único que abre) · `bloqueado`. Lido fora de ordem segue lido; o
  atual é sempre o primeiro buraco. "No seu ritmo" = pode ler 2 dias no mesmo
  dia; o que não pode é pular.
- **O check-in é o MESMO `checkInDevocional`** do diário: grava
  `devocional_leituras_planos` (libera o dia seguinte) **e** `mem_devocionais`
  (o KPI do valor Investir, upsert por membro+dia+tipo — ler 2 dias no mesmo dia
  atualiza o `devocional_item_id` daquele dia, o KPI conta 1). Segunda régua
  aqui divergiria.
- `leiturasDoPlano` filtra pelo embed `devocional_itens!inner(plano_id)` —
  a UNIQUE `(membro_id, item_id)` de `devocional_leituras_planos` é o que torna
  o check-in idempotente.
- Conteúdo do **Valores de Cristo** (plano `acd9f8df…`, slug
  `valores-de-cristo`, `destaque=true`): 5 itens em Atos 2.42–47, um valor por
  dia (Seguir Jesus · Conectar · Investir tempo com Deus · Servir ·
  Generosidade), com `gerado_por_ia=true` e `autor='CBRio'`. Texto bíblico em
  Almeida (domínio público) — a bible-api não devolve Atos 2. Criado por script
  direto no banco (24/09), sem migration: **é DADO, não schema**.
- ⚠️ `subirUmNivel` de `/devocional-plano-dia` volta pro plano (é lá que o dia
  seguinte aparece liberado) e o plano volta pra home do Devocional.

## ⚠️⚠️ DEVOCIONAL · a casa nova (Bíblia · Planos · Comentários · Anotações · Leituras) RESTAURADA (23/09/2026)

**O que é.** A aba Devocional deixou de ser uma tela só e virou uma **casa com 5
portas** (`app/(app)/devocional.tsx` é a home; nada de conteúdo nela):

| Porta | Rota | O que faz | Onde grava |
|---|---|---|---|
| Bíblia | `/biblia` | livro → capítulo → leitura (JFA/WEB/KJV via `bible-api.com`, domínio público — `lib/bibliaLivre.ts`); tocar no versículo = marcar com cor · Salvar (privado) · Comentários (público); abre no último capítulo lido; setas Anterior/Próximo | `devocional_leituras_biblia` (1 por membro+dia+capítulo) · `devocional_registros_pessoais` (marcação = linha com `cor`) |
| Planos de leitura | `/devocional-planos` → `/devocional-diario` | 3 cartões: **Pense Pedrão** (YouTube) · **Quarta com Deus** (ciclo **qui→qua**, 7 bolinhas, culto = última leitura) · **Devocional da semana** (seg→sex). O diário é a tela antiga do devocional, parametrizada por `planoId`+`ciclo` | check-in grava em **`devocional_leituras_planos`** (novo) **E** em `mem_devocionais` (o KPI do valor Investir continua daqui) |
| Comentários | `/devocional-mural` | publicar reflexão sobre um versículo com alcance **grupo · servir · igreja**; sempre com o nome (anônimo foi vetado pelo Marcos) | `devocional_mural` (RPC `listar_devocional_mural`) |
| Anotações e Marcações | `/devocional-registros` | tudo que a pessoa guardou (privado + o que publicou), com excluir | `devocional_registros_pessoais` + `devocional_mural` do próprio |
| Leituras da Bíblia | `/devocional-leituras` | mini-relatório: dias com leitura no mês, recentes, planos concluídos/em andamento | leitura de `devocional_leituras_biblia` + RPC `resumo_meus_planos_devocionais` |

**De onde veio (a história que explica o "sumiu").** Isto foi construído numa
sessão do **Codex** (31/08→03/09/2026, pedidos do Marcos em 02/09) e **publicado
por OTA em 03/09 (update `3aa750e3`) SEM COMMIT** — ficou só na working copy de
`~/Aplicativo-CBRio` (branch `codex/grupo-encontros-acoes`). Os OTAs seguintes
saíram do `main` e sobrescreveram a frota com a tela antiga. Em 23/09 o trabalho
foi trazido pra este branch **sem alteração de comportamento** (tsc limpo · 348
testes verdes) e publicado de novo. LEI: **nada vai ao ar sem estar no `main`**.

⚠️⚠️ **O SCHEMA DESSAS 5 TABELAS EXISTE SÓ NO BANCO.** `devocional_inscricoes`,
`devocional_mural`, `devocional_registros_pessoais`, `devocional_leituras_biblia`,
`devocional_leituras_planos`, as colunas novas de `devocional_planos`
(`slug`, `continuo`, `inscricao_habilitada`, `destaque`) e de `devocional_itens`
(`edicao_slug/titulo/inicio/fim`, `ordem_no_ciclo`, `autor`) e as 2 RPCs **não
têm migration em nenhum repo** (o Codex aplicou direto). Colunas/FKs conferidas
em 23/09 pelo OpenAPI do PostgREST; anon é negado nas 5. ⏳ Dumpar o DDL (SQL
editor do Supabase) pra `supabase/migrations/` do SISTEMA antes de qualquer
mudança de schema. ⏳ Rodar a sonda com a conta de membro comum nas 5 tabelas
(SELECT/INSERT) — a auditoria de 17/09 apertou `authenticated` e pode ter
alcançado estas.

⚠️ **Conteúdo parou em 04/09.** Último `devocional_itens` de qualquer plano é
04/09/2026 (edição "1 Crônicas" do Quarta com Deus, seg→sex ainda). Os planos
semanais estão todos `ativo=false`. O Codex ia carregar `Downloads/Samuel2.docx`
(2 Samuel, 7 leituras qui 03/09 → qua 09/09) e não chegou a gravar. Sem item do
dia, TODAS as portas de plano mostram "ainda não foi publicado" — isso é
conteúdo (Cuidados → planos no SISTEMA), não bug do app.

⚠️ O portão do OTA (`npm run ota`) roda `test/dialogoDaCasa.test.ts`: confirmação com
botões tem que ser `useDialogo` (a de excluir anotação foi migrada em #165 — o 1º OTA
da restauração foi barrado por isso, e é assim que deve ser).

⚠️ Gotchas do código: `listarPlanos` acha o "Devocional da semana" por título
contendo "semana" e sem `slug` (frágil; o certo é dar slug ao plano semanal);
`cartoes.tsx`/`sobre.tsx` escrevem `{"CB"+"Rio"}`/`{"NSM"+": "}` só pra não
contar no portão de i18n; a leitura da Bíblia tem cores fixas de "papel"
(`#FBFAF7`) — não segue o tema escuro de propósito.
