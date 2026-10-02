# publicacao · ota · auditorias · conhecimento operacional do app

Movido **na íntegra** do `CLAUDE.md` em 2026-10-01 (o arquivo tinha 268 KB e era carregado em toda chamada). Referência VIVA: leia o índice e a seção do assunto antes de mexer. Seção nova entra no FIM deste arquivo, datada, com uma linha a mais no índice.

**Escopo:** Loja e OTA: porta de entrada da loja, versão antiga na 1ª abertura, `version` 1.0.0, auditorias do app (ondas 0, 2, 2b, 3).

## Índice de seções

- ⚠️⚠️ A PORTA DE ENTRADA DA LOJA ESTAVA VELHA · medido (03/09/2026)
- ⚠️⚠️ INSTALOU E VEIO A VERSÃO ANTIGA · o portão na primeira abertura (29/08/2026)
- ⚠️⚠️ AUDITORIA DO APP · ONDA 2 · A PUBLICAÇÃO (2026-08-07)
- ⚠️⚠️ ONDA 3 · versão mínima, e o que a medição derrubou (2026-08-07)
- ⚠️⚠️ ONDA 2b · os 4 defeitos que o TESTE EM APARELHO achou (2026-08-07)
- ⚠️⚠️ FECHO DAS ONDAS 2 e 3 · três achados que derrubaram premissas (2026-08-07)
- ⚠️⚠️ AUDITORIA DO APP · ONDA 0 (2026-08-06) · o que mudou NESTE repo

---

## ⚠️⚠️ A PORTA DE ENTRADA DA LOJA ESTAVA VELHA · medido (03/09/2026)

Pergunta do Marcos: *"toda vez que alguém baixa o app da playstore ou appstore,
ela entra na primeira versão do app, sem validação de cpf, sem várias abas que
criamos depois"*. Não era o OTA quebrado. **A loja não serve "o último OTA": ela
serve um BINÁRIO, e cada binário carrega o bundle de JS congelado no dia em que
foi compilado.** Os dois binários publicados estavam velhos:

| | Binário no ar | Compilado | Commits de atraso |
|---|---|---|---|
| **iOS** | build **33** | 22/06/2026 | **192** |
| **Android** | versionCode **5** | 24/07/2026 | 159 |

Medições (não suposições): `eas submit:status -p ios` → `App Store Live: 1.0 (33)
— uploaded 2 months ago`, nada em review nem pending. Android inferido da
telemetria (`app_eventos`): das 98 instalações novas em 30 dias, **35 caíram na
vc 5** e 49 no build 33 iOS; as vc 6 (18/08) e vc 7 (29/08) somam **7**.

### As causas, e o que foi feito

1. **`eas.json` mandava o Android pro track errado** — `submit.production.android.
   track: "internal"`. Os builds vc 6 e vc 7 existem e estão saudáveis (canal
   `production`, runtime 1.0.0), mas foram pro teste interno; a Play pública
   continuou servindo a vc 5 de julho. ⇒ **trocado pra `"production"`.**
   ⚠️⚠️ **A conta de serviço `eas-submit@crm-cbrio` tem só "Release apps to
   testing tracks" no Play Console.** Com `track: production` o submit pode
   falhar por permissão até o Matheus conceder "Release to production". Se
   falhar, o caminho manual é promover internal → produção no Play Console.
2. **`updates.fallbackToCacheTimeout` nunca existiu no `app.json`** ⇒ default
   `0` = *"não espere nada"*. A primeira abertura depois de instalar roda o JS
   embutido no binário, e o OTA só entra da segunda em diante. ⇒ **posto em
   `10000`** (o teto útil; o máximo aceito é 300000).
3. **Rebuild + submit dos dois** — é a única coisa que faz o embutido deixar de
   ser de junho/julho.

### ⚠️⚠️ ISTO É O QUE ATIVA O CONSERTO DE 29/08

A régua de `lib/portaoUpdate.ts` (`decidirAplicacao` + `isEmbeddedLaunch`, seção
"INSTALOU E VEIO A VERSÃO ANTIGA") **já resolvia a primeira abertura em JS desde
29/08 — e está morta em campo há 5 dias**, porque ela roda a partir do bundle
embutido e nenhum binário publicado a contém. O build novo é o que liga.

**As duas camadas são complementares, não redundantes:**
- `fallbackToCacheTimeout` é **nativo**: a primeira abertura nem chega a rodar o
  JS velho — espera até 10s e sobe já no bundle novo. Funciona mesmo quando o JS
  embutido é antigo, porque é config compilada no binário.
- `decidirAplicacao` é o **fallback de rede ruim**: se os 10s estouram, o app
  sobe no embutido e a régua aplica assim que o download cair, em vez de cobrar
  o ciclo de duas aberturas.

⚠️ Custo aceito: numa abertura logo depois de um OTA publicado, o cold start pode
levar até 10s de splash. É o preço de "se não atualizar não usa" — e só acontece
quando há bundle novo pra baixar; sem update, a checagem é um HTTP curto.

