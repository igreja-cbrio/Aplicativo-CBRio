# ui · navegacao · conhecimento operacional do app

Movido **na íntegra** do `CLAUDE.md` em 2026-10-01 (o arquivo tinha 268 KB e era carregado em toda chamada). Referência VIVA: leia o índice e a seção do assunto antes de mexer. Seção nova entra no FIM deste arquivo, datada, com uma linha a mais no índice.

**Escopo:** Interface: diálogo da casa, navegação, teclado/KeyboardAvoidingView, relatos do Android, portão de i18n.

## Índice de seções

- ⚠️⚠️ TRÊS RELATOS DO ANDROID DO MARCOS · diálogo, fundo da folha, teclado (23/09/2026)
- ⚠️ NAVEGAÇÃO · o peso não era o destino (11/08/2026 · PR #111)
- ⚠️⚠️ DIÁLOGO DA CASA · o fim do "modal quadrado" (11/08/2026)
- ⚠️ O portão de i18n parou de contar COMENTÁRIO (11/08/2026)
- ⚠️⚠️ LEI · `behavior` do KeyboardAvoidingView NUNCA é `undefined` (2026-08-07)
- ⚠️⚠️ O portão de i18n estava VERMELHO na `main` — e travava o OTA (26/08/2026)

---

## ⚠️⚠️ TRÊS RELATOS DO ANDROID DO MARCOS · diálogo, fundo da folha, teclado (23/09/2026)

Vieram juntos, logo depois do OTA que devolveu o Recusar: ele recusou a
"MARIA JOANA TESTE" pela tela de gerenciar (funcionou: `devolvido`, evento
`recusado_lider` com `origem: app`) e relatou três coisas.

### 1 · "Aprovar abria uma janela quadrada e feia; o Recusar ficava bonito"

O Aprovar era `Alert.alert` com botões (a caixa cinza do Android); o Recusar era
folha da casa. Medido: **22 confirmações nativas em 15 arquivos**. Regra de
migração — só a **confirmação de NÍVEL DE TELA** (nenhum `<Modal>` aberto no
momento) vira `useDialogo`, porque o diálogo da casa é um Modal irmão e **no
iPhone nasce ATRÁS de uma folha já aberta** (`grupo-visita.tsx` documenta).

Migradas (10 telas): Aceitar em `grupo-inscricoes` e `grupo-membros` ·
Remover da escala (`escala-supervisor`) · Remover a capa (`grupo-editar`) ·
Desfazer check-in (`checkin-voluntarios`) · Desativar notificações + Solicitação
registrada (`configuracoes`) · Remover foto (`kids-filho`) · Solicitação enviada
(`kids-solicitar-vinculo`) · Confirmar inscrição + Ative a localização (`next`)
· Confirme seu e-mail (`(auth)/cadastro`). Onde o alerta navegava/deslogava no
OK, o código agora **espera o `await`** e só então navega — a tela continua
montada até a pessoa ler.

⚠️⚠️ **As que FICAM nativas estão em `lib/dialogosNativos.ts` →
`CONFIRMACOES_NATIVAS_QUE_FICAM`, por TÍTULO e com o porquê** (folha aberta por
baixo · três opções · SOS). `test/dialogoDaCasa.test.ts` exige que **toda**
`Alert.alert` com botões do app esteja lá — confirmação nova sem porquê listado
derruba o portão. Os **avisos** de um botão só (`Erro`, `Não deu`…) continuam
nativos por enquanto: a maioria dispara com folha aberta, e é a mesma decisão de
11/08.

### 2 · "O botão ficou muito abaixo, eu poderia ter clicado em fechar sem querer"

Segundo relato **no mesmo botão** (o primeiro foi 25/08, item 4). O "fechar" é o
BACK da barra de 3 botões do Android, logo abaixo do botão de confirmar. Eram
**cinco fórmulas diferentes** de `paddingBottom` nas folhas do app — e a tela que
ele testava por último era sempre a que não tinha recebido o ajuste da anterior.

⚠️⚠️ **Régua ÚNICA: `fundoDaFolha(insets.bottom)` em `lib/folha.ts`** —
`max(inset, 48) + 40` (barra de 3 botões + respiro), nunca menos que 88 dp.
Monotônica de propósito: dentro de um `<Modal>` do Android o inset do provider
pode chegar 0. Aplicada em `grupo-membros` (5 folhas), `NextGestao`,
`grupo-inscricoes`, `escala-supervisor` (2). O teste proíbe `styles.sheet` com
`insets.bottom` cru. ⏳ **Se ele ainda achar baixo depois deste OTA, a causa é
inset 0 dentro do Modal — o próximo passo é medir o inset NA JANELA da folha
(`SafeAreaView edges={["bottom"]}` dentro do Modal), não aumentar o número.**

### 3 · "No form de entrada, quando a pessoa está dizendo quem é, o teclado sobe e fica difícil de ver"

`TecladoSeguro` garante que o teclado **não cobre**; nada garantia que o campo
focado ficasse **visível** — com o herói (ícone + título + explicação) no topo,
o campo ficava espremido na faixa que sobrava. `automaticallyAdjustKeyboardInsets`
é iOS-only e também não rola até o campo.

⚠️⚠️ **`components/ui/FormularioRolavel.tsx`** substitui a `ScrollView` nas
**três portas** (`(auth)/login`, `(auth)/cadastro`, `completar-cadastro`). O
`<Input>` e o `<PhoneInput>` avisam por contexto ao ganhar foco; o formulário
mede o campo contra um View próprio (`measureLayout`, sem API interna da
ScrollView) e rola pra deixá-lo no topo com o rótulo visível
(`lib/rolarAteCampo.ts`). Fora de um `FormularioRolavel` o gancho é `null` e o
`Input` se comporta como antes. Medição que falha é silenciosa (pior caso =
comportamento antigo). ⚠️ `contentContainerStyle` vai pro View INTERNO (é ele
que segura `padding`/`gap`); a ScrollView recebe só `flexGrow: 1`.
⏳ **Não foi visto em aparelho** — o Marcos testa no Android depois do OTA.

Mutantes novos (3): tirar o piso da folha · tirar o gancho de foco do Input ·
devolver o Aprovar pro `Alert.alert`. `expo lint` não roda neste repo (eslint
não está instalado) — o portão é `tsc` + `vitest` + mutantes, como sempre.

## ⚠️ NAVEGAÇÃO · o peso não era o destino (11/08/2026 · PR #111)

Relato do Marcos: *"melhore mais a navegação, tô achando meio travada; melhore
a navegação de quando aperta para voltar"*. O DESTINO já estava certo (a seta é
`cd ..` desde 05/08) — o peso vinha de duas outras coisas.

