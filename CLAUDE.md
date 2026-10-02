# CLAUDE.md — Memória do projeto CBRio

> **Regra permanente:** mantenha este arquivo sempre atualizado a cada mudança
> relevante (novo módulo, dependência, decisão de arquitetura, config de
> backend). Ele é a memória e o contexto contínuo do app.

## ⚠️⚠️ Como este arquivo é mantido (reorganização 2026-10-01 · LEIA ANTES DE ACRESCENTAR)

Este arquivo é carregado em **toda chamada de toda sessão e de todo agente auxiliar**
do Claude Code neste repositório. Em 01/10/2026 ele tinha 268 KB (~130 mil tokens) e
crescia a cada leva, o mesmo caminho que levou o `CLAUDE.md` do ERP a 1,5 MB e fez o
limite de uso da conta acabar em dias. Foi reorganizado **sem apagar nada**:

- **Aqui ficam só** as regras gerais, a stack, a estrutura, a rotina de build/OTA e o
  índice de onde mora o conhecimento de cada módulo.
- **O conhecimento de cada módulo** foi movido **na íntegra** para
  **`docs/claude/<modulo>.md`** (referência VIVA).

**Regras de manutenção (não regredir):**
1. ⚠️⚠️ **Seção nova de módulo NÃO entra aqui.** Vai para o fim do
   `docs/claude/<modulo>.md`, datada, com uma linha a mais no índice do topo dele.
2. Aqui só entra regra transversal nova (UMA linha em "Regras transversais").
3. **Teto: 70 KB.** O CI (`ci.yml` → "Tamanho do CLAUDE.md") falha acima disso. Não
   suba o teto: mova texto para `docs/claude/`.

## 🧭 Onde mora o conhecimento de cada módulo (LEIA antes de mexer)

Abra o arquivo, leia o índice do topo e só a seção do assunto. Para achar um termo:
`grep -n "termo" docs/claude/*.md`. O mapa de telas do app e do que cada uma chama
está no ERP, em `docs/mapa/APPS.md`.

| Arquivo (`docs/claude/…`) | O que tem |
|---|---|
| `devocional.md` | Devocional: casa nova (Bíblia, Planos, Comentários, Anotações, Leituras), check-in, vídeo, planos por inscrição |
| `servir-escala.md` | Servir e escala: montar escala por time, Pessoas do Servir, leitor/líder/admin, preferência de domingo, check-in do supervisor |
| `grupos.md` | Grupos: gerenciar grupo (abas, editar, recusar), ajustes dos líderes, tela do supervisor, inscrição, NEW HEART |
| `kids-criancas.md` | Kids e crianças: card do Kids, apresentação de criança (porta nativa, saúde), atalho, Kids arquivado |
| `batismo.md` | Batismo: escolha da data e do horário (régua de OTA de worktree limpa também está aqui) |
| `next.md` | Next: gestão pelo app (turmas, presença, abrir direto na gestão) |
| `publicacao-ota-auditorias.md` | Loja e OTA: porta de entrada da loja, versão antiga na 1ª abertura, `version` 1.0.0, auditorias do app (ondas 0, 2, 2b, 3) |
| `ui-navegacao.md` | Interface: diálogo da casa, navegação, teclado/KeyboardAvoidingView, relatos do Android, portão de i18n |
| `conta-identidade-cartao.md` | Conta e identidade: autenticação, cartão (Wallet), entrada de pessoa sob o Contrato de porta |
| `geral-integracao-erp.md` | Integração com o ERP: varredura app × ERP, eventos, o que o web muda, censo, Cuidados, notificação com botão, ajuda, generosidade, telemetria, telas mortas, recado aberto ao Matheus (10/08) |

## ⚠️⚠️ Regras transversais (uma linha cada · a íntegra está no arquivo indicado)

- **OTA só sai de uma worktree LIMPA em `origin/main`** (um OTA tirado de branch antiga já derrubou 18 PRs da frota) → `batismo.md`.
- **A `version` do `app.json` continua `"1.0.0"`**: subir congela o OTA da frota (o runtime é `appVersion`) → `publicacao-ota-auditorias.md` e "Rotina do build de loja" abaixo.
- **Quem decide o que é válido é o BACKEND, não o app**: régua de negócio (o que está aberto, quem pode, qual status vale) vem de endpoint do ERP, nunca reproduzida aqui → `geral-integracao-erp.md`.
- **`behavior` do `KeyboardAvoidingView` NUNCA é `undefined`** → `ui-navegacao.md`.
- **`<Modal>` dentro de `<Modal>` nasce ATRÁS no iOS**: componente embutido (ex.: `CalendarioBR embutido`) dentro de modal → `ui-navegacao.md`.
- **O portão de i18n conta texto, não comentário, e vermelho trava o OTA** → `ui-navegacao.md`.
- **NBSP não força quebra de linha** → `kids-criancas.md`.
- **Dia de operação da igreja é BRT** (`lib/dataBRT.ts`, espelho do `hojeBRT` do ERP); nunca `toISOString().slice(0,10)` para "hoje".
- **Régua gêmea com o ERP anda junto** (ex.: `lib/pushLotes.ts` × `backend/utils/pushLotes.js`, mesmo vetor de casos nos dois repos).
- **Telemetria não leva PII**: `props` só com as chaves permitidas pelo backend; nunca `Constants.deviceName` → `geral-integracao-erp.md`.
- **Entrada de pessoa segue o Contrato de porta do ERP** (o app pergunta ao servidor; dado herdado de vínculo não libera acesso) → `conta-identidade-cartao.md`.

## Visão geral

App de membros da igreja **CBRio**. Está sendo **reconstruído do zero, módulo a
módulo**. Roda em **Android e iOS**.

## ⚠️⚠️ PORTÃO DO REPO · CI das réguas + gate no OTA (05/08/2026)

Até hoje este repo **não tinha portão nenhum**: nem teste, nem CI. O que segurava
regressão era `tsc --noEmit` rodado à mão. Numa varredura só (05/08) apareceram
**nove** divergências entre a régua do app e a do ERP — e **nenhuma quebra o
TypeScript**, porque são erros de SEMÂNTICA (status que não existe no banco, dia
em UTC, filtro de soft-delete ausente, 7 status tratados como 3).

**Comandos:**
- `npm run verificar` → `typecheck` + `test`. **É o portão.**
- `npm test` → vitest nas réguas (`test/reguas.test.ts` · 27 casos).
- `npm run test:mutantes` → quebra cada régua de propósito e exige que o teste
  FALHE (6/6 hoje). **Guarda que não pega a regressão é decoração.**

**Onde o portão está pregado:**
1. **CI** (`.github/workflows/ci.yml`) em todo push/PR: typecheck → réguas →
   mutation guards.
2. **`npm run ota` NÃO PUBLICA se o portão falhar** — testado: com a régua do BRT
   quebrada, o script aborta e nada vai pro ar. OTA chega em quem tem o app
   instalado **sem revisão no caminho**, então o portão tem que ser aqui. Escape
   consciente: `CBRIO_OTA_SEM_PORTAO=1` (aparece no log).

