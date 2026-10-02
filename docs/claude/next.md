# next · conhecimento operacional do app

Movido **na íntegra** do `CLAUDE.md` em 2026-10-01 (o arquivo tinha 268 KB e era carregado em toda chamada). Referência VIVA: leia o índice e a seção do assunto antes de mexer. Seção nova entra no FIM deste arquivo, datada, com uma linha a mais no índice.

**Escopo:** Next: gestão pelo app (turmas, presença, abrir direto na gestão).

## Índice de seções

- ⚠️⚠️ NEXT · quem gerencia ABRE DIRETO na gestão (03/09/2026 · 2ª rodada)
- ⚠️⚠️ GESTÃO DO NEXT NO APP · a tela existia e ninguém alcançava (03/09/2026)

---

## ⚠️⚠️ NEXT · quem gerencia ABRE DIRETO na gestão (03/09/2026 · 2ª rodada)

Pedido do Marcos, horas depois da 1ª leva: *"agora dentro do next tem várias
turmas, gostaria que para quem tem permissões, abrisse direto na página de
gerenciamento, e pode fazer essa nova página, muito semelhante com a que temos
de batismo em estilo."*

### ⚠️⚠️ ISTO SUBSTITUI `/next-turma` e `/next-espera`, feitas HORAS ANTES

As duas viraram **redirect pra `/next`**. Motivo: com a página de gestão única,
elas seriam **duas portas pro mesmo lugar** — o erro que o módulo de Grupos
pagou (lá "grupos" no menu e "Grupos" na barra abriam telas diferentes, e a
saída foi juntar numa só). Aqui a junção veio antes de a divergência existir.

⚠️ **O redirect FICA, não apagar os arquivos**: o OTA aplica na 2ª abertura,
então há bundle intermediário com essas rotas na pilha, e `/next-turma` existia
antes de hoje (pode estar em link/push já entregue). Precedente da casa:
`inscricao-next.tsx`. As duas seguem no mapa de `lib/hierarquia.ts` — rota fora
do mapa cai na Home em vez de subir pro pai certo.

### O desenho é o do `/batismo`: a MESMA rota decide

```
if (gestao && !verComoMembro) → <NextGestaoScreen/>   (cabeçalho "NEXT · Gestão da equipe")
senão                          → a tela de membro (inscrever + check-in)
```

- ⚠️⚠️ **NÃO é redirect entre rotas.** Redirect volta a disputar com a seta de
  voltar e é o caminho mais curto pro laço — o incidente de 06/08 (o portão que
  trancou todo mundo fora) foi exatamente disso. Aqui é ramo de render, como o
  `/batismo` faz desde sempre.
- ⚠️ **Enquanto `gestao` é `null` a tela NÃO decide**: mostrar a de membro e
  trocar depois faria a página piscar pra quem gerencia. Falha na consulta cai
  na de membro — **nunca prende ninguém**.
- ⚠️⚠️ **A porta de volta pra visão de MEMBRO existe de propósito** (ícone de
  pessoa no cabeçalho, estado local `verComoMembro`): quem lidera o NEXT também
  pode ter inscrição e check-in próprios, e sem isso a página dele ficaria
  **inalcançável**. ⚠️ É estado local, **não rota nova** — rota aqui significaria
  a seta de voltar competindo com o toggle. O `/batismo` não tem essa saída, e é
  uma diferença consciente.

### `components/next/NextGestao.tsx` · o que a tela é

Estilo copiado do `components/batismo/BatismoGestao.tsx` (herói na cor da marca,
trilho horizontal, abas com contador, busca, cartões de pessoa, folhas):

| batismo | next |
|---|---|
| trilho de DATAS do batismo | trilho de **TURMAS** (a turma é um domingo desde 26/08) |
| abas Pessoas do dia · Aprovações | abas **Pessoas da turma · Aceitações** |
| stats previstos/presentes/aguardando | **inscritos / presentes / esperando** |
| "Adicionar" pessoa | **"Chegou agora"** (walk-in) |
| check-in + aprovar + editar + retirar | **presença + direcionar + colocar em turma** |