**1 · Trocar de aba deslizava como se fosse ENTRAR num nível.** As 5 telas da
barra são IRMÃS, e o Stack aplicava `ios_from_right` por 280 ms a cada toque na
barra — inclusive na volta pra Home, que é justamente a seta. Agora as **6 telas
de barra (as 5 + Home) têm `animation: "none"`** (`Stack.Screen` em
`(app)/_layout.tsx`); o resto do Stack segue em `ios_from_right`, 260 ms.
⚠️ Tela de PROFUNDIDADE (perfil, cartões, kids, evento…) **não** entra nessa
lista: ali o deslizamento é a informação de que se desceu um nível.
⚠️ A Home entra porque a seta VOLTA pra ela dessas telas — se ela animasse, a
ida seria instantânea e a volta não, o que se lê como lentidão de novo.

**2 · O toque não respondia NADA até a próxima tela desenhar.** Os `Pressable`
da barra e da faixa não tinham estado de toque nem retorno tátil: ~300 ms de
silêncio que se lê como "não registrou" — e leva a pessoa a tocar duas vezes,
subindo dois níveis. Agora: opacidade no toque, `android_ripple` e
`Haptics.selectionAsync()`.
⚠️ **O tátil do VOLTAR mora dentro de `subirUmNivel` (`lib/hierarquia.ts`)**, não
na TopBar: é o ÚNICO ponto por onde passam a seta da faixa, as ~35 telas com
seta própria E o botão físico do Android. Repetir na tela vibra duas vezes.
⚠️ `require("expo-haptics")` **lazy, dentro de try/catch**: é módulo nativo e o
arquivo roda no portão (vitest, em Node) — import no topo derrubaria o CI, e
aparelho sem motor de vibração não pode derrubar a navegação.