**As réguas testadas — e por que cada uma existe** (cada teste cita o estrago
medido em produção):
- `lib/volStatus.ts` — os **7** status de `vol_inscricoes` do ERP (o app tratava
  3; 88 pessoas com fila encerrada apareciam como "Pendente").
- `lib/hierarquia.ts` — a árvore do `cd ..`, com **invariante**: todo pai é a Home
  ou existe no mapa (senão a seta leva a lugar nenhum).
- `lib/dataBRT.ts` — o dia da igreja em BRT (21h no Rio ainda é hoje).
- `lib/ficha.ts` — o que o Contrato de Inscrição exige (CPF barrava 50 das 75
  contas na hora de pedir grupo).
- `lib/inscricaoPayload.ts` — o corpo da inscrição: **faltar campo aqui não quebra
  o TypeScript, quebra a inscrição da pessoa com 400**.

⚠️ **REGRA: régua nova vive em `lib/` (código PURO), nunca dentro de `.tsx`.** Foi
por isso que `fichaCompleta` saiu do `SeusDados.tsx` e o payload saiu do
`evento.tsx` — arquivo que importa react-native não roda no CI. O componente
re-exporta pra não quebrar quem importava.
⚠️ **Teste tem que ser DETERMINÍSTICO**: sem rede, sem banco, sem o relógio da
máquina (`vi.setSystemTime`) — a lição do `faixaEtaria.test.ts` do ERP, que
passava ou falhava conforme a hora do dia.
⚠️ **O que este portão NÃO cobre: a TELA.** Ele garante que a regra não muda sem
alguém perceber; não garante que o botão renderiza. Isso exige rodar o app num
aparelho, e continua sendo passo humano antes de release.

## Stack

- **Expo SDK 54** + **Expo Router** (rotas tipadas)
- **React Native 0.81** / React 19 / **TypeScript** (strict)
- **Liquid Glass (iOS 26/27)** via `expo-glass-effect` (`GlassView`), com fallback
  `expo-blur` **só em iOS antigo** (`isLiquidGlassAvailable()`). Componente
  `components/ui/GlassCard.tsx` é o veículo padrão. Adotado no Dock e nas
  superfícies proeminentes/controles das telas principais: atalhos da Home,
  cards de Cuidados, seletor de método da Generosidade, lista do Menu, card de
  cartões do Perfil. **Por HIG**, conteúdo denso (instruções PIX, cards de
  status do Voluntariado) e alertas (SOS) ficam SÓLIDOS pra legibilidade — não
  espalhar glass em tudo.
  **⚠️ ANDROID = superfície SÓLIDA, nunca BlurView (04/08/2026):** o
  `experimentalBlurMethod="dimezisBlurView"` do expo-blur crashava NATIVO
  ("o app foi fechado forçadamente") ao rolar a Home (ProximosCultos) e ao
  abrir a aba Menu — reproduzido em Xiaomi/MIUI pelo Marcos. O GlassCard no
  Android renderiza View com `colors.surface`; não reintroduzir o blur
  experimental. (BlurView SEM o método experimental no Android não borra
  nada, mas é estável — o header da Home usa assim e pode ficar.)
- **Supabase** para autenticação (e futuramente dados)
- **EAS Update (OTA):** `expo-updates` configurado (canais `development`/
  `preview`/`production` no `eas.json`; `runtimeVersion.policy = appVersion`).
  Mudança **só de JS** vai ao ar sem revisão da Apple:
  `eas update --channel production --message "..."`. Só chega a builds com a
  MESMA `version` do app.json (runtime 1.0.0) e que já contenham
  `expo-updates`. Mudança nativa (módulo, plugin, permissão) continua exigindo
  build novo + revisão.
  ⚠️⚠️ **NÃO DÁ PRA AFIRMAR PELO EAS QUE O iPHONE RECEBE OTA** (apurado em
  05/08/2026): o EAS **não tem nenhum build iOS depois de 11/06** (o mais recente
  lá é o #16, commit `6387fd9`), e o OTA só foi configurado em **12/06** (commit
  `f3810c5` · `git merge-base --is-ancestor f3810c5 6387fd9` → **não** é
  ancestral). Se o binário da loja fosse esse, ele ignoraria todo update.
  **MAS** o contador de buildNumber remoto do EAS estava em **31** (o build novo
  saiu como **32**), o que indica build feito FORA do EAS (Xcode/Transporter) ou
  `build:version:set` — então o binário publicado pode ser mais novo e receber
  OTA. **Só o App Store Connect responde qual build está no ar.** Não repetir
  nenhuma das duas versões como fato sem olhar lá.
  **Android recebe, isso sim está conferido** (build #5, de 24/07, commit
  `6202102`, posterior ao OTA).
  ✅ **Build iOS #32 (05/08/2026 · commit `7eabfb5`) fecha essa dúvida pra
  frente**: `eas build:view` mostra **Channel `production` · Runtime 1.0.0**, e o
  `eas channel:view production` confirma o canal apontando pro branch
  `production` nas DUAS plataformas. Ou seja: esse binário recebe todo OTA que a
  gente publicar. Ele está **construído (IPA pronto, distribuição STORE), NÃO
  submetido** — `eas submit -p ios --profile production --latest` inicia revisão
  da Apple e é decisão de gente.
  ✅ **Contas de revisão PREPARADAS (05/08/2026)** — as três passam no portão,
  conferido rodando a régua real do `identidade/status`:
  `apple.review@cbrio.com.br` · `appstore.review@cbrio.app` ·
  `appstore.staff@cbrio.app` (esta não tinha cadastro nenhum — foi criada pelo
  matcher canônico, origem `conta_revisao_loja`, e vinculada ao profile).
  Todas com telefone/nascimento/sexo fictícios e `observacoes` marcando
  "CONTA DE REVISÃO — não é pessoa".
  ⚠️⚠️ **NUNCA pôr CPF nessas contas.** Uma delas tinha `39147258004`, que é
  **DV-VÁLIDO** — ou seja, pode pertencer a alguém real, e como CPF é a chave
  MAIS FORTE do matcher, essa pessoa seria ligada à conta de revisão no primeiro
  formulário que preenchesse. O CPF foi anulado (o portão não exige) e o Marcos
  ofereceu usar o dele/do Matheus — recusei pelo mesmo motivo: inscrição feita
  pelo revisor cairia no cadastro real deles.
  ⚠️ As três são `status='visitante'`, então ficam fora do disparo do censo por
  padrão (que mira `membro_ativo`) — mas entram se alguém marcar o chip de
  visitantes. Conferido também que elas **não viram par na fila de duplicidades**
  (`avaliarPossivelDuplicidade` → `incluir:false` nos 3 pares).
  ⚠️ **`eas.json` · perfil production ganhou `"environment": "production"`**
  (05/08/2026): o `env` inline do perfil tem URL e merchant do Apple Pay mas
  **NÃO tem `EXPO_PUBLIC_SUPABASE_ANON_KEY`** — ela vive nas EAS environment
  variables do servidor. Sem amarrar o perfil ao environment, o build podia sair
  com a chave vazia e cair no `placeholder.supabase.co`: o mesmo estrago do OTA
  sem `--environment`, só que gravado no binário da loja, onde OTA não conserta.