- ⚠️⚠️ **TROCAR DE TURMA LIMPA O DETALHE ANTES DE BUSCAR O NOVO.** Sem isso a
  lista da turma ANTERIOR fica sob o cabeçalho da nova — e não é cosmético:
  `encontroAtual` e `presMap` são derivados desse detalhe, então um toque em
  "Presença" nessa janela **marcaria presença no encontro da turma ERRADA**. É a
  versão em miniatura do bug de 12/07 no web (19 nomes lançados no culto errado).
  Tem ainda a rede de segurança na própria ação: só marca quem está na lista
  carregada.
- ⚠️ **A fila de Aceitações só é buscada quando a aba abre**: ela carrega PII
  (telefone) e não tem por que trafegar enquanto a pessoa marca presença.
- ⚠️ **Erro do detalhe NÃO derruba a tela** (o trilho e a fila continuam de pé) e
  **erro da fila não vira fila vazia** — "ninguém esperando" e "não carregou"
  levam a decisões opostas.
- ⚠️ **`refrescar` NÃO troca a turma selecionada** (`setTurmaId(atual => atual ??
  …)`): arrastar a pessoa pra outra turma no meio do trabalho dela seria pior que
  dado velho.
- ⚠️ **Turma sem encontro datado mostra o NOME**, nunca uma data calculada — e a
  tela DIZ que não dá pra marcar presença ali, em vez de deixar o botão mudo.