**⚠️⚠️ O que foi CONSIDERADO e recusado: `replace` na barra.** Trocar o
`navigate` por `replace` "pra não empilhar" **seria regressão**: `navigate`
reaproveita a instância VIVA da aba (Grupos → Servir → Grupos volta com a
rolagem e os dados no lugar), enquanto `replace` destruiria a tela a cada toque
e toda volta pagaria montagem nova + a busca do `useFocusEffect` + o spinner.
E a pilha **não cresce sem limite**: as 5 são irmãs, então o pior caso é
Home + as 5 abas, e revisitar uma delas ENCOLHE a pilha. Régua e o porquê em
`lib/nav.ts` (`acaoDaBarra`/`irParaBarra`), congelados num **mutante**.

⚠️ **O portão cobre a RÉGUA, não a sensação.** 177 testes · 55/55 mutantes ·
typecheck limpo. Fluidez se mede em aparelho: tocar as 5 abas em sequência,
voltar de tela funda, e o back físico no Android.

⚠️ **`.expo/types/router.d.ts` desatualizado derruba o `npm run ota`** (foi o
que aconteceu aqui): ele é GERADO e gitignored, então o CI passa verde e a
máquina local reprova, acusando rota nova como "não atribuível a `Href`". Não é
caso de `CBRIO_OTA_SEM_PORTAO=1` — o conserto é regenerar (subir o
`npx expo start` por ~40 s e matar).

## ⚠️⚠️ DIÁLOGO DA CASA · o fim do "modal quadrado" (11/08/2026)

Reclamação do Marcos, **duas vezes**: *"o modal não está na cara do sistema, está
quadrado"*. Medido: **90 `Alert.alert` em 27 arquivos, 90 de 90 nativos** — não
existia **nenhum** componente de diálogo neste repo.

`components/ui/Dialogo.tsx` (hook `useDialogo`) é a resposta.

### ⚠️⚠️ A premissa que eu carregava CAIU (e é o que decide o desenho)

Eu registrava que *"`Alert.alert` é hoje o único que renderiza ACIMA de um
`<Modal>` aberto"*. **Falso, e o contraexemplo já está no ar neste repo**:
`components/voluntariado/Disponibilidade.tsx` e `app/(app)/grupo-visita.tsx`
montam **dois `<Modal>` irmãos simultâneos** desde 07/08 (o teste em Android
daquele dia gravou linha em `vol_availability`).

O que é verdade é a metade estreita: `<Modal>` é container **nativo**,
apresentado a partir do primeiro view controller da cadeia, então um diálogo
montado por **provider na raiz** fica **ATRÁS** de qualquer modal aberto.

⇒ Por isso o diálogo é renderizado **PELA TELA**, como **irmão** — o padrão que
este repo já exercita 21 vezes. **Aninhamento tem zero precedente aqui; não é
hora de estrear.**

### O que migrou, e o que NÃO migra

Migradas 4 telas de **nível de tela** (nenhuma tem `<Modal>`): `grupo-detalhe`
(pedir entrada — o apontamento 8), `apresentacao-crianca` e `falar-com-a-igreja`
(descartar rascunho), `inscricao-batismo` (confirmar).

⚠️⚠️ **Três ficam nativos de propósito**, listados com o porquê em
`lib/dialogosNativos.ts` e **guardados por teste**:
- **SOS** (`cuidados.tsx`) — é a única tela que pode salvar alguém em minuto
  zero (CVV 188 / SAMU 192 antes de qualquer formulário), e um dos alertas dela é
  o **caminho de falha de rede**: diálogo que depende do render da tela é
  estruturalmente pior justo quando algo já falhou.
- **`trocar-senha` e `redefinir-senha`** — a navegação roda na LINHA SEGUINTE ao
  alerta. Isso só funciona porque o `Alert` nativo tem janela própria e sobrevive
  à tela sair por baixo; um diálogo da tela desmontaria junto e a pessoa trocaria
  a senha sem ver confirmação nenhuma.

⚠️ **Os 16 que disparam com um `<Modal>` já aberto NÃO foram migrados** — ali a
sobreposição depende de comportamento que **só um aparelho responde** (o padrão
irmão está provado em Android, não em iOS). Ficam pra depois do teste no celular.

### Duas armadilhas que a revisão adversarial pegou