- **⚠️⚠️ PUBLICAR OTA SÓ POR `npm run ota -- "mensagem"`** (`scripts/ota.js`) —
  ele passa **`--environment production`**, que é o que faz as
  `EXPO_PUBLIC_*` entrarem no pacote.
  **O EAS CLI 21 NÃO LÊ `.env` no `eas update`** (medido em 04/08/2026, não
  suposto): as vars vêm dos **EAS environment variables do servidor**
  (`eas env:list production` — URL e anon key já cadastradas lá). Sem a flag,
  `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` saem VAZIOS, o app cai no fallback
  `placeholder.supabase.co` (lib/supabase.ts) e o **login com Google quebra**
  pra todo mundo que baixar o update (o build da loja fica intacto — quem
  desinstalar/reinstalar volta a funcionar na hora). Diagnóstico: publiquei 2×
  "com o .env no lugar" e o bundle continuou quebrado; só com a flag o
  conteúdo mudou (launchAsset key 47bc9a66 → 86b28c44 no manifest de
  `u.expo.dev/<projectId>`).
  **Como conferir um OTA depois de publicar:** `curl u.expo.dev/<projectId>`
  com headers `expo-platform/expo-runtime-version/expo-channel-name/
  expo-protocol-version` + `accept: multipart/mixed` → o manifest traz o `id`
  servido e a `key` do launchAsset (a key MUDA quando as vars entram).
  ⚠️ Baixar o bundle do `assets.eascdn.net` pra inspecionar dá **403**
  (requer assinatura do cliente) — pra ver o conteúdo, `npx expo export
  --platform android` local e `grep` no `.hbc` (o export SIM lê o `.env`).
  ⚠️ `.env` local serve pro dev (`expo start`). ~~`.env.example` aponta pro
  projeto inicial `otzemqml…`~~ → **CORRIGIDO em 08/08/2026** (Onda 5), junto
  com o `SUPABASE_SETUP.md`, que era pior: o **passo 2 mandava rodar
  `supabase/profiles.sql` no SQL Editor**, e esse arquivo cria `profiles` com
  colunas `nome`/`cpf` que **não existem** na tabela viva — o trigger dele
  estouraria `42703` no `AFTER INSERT` de `auth.users` e **quebraria todo
  cadastro novo**. Passo revogado, arquivo marcado como FÓSSIL no cabeçalho.
  ⚠️ **LEI QUE FICA**: neste repo, `supabase/*.sql` é **CÓPIA DE LEITURA** — os
  16 arquivos foram marcados no próprio cabeçalho. A FONTE que roda são as
  migrations do ERP. Não rode SQL daqui no painel.
- **⚠️ Projeto EAS vive na ORGANIZAÇÃO `cbrio`** (transferido em 04/08/2026 da
  conta pessoal `mtoscano99`; `owner: "cbrio"` no app.json — mesmo projectId,
  OTAs/builds/credenciais preservados). Membros: mtoscano99 (owner) +
  infra@cbrio.com.br + matheus@cbrio.com.br (admins) — qualquer um publica.
  **O CBRio-Staff (app do staff · repo `igreja-cbrio/CBRio-Staff`) também
  está na mesma organização** (movido em 04/08/2026 — o owner do app.json de
  lá precisa dizer `cbrio` antes do próximo update/build daquele projeto).
  Login do eas-cli é browser-flow: pra trocar de conta, deslogar do SITE
  expo.dev antes (o CLI reaproveita a sessão do navegador em silêncio).
- **EAS Submit — Play Store (Android):** configurado no `eas.json` (`submit.production.android`)
  com `serviceAccountKeyPath: ./google-play-service-account.json` (JSON da conta de
  serviço `eas-submit@crm-cbrio.iam.gserviceaccount.com` · projeto Cloud `crm-cbrio` ·
  **gitignored, NUNCA commitar**) e `track: internal`. Fluxo: `eas build -p android
  --profile production` (gera **AAB**, `autoIncrement` no versionCode) →
  `eas submit -p android --profile production --latest`. Cai no track **internal**;
  promover pra produção no Play Console. A permissão da conta de serviço no Play é
  "Release apps to testing tracks" (Users and permissions). iOS submit já existia
  (`ascAppId`/`appleTeamId`).
- **Estilização:** `StyleSheet` nativo (decisão: melhor performance/confiabilidade
  no celular; sem Tailwind/NativeWind). **Tema claro/escuro** com paletas em
  `constants/theme.ts` (`lightColors`/`darkColors`) e `ThemeContext` (segue o
  sistema por padrão + opção de fixar claro/escuro no Menu). Componentes/telas
  usam `useColors()` + `makeStyles(colors)`.
- Ícones: `@expo/vector-icons` (bundled com Expo).
- **Animação / gráficos:** `react-native-reanimated` (v3) +
  `react-native-gesture-handler` (gestos do cartão), `@shopify/react-native-skia`
  (brilho holográfico do cartão) e `expo-haptics`. O plugin do Reanimated está no
  `babel.config.js` (deve ser o **último**) e a raiz é envolvida por
  `GestureHandlerRootView` (`app/_layout.tsx`). ⚠️ Por usarem código nativo,
  **Expo Go não roda mais** — é preciso **development build** (`npx expo run:ios`).
- **Apple Wallet:** `react-native-wallet-pass` expõe `PassKit.addPass(base64)`
  (abre a tela nativa de adicionar passe) e o componente `AddPassButton`
  (`PKAddPassButton` — botão oficial da Apple, HIG).