⚠️ A `version` continua **`"1.0.0"`** de propósito. Subir dispara a armadilha do
`runtimeVersion` e congela o OTA da frota inteira (ver "A ARMADILHA DO
`runtimeVersion`"). O contador de buildNumber do EAS já está em **41** (> 33),
então o blocker de colisão com o ASC descrito na Onda 3 **está resolvido** — o
próximo iOS sai como 42.

### O que ficou de fora desta rodada (conversado com o Marcos)

- **`runtimeVersion.policy: "fingerprint"`** — hoje é `appVersion` travado em
  1.0.0 enquanto módulos NATIVOS entraram (maplibre, expo-local-authentication,
  apple-targets, apple-authentication). O OTA de hoje é entregue à vc 5 de
  julho, que não tem esse nativo: hoje só deixa a pessoa velha, mas o próximo
  OTA que tocar num desses módulos vira **crash**, não desatualização.
- **O piso da loja está desarmado E não funcionaria**: `app_config` tem
  `bloqueia: false` e `versao_minima_*: null` (as URLs das lojas foram
  preenchidas em 03/09). E `abaixoDoPiso` compara `Updates.runtimeVersion`, que
  é `"1.0.0"` em **todo** build que já existiu — ele não distingue o 33 do 42.
  A régua certa é `Constants.nativeBuildVersion` (33/42 no iOS, versionCode no
  Android), que é o que a telemetria já coleta em `build_number`.
- **Os binários iOS de junho #14/#15/#16 saíram sem canal e sem runtime**: neles
  `Updates.isEnabled` é `false`, não recebem OTA nenhum e não têm portão (ele
  nasceu em 05/08). Em campo: nos 7 dias antes de 03/09, **470 eventos de 16
  usuários distintos** vieram de bundle antigo o bastante pra não enviar
  `runtime_version`/`installation_id` (campos que entraram em 05/08).

## ⚠️⚠️ INSTALOU E VEIO A VERSÃO ANTIGA · o portão na primeira abertura (29/08/2026)

Relato do Matheus: *"quem tá baixando o app pro android, quando a pessoa instala,
algumas baixam e ele vem com uma versão antiga, como se não tivesse subido o OTA
pra ela. Aí a pessoa tem q fechar e abrir o app para subir o OTA novo. Na
instalação, já deve vir com a última versão."*

⚠️⚠️ **A TELA "Atualizando…" JÁ EXISTIA e funcionava** (`components/app/
PortaoAtualizacao.tsx`) — o que faltava era ela DISPARAR na primeira abertura. O
bloqueio era uma linha:

```ts
setBaixouNestaSessao(true);   // sobe ANTES do fetch, pra fechar uma corrida
await Updates.fetchUpdateAsync();
...
const prontoParaAplicar = ... && !baixouNestaSessao && ...
```

Aquela guarda existe desde 07/08 pra **NÃO INTERROMPER quem está usando** quando
um download termina no meio da sessão (foi ela que fechou o bug do teclado
sumindo no campo de CPF, 10/08) — e está certa. Só que na **primeira abertura
depois de instalar não há nada a interromper**: a pessoa acabou de abrir e está
vendo exatamente o bundle que veio no APK. Ali a guarda protegia o vazio e
cobrava o ciclo de duas aberturas que ele descreveu.

⇒ A decisão saiu do componente e virou régua PURA em **`lib/portaoUpdate.ts`**
(`decidirAplicacao`), com `Updates.isEmbeddedLaunch` como exceção: `true` = nenhum
OTA aplicado ainda, ou seja **é a primeira abertura**. Fato do runtime, não
heurística de tempo.

⚠️ **A ORDEM das guardas é o contrato** (tem teste): ficha de cadastro aberta,
`isChecking`, `isDownloading` e `isStartupProcedureRunning` bloqueiam **INCLUSIVE
na primeira abertura**. Dá pra instalar, abrir e começar o `/completar-cadastro`
antes de o download terminar — aplicar ali apagaria o formulário. E sem as
guardas de transição o `reloadAsync` reinicia no MESMO bundle, que é o loop de
13/08.

⚠️ **`leEmbutido` devolve `false` quando o valor não é booleano.** `undefined`
virando `true` ligaria a exceção em TODA sessão e traria de volta a interrupção no
meio do uso — o oposto do que a guarda protege. Na dúvida, comportamento de antes.

⚠️⚠️ **ISTO SÓ VALE A PARTIR DO PRÓXIMO BINÁRIO.** A régua roda a partir do bundle
**embutido no APK/IPA**, no instante em que ainda não há OTA aplicado — publicar
por OTA a entrega só para quem instalar dali em diante. Quem já tem o app no
aparelho continua com o ciclo de duas aberturas até trocar de binário.
⚠️ E o build novo sai **com `version` ainda `"1.0.0"`**: subir a versão dispara a
armadilha do `runtimeVersion` e congela o OTA da frota inteira, iOS incluído.

Teste: `test/portaoUpdate.test.ts` (7 casos). **4 mutantes RODADOS e mortos**:
tirar a exceção do lançamento embutido (o bug original) → 1 vermelho · deixar o
embutido passar por cima da ficha aberta → 1 · transição em voo deixando de
bloquear no embutido → 1 · `isEmbeddedLaunch` ausente virando `true` → 1.

## ⚠️⚠️ AUDITORIA DO APP · ONDA 2 · A PUBLICAÇÃO (2026-08-07)

A onda que só existia por OTA. Cinco entregas, todas no app — o servidor foi
preparado antes (PR #2327 do sistema).

### 1 · ERROR BOUNDARY na raiz — o app não tinha NENHUM

Varredura: **zero** `componentDidCatch`/`getDerivedStateFromError` em `app/`,
`components/`, `lib/` e `contexts/`, e nenhuma rota exportava `ErrorBoundary` (o
expo-router só protege rota que exporta o dele; o overlay de erro é só de DEV).
Em produção, **qualquer exceção de render encerrava o app na cara da pessoa, sem
mensagem**. O handler global de `lib/telemetria.ts` REGISTRAVA o fatal e
repassava pro padrão — a gente sabia do crash e a pessoa ficava sem app.

- `components/app/ErrorBoundary.tsx`, montado **na raiz e FORA de todos os
  providers** (tema, tradução, portão de atualização, auth) — assim cobre erro
  DELES também. ⚠️ Por isso as cores da tela de erro são **fixas**: não dá pra
  usar `useColors()` (é componente de classe, e o provider pode ser justamente o
  que quebrou).
- "Tentar de novo" faz `Updates.reloadAsync()` (com guard de `Updates.isEnabled`,
  que não existe em dev) e, se falhar, reseta o estado. Sem saída lateral, mas
  sem beco sem saída.
- Reporta `render_crash` na telemetria com a 1ª linha da pilha de componentes —
  dá pra achar a tela sem despejar stack nem dado dela.
- ⚠️ Gatilho já mapeado que isto contém: `scrollToIndex` do carrossel da Home sem
  `getItemLayout`/`onScrollToIndexFailed` (uma leva grande de destaques lança
  invariant).

### 2 · As 3 telas que escreviam DIRETO no banco passaram pelo backend

A LEI do projeto é "quem decide o que é válido é o BACKEND". Cada uma tinha um
estrago próprio, e os dois primeiros eram **invisíveis**:

- **Perfil** (`perfil.tsx`) chamava a RPC `app_salvar_membro`, que procurava
  cadastro por CPF **ou telefone ou NOME EXATO** e vinculava a conta ao primeiro
  que achasse, **sem prova de posse**. Agora: `PUT /app/membro/perfil`.
  ⚠️ **CPF não vai mais daqui** e o campo virou **somente leitura**: o endpoint
  não o aceita, e deixar editável seria a tela prometendo uma gravação que não
  acontece. Trocar CPF é ato de IDENTIDADE (`/completar-cadastro`). A mensagem
  deixou de dizer "e vinculado ao seu cadastro".
  ⚠️ Com isso a RPC estreitada (`20260806140000`) **pode ser dropada** assim que
  esta publicação estiver em todo mundo.
- **Indisponibilidade** (`lib/disponibilidade.ts`) gravava em `vol_availability`,
  onde **só service_role tem policy desde 15/06** — sonda: **0 linhas na tabela**,
  ou seja **nunca funcionou**. O voluntário marcava as datas em que não pode
  servir e a escala continuava contando com ele. Agora usa os 3 endpoints que já
  existiam e **não tinham chamador**.
  ⚠️ As assinaturas ficaram iguais pra a tela não mudar; `volProfileId` virou
  parâmetro ignorado — **quem resolve o perfil de voluntário é o servidor, pelo
  token**, e é bom que seja: o cliente não decide de quem é a indisponibilidade.
  ⚠️ `getMeuVolProfileId` NÃO volta a consultar `vol_profiles`: helper morto
  apontando pra tabela que o app não pode escrever foi como este bug nasceu.
- **Editar grupo** (`grupo-editar.tsx`) fazia UPDATE direto e a RLS barra
  supervisor; sem `.select()`, 0 linhas voltavam SEM erro e a tela dizia "Grupo
  atualizado." Agora `PUT /app/grupos/:id` (Onda 1b), que autoriza pelo MESMO
  critério que esta tela usa pra mostrar o botão e devolve **409** quando nada é
  gravado. A tela reflete o que o servidor **normalizou** ("1930" → "19:30",
  "casais" → "Casais") — senão mostraria uma coisa e o banco teria outra.

### 3 · Falha de rede deixou de virar tela vazia enganosa

- `meu-grupo.tsx`: o `catch` fazia `setGrupos([])` ⇒ offline/401/500 viravam a
  MESMA tela de "Você ainda não está em um grupo de conexão", **com um botão
  convidando a pessoa a entrar num grupo que ela já tem** — e o líder com rede
  ruim lia que não lidera nada. Agora erro é erro, com "tentar de novo", e vem
  ANTES do estado vazio na renderização.
- `evento.tsx`: os dois fetches tinham `.catch(() => vazio)` ⇒ catálogo vazio ⇒
  **"Evento não encontrado"** — na PORTA do evento, que é onde o sinal é pior,
  escondendo o QR de quem ESTÁ inscrito. Virou `Promise.allSettled`, e **só é
  falha quando as DUAS não vieram**: com a inscrição em mãos a tela ainda mostra
  o QR, que é o que importa na entrada.
- `Disponibilidade.tsx`: o `carregar` não tinha try/catch — com a leitura indo
  pro backend, uma falha deixaria `carregando` **true pra sempre**.

### 4 · `/completar-cadastro` parou de reimplementar régua fraca

É a porta que TODO mundo atravessa pra entrar no app, e tinha a própria
validação: aceitava **31/02** (só conferia dia 1..31) e CPF **sem DV** — a
pessoa digitava, enviava, e só o SERVIDOR recusava, com 400 seco.

- ⚠️ **A régua foi pra `lib/validators.ts`** (`nascimentoBRParaISO`, com `hoje`
  injetável) porque **régua dentro de `.tsx` não roda no CI** — a lei do repo. 4
  testes novos (41 no total) + **mutante próprio**: tirar o calendário real deixa
  o portão vermelho (8/8 mutantes pegos).
- CPF passou a conferir **DV** pela mesma `isValidCPF` do resto do app.
- ⚠️ A conversão segue **sem `new Date("YYYY-MM-DD")`**: essa forma é UTC e em
  fuso negativo volta um dia (a armadilha da faixa etária).

### ⏳ O que NÃO deu pra fazer nesta onda, e por quê

- **`build_number` na telemetria** (chega nulo em 100% dos eventos): o campo vem
  de `Constants.nativeBuildVersion`, que o Expo aposentou — a fonte certa é
  **`expo-application`, que é módulo NATIVO e não sai por OTA**. Fica pra Onda 3
  (build). ⚠️ Alternativa OTA-safe pra medir "quem está em código velho":
  `Updates.updateId`/`runtimeVersion` (expo-updates já está no binário), mas
  exige coluna/whitelist no backend.
- **Foto de capa do grupo**: continua sem gravar (0 de 140 grupos têm
  `foto_url` — **nunca funcionou**). A policy do bucket `grupos` exige
  `is_admin_or_diretor()` (`profiles.role`, esquema APOSENTADO) ou ser o líder,
  então supervisor não passa nem no Storage. Consertar exige **endpoint de
  upload**, não só o PUT.
- **i18n de `perfil.tsx` e `escala-supervisor.tsx`**: ficou de fora pra a
  publicação não misturar conserto de dado com varredura de tradução.

## ⚠️⚠️ ONDA 3 · versão mínima, e o que a medição derrubou (2026-08-07)

### 🔴 O BUILD iOS #32 NUNCA CHEGOU NA LOJA — e o CLAUDE.md dizia que sim

Medido com `eas submit:status -p ios` (lê o App Store Connect pela API key do
EAS):

```
App Store   Live: 1.0 (33) — ready for distribution
TestFlight  1.0.0 (33) … uploaded 1 month ago   ← o mais recente
```

⚠️ **O build 32 não aparece em lugar nenhum do ASC.** As TRÊS submissões de
05/08 (`eas submit:list`) estão todas como `finished` — e `finished` no EAS
Submit significa *"o upload foi aceito"*, **não** que a Apple processou. A
submissão anterior (build 31) errou com `SUBMISSION_SERVICE_IOS_OLD_APP_VERSION`
("you've already submitted this version").

**Causa provável, e é aritmética**: o contador remoto do EAS está em **32** e o
ASC já tem o **33** (build feito FORA do EAS, em 22/06 — os builds iOS #17 a #33
não existem no EAS). Apple descarta binário cujo build number não é maior que um
já existente pra mesma versão. ⇒ **antes do próximo build iOS é preciso subir o
contador do EAS acima de 33** (`eas build:version:set`), senão o próximo sai como
33 e colide de novo.

⚠️ Consequência prática: **o que as pessoas têm no iPhone é o binário de 22/06** —
e ele recebe OTA (já provado por telemetria), então o app está atualizado. Mas
tudo que dependia de "o #32 está no TestFlight" era falso.

### ⚠️⚠️ A ARMADILHA DO `runtimeVersion`, provada ao vivo

`app.json` tem `runtimeVersion.policy = "appVersion"` e `version: "1.0.0"`. GET
no manifesto de `u.expo.dev`:

| `expo-runtime-version` | resposta |
|---|---|
| `1.0.0` | **200** + bundle |
| `1.0.1` | **204** — nada |
| `1.0`   | **204** — nada |

⇒ **No dia em que a `version` subir, todo binário 1.0.0 para de receber OTA.** O
app não quebra: **CONGELA** no último bundle. E o `PortaoAtualizacao` fica
**cego**, porque ele só age com `isUpdatePending` — que nunca mais vai existir
naquele aparelho. A partir daí o único canal é a LOJA.

⚠️ O casamento é **igualdade exata de string** (não semver):
`LauncherSelectionPolicyFilterAware` faz `runtimeVersion == it.runtimeVersion`.
⚠️ A `version` **nunca mudou** desde o commit inicial — a armadilha está armada,
não disparada. **Ordem obrigatória**: o aviso de versão mínima precisa chegar por
OTA a todo mundo ANTES de qualquer bump.

### O que foi construído

- **`GET /api/app/versao`** (público, fail-open) + tabela `app_config`
  (singleton, no padrão de `batismo_config`/`vol_config`). ⚠️ **Tabela, não env**:
  env do Vercel só propaga com redeploy e não tem trilha nem reversão em 1
  clique — e este é o interruptor capaz de trancar a base inteira.
  ⚠️ `bloqueia` **nasce false**: hoje nenhum binário no campo manda a versão.
- **`lib/versaoApp.ts`** (régua pura, no portão, 2 mutantes): compara por
  POSIÇÃO (texto diria que `1.0.10 < 1.0.9`) e **fail-open** em qualquer dado
  ilegível. ⚠️ `"1.0"` e `"1.0.0"` são a MESMA versão — o ASC mostra `1.0` e o
  app.json diz `1.0.0`; tratar como diferente bloquearia todo mundo.
- **Tela de "atualize pela loja"** no `PortaoAtualizacao`, ANTES do portão de
  OTA: quem está abaixo do piso não recebe OTA nenhum, então oferecer "atualizar
  agora" seria mandar a pessoa pra um beco sem saída.
- **Telemetria passa a identificar o BINÁRIO**: `runtime_version` (do plist),
  `update_id`, `canal`, `is_embedded`. ⚠️ `app_version` é a versão do BUNDLE e é
  `1.0.0` em **13.231 de 13.231** eventos — nunca distinguiu ninguém; a única
  forma até hoje era deduzir por campo AUSENTE, truque que se gasta a cada
  release e enviesa pro otimista (quanto mais velho o cliente, menos aparece).

### ⚠️ `build_number` NÃO precisava de build (o CLAUDE.md estava errado)

A seção da Onda 2 dizia que ficaria pra Onda 3 porque `expo-application` é
módulo nativo. **Ele já está no binário**: é dependência transitiva de
`expo-notifications` e `expo-auth-session` (7.0.8, autolinkado), ambas anteriores
aos builds vivos. A causa real do `build_number` nulo em 100% é outra:
**`Constants.nativeBuildVersion` foi REMOVIDO do expo-constants na v16** (o
projeto está na 18) e o `& Record<string, any>` do tipo escondia isso do
TypeScript. ⚠️ Lido com `requireOptionalNativeModule`, **nunca com `import`**: se
o módulo sair da árvore, o pior caso vira `build_number: null` em vez de **crash
de boot** no próximo OTA.

### 🐛 O portão de atualização tinha um bug que anulava a própria proteção

`momentoDeCobrar` virava `true` e **nunca voltava a `false`** — então a promessa
do comentário (*"não interromper no meio do `/completar-cadastro`"*) **não
existia**: um download que terminasse durante o uso mostrava o portão na hora e
apagava o que a pessoa tinha digitado. A régua certa não é *quando* cobrar, e sim
**de onde veio o update**: baixado NESTA sessão de tela acesa ⇒ espera o próximo
ciclo; já estava no aparelho na abertura (ou na volta do background) ⇒ cobra.

### ⏳ Onda 3 · o que depende de GENTE

1. **Aplicar a migration `20260807180000`** e só então mergear o PR do ERP —
   sem as colunas, o normalizador manda campo que a tabela não tem e o PostgREST
   recusa o INSERT **inteiro** (a lição do `event_id`, que matou a telemetria
   por 5 dias).
2. **Conferir no App Store Connect** por que o 32 não entrou, e subir o contador
   do EAS acima de 33 antes do próximo build iOS.
3. **NÃO subir a `version`** até a telemetria mostrar a frota se identificando.
4. ⚠️ **`app_push_tokens`: 30 tokens, TODOS iOS, ZERO Android** — não existe
   canal de push pro Android hoje, que é a maioria da frota (598 de 690 eventos).

## ⚠️⚠️ ONDA 2b · os 4 defeitos que o TESTE EM APARELHO achou (2026-08-07)

O Marcos testou a Onda 2 no celular e reportou 5 pontos (o 1 e o 5 estavam
certos). Os outros quatro **nenhum teste automático pegaria**, e três deles são
a mesma família: código que existia há semanas e que só agora ficou alcançável.

### 1 · A régua de NASCIMENTO recusava toda data de indisponibilidade

Relato: *"coloquei diversas datas 09/08/2026, 20/10/2026... mas sempre ele dá
'Data de início inválida'"*. `isValidDateBR` termina em `<= Date.now()` porque
foi escrita pra data de NASCIMENTO — e as datas em que o voluntário não pode
servir são **futuras por definição**. ⇒ **nenhuma data jamais foi aceita ali.**

⚠️ Era a **2ª razão, independente da RLS**, de a tela nunca ter gravado nada:
ontem eu consertei o caminho de escrita (`vol_availability` só aceitava
service_role) e a validação continuava recusando antes de chegar lá.

- A régua foi **SEPARADA, não afrouxada**: `isDataCalendarioBR` (só "existe no
  calendário") + `janelaIndisponibilidadeBR` (aceita futuro). `isValidDateBR`
  virou composição e **segue recusando futuro** — ela tem 5 chamadores, todos de
  nascimento (cadastro, perfil, batismo, vínculo do Kids, `nascimentoBRParaISO`).
  Afrouxá-la teria trocado um bug por outro, em 4 telas.
- ⚠️ O corte da janela é pelo **FIM**, não pelo início: viagem que começou ontem
  e termina semana que vem é bloqueio legítimo, e é o fim dela que protege a
  escala. Janela já terminada é recusada porque `listarIndisponibilidades` só
  exibe `unavailable_to >= hoje` — ela sumiria da lista ao salvar, e "salvei e
  desapareceu" se lê como perda de dado.
- `hoje` é **injetado em BRT** (`hojeBRT()`): com `toISOString()` a pessoa
  perderia o direito de bloquear o dia de hoje a partir das 21h.
- **2 mutantes** congelam isto: usar a régua de nascimento aqui, e cortar pelo
  início.

### 2 · O teclado cobria o formulário · calendário em JS PURO

Relato: *"a interface é ruim de ver os dados, pois o teclado sobe e cobre"* +
pedido de calendário clicável. `components/ui/CalendarioBR.tsx` + o formulário
de bloqueio virou **modal** (inline, ele ficava no meio de uma tela longa e o
`KeyboardAvoidingView` era da tela hospedeira).

⚠️⚠️ **NADA de `@react-native-community/datetimepicker`** nem de qualquer picker
nativo: **módulo nativo não sai por OTA** — entraria só num build novo, com
revisão da Apple no caminho, e este conserto precisa chegar em quem já tem o app.
O calendário é View/Text/Pressable. ⚠️ Toda a aritmética usa `Date` **LOCAL** e o
ISO é montado por concatenação — `toISOString()` aqui devolveria o dia anterior.

### 3 · ⚠️⚠️ A aba SERVIR caía em "Algo deu errado" · canal realtime

Relato: *"duas vezes ao tentar abrir a aba de servir apareceu o erro tente
novamente"*. **Não era rede, nem 401, nem rate limit** (as três hipóteses
naturais). Era **crash de render**, capturado pelo Error Boundary que subiu
ontem — que fez seu trabalho: antes disso, um throw de efeito **fechava o app**.

Diagnóstico pela TELEMETRIA, não por suposição: exatamente 2 eventos
`render_crash` em produção, do aparelho dele, com a mensagem literal
*"cannot add `postgres_changes` callbacks for realtime:voluntariado-<id> after
`subscribe()`"* e `label` apontando `VoluntariadoScreen`.

A cadeia, em 3 fatos do supabase-js: `channel(topico)` **reaproveita** canal já
registrado · `on()` **lança** em canal joined/joining · `removeChannel()` é
assíncrono e o cleanup não espera. Tópico FIXO por membro ⇒ a 2ª montagem da
tela reencontrava o canal vivo e o `.on()` lançava dentro do `useEffect`.

- `lib/canalRealtime.ts` (régua PURA, no portão): **tópico novo por montagem**
  + limpeza dos canais órfãos do mesmo membro. ⚠️ As duas juntas — tópico único
  sozinho troca o crash por **vazamento de canais**, um por abertura da tela.
- ⚠️ O bloco inteiro ganhou **try/catch**: realtime aqui é CONVENIÊNCIA (o
  refetch por foco e por AppState já cobre o dado) e **nunca** pode derrubar a
  tela. Custo declarado: se o canal falhar, a lista atualiza ao voltar pra tela
  em vez de "em segundos".
- `apiGet` era o **único** dos quatro verbos que lançava sem `.status` — quem
  quisesse distinguir 401 de 429 numa leitura só tinha a string pra olhar.
- ⚠️ Junto, em `Disponibilidade.tsx`: o erro de carregamento só era renderizado
  **dentro** do bloco do formulário, então falha de rede aparecia como
  *"Nenhum bloqueio. Você está disponível!"* — o mesmo estado vazio enganoso que
  a Onda 2 corrigiu em meu-grupo e evento, sobrevivendo num terceiro lugar.

### 4 · O SUPERVISOR não via os grupos dele

Relato: *"me coloquei como supervisor mas não apareceu no aplicativo"*.
`GET /app/meu-grupo` monta a lista de dois lugares só — roster e
`mem_grupos.lider_id`. **`supervisor_id` não entra em lugar nenhum** daquele
handler, embora o resto do domínio já trate supervisor como gestor pleno (é
`gruposGeridos` = liderados ∪ supervisionados que autoriza `/grupos/:id/membros`,
os pedidos e o `PUT` da Onda 1b).

**Medido: 79 dos 87 grupos ativos com supervisor eram invisíveis pro próprio
supervisor, atingindo 14 pessoas** — e como não havia nenhum outro caminho de
navegação até `/grupo-membros`, **o save que consertei ontem era inalcançável
pela tela**. Consertar o backend sem isto teria sido conserto que ninguém alcança.

- Conserto **no app** (sai por OTA, sem tocar no servidor): `/meu-grupo` passa a
  consumir `GET /app/grupos/meus`, que já devolve liderados ∪ supervisionados.
- ⚠️ Em **seção própria**, não misturado nos cards: esta tela é de
  PERTENCIMENTO ("meu grupo", com material e "falar com o líder"); injetar 10
  grupos supervisionados nela viraria painel de gestão pra quem só quer ver o
  próprio grupo.
- ⚠️ O rótulo diz **"Grupos que você gerencia"**, não "supervisiona": o endpoint
  não diz qual é qual, e afirmar o papel seria a tela inventar o que o payload
  não carrega.
- ⚠️ Dedup por id **não é cosmética**: quem lidera E supervisiona o mesmo grupo
  apareceria duas vezes.
- Chamada **best-effort e separada**: falha da lista de gestão não pode virar
  "não conseguimos carregar seus grupos".
- De quebra, matou o `contarPedidosGrupo()` que rodava **a cada foco de tela e
  cujo resultado não era renderizado em lugar nenhum** desde 05/08 — agora as
  pendências aparecem POR GRUPO, com o dado que já vem na mesma resposta.

### 5 · Conta NOVA era mandada pra tela de cadastro de novo

Relato: *"preenchi todos os dados, mas quando entrei ele pediu novamente pra eu
confirmar quem eu era"*. **Não era o matcher casando com cadastro alheio**: a
observação de identidade diz `{"created": false, "matched_by": "cpf"}` — ele
casou com o cadastro que **ele mesmo** criou 3 minutos antes, no próprio signup.

O portão exige `profiles.app_ficha_confirmada_em` (05/08 · dado herdado de
vínculo não libera acesso). Só que o carimbo é escrito em **dois lugares, os
dois do fluxo de quem entra por login** — `/identidade/completar` e
`/identidade/confirmar`. O cadastro nativo, que é **justamente onde a pessoa
digitou tudo**, não passava por nenhum: nascia com a ficha completa em
`mem_membros` e `confirmouFicha` false ⇒ `completo: false` ⇒ rebatido.
Medido na conta de teste: **3min19s preso na porta**, e ele ainda recebeu um
código por e-mail pra provar que era quem tinha acabado de dizer que era.

⚠️ É a **lição nº 2 do incidente de 06/08 se repetindo** ("ligar uma exigência
exige cobrir TODOS os caminhos que a satisfazem") — cobri os dois caminhos de
login e esqueci o terceiro, o cadastro.

- Conserto: `cadastro.tsx` chama `completarCadastroApp(...)` depois do signup
  **com sessão**, com os dados já na mão. Passa pela porta canônica (matcher,
  vínculo, fila de duplicidade) e carimba.
- ⚠️ **Best-effort**: falha de rede não derruba o cadastro (a conta já existe) —
  cai no comportamento de hoje. Zero regressão no pior caso.
- ⚠️ **Não relaxa nada no servidor**: `completo` continua exigindo `falta: []`,
  então o carimbo nunca vira atalho de acesso.
- ⚠️ Só vale pra quem passa pelo formulário nativo. Google/Apple continuam
  pedindo a ficha — e é o certo: de lá vêm só nome e e-mail.

### ⚠️⚠️ ACHADO DO LEVANTAMENTO: a migration `20260806120000` NÃO está viva

O agente concluiu por DADO, não por arquivo: a conta de teste tem `mem_membros`
criado no **mesmo microssegundo** do `profiles`, `mem_historico` dizendo
*"Criado automaticamente via auth_signup"* e `origem_cadastro='app'` — nada
disso existiria se o gatilho já criasse **só o profile**.

⚠️ **A ORDEM IMPORTA e é contraintuitiva:** se essa migration for aplicada
**antes** desta publicação chegar aos aparelhos, o caso 5 fica **PIOR** — a
conta nova passa a chegar com `membro_id` NULL e `falta` com os 5 campos, e a
pessoa preenche tudo de novo a partir do zero. **Publicar o app primeiro.**

### 2ª rodada do mesmo dia · o que o teste seguinte achou (07/08)

Ele testou de novo: **1, 2 e o calendário passaram** (a indisponibilidade gravou
e persistiu — `vol_availability` saiu de 0 pra 1 linha: "viagem", 20–31/08). Dois
achados novos:

**A · ⚠️ A escala LÊ o bloqueio, mas só metade do sistema o VIA.** Pergunta dele:
*"veja se isso afeta as escalas quando forem montadas"*. Medido no ERP: são
**dois modelos na mesma tabela** — por CULTO (`service_id` preenchido, o que a
coordenação marca na tela) e por PERÍODO (`unavailable_from/to` com `service_id`
NULL, o que **o app** grava). `POST /schedules/auto-fill` filtra por FAIXA DE
DATA e **sempre respeitou**; mas `GET /services-availability` — a tela que a
coordenação usa pra escalar **na mão** — filtrava `service_id não nulo` e
mostrava "ninguém indisponível". Gerador automático e painel discordavam sobre a
mesma pessoa no mesmo culto. Corrigido no ERP (PR #2338), com dedup por pessoa e
o `motivo` na resposta. ⚠️ **Não era regressão**: a tabela só passou a receber
bloqueio por período hoje, então é porta recém-aberta cujo destino não olhava
pra ela.

**B · O telefone não tinha limite** (`components/ui/PhoneInput.tsx`): aceitava
qualquer quantidade de dígitos e o Contrato de porta exige 10–11 — a pessoa só
descobria no fim do cadastro. Régua em `lib/telefone.ts` (máscara
`(21) 99999-8888`, corte por país). ⚠️ O estado do pai continua guardando **só
dígitos**: o `+55…` é concatenado na gravação, e parêntese ali viraria telefone
inválido no banco.

**C · ⚠️⚠️ O carimbo FUNCIONOU — o que sobrou foi CORRIDA.** Ele reportou que a
conta nova pediu confirmação de novo, mas a medição mostra o contrário do
esperado: `app_ficha_confirmada_em` gravado às **15:20:15.606** (`matched_by:
cpf`), e a telemetria com `tela /completar-cadastro` às **15:20:19** — 4
segundos DEPOIS. A sessão nasce dentro do `signUp`, o `RootNavigator` troca pra
área logada e o `CadastroGate` monta perguntando `/identidade/status`
**em paralelo** com o `completarCadastroApp` que ainda está no ar; a resposta
volta `completo: false` (lida antes do carimbo) e o portão rebate.
⚠️ Esperar N segundos não resolve (o tempo do serverless varia): o portão
**não decide enquanto o cadastro está sendo concluído** (`lib/cadastroEmAndamento.ts`
+ `useSyncExternalStore` no gate). ⚠️ **FAIL-CLOSED**: a bandeira tem teto de 30 s
— sem ele, um crash no meio do cadastro a deixaria ligada pra sempre e alguém
entraria **sem ficha**, que é o oposto do que o portão existe pra fazer.
⚠️ Não afrouxa nada: quem não completar cai na decisão normal quando a bandeira
baixa, e quem diz se a ficha fechou continua sendo o servidor.

## ⚠️⚠️ FECHO DAS ONDAS 2 e 3 · três achados que derrubaram premissas (2026-08-07)

### 1 · Push no Android: zero token, e NÃO se conserta por OTA nem por merge

`app_push_tokens` tem **30 linhas, todas iOS**. Zero Android, desde sempre — e
7 das 8 contas que já abriram o app num Android nunca tiveram token nenhum.

⚠️ **A causa está nos ARQUIVOS**: o projeto **nunca teve**
`android.googleServicesFile` no `app.json` nem `google-services.json` no repo —
`git log --all --diff-filter=A` e `git log --all -S googleServicesFile` voltam
**vazios**. Sem a chave, o `@expo/config-plugins` não aplica o plugin do
Firebase, o AAB sai sem ele, `FirebaseMessaging.getInstance()` lança
`IllegalStateException` e `getExpoPushTokenAsync` falha **na primeira linha**,
antes do projectId e antes de falar com o servidor da Expo.

⚠️⚠️ **O que escondeu isso por dois meses foi um `console.log`.** O `catch` de
`registerForPush` não emitia telemetria — a falha não existia em painel nenhum.
Agora emite `push_sem_token` com `reason` classificado por `lib/motivoPush.ts`
(`credencial_fcm` · `permissao` · `simulador` · `rede` · `sem_project_id` ·
`outro`). ⚠️ A ordem da classificação importa e tem mutante: **credencial é
conferida ANTES de permissão**, porque a mensagem do Firebase interpola
`e.message` e pode conter "permission" — trocar as duas faria o achado se
disfarçar de "as pessoas recusaram", que é a conclusão errada mais fácil de
tirar de "zero token" e levaria ao conserto errado.

⚠️ **O que NÃO está quebrado**: o aviso in-app. `_shared/notify.ts` grava a linha
em `app_notificacoes` **antes** de olhar tokens — o sino funciona no Android; o
que falta é a INTERRUPÇÃO. Medido: 71 notificações in-app já existem pras 8
contas Android.

⚠️ **PREMISSA MINHA QUE ESTAVA ERRADA**: eu disse "Android é a maioria da frota
(598 de 690 eventos)". Os 598 vêm de **3 aparelhos**, 454 deles de um Xiaomi só
(o de teste). No acumulado é **iOS 12.285 × Android 946**. Contar EVENTO não
dimensiona frota.

**Conserto de verdade (precisa de gente):** criar projeto Firebase pra
`br.com.cbrio.app` → baixar `google-services.json` → `"googleServicesFile":
"./google-services.json"` no bloco `android` → `eas credentials -p android`
(chave FCM V1) → **build Android novo**. ⚠️ Com `version` ainda `"1.0.0"`, senão
dispara a armadilha do `runtimeVersion` e congela o OTA da frota inteira.
⚠️ Subir SÓ a chave FCM no painel da Expo **não muda nada** — o aparelho nem
chega a falar com o servidor da Expo.

### 2 · A capa do grupo tinha o MESMO save silencioso da Onda 1b

Ver a seção 3b do CLAUDE.md do ERP. Resumo do lado do app: `escolherCapa()`
parou de tocar `supabase.storage` e de fazer UPDATE em `mem_grupos` — agora sai
por `POST /api/app/grupos/:id/foto` (e `DELETE` pra tirar).
- `lib/capaGrupo.ts` decide o formato: **o MIME manda, a URI é o plano B**. A
  tela antiga fazia `asset.uri.split(".").pop()` e no Android montava
  `image/media` como Content-Type — a URI é `content://…` e não tem extensão.
- ⚠️ Recusa em vez de CHUTAR `image/jpeg` (mutante): mentir o Content-Type
  guardaria um HEIC com nome de JPEG, que nenhum navegador abre — a capa
  apareceria quebrada no catálogo público e ninguém saberia por quê.
- ⚠️ `capaCabe` é **fail-open** quando `fileSize` vem indefinido (o `ImagePicker`
  nem sempre preenche): quem recusa de verdade é o multer, com 400 e mensagem.
- `lib/api.ts` ganhou `apiUpload` — o primeiro multipart do app. ⚠️ **NÃO setar
  `Content-Type` à mão**: o RN precisa gerar o boundary sozinho, e fixar o
  header faz o multer não achar campo nenhum enquanto o arquivo sobe inteiro.

### 3 · i18n: o problema NÃO era string solta — era o dicionário

⚠️⚠️ **A premissa "faltam t() em 2 telas" estava errada nos dois sentidos.**
`npm run i18n` (novo, no gate) mediu 90 telas:
- **405 chaves estavam dentro de `t("…")` e SEM entrada em `translations.ts`.**
  O `translate()` cai no português (`?? pt`), então isso **nunca quebra a tela**
  — some em silêncio. O app *parecia* traduzido (64 arquivos importam `useT`) e
  mostrava PT pra quem escolheu inglês.
- Strings realmente soltas: **36**, não ~394. Duas delas em `perfil.tsx` são
  `"CPF"` e `"DD/MM/AAAA"`, que **não devem** ser traduzidas.

Fechado nesta leva: `perfil.tsx` e `escala-supervisor.tsx` (que **nunca**
importaram `useT`) + as chaves novas de `grupo-visita`/`grupo-editar` — **112
entradas** em en/es. Restam **293**, o grosso em `completar-cadastro.tsx`.

⚠️⚠️ **`"Sem equipe"` em `escala-supervisor.tsx` NÃO É RÓTULO — É SENTINELA DE
DADO.** Ela era chave do agrupamento, comparação do drag&drop e **payload pro
servidor** (`team_name: team === "Sem equipe" ? undefined : team`). Envolver em
`t()` faria, em inglês, o `adicionarNaEscala` **GRAVAR uma equipe chamada "No
team" no banco** e o arraste mover pra lugar nenhum — sem erro de TypeScript,
sem falhar o portão, visível só pra quem trocou de idioma. Virou a constante
`SEM_EQUIPE`; a tradução entra **só na renderização**, por `rotuloEquipe()`.
- ⚠️ Mesma família: `"confirmed"`/`"declined"` são **enum do banco** e ficam
  crus (traduzir a comparação faria o resumo contar 0 confirmados). Só o rótulo
  derivado traduz.
- ⚠️ `fmtData` é **função de módulo** e `useT()` é hook: ela recebe o tradutor
  **por parâmetro**. Mover a formatação pra dentro do `.tsx` violaria a lei da
  casa (régua vive fora da tela).

**O portão é um TETO QUE SÓ DESCE, não um zero.** Motivo: `grupo-visita.tsx`
nasceu em 07/08 com strings sem tradução num arquivo que **já importava
`useT`** — a torneira estava aberta, e varrer telas uma a uma é enxugar gelo
enquanto código novo entra em PT duro (`npm run verificar` cobre RÉGUA e não vê
tela nenhuma). Quem pagar um pedaço baixa o número em `scripts/i18n-cobertura.mjs`.

## ⚠️⚠️ AUDITORIA DO APP · ONDA 0 (2026-08-06) · o que mudou NESTE repo

Auditoria de 4 dimensões pedida pelo Marcos (versão · integração · código ·
escalabilidade pra 4.000 downloads): 21 agentes, 85 achados brutos, **12
confirmados sob contestação adversarial**. Relatório em
`~/Downloads/auditoria-app-cbrio.html`. O plano ficou em **6 ondas por VEÍCULO de
entrega** (servidor chega na hora · OTA depende de 2 aberturas · loja depende da
Apple). A Onda 0 é quase toda no ERP (PR #2321 lá); aqui entraram 2 coisas.

### 1 · O lembrete do NEXT estava MORTO desde 13/06 (`notify-lembretes`)

`lembreteNext()` consultava `next_eventos` + `next_inscricoes` — a camada
**aposentada** no cutover de turmas de 17/06, cuja data MÁXIMA é 21/06. A query
devolvia zero linhas e **nenhum lembrete de véspera saiu desde 13/06** (única
chave `next-vespera:*` em `app_lembretes_enviados`), com o cron **vivo** esse
tempo todo — as chaves `aniversario:*` são de hoje. Quando foi medido havia **2
turmas abertas com 46 matrículas** e encontros em 09, 16 e 23/08.

⚠️ **Por que passou:** o conserto de 05/08 (#2288) cobriu as ROTAS do backend
(`/next/me`, `/next/inscrever`, check-in) e não esta função, que vive **neste
repo**. É a mesma classe do gatilho de `auth.users`: código de produção fora do
repositório onde alguém ia procurar.

Reescrito como espelho de `nextTurmasAbertas()` + `/next/me` do backend: turma
`aberta` → `next_encontros` de amanhã → `next_matriculas` da turma. Dedup por
**encontro** (`next-vespera:<encontro_id>:<membro_id>` — id de outra camada, não
colide com as chaves antigas). Quem está `desistente`/`cancelado` não recebe
(filtro em JS de propósito: status desconhecido continua RECEBENDO, porque
silenciar por engano é pior que avisar demais).

⚠️⚠️ **ISTO NÃO SAI POR OTA NEM POR MERGE.** Edge Function precisa de
`supabase functions deploy notify-lembretes`. E o CLI desta máquina está logado
numa conta que **não tem o projeto da CBRio** (`supabase projects list` mostra só
Granum e SNP) — deploy exige `supabase login` com a conta certa + `supabase link
--project-ref hhntwfawfnxvuobhdfkb`. **Prazo real: 08/08**, que é a véspera do
encontro de 09/08.

### 2 · `supabase/app_salvar_membro.sql` era uma ARMADILHA

Achado **CRÍTICO** da auditoria: a função procurava `mem_membros` por **CPF ou
telefone ou `lower(btrim(nome))` EXATO** e vinculava a conta ao primeiro que
achasse, **sem prova de posse** — e é `profiles.membro_id` que alimenta
`current_user_membro_id()` nas policies de Kids e de contribuições. Quem digitasse
o nome de um homônimo em `perfil.tsx` passava a ver grupo, comprovante de
contribuições e **filhos no Kids** daquela pessoa.

O conserto é a migration `20260806140000` **no repo do ERP** (a função escreve em
`mem_membros`, então a definição canônica vive lá). Este arquivo virou **cópia de
leitura sincronizada**, com o ponteiro pra migration no cabeçalho — arquivo
desatualizado aqui é exatamente o mecanismo que deixou o gatilho de `auth.users`
2 meses fora do git.

⚠️ **A função foi ESTREITADA, não dropada, e a ordem importa:** `perfil.tsx:184`
ainda a chama, e dropar antes do OTA deixaria a tela de perfil sem salvar. Ela
perdeu os ramos de BUSCA e de CRIAÇÃO; sem `membro_id` devolve `null` (o app já
trata: `if (vId) setMembroId(...)`) e os campos de `profiles` seguem salvando,
porque isso o cliente faz ANTES da RPC. **Trocar `perfil.tsx` pra
`PUT /app/membro/perfil` é da onda seguinte (por OTA) — e só depois disso a
função pode ser dropada.**

### O que a auditoria achou aqui e ficou pra Onda 2 (por OTA, numa publicação só)

`perfil.tsx` → endpoint do backend · `lib/disponibilidade.ts` → os 3 endpoints
que já existem (a tabela `vol_availability` só aceita service_role desde 15/06:
**a feature nunca gravou nada**, a tabela está vazia) · `grupo-editar` → endpoint
novo (hoje o save do supervisor não grava em 79 dos 100 grupos, e diz "Grupo
atualizado") · **Error Boundary raiz** (não existe nenhum: todo throw de render
fecha o app) · falha de rede parar de virar tela vazia enganosa ·
`completar-cadastro` usar `lib/validators` · `build_number` na telemetria (chega
nulo em 100% dos eventos) · i18n de perfil e escala-supervisor.