- ⚠️⚠️ **`<dlg.Dialogo />` NÃO pode ir nos `children` do `FormScaffold`**: eles
  só são renderizados no ramo do formulário — com `enviado` ou `bloqueadoTexto` a
  tela mostra outra coisa e o diálogo **não existe**, então `confirmar()`
  devolveria promise que **nunca resolve** e o fluxo travaria sem erro nenhum.
  O scaffold ganhou a prop **`overlay`**, renderizada sempre e FORA do ScrollView.
- ⚠️⚠️ **`accessible={false}` no fundo é obrigatório.** `Pressable` marca
  `accessible` por padrão; no iOS isso vira `isAccessibilityElement` e o UIKit
  **para de descer nos filhos** — com VoiceOver a única coisa alcançável seria o
  fundo, cuja ação é CANCELAR. A pessoa cega não conseguiria confirmar nada, num
  componente que substitui o `UIAlertController`, que é 100% acessível.

## ⚠️ O portão de i18n parou de contar COMENTÁRIO (11/08/2026)

`scripts/i18n-cobertura.mjs` contava `t("...")` dentro de comentário: o exemplo
de uso no JSDoc do `Dialogo.tsx` fazia `npm run ota` **recusar publicar por causa
da documentação do próprio componente**. A saída certa nunca é traduzir o
exemplo — é o scanner ler só o código.

⚠️⚠️ **E a primeira tentativa de conserto era pior que o problema.** O regex
`(^|[^:])\/\/[^
]*` apagava **o resto de qualquer linha em que uma STRING
contivesse `//`** — caso vivo em `completar-cadastro.tsx:218`
(`!retorno.startsWith("//")`). Testado: um `t("REAL")` na mesma linha **sumia da
varredura**, ou seja o modo de falha era **remover dívida da contagem em
silêncio**. Guarda que esconde o problema é pior que guarda nenhuma.

⇒ **`scripts/semComentarios.mjs`** é um autômato de 1 caractere que respeita
string (aspas, apóstrofo, crase e escape), **preserva comprimento e quebras de
linha** (pra linha/coluna de relatório continuarem batendo) e é **régua ÚNICA**:
o scanner e `test/reguas.test.ts` importam dela. Havia duas implementações
divergentes, ambas por regex e **nenhuma testada** — agora tem 6 casos no portão.

Efeito colateral bom: sem contar comentário, as **strings soltas caíram de 32
para 31** e o teto desceu junto (neste repo o teto só desce).

## ⚠️⚠️ LEI · `behavior` do KeyboardAvoidingView NUNCA é `undefined` (2026-08-07)

Relato do Marcos: *"na aba de comentário opcional da visita, ao clicar, o teclado
está tapando a visualização — verifica TODOS os campos de preenchimento do app"*.
A varredura (4 agentes, 31 arquivos com campo) achou **um defeito só, copiado em
20 lugares**:

```tsx
behavior={Platform.OS === "ios" ? "padding" : undefined}   // ❌
```

⚠️⚠️ **No Android isso não é "um comportamento mais fraco" — é NADA.** Sem
`behavior`, o `KeyboardAvoidingView` renderiza um `<View style={{flex:1}}>` puro
(`KeyboardAvoidingView.js`, o `default` do switch não aplica padding nem height).
Toda a proteção do Android dependia do **resize automático da janela**, que:

- **não alcança a janela de um `<Modal>`** (é um `Dialog` próprio) — pior ainda
  com `statusBarTranslucent`, que liga `FLAG_LAYOUT_NO_LIMITS` e desliga o resize;
- e não se pode contar com ele nas telas normais.

⇒ **A regra: `behavior="padding"` nas DUAS plataformas.** É seguro e
**auto-corretivo**: o RN calcula `frame.y + frame.height - keyboardScreenY`, então
quando a janela JÁ encolheu sozinha o resultado dá ~0 e nada é somado duas vezes.
Dentro de um Modal o KAV é a raiz da janela (`frame.y = 0`), então a conta bate
exata.

### Os 7 modais que cobriam o campo 100% das vezes no Android

Todos com a mesma combinação (`statusBarTranslucent` + `behavior: undefined`), e
todos de LÍDER/SUPERVISOR — o público que está sendo ativado agora, e o campo
coberto era sempre o **comentário/motivo**, o texto que a coordenação lê depois:

