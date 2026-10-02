# batismo · conhecimento operacional do app

Movido **na íntegra** do `CLAUDE.md` em 2026-10-01 (o arquivo tinha 268 KB e era carregado em toda chamada). Referência VIVA: leia o índice e a seção do assunto antes de mexer. Seção nova entra no FIM deste arquivo, datada, com uma linha a mais no índice.

**Escopo:** Batismo: escolha da data e do horário (régua de OTA de worktree limpa também está aqui).

## Índice de seções

- ⚠️⚠️ BATISMO · a pessoa ESCOLHE a data (25–26/09/2026 · #177 + #179 · par do ERP #3063)
- ⚠️ Batismo · seletor de HORÁRIO na inscrição (2026-08-13)

---

## ⚠️⚠️ BATISMO · a pessoa ESCOLHE a data (25–26/09/2026 · #177 + #179 · par do ERP #3063)

Pedido do Matheus: *"preciso que na inscrição de batismo tenha como escolher o
mês... isso deve refletir tanto no formulário público quanto no app dos
membros."* Até então a tela calculava a data sozinha (`proximoBatismo()`, a
fórmula do 4º domingo) e **não mandava data nenhuma** no envio.

- **As datas vêm do SERVIDOR**: `GET /public/batismo/horarios` ganhou
  `datas: [{data_batismo, horarios}]` — as 3 próximas datas abertas de
  `batismo_eventos`, cada uma com a ocupação POR data. `data_batismo`/`horarios`
  no topo continuam existindo: é o contrato antigo, pra bundle sem OTA.
- ⚠️⚠️ **Sem `datas` na resposta = comportamento antigo, byte a byte** (servidor
  antigo, timeout): a tela cai na data única do topo. `proximoBatismo()` fica
  só como RESERVA do banner antes de a resposta chegar — **não ensinar essa
  função a calcular N meses**: recriaria a divergência que esta leva fecha (a
  fórmula já errou em dez/2024, batismo antecipado pro 3º domingo).
- ⚠️⚠️ **`data_batismo: dataEscolhida` VIAJA no payload, e é ESCOLHA, não
  required.** A inscrição do app não passa pelo endpoint: grava em
  `app_inscricoes` e o gatilho `fn_app_inscricoes_fanout` cria a linha do
  batismo. Até 25/09 ele carimbava `fn_proximo_quarto_domingo()` FIXO e
  descartava qualquer data — a tela diria novembro, o banco gravaria setembro,
  calado. O ERP corrigiu por patch dinâmico (migration `20260925121000`,
  conferida VIVA em 26/09: a função lê `dados->>'data_batismo'`). Sem data, ou
  data fora da janela aberta, o banco cai na primeira aberta — regra dele, não
  do app. **Nunca travar o envio por causa desse campo.**
- ⚠️ **Seletor só com `datas.length > 1`** — com uma, o banner "Próximo
  batismo: X" já responde. Cartão sem horário aberto fica desabilitado ("sem
  vaga"); trocar a data TROCA os horários e limpa a seleção se o horário não
  existir na data nova (a ocupação é por data, e "09:30" de setembro não é o
  slot de novembro).
- ⚠️ **Data de calendário por componentes LOCAIS** (`isoParaDataLocal`):
  `new Date('2026-09-27')` é meia-noite UTC = 21h do dia anterior no Rio, e o
  cartão do domingo 27 diria "sábado, 26".
- **Banner: "Sempre no 4º domingo" virou "Geralmente"** (#179): as datas são
  cadastro e podem não ser o 4º domingo. A chave antiga fica em
  `lib/translations.ts` pra bundle velho.
- Guarda em `test/reguas.test.ts` ("batismo · escolher a data") + 2 mutantes em
  `scripts/mutantes.mjs` (payload sem data · seletor com 1 data). 4 mutantes
  rodados e mortos em 26/09.

### ⚠️⚠️ O 1º OTA desta feature saiu da BASE ERRADA (26/09/2026)

Update "feat(batismo): escolha da data de batismo no aplicativo" (madrugada de
26/09). Pelo estado do checkout principal `~/Aplicativo-CBRio` — branch
`claude/ledger-android-vc9` em `14a34c1` (base de 21/09) com a tela editada
SEM COMMIT — foi dali que ele saiu: a frota recebeu a escolha de data e
**perdeu #160–#177** — 18 PRs, tudo desde 21/09 (Devocionais, Servir,
Grupos, Next…) — por alguns minutos. O #177
reaplicou a mudança sobre a main atual e o OTA corretivo ("fix(app): restaura
base atual com datas de batismo") saiu em seguida. É a mesma armadilha do
Devocional de 03/09 (update `3aa750e3` sem commit).
⚠️⚠️ **Régua: OTA sai de uma worktree LIMPA em `origin/main` (ou do PR recém
mergeado), nunca do checkout principal** — ele fica dias numa branch antiga.
Antes de `npm run ota`: `git status` limpo **e** `git log -1` igual a
`origin/main`.
⚠️ Em 26/09 o checkout principal AINDA está nessa branch com os 2 arquivos
modificados sem commit — é resíduo do acidente, não trabalho a preservar.

## ⚠️ Batismo · seletor de HORÁRIO na inscrição (2026-08-13)

Pedido do Marcos: *"na inscrição de batismo, tenha a mesma opção de escolher os
horários abertos que tem no formulário de inscrição"*. A tela **já chamava**
`GET /public/batismo/horarios` desde sempre — só usava o `grupo_url` e
**descartava a lista**.

- `inscricao-batismo.tsx` renderiza chips com o que o SERVIDOR mandou e envia
  `horario_culto` no payload. **O app não decide nada**: o endpoint já esconde
  fechado e lotado (régua `utils/batismoHorario.js` no ERP). É a lei "quem
  decide o que é válido é o BACKEND" — não replicar `aberto`/`limite` aqui.
- ⚠️ **Lista vazia = seletor não aparece**, e a inscrição segue valendo (o campo
  é opcional no servidor). Falha de rede não pode virar tela travada num
  formulário que a pessoa já preencheu.
- ⚠️ **Seleção que sumiu da lista é limpa** no refetch: horário que fechou ou
  lotou entre abrir a tela e enviar levaria **409** do servidor.
- ⚠️ Do lado do ERP (mesma leva): o fan-out **não copiava** `horario_culto` pro
  `batismo_inscricoes` — sem a migration `20260813120000` o horário era validado
  e **descartado em silêncio**. Bundle antigo, que não manda o campo, continua
  gravando NULL exatamente como hoje.