- ⚠️ **`escreve === false` esconde as ações e é DECLARADO** ("seu acesso é só de
  leitura"): a conta "Revisor App Store" tem leitura 3 / escrita 0.

### As réguas novas em `lib/nextGestao.ts`

- **`turmaSugerida(turmas, hoje)`** — a do domingo de HOJE → a próxima → a mais
  recente que passou. ⚠️⚠️ Compara **STRING `YYYY-MM-DD`**, nunca
  `new Date(data)`: aquela forma é meia-noite UTC e no Rio devolve o dia
  ANTERIOR, então a tela abriria na turma do domingo passado **no meio do
  domingo**. É a armadilha registrada 5× nos dois repos.
- **`dataDaTurma`** — o encontro mais ANTIGO com data (a turma é 1 domingo).
- **`contarPresentes`** — ⚠️ conta só `presente === true` (o histórico guarda
  quem foi DESMARCADO) e por **PESSOA**, não por linha: a mesma pessoa em 2
  encontros conta 1.

### Portão

`npx tsc --noEmit` limpo · **323 testes** · **85/85 mutantes** (3 novos: turma
por `Date` · presença ignorando o campo `presente` · contagem por linha).
i18n **247/247** e as soltas caíram **31 → 30**, com o teto descendo junto: o
`"NEXT"` do título virou **constante**, porque é MARCA e não texto de interface
— `t("NEXT")` pediria a "tradução" de um nome próprio.

⚠️ **O portão cobre a RÉGUA, não a TELA.** Nada disto foi executado em aparelho.

## ⚠️⚠️ GESTÃO DO NEXT NO APP · a tela existia e ninguém alcançava (03/09/2026)

Decisão do Marcos ao desenhar as 3 superfícies do Next (FUNCIONÁRIO na aba Next
da Integração, com tudo · **VOLUNTÁRIO no app** · INSCRITO no totem):
*"gate = permissão, não posse"* e *"1ª entrega = tudo de uma vez"*.

### ⚠️⚠️ O ACHADO: `next-turma.tsx` era INALCANÇÁVEL em produção

A tela de presença por encontro está escrita desde o cutover de 17/06. Os 3
endpoints `/app/next/*` gateavam por **POSSE**
(`next_turmas.responsavel_id = membro.id`) e as **44 turmas vivas têm o campo
NULO** (medido em 03/09) — a rotina que abre as turmas do mês
(`nextTurmasAuto.js`) não o preenche. Logo `GET /app/next/papel` respondia
`responsavel: false` pra TODO MUNDO, a seção "Turmas que você conduz" nunca
renderizava, e **não existia gestão do Next no mobile**. Sem erro, sem log.

⚠️ **Régua de leitura: "o endpoint existe" não é "o caminho funciona".** Este é
o 4º caso da mesma família neste app (o pré-check-in do Kids com 1 uso em toda a
história · o avatar que nunca chegava · o portão de update que só valia do
próximo binário) — **antes de construir tela, conferir se o caminho até a que já
existe está de pé.**

### O que entrou

| tela | o que ganhou |
|---|---|
| `/next` | seção **"Gestão do NEXT"** (era "Turmas que você conduz") + card **Aceitações** com a fila |
| `/next-turma` | **"Chegou agora"** (walk-in) + **"Direcionar"** por pessoa |
| `/next-espera` | **NOVA** · a fila de quem aceitou e ainda não tem turma, com "Colocar em uma turma" |

### ⚠️⚠️ Quem autoriza é o SERVIDOR · `escreve` viaja na resposta

`backend/utils/nextGestaoApp.js` decide entrar (módulo `next` >= 2 **∪** posse) e
**agir** (escrita >= 2 ∪ posse) — leitura alta **não escreve**, que é a régua do
`authorizeModule` do web. Medido em 03/09: **12 pessoas** alcançam a área e **11**
escrevem; a diferença é a conta **"Revisor App Store"** (leitura 3 · escrita 0).

⇒ `GET /next/gestao` devolve `escreve`, e a tela **esconde** walk-in e direcionar
quando ele é `false`, DECLARANDO "seu acesso é só de leitura". Sem isso os botões
apareceriam e o toque voltaria 403 — botão que falha é pior que botão ausente.
⚠️ Enquanto `escreve` é `null` (não sabemos ainda) a tela **não mostra** ação de
escrita: fail-closed, como o `useAdminGrupo`.

⚠️ **`getNextPapel` fica como PLANO B** pra backend antigo (deploy em 2 etapas):
sem ele, um bundle novo contra API velha esconderia a gestão de quem entra por
posse. O shape de `/next/papel` é **INTOCADO** de propósito — o binário publicado
lê aquelas duas chaves.

### A régua pura · `lib/nextGestao.ts`

- ⚠️⚠️ **`podeDirecionar`**: batismo sem horário **não passa**, porque
  `services/nextDirecionar.js` LANÇA 400. Sem a guarda o líder preenche o
  direcionamento inteiro no fim do encontro, toca em "Direcionar" e leva erro —
  com a fila esperando. E o **motivo é ESCRITO ao lado do botão**: botão cinza sem
  explicação lê-se como app quebrado (lição do calendário de 25/08).
- ⚠️ **Catálogo `indisponivel` NÃO é "não tem horário"** — é "não deu pra saber"
  (ou a equipe fechou tudo). O servidor declara; tratar como ausência faria a tela
  dizer que o batismo não existe.
- ⚠️ **Área do servir é OPCIONAL** (`areasSaoObrigatorias()` → false): o servidor
  aceita `voluntarios` sem área. Exigir na tela travaria o direcionamento por um
  campo que ele não pede — o desalinhamento que fez o batismo pedir data que a
  ficha já tinha.
- ⚠️⚠️ **`encontroSugerido` compara STRING `YYYY-MM-DD`, nunca `new Date(data)`**:
  aquela forma é meia-noite UTC e no Rio vira 21h do dia ANTERIOR — o encontro de
  hoje seria o de ontem, e o walk-in do domingo cairia no encontro errado. É a
  armadilha registrada 5× nos dois repos. O "hoje" vem de `hojeBRT()`.
- ⚠️ **`turmasQueRecebem` só devolve `aberta`**: oferecer turma encerrada no
  seletor manda o líder pro 403. Turma encerrada **segue acessível pra corrigir
  presença** — o que ela não faz é receber gente nova.

Portão: 20 casos em `test/reguas.test.ts` · **4 mutantes** em
`scripts/mutantes.mjs` (batismo sem horário passando · encontro comparado por
`Date` · turma encerrada oferecida · `indisponivel` deixando de bloquear).

### Detalhes que não são enfeite

- **Walk-in: só o NOME é obrigatório** (a política do totem — *"nunca travar o
  atendimento na hora"*). CPF e celular são opcionais **e validados se vierem**;
  quem valida é o servidor. A máscara **TRUNCA** no limite — é o que impede o
  campo aceitar 20 dígitos e o servidor recusar sem a pessoa saber por quê.
- ⚠️⚠️ **A confirmação DIZ quando o matcher LIGOU** numa pessoa que já existia
  (`pessoa_nova === false`). Sem isso o líder acha que não funcionou e tenta de
  novo com outro nome — o comportamento que fabrica duplicata na base.
- ⚠️ **Alocar sai da fila NA HORA** (otimista) e **`ja_tem_turma`/`corrida` não é
  erro**: é fato que mudou por fora (alguém alocou no sistema). A tela diz "já
  estava resolvido" e tira da fila, em vez de mostrar vermelho.
- ⚠️ **Aceitações vem ANTES das turmas** na seção: é a fila que espera decisão de
  gente. Turma sem ninguém alocado é o gargalo do fluxo.
- ⚠️ **Contagem de inscritos só aparece quando o servidor a manda**: `0` é
  resposta ("ninguém matriculado"), `undefined` é "backend antigo não manda" — e
  escrever "0" nesse caso afirmaria turma vazia sem ter medido.
- ⚠️ `/next-espera` carrega **telefone** (PII) e vive atrás do gate do servidor.
  403 é DECLARADO; a tela nunca mostra lista vazia, que se leria como "a fila está
  limpa".
- ⚠️ `Promise.allSettled` na fila: falhar a lista de turmas **não esconde quem
  está esperando** — sem turma a tela ainda mostra a fila e diz que não dá pra
  alocar agora.
- ⚠️ As duas folhas usam **`TecladoSeguro`** e o **piso** `fundoSeguro` (dentro de
  um `<Modal>` do Android o inset pode vir 0 e o botão encosta na barra de
  navegação). O calendário **não entra aqui** — quem escolhe horário são chips.

### ⚠️⚠️ O portão de i18n contava como dívida chave que JÁ EXISTIA

Achado ao pagar as 56 chaves novas: `noDicionario` (em
`scripts/i18n-cobertura.mjs`) procurava só a chave **ENTRE ASPAS** (`"CPF":`), e
o dicionário tem entradas escritas **sem aspas** (`CPF:`, `Sexo:`, `Registrar:`,
`em:` — JS aceita quando a chave é identificador válido).

⚠️⚠️ **O efeito prático era pior que o número errado: quem tentasse "pagar"
acrescentando a versão entre aspas levava `TS1117` (chave repetida) e ficava sem
saída** — foi exatamente o que aconteceu comigo com `CPF` e `Registrar`.

⇒ `noDicionario` passou a ver as duas formas (e virou `export`, pra ter teste). A
dívida caiu de **257 pra 247** e o teto desceu junto. ⚠️ **A queda NÃO é texto
traduzido** — é o scanner passando a ver o que já estava lá; está escrito no
comentário do teto pra ninguém ler como progresso.

⚠️⚠️ **E a âncora `INICIO_DE_PROPRIEDADE` não é enfeite — foi MEDIDA.** Varrendo o
dicionário real: sem ela, **`HH` casa dentro de `"Horário (HH:MM)"`** e **`e`
dentro de `"an estimate:"`**, ou seja as duas sairiam da contagem **em silêncio**
sem ter entrada nenhuma. Guarda que esconde o problema é pior que guarda nenhuma.
⚠️ Ela vive numa **constante** de propósito: âncora de mutante em
`scripts/mutantes.mjs` **não pode conter escape** (`\s`) — o JS interpreta e a
string para de casar o arquivo (o `ÂNCORA PERDIDA` que este repo já registrou em
26/08). Com a constante, o mutante ancora em `${INICIO_DE_PROPRIEDADE}${escapado}`,
que não tem barra nenhuma.

⚠️⚠️ **De carona, um 3º furo: o dicionário era lido COM COMENTÁRIO.** O scanner
casa TEXTO, então um comentário que MENCIONE `CPF:` marcava a chave como
traduzida **sem existir entrada**. Medido: 2 dos "acertos" vinham do meu próprio
comentário. É a armadilha do `//` que este scanner já tratava do outro lado (a
varredura das telas) reaparecendo **na fonte da verdade** — agora o dicionário
passa por `semComentarios`. **3 mutantes** cobrem os três lados.

### Estado

Backend **mergeado (#2862)** — os endpoints já estão em produção. Esta metade é
**tela**, então precisa de **OTA** (`npm run ota -- "msg"`, nunca `eas update`
cru).
⚠️⚠️ **A catraca do `npm run ota` BLOQUEIA hoje**: as lojas servem iOS build 33
(22/06) e Android vc 5 (24/07). Publicar exige as lojas atualizadas **e o
`loja-publicado.json` atualizado**, ou o escape declarado
`CBRIO_OTA_EMBUTIDO_VELHO=1`.