- **⚠️ Navegação autenticada (04/08/2026 · desenho do Marcos):** casca montada
  em `app/(app)/_layout.tsx` — **faixa superior** (`components/ui/TopBar.tsx`:
  seta · título/logo · sino com contador · foto) + **barra de baixo**
  (`components/ui/BottomBar.tsx`: **Grupos · Servir · Cuidados · Devocional ·
  Menu**). Os 4 primeiros são os **valores da jornada**; a **HOME fica FORA da
  barra** e **NÃO existe botão "Início" em lugar nenhum** — chega-se nela pela
  SETA. Decisão dele, ciente do trade-off (eu sugeri Início na barra; ele
  preferiu "senão fica bagunçado").
  ⚠️⚠️ **A SETA É `cd ..`, NÃO "um passo atrás" (05/08/2026 · pedido dele com a
  metáfora exata: "a ideia é como se fosse uma ótica de pastas, e que esse
  voltar fosse um comando cd .. no terminal").** `router.back()` anda no
  HISTÓRICO: quem tocava Grupos → Servir → Cuidados → Devocional na barra
  precisava de 4 toques repassando telas já vistas. O mapa da árvore vive em
  **`lib/hierarquia.ts`** (`subirUmNivel()` · `router.navigate(pai)`, que VOLTA
  pro pai quando ele já está na pilha e descarta o que estava em cima) e as **~29
  telas com seta própria chamam a MESMA função** — regra única, não 29 cópias.
  ⚠️ A rota atual é registrada pelo `(app)/_layout.tsx` (`registrarRotaAtual`),
  que já observa o pathname: as telas antigas usam `router.back()` do objeto
  global, sem `usePathname()` em escopo, e passar a rota exigiria um hook em cada
  arquivo. ⚠️ Tela NOVA = uma linha no mapa (sem mapa, cai na Home — destino
  previsível em vez de adivinhação). ⚠️ O botão FÍSICO do Android continua
  andando no histórico (convenção do sistema); alinhar os dois exigiria
  interceptar o BackHandler — decisão do Marcos, não minha.
  As telas de barra vivem em `app/(app)/` (o grupo `(tabs)` **deixou de
  existir** · rotas idênticas, grupo entre parênteses não entra no path).
  ⚠️ **A tab bar NATIVA (`expo-router/unstable-native-tabs`) SAIU**: no
  UITabBarController tudo que aparece TEM que ser uma aba, e a Home precisa
  justamente do contrário (fora da barra, com a barra visível). Custo assumido:
  perdemos o Liquid Glass nativo do iOS 26 e o `minimizeBehavior`. Ganho: é JS
  → **sai por OTA**.
  ⚠️ Isto **NÃO é o "dock custom" aposentado em 12/06** (aquele morreu por
  GESTOS próprios: pan/long-press/GlassView aninhada) — aqui são 5 `Pressable`
  simples, **sem gesto nenhum**. Não reintroduzir gestos na barra.
  ⚠️ A barra é **IRMÃ do Stack, não sobreposta** → tela nunca fica por baixo
  dela e nenhum `paddingBottom` de tela precisa saber que ela existe.
  ⚠️ **Na HOME o logo fica À ESQUERDA** (150×38), não centralizado: sem a seta
  sobrava um vão à esquerda e a marca parecia encolhida ("o cbrio ali em cima
  ficou esquisito" · Marcos, 04/08). Nas outras telas de barra o centro é o
  título.
  ⚠️ **REABRIR O APP COMEÇA NA HOME** (`MS_PARA_RECOMECAR`, 3 min, em
  `(app)/_layout.tsx`): voltar do background depois de 3 min faz
  `dismissAll()` + `replace("/")`. **Cold start já caía na Home sempre** — o
  expo-router força a rota raiz quando não há deep link (`getInitialURL()` →
  `getRootURL()`) e o `index` é o 1º filho do Stack (`sortRoutes` põe index e
  grupos antes de tudo). O que fazia o app "abrir na tela de Notificações" era
  o **sistema RETOMANDO** a última tela com o processo vivo — normal do
  Android/iOS, e a razão de "só apagando os dados" resolver o travamento da
  manhã (apagar força o encerramento → a abertura seguinte é cold start).
  Não reseta se já está na Home nem em `/completar-cadastro` (apagaria o que a
  pessoa digitou).
  ⚠️ **Tela de barra não aplica a borda de cima** (`edges={["left","right"]}`):
  o inset do notch é da faixa. Tela de barra também **não tem cabeçalho
  próprio** (seta/título) — senão ficam dois. As telas de PROFUNDIDADE (perfil,
  cartões, kids, next…) seguem com o cabeçalho local até a limpeza.

## Estrutura de pastas

```
app/
  _layout.tsx          # provider de auth + guard de rotas (auth vs app)
  (auth)/              # fluxo não autenticado
    _layout.tsx
    login.tsx          # e-mail/senha + Google + Apple + "lembrar de mim"
    cadastro.tsx       # nome, e-mail, telefone, senha -> dispara SMS
    verificar-telefone.tsx  # confirmação do código SMS (OTP)
    recuperar-senha.tsx
  (app)/               # área autenticada — Stack + casca (faixa + barra)
    _layout.tsx        # MembroProvider + CadastroGate + TopBar/BottomBar + Stack
    index.tsx          # Home (carrossel + cultos + atalhos) — SEM header próprio
    cuidados.tsx / voluntariado.tsx / devocional.tsx / meu-grupo.tsx / menu.tsx
                       # telas de BARRA (sem cabeçalho local, sem edge de cima)
    generosidade.tsx   # fora da barra (vai pelo Menu) — mantém header próprio
    perfil.tsx         # editar e-mail/telefone/nascimento + CPF (vincula ao membro) + foto + cartões
    cartoes.tsx        # CARTÃO ÚNICO holográfico (toque vira; brilho holo reage ao giroscópio) + QR (mem_qrcodes.token) + botão oficial "Add to Apple Wallet"
    voluntariado.tsx   # inscrição de voluntariado (+ escalas em breve)
    inscricoes.tsx     # hub: Batismo, Grupos, NEXT, Voluntariado; fora do dock
    inscricao-batismo.tsx / inscricao-grupos.tsx / inscricao-next.tsx
    grupos.tsx / grupo-detalhe.tsx  # lista/detalhe de grupos (mem_grupos) + pedido p/ entrar (mem_grupo_pedidos)
    grupo-editar.tsx     # tela admin: edita info do grupo + upload de foto de capa (bucket 'grupos')
    notificacoes.tsx     # histórico de notificações (app_notificacoes) — tap navega pra tela origem
    configuracoes.tsx    # tema + tamanho da fonte + idioma + pagamento + notif + excluir conta
    batismo.tsx          # hub do meu batismo: countdown, check-in no dia, galeria de fotos
    culto-detalhe.tsx    # info de um culto específico (data, online, kids, mapa)
    sobre.tsx            # missão, contato, valores da jornada, NSM
components/
  inscricoes/FormScaffold.tsx  # layout comum dos formulários de inscrição
lib/
  inscricoes.ts        # criarInscricao(tipo, dados) -> grava em app_inscricoes
  useMembro.ts         # carrega dados do membro logado p/ pré-preencher
  wallet.ts            # baixa o .pkpass (API do ERP); iOS adiciona direto via PassKit (react-native-wallet-pass), Android compartilha
components/
  cartao/              # HoloTicket + HolographicCard (Skia) + useDeviceTilt (giroscópio) + AddToWalletButton (PKAddPassButton oficial)
  ui/                  # Button, Input, SocialButton, Checkbox, CodeInput, PhoneInput, ComingSoon
constants/
  countries.ts         # lista de países (bandeira via emoji + DDI) p/ o PhoneInput
lib/
  validators.ts        # máscaras/validações: CPF, data (DD/MM/AAAA)
contexts/
  AuthContext.tsx      # sessão e todos os métodos de auth
  ThemeContext.tsx     # tema claro/escuro (segue o sistema + override); useColors()/useTheme()
lib/
  supabase.ts          # cliente Supabase + storage híbrido (lembrar de mim)
constants/
  theme.ts             # cores, espaçamentos, tipografia
```

## ⚠️⚠️ A ROTINA DO BUILD DE LOJA · a catraca no `npm run ota` (03/09/2026)

O Marcos perguntou: *"criamos uma rotina para subir isso a cada quantas OTAs?"*

**Resposta curta: a unidade não é OTA.** Contar OTA mede VOLUME de publicação,
não DISTÂNCIA. Um OTA que troca uma string não envelhece o binário; um que
adiciona uma aba ou mexe no cadastro envelhece muito. As três réguas que valem:

1. **Mudança NATIVA pendente** — dependência, plugin, permissão, entitlement,
   `googleServicesFile`. O OTA não entrega isso **e tenta mesmo assim**: com
   `runtimeVersion.policy = appVersion` travado em 1.0.0, o manifesto serve o
   pacote novo a um binário que não tem aquele código nativo. Desfecho é
   **crash**, não desatualização. ⇒ **bloqueio, sozinho, sem olhar distância.**
2. **Distância do embutido** — dias e commits desde o binário publicado.
3. **Cadência de 2 semanas** — ancorada no ciclo de revisão da Apple; semanal
   viraria fila.

### Onde isso é cobrado

`scripts/ota.js` (o **único** caminho autorizado pra publicar OTA) ganhou a
**GUARDA 0**, antes de todas as outras: ela é a única guarda dali que fala do que
a pessoa que **BAIXA** o app recebe, e não do que quem já tem instalado recebe.

- **Régua pura** em `scripts/driftLoja.js` (`avaliarDrift` + `diffNativo`), com
  `scripts/driftLoja.d.ts` pra o `tsc` aceitar o import no teste. CJS de
  propósito: `ota.js` roda por `node` direto, sem bundler. **Não vive em `lib/`
  porque não é código de app** — iria pro bundle sem servir pra nada.
- **Limites:** avisa em **14 dias OU 30 commits**; bloqueia em **30 dias OU 60
  commits**, ou com mudança nativa pendente.
- **Escape hatch:** `CBRIO_OTA_EMBUTIDO_VELHO=1` (padrão do
  `CBRIO_OTA_SEM_PORTAO`). ⚠️ **Não é flag de argv** — tudo em `process.argv`
  vira a MENSAGEM do update.
- `npm run loja` imprime o relatório sem publicar nada.
- Teste: `test/driftLoja.test.ts` (21 casos) + **4 mutantes** em
  `scripts/mutantes.mjs`, todos mortos (75/75 no total).

### ⚠️⚠️ `loja-publicado.json` É O LEDGER — e atualizar é parte da release

Ele registra qual binário está **PUBLICADO** em cada loja, não o último build do
EAS. **Essa distinção é a causa raiz do incidente:** o iOS 41 e as vc 6 e 7
existiam no EAS enquanto as lojas serviam junho e julho, então "tem build
recente" nunca foi sinal de nada.

**Atualize o ledger no mesmo PR/commit em que uma release chegar à loja.** Como
conferir: iOS por `npx eas-cli submit:status -p ios` (linha `App Store Live`);
Android **só pelo Play Console** — o CLI não responde isso, porque a conta de
serviço `eas-submit@crm-cbrio` só tem "Release apps to testing tracks".

⚠️ `commit` é opcional: o iOS 33 foi compilado FORA do EAS (Xcode, 22/06) e não
tem registro de commit. Sem ele a catraca aproxima pelo último commit até
`publicado_em` — pior que o hash, muito melhor que não medir.

⚠️⚠️ **FAIL-OPEN é lei**, igual `lib/versaoApp.ts`: ledger ausente, commit fora
do clone, JSON ilegível ⇒ **avisa e deixa publicar**. Travar um hotfix por um
dado que não deu pra ler é o pior desfecho. Só bloqueia com fato na mão.

### Estado no dia em que isto entrou (o `npm run loja` real)

```
❌ IOS     build 33 · publicado em 2026-06-22 · 76 dias · 193 commits
❌ ANDROID versionCode 5 · publicado em 2026-07-24 · 41 dias · 168 commits
   ⚙ app.json · plugins mudou · android.googleServicesFile mudou
```

⇒ **A catraca BLOQUEIA OTA hoje**, e está certa: o `googleServicesFile` entrou
em **18/08** (#124) e a Play serve a vc 5 de 24/07 — é exatamente a origem do
`Default FirebaseApp is not initialized` que o recado do Matheus registra. Até a
vc 8 / build 42 chegarem às lojas **e o ledger ser atualizado**, publicar OTA
exige `CBRIO_OTA_EMBUTIDO_VELHO=1`.

## ⚠️⚠️ OTA · o iPhone RECEBE (provado 05/08) · e o ciclo de 2 aberturas engana quem testa

Duas coisas que este arquivo afirmava com dúvida, agora medidas — o gatilho foi o
Pedro Paiva (líder de marketing, iOS) baixar o app pra dar opinião:

- ✅ **iOS recebe OTA.** Evidência: `app_eventos` tem evento de **iPhone (iOS 27,
  `device_model: "phone"`) com os campos novos** (`session_id`/`installation_id`/
  `occurred_at`, que só existem no bundle de 05/08) a partir das **15:10**. Some
  a dúvida do bloco "NÃO DÁ PRA AFIRMAR PELO EAS…" acima: **dá, e a resposta é
  sim** — o binário da loja está com `expo-updates` no canal `production`,
  runtime 1.0.0. (A pista do EAS enganava porque os builds recentes saíram FORA
  dele.)
- ⚠️ **Mas o ciclo é de 2 aberturas** (a 1ª baixa, a 2ª aplica) e **nada na tela
  avisa**. O Pedro abriu uma vez e viu **a versão de ontem** — e concluiu, com
  razão, que o app estava daquele jeito. Medido no mesmo instante: 1 iPhone no
  bundle novo e 2 no antigo.
### ✅ PORTÃO DE ATUALIZAÇÃO OBRIGATÓRIO (`components/app/PortaoAtualizacao.tsx`)

Decisão dele ao ver o caso do Pedro: *"coloca essa questão de aviso, mas não de
opção de recusar, não queremos pessoas usando código antigo, isso quebra o
sistema, se não atualizar não usa"*. Montado **acima de tudo** no
`app/_layout.tsx` — **fora do `AuthProvider`**, então nem dá pra logar com bundle
velho.

- ⚠️⚠️ **Só bloqueia com `isUpdatePending`** (o bundle JÁ está no aparelho e
  aplicar é instantâneo). Bloquear em `isUpdateAvailable` (existe no servidor,
  ainda não baixou) trancaria fora quem está com internet ruim — e o app funciona
  offline hoje. É a diferença entre "obrigatório" e "inutilizável".
- ⚠️ **Cobra no cold start e na volta do background**, não no instante em que o
  download termina: `isUpdatePending` vira true em background e interromperia a
  pessoa **no meio do `/completar-cadastro`** (que também é obrigatório),
  apagando o que ela digitou. Não é escape — não existe botão "depois" e não se
  atravessa um ciclo de background com bundle velho.
- ⚠️ Se `reloadAsync` falhar, o botão vira **"Tentar de novo"** (mesma ação). Sem
  saída lateral, mas sem beco sem saída.
- ⚠️ **No-op quando `Updates.isEnabled` é false** (dev/Expo Go) — lá `reloadAsync`
  nem existe.
- ⚠️ **O portão só começa a valer do PRÓXIMO update em diante**: quem está no
  bundle de hoje recebe este código primeiro; a tela aparece na atualização
  seguinte.

### ⚠️ Login com Google pessoal × conta institucional (caso Pedro · 05/08)

Ele relatou que **"não pediu complemento de cadastro"**. Duas causas somadas, e a
2ª só apareceu porque medi em vez de supor:

1. **Bundle antigo** → o `CadastroGate` (que saiu hoje) não existe nele. O
   servidor respondia `completo=false`; não havia quem perguntasse.
2. **Ele entrou com o Google PESSOAL** (`…04@gmail.com`), não com
   `pedro.paiva@cbrio.org`. E o gatilho de `auth.users` **fez o certo**: o
   matcher canônico achou por e-mail + nome compatível o cadastro que já existia
   dele (importado do Next em 13/05, status `visitante`, com telefone) e
   **ligou — não criou duplicata**. É validação real da lei do gatilho.
3. ⚠️ Sobra o par **"Pedro Martins Paiva" (Gmail) × "Pedro Paiva" (institucional,
   `membro_ativo`, sem CPF)**, que **já aparece na fila de Possíveis duplicidades**
   (`incluir: true`, prioridade média). Resolver é 1 clique em /entradas — não é
   furo, é a fila funcionando.

⇒ Quando o bundle novo aplicar no aparelho dele, a tela de completar cadastro
**vai** aparecer (falta CPF, nascimento e sexo no cadastro ligado).

### ⚠️⚠️ DADO HERDADO NÃO LIBERA O APP (decisão dele · 05/08 · migration `20260805150000`)

Ele foi direto ao ponto: *"qual CPF de Pedro Paiva que cadastrou no app? Data de
nascimento, Sexo? Só tem email e nome. Se ele pode preencher o cadastro, pra que
fundir automaticamente entende? O caso do app, mesmo que o sistema ache que
alguém é igual, NÃO deve liberar acesso; depois de preencher todos os dados aí sim
pode se ter 100% de certeza"*.

O furo: `/identidade/status` calculava o que "falta" **a partir do cadastro que o
vínculo encontrou**. Como o gatilho liga por e-mail + nome, quem caía num cadastro
já completo **entrava sem nunca ter provado nada**, herdando CPF/nascimento/sexo
de um import. **Medido antes de ligar: das 89 contas com cadastro vinculado, 9
passavam — TODAS as 9 por herança** (confirmações reais pelo app: **0**). Dois
casos não-staff eram gente que logou com Gmail e caiu num cadastro do
`grupos_import_2026`.

- **`profiles.app_ficha_confirmada_em`** é a marca. `completo` agora exige ficha
  fechada **E** confirmação por ESTA conta. ⚠️ Fica em `profiles` (a CONTA), não em
  `mem_membros`: duas contas ligadas ao mesmo cadastro herdariam a confirmação uma
  da outra — o mesmo furo por outro caminho.
- **O formulário não pré-preenche dado herdado**: enquanto o servidor não disser
  `pode_preencher_com_vinculo`, vem **só o nome** (que veio do provedor do login) e
  a pessoa digita telefone, nascimento, CPF e sexo. Pré-preencher seria fazê-la
  "confirmar" o que não forneceu. Depois de confirmar, o prefill volta (aí é ela
  editando a própria ficha). Erro de rede ⇒ **não pré-preenche** (na dúvida, digita).
- ⚠️ **FAIL OPEN quando a coluna não existe** (deploy em 2 etapas): pedir coluna
  inexistente faz o PostgREST recusar a query inteira, e tratar isso como "não
  confirmou" prenderia todo mundo na tela — **inclusive depois de preencher**,
  porque a gravação da marca falharia igual (loop sem saída). Sem a migration vale
  o comportamento antigo; com ela, o portão liga. Os dois lados degradam juntos.
- ⚠️ **O gatilho de `auth.users` NÃO foi alterado**: ele continua ligando por CPF
  (forte) e por e-mail+nome. Mudá-lo pra não ligar criaria duplicata em todo login
  e inundaria a fila. O que mudou é que **o vínculo deixou de ser prova de
  acesso** — e o par duplicado continua indo pra fila humana em /entradas, agora
  com CPF de verdade pra decidir, que é o que ele pediu.
- ⚠️ **Efeito conhecido e correto**: as 9 contas (incluindo Marcos, Natasha e
  Arthur) vão ver a tela de cadastro **uma vez**. É a régua dele aplicada a todo
  mundo, não regressão.

## Módulos

| Status | Módulo           | Descrição                                                        |
| :----: | ---------------- | ---------------------------------------------------------------- |
|   ✅   | **Autenticação** | Login/cadastro e-mail/senha, Google, Apple, "lembrar de mim", recuperação de senha (SMS pronto, desligado até ter remetente BR). **Desbloqueio por Face ID/Touch ID** (`lib/biometria.ts` + `components/auth/BiometriaLock.tsx`): trava 1x por abertura quando há sessão salva e a opção está ligada em Configurações → Segurança. |
|   ✅   | **Inscrições**   | Todos os formulários vão via `POST https://cbrio.org/api/app/inscricoes` (helper em `lib/api.ts`, fachada em `lib/inscricoes.ts`). Voluntariado puxa áreas dinâmicas de `GET /public/voluntariado/form-opcoes` (até 3 áreas, com Kids/Bridge exigindo CPF + nome da mãe). Grupos usa o mesmo endpoint com `tipo:"grupos"`. **Eventos publicados no sistema (espinha /inscricoes):** a aba lista os eventos abertos via `GET /app/eventos` (`buscarEventosAbertos` em `lib/api.ts`) numa seção "Eventos abertos" (card com capa/data/local/valor/sorteio); tocar chama `abrirInscricaoEvento(url)` (`lib/eventos.ts` · `WebBrowser.openBrowserAsync`) que abre o **form público** `cbrio.org/evento/<slug>` — mesmo fluxo do site, trata gratuito e **pago→checkout Asaas** (não reimplementamos contrato/PCI no app). **Push ao publicar:** quando a equipe publica um evento (transição p/ `status='publicado'` no `PUT /inscricoes/eventos/:id`), o backend faz broadcast via `appPush.notificarApp` (tipo `inscricao_evento`, `data.slug`); o tap (push ou lista `notificacoes.tsx`) abre o form via `notifTap`. |
|   🚧   | **Voluntariado** | Aba self-service: ver/confirmar **escalas** (`mem_escalas`) ✅. **Push** ao ser escalado: `lib/push.ts` salva token em `app_push_tokens`; Edge Function `supabase/functions/notify-escala` dispara (precisa EAS projectId + device físico + webhook). |
|   ✅   | **Notificações** | `app_notificacoes` (histórico in-app), helper `supabase/functions/_shared/notify.ts`, tela `notificacoes.tsx` com badge e marca-como-lida, `lib/notifTap.ts` roteia o tap (tipos: escala, sos, grupo_pedido, batismo, culto, next, devocional, cuidado, kids_vinculo→/kids). **⚠️ Push SEM DESTINO não navega mais (04/08/2026):** o `default` do
`notifTap` era `router.navigate("/notificacoes")`, então qualquer tipo sem
`case` (o `aniversario`, e os `inscricao_<tipo>` que a Edge Function de
confirmação manda: inscricao_grupos, inscricao_batismo…) **sequestrava a
abertura do app** e jogava a pessoa na lista em vez da tela certa. Agora
`inscricao_*` cai em `/inscricoes`, `next` vai pra `/next` (ia pra Home) e tipo
desconhecido **não navega** — o aviso já está no sino, com contador — e emite
`notif_tap_sem_destino` na telemetria pra a gente descobrir qual tipo apareceu
sem mapa. **⚠️ DEDUP QUE ATRAVESSA ABERTURAS:**
`clearLastNotificationResponseAsync()` só limpa uma variável em MEMÓRIA do
módulo nativo (`lastNotificationResponseBundle`, NotificationsEmitter.kt) —
processo novo = memória nova, e o Android remonta a "última resposta" do intent
que abriu a Activity. Por isso a marca é PERSISTIDA em AsyncStorage
(`cbrio:notif_tap_ultima`, chave = `date`+`identifier`, replay se qualquer um
casar). **⚠️ Cold start CONSOME a resposta (04/08/2026):** `getLastNotificationResponseAsync` no Android devolve a MESMA resposta a cada recriação da Activity (inclusive pós-crash) — sem o `clearLastNotificationResponseAsync()` + dedup por identifier, o app reabria SEMPRE na tela da última push e o usuário ficava preso (caso "preso em Notificações" do Xiaomi; só apagar dados resolvia). O voltar de `notificacoes.tsx` tem fallback `canGoBack() ? back() : replace("/")` pro caso de ela ser a primeira rota. **Push funcionando ponta a ponta** (validado 12/06: triggers SQL de `webhooks_app.sql` aplicados, pg_net ativo, tokens em `app_push_tokens`). **Vínculo Kids (14/06):** trigger `kids_vinculo_notify` (AFTER UPDATE de `kids_vinculo_solicitacoes` p/ status aprovado/rejeitado) → Edge Function `notify-kids-vinculo` avisa o responsável do resultado. **Lembretes agendados** via pg_cron (a cada min) → Edge Function `notify-lembretes` (`supabase/lembretes.sql`): batismo (véspera 18h + dia 8h), NEXT (véspera 18h), culto online (5 min antes, broadcast). Dedup em `app_lembretes_enviados`. |
|   🚧   | **Cuidados**     | Pedido de oração + aconselhamento (grava em `app_inscricoes`) e **SOS** (CVV 188/192 na hora + alerta push aos pastores via Edge Function `notify-cuidado-sos`). |
|   ✅   | **Devocional**   | ⚠️ **Desde 23/09/2026 é uma CASA de 5 portas — ver a seção no topo deste arquivo.** O que segue descreve o diário (`devocional-diario.tsx`, ex-`devocional.tsx`): devocionais de **seg a sex** dos planos ativos do sistema (lê `devocional_itens`+`devocional_planos` direto, RLS liberada p/ authenticated). Check-in grava em `mem_devocionais` (tipo pessoal, upsert por membro+data — **é a tabela que alimenta os KPIs** do valor Investir). Incentivo: streak de dias úteis (`lib/devocional.ts`), bolhas da semana, haptic + push lembrete 7h30 (seg–sex, só quem não leu — `notify-lembretes`). Conteúdo é criado no SISTEMA (Cuidados → planos, manual ou IA). |
|   ✅   | **Check-in Kids** | Tela `kids.tsx` (⚠️ desde 05/08/2026 chega-se por **Minha família** — o item solto saiu do menu — e pelo atalho da Home): **pré-check-in** dos filhos. Lê `GET /app/kids/meus-filhos` (crianças de quem o membro é responsável `autorizado_buscar`), o membro marca quem vai e gera código/QR via `POST /app/kids/pre-checkin` (válido 12h, 1 ativo por responsável). QR = `react-native-qrcode-svg` com o código de 6 chars. No totem (sistema), o voluntário escaneia/digita, confere e imprime. **Sem checkout remoto** — entrada/retirada continuam presenciais (decisão de segurança das crianças). **Solicitar vínculo** (`kids-solicitar-vinculo.tsx`): quem não tem filho vinculado pede o vínculo enviando documentos (criança + pai e/ou mãe) — **foto** (`expo-image-picker` câmera/galeria) **ou arquivo PDF** (`expo-document-picker` · ⚠️ módulo NATIVO → só funciona a partir do **build 21**; no build 20 o app cai num aviso "atualize o app"). Upload direto pro bucket **privado** `kids-documentos` (path `{user.id}/...`, helper `uploadDoc` infere ext/contentType) e `POST /app/kids/solicitar-vinculo` manda só os paths; a equipe Kids confere e aprova. Status (em análise/recusada) aparece na própria tela (`GET /app/kids/minhas-solicitacoes`) e via push (`notify-kids-vinculo`). **Foto da criança (opcional · ECA/LGPD):** na tela do filho (`kids-filho.tsx`) o responsável autorizado pode adicionar a foto da criança com **consentimento explícito** (bloco com texto ECA Lei 8.069/90 arts. 17/18 + LGPD Lei 13.709/18 art. 14 + checkbox · versão `eca-lgpd-v1`). Upload pro bucket **privado** `kids-documentos` (`{user.id}/foto-crianca/...`) → `POST /app/kids/filho/:id/foto` (exige `consentimento:true`); a foto só é exibida (signed URL) com consentimento, a responsável + equipe Kids. **Revogável**: `POST /app/kids/filho/:id/foto/remover` apaga a foto e limpa o consentimento. |
|   ✅   | **Pregações**    | Tela `videos.tsx` (`/videos` · atalho na Home + item "Pregações" no Menu): vídeos recentes + séries do YouTube (módulo Online do sistema) + **Assistir ao vivo**. Lê `GET /api/app/videos` (30 vídeos `online_videos` + 20 séries `online_series` + `canal_live`). Tap no vídeo → `Linking.openURL` `youtube.com/watch?v=ID`; série → playlist; ao vivo → `channel/<id>/live`. `trackEvento` em cada abertura. Fase 5 (Transmissão/Séries). |
|   ✅   | **Meu discipulado** | Tela `jornada.tsx` (Sua jornada) ganhou o **placar X/5 valores** (bolinhas) + banner **"Seu próximo passo"** (1º valor não vivido → ação). Tudo client-side sobre os dados já carregados. |
|   ✅   | **Modo Culto**   | Tela `modo-culto.tsx` (`/modo-culto`): **Assistir ao vivo** (canal YouTube), **decisão de fé** (tipo + presencial/online + recado → `POST /app/culto/decisao` → **fila de revisão da Integração**, NUNCA entra direto na NSM) e **anotações da pregação** (locais no aparelho via AsyncStorage). **⚠️ Só se chega nela pelo card VERMELHO de "Estamos ao vivo" no topo da Home** (04/08/2026 · pedido do Marcos: saiu do menu e do atalho fixo, porque fora do culto a tela não tem propósito). O card aparece com `ao_vivo` de `GET /app/culto/agora` (`cultoAoVivo()` em `lib/cultos.ts` · **sem cache**, é o dado mais perecível da tela; recarrega ao focar). Backend: `ao_vivo` = existe culto cuja janela [hora−30min, hora+3h] contém o agora, com o dia em **BRT** e valendo o culto **mais recente que começou** — antes o endpoint devolvia a maior hora do dia em UTC (decisão das 08:30 ia pro culto das 19:00, e das 21h em diante o dia já era o seguinte). |
|   ✅   | **Minha família** | Tela `familia.tsx` (Menu → Minha família): mostra a família (household + parentescos via `GET /app/familia`), **convida um familiar** escolhendo o parentesco (`POST /app/familia/convite` → gera código + link → `Share`), e **aceita convite por código** (`POST /app/familia/aceitar`). Ao aceitar, a pessoa entra na MESMA família do convidador e ganha o vínculo de parentesco — reflete direto na Membresia do sistema (`mem_membros.familia_id` + `mem_vinculos_familiares`). Remover da família = `DELETE /app/familia/vinculo/:outroId` (a pessoa continua no sistema). **Deep link** `cbrio://familia?codigo=XXX` (do link web `cbrio.org/f/a/<codigo>`) pré-preenche o código. Aceite exige login (vincula dois cadastros reais). |
|   ⬜   | _Próximos_       | A definir, construídos um a um (Fase 6: Generosidade recorrência) |

## Performance / carga no Supabase

Otimizações pra aguentar picos (muita gente abrindo no culto). Tudo no app:

- **Dados do membro = contexto global.** `contexts/MembroContext.tsx`
  (`MembroProvider` montado em `app/(app)/_layout.tsx`) carrega
  profiles + mem_membros (+ mem_voluntarios) **uma vez por sessão** e
  compartilha. Antes, `useMembro` refazia tudo ao focar cada uma das ~12
  telas. `lib/useMembro.ts` virou só re-export do contexto (interface
  intacta: `{ membro, loading, reload }`). `reload()` é chamado nos pontos de
  mutação (perfil: salvar + upload de foto + `app_salvar_membro`). Recarrega
  ao voltar do background se passou > 5 min. Limpa na troca de usuário.
- **Polling 120s + ciente de foco.** Badge de notificações
  (`useNotificacoesNaoLidas`) e NEXT (`useNextSync`) usam 120s (era 30s) e
  **pausam em background** (AppState), retomando + recarregando ao voltar pra
  `active`. Voluntariado (`useVoluntariadoSync`) **não faz mais polling** — o
  canal realtime de `vol_inscricoes` já cobre; mantém focus + foreground +
  realtime.
- **Cache local da Home.** `lib/cache.ts` (`cacheSWR`, AsyncStorage + TTL,
  stale-while-revalidate). `destaquesAtivos()` e `proximosCultos()` (iguais
  entre usuários) servem do cache na hora e revalidam em background; TTL 10
  min; offline serve stale; pull-to-refresh passa `forcar` e ignora o cache.
  `limparCache()` roda no signOut.

## Como rodar

```bash
npm install
cp .env.example .env   # preencher credenciais do Supabase
npm start              # "a" = Android, "i" = iOS
```

## Identidade visual (marca CBRio)

Paleta oficial (em `constants/theme.ts` → `brand`):

| Cor       | Hex       | Uso                                  |
| --------- | --------- | ------------------------------------ |
| Principal | `#408097` | marca, botões primários, logo        |
| Teal médio| `#70a8b0` | links, ícones, destaques secundários |
| Azul claro| `#d5e4e6` | logo sobre fundo escuro, realces      |
| Areia     | `#eae3da` | superfícies claras / off-white        |

Fundo do app: teal escuro `#0B1F26` (mantém o visual "glass" alinhado à marca).

**Logos:** arte **oficial** em `assets/images/` (ver `assets/images/README.md`):
`cbrio-heart.png` (coração teal), `cbrio-vertical-light.png` (logo clara),
`cbrio-vertical.png`, `cbrio-wordmark.png`. O ícone do app (`app-icon.png`) e a
splash nativa (`splash.png`) são compostos com `sharp` e referenciados no
`app.json`.

- **Componente** `components/brand/CbrioHeart.tsx`: renderiza `cbrio-heart.png`
  via `Image` (prop `size`; prop `color` = `tintColor` para recolorir).
- **Splash / carregamento** (`components/brand/SplashPulse.tsx`): logo clara da
  CBRio **pulsando** (scale + opacity em loop) sobre o fundo teal escuro,
  enquanto a sessão é restaurada. Usado em `app/_layout.tsx`.
- **Header dos formulários** (login, cadastro, etc.): coração dentro de um
  círculo "glass".

## Convenções

- **i18n (pt-BR / en / es):** `lib/i18n.ts` expõe `TranslationProvider`
  (montado no `app/_layout.tsx`, re-renderiza ao trocar idioma), `useT()`
  (`const t = useT(); t("texto PT")`) e `useLang()`. A **CHAVE de tradução é a
  string em português** — `lib/translations.ts` mapeia PT → {en, es}. Falta de
  tradução cai no PT (nunca quebra). Ao criar texto novo, envolva com `t("...")`
  e adicione a entrada PT→en/es em `translations.ts`. Idioma escolhido em
  Configurações → Idioma (pt/en/es habilitados; demais "em breve"); detecta o
  idioma do aparelho na 1ª vez; persiste em AsyncStorage. Strings de UI seguem
  escritas em **português** no código (são as chaves).
- Identidade visual: tema escuro teal (`#0B1F26`), card, botões arredondados
  (pill), cor primária `#408097`.
- Sempre que um módulo for adicionado/alterado, atualizar a tabela de Módulos
  e os detalhes correspondentes aqui.
```