`grupo-visita` (registrar encontro · o relatado) · `grupo-membros` (frequência,
registrar saída, preciso de ajuda) · `grupo-inscricoes` (recusar) ·
`escala-supervisor` (adicionar voluntário — com `autoFocus`, o teclado abre JUNTO
com a sheet) · `Disponibilidade` (bloquear datas).

⚠️ **Ironia registrada**: o formulário de indisponibilidade virou modal em 07/08
*exatamente* porque "o teclado sobe e cobre" — e o remédio que apliquei (KAV do
modal) só valia no iOS.

### O que mais entrou na varredura

- **`automaticallyAdjustKeyboardInsets` + `keyboardShouldPersistTaps="handled"`
  em todos os `ScrollView` de tela com campo** (42 props em 25 arquivos). O
  primeiro é iOS-only (no-op no Android) e faz o que o `padding` NÃO faz: **rola
  até o campo focado**. O segundo evita que o 1º toque no botão de enviar seja
  comido pelo fechamento do teclado. ⚠️ Já havia precedente no repo
  (`generosidade.tsx`) — não é padrão novo, é o padrão espalhado.
- **`completar-cadastro.tsx` e `evento.tsx` não tinham KAV NENHUM** — quebravam
  no iPhone também. O primeiro é a porta **obrigatória** que todo mundo atravessa.
- ⚠️⚠️ **`components/ui/Input.tsx` fixava `height: 52` + `alignItems: "center"`,
  então TODO campo `multiline` do app era uma linha só, com o texto centralizado
  na caixa** — comentário da visita, motivo da saída, pedido de oração, "mande uma
  mensagem", observação do batismo, textarea do form-builder de eventos. É a mesma
  queixa ("não dá pra ver o que estou digitando") por uma causa que **não é o
  teclado**. Agora `minHeight: 96` + `textAlignVertical: "top"`.
- **A `BottomBar` some enquanto o teclado está aberto (só no Android).** Ela é
  IRMÃ do Stack, então com o teclado aberto continuava colada acima dele comendo
  `58 + insets.bottom` da altura que já encolheu — ~80 dp em ~20 telas, roubados
  justamente quando o espaço é mais escasso. ⚠️ **Só no Android**: no iOS a barra
  fica ABAIXO do teclado, então escondê-la não devolveria espaço e ainda faria a
  barra piscar a cada foco.

### ⚠️ Armadilha de FERRAMENTA (erro meu, registrado)

Tentei inserir as props com regex `<ScrollView([^>]*?)>` e **quebrei dois
arquivos**: `[^>]*?` casa o `>` do `<RefreshControl … />` **aninhado dentro do
próprio prop `refreshControl={}`** e corta a tag no lugar errado. Refeito com um
scanner que conta `{}` e respeita aspas (`scratchpad/props_teclado.py`).
**Régua: tag JSX com prop que contém outro elemento não se casa com regex.**

### ✅ O PADRÃO · `components/ui/TecladoSeguro.tsx` (substitui o KAV em TODO o app)

Marcos, ao ler que eu ia "medir tela a tela": *"você tá dizendo pra medir o
celular das pessoas que usam? Faz de uma forma para ficar padrão."*

Ele estava certo e a minha proposta anterior era ruim. O remendo oficial do
`KeyboardAvoidingView` é o `keyboardVerticalOffset`, que exige **um número por
tela**, calibrado num aparelho — e aparelho diferente, fonte aumentada ou
dobrável já saem do calibre. Número decorado envelhece.

**A diferença está em O QUE se mede.** O KAV usa o `onLayout`, que dá
coordenadas **relativas ao pai**: em toda tela que não começa no topo da janela
(ou seja, todas as que ficam sob a faixa superior) ele **sub-compensa exatamente
o deslocamento do topo** — é por isso que o campo "quase" aparecia no iOS.
`TecladoSeguro` mede a posição **ABSOLUTA** do container (`measureInWindow`) e
compara com a posição real do topo do teclado (`endCoordinates.screenY`).

⇒ **Zero constante de aparelho, de faixa ou de notch.** Funciona igual em tela
cheia, dentro de `<Modal>`, com fonte aumentada e em aparelho que ninguém testou.

- ⚠️ **Auto-corretivo nos dois mundos do Android**: janela que encolhe sozinha ⇒
  o container já termina acima do teclado ⇒ folga 0 (não soma duas vezes);
  janela que não encolhe (Modal, edge-to-edge) ⇒ a folga é exatamente o coberto.
- ⚠️ **Não oscila**: o `paddingBottom` reduz a área INTERNA, não a altura do
  container — a borda medida continua a mesma e a conta estabiliza na 1ª passada.
- ⚠️ `max(0, …)` é obrigatório: padding NEGATIVO no RN **puxa o conteúdo pra fora
  da tela** — seria trocar "campo coberto" por "campo cortado". Mutation-testado.
- iOS escuta `keyboardWillShow` (acompanha a animação); Android, `keyboardDidShow`.
- Régua pura em `lib/teclado.ts` (`folgaDoTeclado`), no portão, com mutante.
- **21 arquivos** passaram a usar; `KeyboardAvoidingView` não é mais usado em
  lugar nenhum do app.

### ⚠️ EDGE-TO-EDGE está LIGADO neste projeto (medido em 07/08)

`app.json` **não declara** `android.edgeToEdgeEnabled`, e no SDK 54 o default é
ligado — `@expo/prebuild-config/.../withEdgeToEdge.js:56` faz
`const edgeToEdgeEnabled = raw_edgeToEdgeEnabled !== false`. Ou seja: o app
desenha de ponta a ponta da tela (por baixo da barra de status e da de navegação)
e **o Android deixa de redimensionar a janela quando o teclado abre** — o teclado
vira um *inset* que o app precisa tratar.

⚠️ É a explicação mais provável de o resize não estar salvando nem as telas
NÃO-modais. **Não é para desligar**: no Android 16 (targetSdk 36) deixa de ser
opcional — o próprio plugin avisa isso ao ver `edgeToEdgeEnabled: false`.
⇒ Por isso o padrão certo é o que MEDE (acima), e não o que espera a janela
encolher. Com `TecladoSeguro` a conta fica correta **nos dois cenários**, então
esta questão deixou de ser um risco em aberto.

### ⏳ O que a varredura deixou EM ABERTO

✅ **Os dois itens que estavam aqui foram RESOLVIDOS no mesmo dia** — o
`keyboardVerticalOffset` por tela deixou de ser necessário (o `TecladoSeguro`
mede) e o edge-to-edge deixou de ser incógnita (medido: está ligado, e o padrão
novo funciona nos dois cenários). Ver as duas seções acima.

O que segue valendo: **nada disto roda no portão** — ele cobre régua pura, e
teclado é 100% tela. O critério de aceite é aparelho, campo por campo.

## ⚠️⚠️ O portão de i18n estava VERMELHO na `main` — e travava o OTA (26/08/2026)

Descoberto ao mexer no atalho de "Apresentação de crianças": `npm run verificar`
falhava com **32 strings soltas (teto 31)** — e falhava **antes** da minha
mudança (conferido com `git stash`). Como `npm run ota` roda o portão antes de
publicar, **ninguém conseguia publicar OTA** nesse estado.

**A solta era `"dd/mm/aaaa"`** em `app/(app)/completar-cadastro.tsx` (arquivo
tocado pelo PR #137). É **máscara de data, não texto** — traduzir quebraria a
máscara. O `ehFormato` do scanner isentava só a versão em MAIÚSCULA
(`[DMAYHhSs0-9]`), e a tela usa minúscula.

⇒ Conserto na RAIZ (`scripts/i18n-cobertura.mjs`), **sem subir o teto** — a lei
deste repo é que o teto só desce. Voltou pra 31/31.

⚠️ **A variante minúscula NÃO aceita espaço como separador**, de propósito. A
maiúscula aceita; se a nova aceitasse, prosa curta feita só de `a d m h s` +
espaço (ex.: `"ah ah"`) sairia da contagem **em silêncio** — e guarda que esconde
o problema é pior que guarda nenhuma. Tem caso de teste pras duas pontas.

⚠️ **Caixa MISTA (`"HH:mm"`) segue não isenta**, e é decisão medida: essa máscara
**não existe no app** hoje (grep). Alargar a classe sem necessidade real deixaria
`"as.mas"` passar. Se um dia precisar, medir primeiro.

`ehFormato` virou `export` para entrar no portão (`test/reguas.test.ts`) — antes
não tinha teste nenhum, o que é justamente como o furo apareceu.
