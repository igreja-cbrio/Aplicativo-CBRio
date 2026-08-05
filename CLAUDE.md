# CLAUDE.md — Memória do projeto CBRio

> **Regra permanente:** mantenha este arquivo sempre atualizado a cada mudança
> relevante (novo módulo, dependência, decisão de arquitetura, config de
> backend). Ele é a memória e o contexto contínuo do app.

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
  ⚠️ `.env` local serve pro dev (`expo start`) e `.env.example` está
  DESATUALIZADO (aponta pro projeto Supabase inicial `otzemqml…`).
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

## ⚠️ Varredura app × ERP · o que estava desalinhado (2026-08-05)

Pedido do Marcos ("avalie todos as variáveis e tabelas dentro do nosso sistema
mobile"). O padrão de TODOS os achados é o mesmo: **o app reproduz a régua do ERP
em vez de consumi-la**, e quando a régua muda de um lado o outro não sabe.
**LEI: quem decide o que é "válido" é o BACKEND.** O app lê tabela direto pelo que
é dado DELE (perfil, devocional, cartão); régua de negócio — o que está aberto,
quem pode se inscrever, qual status vale — vem de endpoint.

- **NEXT (o caso que ele reportou)** · conserto no BACKEND (PR #2288 do sistema):
  `/next/me`, `/next/inscrever` e `/next/encontros/:id/checkin` liam
  `next_eventos`/`next_inscricoes`, a camada aposentada no cutover de turmas
  (17/06). Medido: 8 eventos 'agendado' com data máxima **21/06** contra **2
  turmas abertas** com encontros em 09, 16 e 23/08 — daí o "não há encontros do
  NEXT agendados". O app **não mudou** (o contrato da resposta foi preservado);
  `lib/api.ts` só ganhou os campos novos `turma_id`/`turma_nome`/`horario`.
- **`"recusado"` NUNCA EXISTIU** (`grupo-detalhe.tsx`): o CHECK do banco é
  `pendente|aprovado|rejeitado|devolvido|encaminhado`, e a tela decidia com
  `status !== "recusado"` → quem levava recusa ficava em "aguardando aprovação"
  **pra sempre**, em qualquer grupo (20 pedidos vivos · 14 pessoas · 1 com conta
  no app). Agora a lista de status que vale está explícita e comentada.
- **Filtros que a RLS NÃO cobre** · `mem_grupos` é `FOR SELECT USING (true)`
  (catálogo): sem `deleted_at`/`ativo`, **137 grupos apagados + 38 desativados**
  abriam por deep link com botão "Quero participar". Idem `deleted_at` em
  `mem_contribuicoes` (comprovante de IR) e `vol_inscricoes` (soft-delete
  liberado em 28/07) — hoje 0 apagadas nas duas, então é **gatilho armado**, e o
  filtro é o que impede o dia em que houver.
- **Dia em UTC** (`lib/cultos.ts`): `toISOString()` sobre o agora dá o dia UTC, e
  das 21h BRT em diante ele já virou → **o culto de quarta (20h) saía de "próximos
  cultos" durante o próprio culto**. Toda data de operação da igreja é BRT.
- **Portas de inscrição: o app tinha 4, o sistema tem 7.** Entrou **Apresentação
  de crianças** como porta WEB (abre `cbrio.org/apresentacao-criancas` no
  navegador in-app, como os "Eventos abertos"): a porta exige dado de CRIANÇA e
  consentimento de MENOR (art. 14 §1º) com snapshot do texto, e reimplementar
  seria um 2º caminho de escrita de pessoa — o que o Contrato de porta existe pra
  impedir. Líderes/anfitriões e o totem de bebês seguem fora (são de gestão).
- ✅ **Alarmes que NÃO se sustentaram** (registro proposital): `app_destaques`
  parece ignorar `ativo`/janela mas a **RLS filtra** (`supabase/destaques.sql`);
  e o `sexo` do cadastro **não** é descartado — o backend grava `mem_membros.genero`
  desde hoje mais cedo. Ia "consertar" o que funciona nos dois casos.

⚠️ **O SCHEMA DO APP VIVE NESTE REPO** (`supabase/*.sql`), não nas migrations do
ERP: `app_destaques`, `app_notificacoes`, `app_push_tokens`,
`app_grupos_temporada`, `app_solicitacoes_exclusao`, `handle_new_user_membro`.
É por isso que a lei do gatilho de `auth.users` no CLAUDE.md do sistema registrou
"nunca foi commitado" — não estava lá; está aqui.

### Rodada 2 · fechamento (mesmo dia · "corrigir todos esses achados")

- **BOTÃO FÍSICO DO ANDROID = a mesma árvore da seta** (`BackHandler` em
  `(app)/_layout.tsx` · pedido dele: "faça o botao fisico ser igual ao da seta").
  ⚠️ Na **Home** e em **`/completar-cadastro`** ele NÃO intercepta: engolir o back
  na raiz é como se faz um app que não fecha (a Play Store reclama), e sair do
  cadastro por gesto cai em loop com o `CadastroGate`. ⚠️ `Modal` do react-native
  (6 telas, todas com `onRequestClose`) trata o back no próprio diálogo nativo e
  não chega no handler — modal aberto fecha o modal, como antes.
- **`lib/volStatus.ts` = régua ÚNICA do voluntariado.** O ERP tem **7** status
  (`VolInscricoes.tsx` é a fonte) e o app tratava 3. Medido: `integrado` 575 ·
  `inscrito` 80 · `enviado_ministerio` 68 · **`nao_responde` 69 ·
  `nao_pode_ou_duplicata` 19 · `kids` 3**. A divergência aparecia na MESMA
  abertura: o hub dizia "Pendente" (`!== 'integrado'`) e a tela de Servir mostrava
  o FORMULÁRIO (status fora dos 3 caíam no `else`). Agora: `integrado`/`kids` =
  ativo · `inscrito`/`enviado_ministerio` = pendente · `nao_responde`/
  `nao_pode_ou_duplicata`/`desistente` = **nenhum** com aviso "sua inscrição
  anterior foi encerrada" (o dedup do backend permite re-inscrição). ⚠️ Status
  novo no ERP entra SÓ nesse arquivo; desconhecido vira "nenhum" (deixa a pessoa
  agir) e nunca "pendente" (fila que ninguém trata).
- **+11 leituras ganharam `deleted_at`** (`mem_membros` ×5, `mem_devocionais` ×4,
  `mem_grupos` ×2, `cultos`) — a RLS não filtra nada disso. ⚠️ No `grupo-editar`
  entrou só `deleted_at`, **não** `ativo`: o líder precisa poder editar grupo
  pausado; quem trava a inscrição é a face pública (`/grupo-detalhe`).
- **`lib/dataBRT.ts`** centraliza o dia da igreja (espelho do `hojeBRT()` do
  backend): a lista de cultos, a **chave de cache** dela e o filtro de
  indisponibilidade do voluntariado estavam em UTC. ⚠️ O check-in do devocional
  segue em hora do APARELHO de propósito — o "hoje" de quem lê é o do lugar onde
  a pessoa está; BRT é pra AGENDA (culto, escala, encontro).
- **No servidor** (PR #2290 do sistema): `resolveMembroApp` passou a filtrar
  soft-delete no caminho do profile (cadastro apagado servia o app inteiro — 3
  contas do app foram soft-deletadas em 04/08) e `POST /app/inscricoes` com
  `tipo:'next'` parou de dizer "enviado" sem inscrever ninguém.

**Auditoria automática que PASSOU** (registro pra não refazer): rodei as **38
consultas literais do app contra o schema de produção** — **0 erros de coluna**.
Isso importa porque select nomeando coluna inexistente faz o PostgREST recusar a
query INTEIRA e o app trata como "vazio" (a armadilha do `parcelas_max`).
Conferido também: `kids_vinculo_solicitacoes` usa
`pendente|aprovado|rejeitado|cancelado` e o app compara os certos.

## ⚠️ EVENTOS no app · inscrição por dentro, sem link externo (2026-08-05)

Pedido do Marcos: *"ao clicar em inscrições, aparecem todos os eventos da igreja,
com um seletor de todos os eventos e eventos inscritos; nessa aba, ao clicar deve
aparecer minha inscrição naquele evento — e eu quero que os outros eventos tenham
inscrições PELO APP também, sem link externo como é o caso do celebra."*

- **Seletor `Todos | Meus eventos`** na aba Inscrições (`inscricoes.tsx`) — NÃO é
  aba nova, é recorte da mesma lista. "Meus" vem de `GET /app/eventos/minhas`
  (tabela `inscricoes`), que é o que traz o estado REAL da pessoa.
- **Tela `/evento?id=`** (`evento.tsx`) faz os dois papéis: **já inscrita** → a
  inscrição dela (estado, número da sorte, **QR do comprovante**, "Pagar agora"
  quando pendente, respostas); **não inscrita** → o **formulário dentro do app**.
- ⚠️⚠️ **O FORMULÁRIO NÃO REPETE A RÉGUA DO SERVIDOR.** O
  `POST /app/eventos/:id/inscrever` executa a MESMA função da porta pública
  (`inscreverEspinha`) — contrato de campos, benefício por CPF, vaga atômica,
  consentimento e cobrança idênticos. Aqui só **pré-preenchemos** (a ficha do
  cadastro, via `SeusDados`), pedimos os campos **EXTRA** do form-builder e
  exibimos o erro que o servidor devolver.
- ⚠️ **PAGAMENTO continua na página hospedada** (`/pagamento/<token>`): é onde
  vivem Pix/boleto/cartão e o escopo PCI — dado de cartão nunca entra no app.
- ⚠️ **Evento com campo `imagem` cai no form público** (o app não sobe arquivo pro
  pipeline daquele formulário): melhor mandar pro caminho que funciona do que
  mostrar um campo que não envia. Caso real: "Patrocinadores - Celebra 2026".
- ⚠️ **Ficha incompleta não tenta inscrever**: o contrato exige CPF, nascimento e
  sexo; sem isso o servidor recusaria. A tela leva pro cadastro.
- ⚠️ `MembroBasico` ganhou **`genero`** — `validarCamposPadrao` exige sexo
  (`exigirSexo` é true por padrão), e sem esse campo o app pediria de novo algo
  que a ficha já tem (ou levaria 400 do servidor).
- ⚠️ A resposta do servidor tem **`pagamento` BOOLEAN**, não objeto: o link do
  pagamento se monta do `public_token` (`urlPagamentoDaResposta` em `lib/api.ts`).
  Eu havia tipado como objeto e a tela nunca acharia o link.

## ⚠️ O que o WEB muda aparece no app (e quando) · 2026-08-05

**É o MESMO banco** (projeto Supabase `hhntwfawfnxvuobhdfkb` nos dois) — não existe
sincronização. O que separa "mudou no web" de "apareceu no app" é: **(1) quando a
tela recarrega · (2) se a régua bate nos dois lados · (3) se o app tem onde
mostrar**.

- **Recarregar ao FOCAR passou de 16 pra 22 telas** — entraram batismo,
  grupo-detalhe (a aprovação do pedido acontece no web!), buscador de grupos
  (grupo criado/desativado lá), devocional, culto-detalhe e escala do supervisor.
  ⚠️ **Formulário NÃO recarrega ao focar** (perfil, grupo-editar,
  completar-cadastro): refetch em cima do que a pessoa está digitando é pior que
  dado velho.
- **Realtime existe em UMA tabela**: `vol_inscricoes` (`useVoluntariadoSync`) —
  aceitar um voluntário no web aparece em segundos.
- **Cache**: só destaques da Home e próximos cultos (SWR 10 min). Dado da pessoa
  fica em contexto por sessão e revalida ao voltar do background se passou de 5 min.
- **`useAdminGrupo` parou de decidir por `profiles.role`** (esquema APOSENTADO) —
  agora pergunta ao servidor (`GET /app/grupos/papel`, que calcula pela matriz +
  boost de área). Quem tem grupos ≥ 3 pela matriz editava no web e **não** no app.
  Falha de rede é **fail-closed** (não concede permissão).

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
  co-líder), transferir, registrar saída.
  ⚠️ **`líder` NÃO está na lista** e quem é `lider_id` **não tem menu**: esse
  campo decide quem recebe o WhatsApp do grupo (lei de 31/07). A tela diz isso.
- **Frequência**: chamada começa com **todos marcados** (o líder desmarca quem
  faltou — muito menos toque) + tema + **comentário do líder** + histórico. Usa a
  RPC canônica no servidor. E o **"Preciso de ajuda"** manda pra coordenação
  (notificação + push · não é ticket com "resolvido", e a tela não promete isso).
- **Transferência** é PEDIDO no grupo de destino, não mudança direta; só oferece
  grupos que o próprio líder gerencia; a saída é passo separado.
- **Estudos**: materiais do grupo + os gerais, com selo de "Estudo da semana".
- ⚠️ Cada aba puxa o SEU dado só quando abre (4 fontes; carregar tudo no mount
  deixaria o líder esperando pelo que não vai olhar).
- ⚠️ `GrupoMembro` ganhou **`membro_id`** (id da PESSOA) além do `id` (id da
  LINHA do roster): a chamada de frequência manda ids de pessoa pra RPC, e as
  ações usam o id da linha. Confundir os dois quebra as duas coisas.

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
|   ✅   | **Devocional**   | Tela `devocional.tsx` (atalho na Home): devocionais de **seg a sex** dos planos ativos do sistema (lê `devocional_itens`+`devocional_planos` direto, RLS liberada p/ authenticated). Check-in grava em `mem_devocionais` (tipo pessoal, upsert por membro+data — **é a tabela que alimenta os KPIs** do valor Investir). Incentivo: streak de dias úteis (`lib/devocional.ts`), bolhas da semana, haptic + push lembrete 7h30 (seg–sex, só quem não leu — `notify-lembretes`). Conteúdo é criado no SISTEMA (Cuidados → planos, manual ou IA). |
|   ✅   | **Check-in Kids** | Tela `kids.tsx` (⚠️ desde 05/08/2026 chega-se por **Minha família** — o item solto saiu do menu — e pelo atalho da Home): **pré-check-in** dos filhos. Lê `GET /app/kids/meus-filhos` (crianças de quem o membro é responsável `autorizado_buscar`), o membro marca quem vai e gera código/QR via `POST /app/kids/pre-checkin` (válido 12h, 1 ativo por responsável). QR = `react-native-qrcode-svg` com o código de 6 chars. No totem (sistema), o voluntário escaneia/digita, confere e imprime. **Sem checkout remoto** — entrada/retirada continuam presenciais (decisão de segurança das crianças). **Solicitar vínculo** (`kids-solicitar-vinculo.tsx`): quem não tem filho vinculado pede o vínculo enviando documentos (criança + pai e/ou mãe) — **foto** (`expo-image-picker` câmera/galeria) **ou arquivo PDF** (`expo-document-picker` · ⚠️ módulo NATIVO → só funciona a partir do **build 21**; no build 20 o app cai num aviso "atualize o app"). Upload direto pro bucket **privado** `kids-documentos` (path `{user.id}/...`, helper `uploadDoc` infere ext/contentType) e `POST /app/kids/solicitar-vinculo` manda só os paths; a equipe Kids confere e aprova. Status (em análise/recusada) aparece na própria tela (`GET /app/kids/minhas-solicitacoes`) e via push (`notify-kids-vinculo`). **Foto da criança (opcional · ECA/LGPD):** na tela do filho (`kids-filho.tsx`) o responsável autorizado pode adicionar a foto da criança com **consentimento explícito** (bloco com texto ECA Lei 8.069/90 arts. 17/18 + LGPD Lei 13.709/18 art. 14 + checkbox · versão `eca-lgpd-v1`). Upload pro bucket **privado** `kids-documentos` (`{user.id}/foto-crianca/...`) → `POST /app/kids/filho/:id/foto` (exige `consentimento:true`); a foto só é exibida (signed URL) com consentimento, a responsável + equipe Kids. **Revogável**: `POST /app/kids/filho/:id/foto/remover` apaga a foto e limpa o consentimento. |
|   ✅   | **Pregações**    | Tela `videos.tsx` (`/videos` · atalho na Home + item "Pregações" no Menu): vídeos recentes + séries do YouTube (módulo Online do sistema) + **Assistir ao vivo**. Lê `GET /api/app/videos` (30 vídeos `online_videos` + 20 séries `online_series` + `canal_live`). Tap no vídeo → `Linking.openURL` `youtube.com/watch?v=ID`; série → playlist; ao vivo → `channel/<id>/live`. `trackEvento` em cada abertura. Fase 5 (Transmissão/Séries). |
|   ✅   | **Meu discipulado** | Tela `jornada.tsx` (Sua jornada) ganhou o **placar X/5 valores** (bolinhas) + banner **"Seu próximo passo"** (1º valor não vivido → ação). Tudo client-side sobre os dados já carregados. |
|   ✅   | **Modo Culto**   | Tela `modo-culto.tsx` (`/modo-culto`): **Assistir ao vivo** (canal YouTube), **decisão de fé** (tipo + presencial/online + recado → `POST /app/culto/decisao` → **fila de revisão da Integração**, NUNCA entra direto na NSM) e **anotações da pregação** (locais no aparelho via AsyncStorage). **⚠️ Só se chega nela pelo card VERMELHO de "Estamos ao vivo" no topo da Home** (04/08/2026 · pedido do Marcos: saiu do menu e do atalho fixo, porque fora do culto a tela não tem propósito). O card aparece com `ao_vivo` de `GET /app/culto/agora` (`cultoAoVivo()` em `lib/cultos.ts` · **sem cache**, é o dado mais perecível da tela; recarrega ao focar). Backend: `ao_vivo` = existe culto cuja janela [hora−30min, hora+3h] contém o agora, com o dia em **BRT** e valendo o culto **mais recente que começou** — antes o endpoint devolvia a maior hora do dia em UTC (decisão das 08:30 ia pro culto das 19:00, e das 21h em diante o dia já era o seguinte). |
|   ✅   | **Minha família** | Tela `familia.tsx` (Menu → Minha família): mostra a família (household + parentescos via `GET /app/familia`), **convida um familiar** escolhendo o parentesco (`POST /app/familia/convite` → gera código + link → `Share`), e **aceita convite por código** (`POST /app/familia/aceitar`). Ao aceitar, a pessoa entra na MESMA família do convidador e ganha o vínculo de parentesco — reflete direto na Membresia do sistema (`mem_membros.familia_id` + `mem_vinculos_familiares`). Remover da família = `DELETE /app/familia/vinculo/:outroId` (a pessoa continua no sistema). **Deep link** `cbrio://familia?codigo=XXX` (do link web `cbrio.org/f/a/<codigo>`) pré-preenche o código. Aceite exige login (vincula dois cadastros reais). |
|   ⬜   | _Próximos_       | A definir, construídos um a um (Fase 6: Generosidade recorrência) |

## Generosidade — notas de implementação

**⚠️ NAO existe tela de PIX no app — e nao recriar sem forma aprovada
(05/08/2026):** por algumas horas a rota `/generosidade` mostrou uma tela so com
a chave PIX da igreja. Foi **RETIRADA no mesmo dia**, por decisao do Marcos, ao
saber que exibir chave de doacao e exatamente o que a guideline **3.2.2(iv)** da
App Store proibe — o mesmo motivo que tirou o modulo de doacoes da submissao em
out/2026, e sair por OTA nao torna a regra menos valida ("nao queremos correr o
risco disso sair do ar; vamos pensar em uma forma de fazer isso posteriormente").
A rota voltou a `<Redirect href="/" />` enquanto `FEATURES.generosidade` e false,
e o item saiu do menu.
- ⚠️ **`constants/pix.ts` ganhou `CNPJ_IGREJA`**: o comprovante anual de doacoes
  imprime "CNPJ …" e estava lendo `PIX_KEY_FORMATADA`. Quando a chave virou
  e-mail, o comprovante passou a dizer **"CNPJ pix@cbrio.com.br"**. Dado fiscal
  nao empresta constante de outro assunto.
- `PIX_KEY` guarda a chave atual e **nao e exibida em lugar nenhum** — o unico
  leitor e o modulo desligado.

- **⚠️ Menu enxuto (04-05/08/2026 · pedido do Marcos):** o menu é o que **NÃO**
  está na barra de baixo nem na faixa de cima. 4 seções — **Você** (Meu perfil ·
  Minha família · Sua jornada) · **Participar** (Inscrições ·
  **Meu grupo** · **Batismo** · NEXT) · Conteúdo (Pregações) · Ajustes
  (Configurações) + Sair.
  Arrumação de 05/08: **Batismo desceu** pra Participar (é inscrição, não dado
  seu) · **Check-in Kids saiu do menu** e virou cartão dentro de **Minha
  família** (quem faz check-in é o responsável, na tela onde ele cuida da
  família) · **Generosidade** entrou em Você e fecha os 4 · **"Inscrições do meu
  grupo" virou "Meu grupo"** apontando pra MESMA tela da barra (`/meu-grupo`) —
  era isso que fazia "grupos" no menu e "Grupos" na barra abrirem coisas
  diferentes; a fila de quem lidera já é cartão lá dentro, então o menu não
  consulta mais `getGrupoPapel()`. **Saíram, e cada um tem destino:** "Início" (não existe
  botão de início — a Home é a seta) · "No culto" (card de ao vivo na Home) ·
  "Avisos" e "Notificações" (o sino, em toda tela — e o **mural virou uma porta
  dentro de Notificações**, senão ficaria inalcançável sem push · a lista in-app
  ganhou `case "comunicado"`, que só existia no `notifTap` da push) · "Cartões"
  (virou **"Cartão de Membro"** no Perfil, com a instrução de uso na linha) ·
  "Grupos"/"Meu grupo"/"Meus grupos" (**3 entradas viraram 1**: `/meu-grupo`
  lista os meus, mostra a fila de inscrições de quem lidera e tem "Entrar em
  outro grupo") · "Fale conosco"/"Sobre a CBRio" (dentro de Configurações).
  ⚠️ **Atalho na Home é só pra o que NÃO está na barra nem no menu** — saíram
  Devocional, Meu grupo, Servir, Cuidados e Inscrições; ficaram Sua jornada,
  NEXT, Batismo, Kids e Generosidade.
  ⚠️ **"Métodos de pagamento" pedido no ponto 3 NÃO existe e não foi inventado:**
  o app nunca guarda dado de cartão (checkout hospedado no provedor · escopo PCI
  fora de nós), então não há cartão pra "salvar ou descadastrar". O que existia
  em Configurações era só a **preferência de qual método abre na Generosidade** —
  e ela agora fica **escondida enquanto `FEATURES.generosidade` é false**
  (configurar uma tela que não existe). Quando as doações voltarem (Benevity), é
  aí que a conversa sobre cartão salvo faz sentido.
- **Comprovante anual de doações (IR):** tela `comprovante-doacoes.tsx`
  (link no rodapé da Generosidade). Lê `mem_contribuicoes` do membro logado
  (RLS `membro_id = current_user_membro_id()` já permite), seletor de ano,
  gera PDF via `expo-print` + compartilha via `expo-sharing`. Só doações
  CONCLUÍDAS entram (cartão/Apple Pay via webhook Stripe; PIX quando o
  financeiro concilia). Nota: doação a igreja não é dedutível — o comprovante
  serve pra ficha "Doações Efetuadas" (código 99).

- **Apple Pay:** módulo nativo local em `modules/apple-pay` (PassKit). A sheet
  devolve o token cru; a Edge Function `generosidade-apple-pay-confirm`
  tokeniza na Stripe (params `pk_token*` no NÍVEL RAIZ do form, não em
  `card[...]`). O botão é o **oficial do sistema** (`PKPaymentButton` tipo
  donate) via view nativa do módulo (`ApplePayButton` em
  `modules/apple-pay/src/ApplePayButton.tsx`) — exigência das HIG; fallback
  custom só pra binário antigo/dev client. ⚠️ O evento da view nativa se chama
  `onApplePress` (NÃO `onPress`: colidiria com o `topPress` core do RN e
  derruba a tela com "Event cannot be both direct and bubbling").
- **Apple Wallet (cartão):** `addPass`/`canAddPasses` também vivem no módulo
  `apple-pay` (PKAddPassesViewController). Substituímos a lib
  `react-native-wallet-pass` (de 2021), que QUEBRA na nova arquitetura do RN
  (constantes não bridgeadas → `PassKit.AddPassButtonStyle` undefined) e era a
  causa do crash da tela de cartões. O botão "Add to Apple Wallet"
  (`components/cartao/AddToWalletButton.tsx`) é estilizado conforme a marca,
  não usa mais view nativa de terceiro.
- **Confirmação de doação:** `components/generosidade/SucessoDoacao.tsx`
  (modal com confete + haptic de sucesso) — Alert de sistema só pra erro.
- **⚠️ .gitignore:** os padrões nativos são ancorados na raiz (`/ios/`,
  `/android/`). NUNCA voltar pra `ios/`/`android/` sem âncora — isso já
  excluiu `modules/apple-pay/ios|android` do upload do EAS e os builds 1–9
  saíram sem o módulo nativo do Apple Pay.

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

## Telas mortas e ambiguas · decisoes de 05/08/2026

- **Mortas**: `/inscricao-grupos` apagada (acidental). **`/inscricao-next` FICA**
  — e redirect proposital pra `/next`, cobrindo deep link antigo.
  **`/verificar-telefone` FICA** — parada de proposito (SMS/OTP desligado).
- ⚠️ **Parecem mortas e NAO sao** (nao "limpar"): `/login`, `/cadastro` e
  `/recuperar-senha` entram por caminho `(auth)/…`; **`/redefinir-senha` entra
  por DEEP LINK** do e-mail de recuperacao — nenhuma varredura de codigo acha.
- **"Assistir ao vivo" era 3 portas** pro mesmo link do YouTube (Home,
  `/modo-culto`, `/videos`). Saiu de `/videos`: o ao vivo e do CULTO; Pregacoes
  e o acervo.
- **Anotacoes eram duas coisas com o mesmo nome**: `/anotacoes` mostra as do
  DEVOCIONAL (servidor · `mem_devocionais`), e `/modo-culto` guarda as da
  PREGACAO **so no aparelho** (AsyncStorage, por dia). Renomeadas ("Anotacoes do
  devocional" x "Anotacoes da pregacao") + aviso na tela do culto. ⚠️ Mandar a do
  culto pro servidor **exige tabela/endpoint novos** — passo combinado pra depois.
- **Jornada · Conectar** leva pra `/meu-grupo` quem JA tem grupo (antes mandava
  todo mundo pro buscador — o "proximo passo" de quem ja deu o passo).
- **Hub de Inscricoes**: o card de voluntariado virou **"Quero servir"** (a barra
  ja tem "Servir", que e a AREA; aqui e a PORTA de inscricao).
- **Os 3 "hubs"** (`/inscricoes`, Menu, `/jornada`) **NAO foram unificados** —
  decisao do Marcos: "nao acho que competem nao".

## ⚠️ Telemetria (`lib/telemetria.ts`) · o contrato com o backend (05/08/2026)

O app manda telas/ações/erros em lote pra `POST /api/app/telemetria`, que grava
em `app_eventos` (visível em `/admin/app-analytics` no sistema).

**Ela ficou 5 dias MORTA em silêncio** (31/07→04/08): o sistema criou
`app_eventos.event_id NOT NULL` pro dedup e o app não mandava esse campo. A
pegadinha: o normalizador do backend devolvia `event_id: undefined` e
**`Object.keys()` inclui chave com `undefined`**, então o supabase-js montava
`?columns=…,event_id`, o PostgREST inseria NULL e dava `23502` — **lote inteiro
descartado**. Como o endpoint responde **HTTP 200 `{ok:false}`** de propósito
(telemetria não pode quebrar o app) e o app ignorava o corpo, ninguém soube.
Descobri quando fui usar a telemetria pra diagnosticar o próprio app.

- O app agora manda **`event_id`** (uuid por evento · `expo-crypto`),
  **`occurred_at`** (quando ACONTECEU · o `created_at` é quando chegou),
  **`session_id`** (uma abertura), **`installation_id`** (aparelho, persistido em
  `cbrio:installation_id`), **`os_version`**, **`device_model`**,
  **`manufacturer`** e **`build_number`**.
- ⚠️ Tudo de `Platform.constants` + `expo-constants` — **sem dependência nativa
  nova**, senão a mudança não sairia por OTA.
- ⚠️ **`Constants.deviceName` é PROIBIDO**: no iOS vem "iPhone de \<nome da
  pessoa\>" (PII). No iOS mandamos o formato (`handset`/`pad`), que responde
  "celular ou tablet?" sem identificar ninguém.
- O app **checa o corpo** da resposta (`{ok:false}` = falhou, mesmo com 200) e
  **retenta o lote 1×** — reenviar é seguro porque o backend deduplica por
  `event_id`. Fila limitada a 60 eventos (nunca cresce sem limite).
- ⚠️ **`props` passa por WHITELIST no backend** e chave fora da lista é jogada
  fora **sem erro**: das 10 chaves que o app mandava, **só `message` passava**.
  Chaves válidas: `message` · `fatal` · `screen` · `route` · `action` · `reason` ·
  `status_code` · `endpoint` · `permission` · `notification_type` · `entity_id` ·
  `label` · `source`. **`entity_id`** = id de COISA (grupo, vídeo, comunicado),
  **nunca de pessoa; `label`** = rótulo curto de enum NOSSO, **nunca texto que a
  pessoa digitou**. Chave nova exige mudar a whitelist em
  `backend/services/systemMobileOps.js` (repo do sistema) — e responder antes:
  *isso pode identificar alguém?*

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

## Módulo 1 — Autenticação (detalhes)

Métodos em `contexts/AuthContext.tsx`:

- `signIn(email, password, remember)` — login e-mail/senha; `remember` controla
  a persistência da sessão (storage híbrido).
- `signUp(email, password, profile)` — **cadastro atual** (e-mail/senha). O
  `profile` traz **nome completo, CPF, data de nascimento e telefone** (todos
  obrigatórios), que vão p/ os metadados e caem na tabela `profiles`. O cadastro
  usa `PhoneInput` (seletor de país com bandeira + DDI) e máscaras de CPF/data
  (`lib/validators.ts`). Retorna `needsEmailConfirmation`.
- `signUpWithPhone` / `verifyPhoneOtp` / `resendPhoneOtp` — fluxo de **SMS (OTP)**,
  pronto no código mas **desativado por enquanto** (Twilio não entrega SMS p/ BR
  sem remetente registrado na Anatel). A tela `verificar-telefone` (com o
  `CodeInput` animado) fica guardada para quando o SMS for religado.
- `signInWithGoogle()` — OAuth via Supabase + `expo-web-browser`.
- `signInWithApple()` — `expo-apple-authentication` + `signInWithIdToken` (iOS).
- `resetPassword(email)` — envia link de recuperação com
  `redirectTo: "cbrio://redefinir-senha"` (⚠️ sem isso o link cai na
  site_url do projeto, que é o sistema interno). A tela
  `(auth)/redefinir-senha.tsx` processa o deep link (tokens no fragmento →
  `setSession`) e mostra o form de nova senha; o guard do `_layout` tem
  exceção pra não expulsar dessa tela quando a sessão chega. O scheme
  `cbrio://**` está na allowlist do Auth (config aplicada 12/06).
- `updatePassword(novaSenha)` — `supabase.auth.updateUser({ password })`. Exposto
  ao usuário logado em **Configurações → Segurança → Trocar senha** (tela
  `app/(app)/trocar-senha.tsx`): confirma a senha atual via `signInWithPassword`
  (re-auth do mesmo usuário, não derruba a sessão) antes de aplicar a nova.
- Troca de e-mail de login: no perfil, `updateUser({ email }, { emailRedirectTo:
  "cbrio://perfil" })` — confirmação chega no novo e-mail.
- `signOut()`.

"Lembrar de mim": `lib/supabase.ts` usa um **storage híbrido** — quando ligado,
a sessão é gravada no `AsyncStorage` (persiste após fechar o app); quando
desligado, fica só em memória (some ao reiniciar o app).

**⚠️ Auto-refresh do token (anti-regressão · 2026-06-17):** o backend Express
(`cbrio.org/api`) valida o JWT via `supabase.auth.getUser(token)` — um
`access_token` vencido vira **401 "Token inválido"**. Sintoma clássico: telas
que batem no backend (Kids, Avisos/Mural, Meu grupo, Pregações, inscrições)
quebram com "Token inválido"/lista vazia, **enquanto** as que usam o supabase
direto (perfil, cartão, devocional) seguem OK — porque o supabase-js renova o
token nas próprias chamadas, mas o `authHeaders()` pegava o token armazenado
(expirado). Dois mecanismos garantem token válido: (1) **AppState wiring** em
`lib/supabase.ts` (`startAutoRefresh`/`stopAutoRefresh` no ciclo ativo/
background — padrão Supabase p/ RN, sem ele o timer não roda confiável em
background); (2) **refresh proativo** em `lib/api.ts` `authHeaders()` (se o
token expira em <60s, chama `refreshSession()` antes de montar o header).
NÃO remover nenhum dos dois.

**Desbloqueio por biometria (Face ID / Touch ID):** `expo-local-authentication`.
`lib/biometria.ts` expõe `biometriaSuportada`, `rotuloBiometria`,
`autenticarBiometria`, e a preferência `biometriaAtiva`/`definirBiometriaAtiva`
(flag em AsyncStorage `cbrio:biometria_unlock`). O gate fica no `RootNavigator`
(`app/_layout.tsx`): se há sessão salva + opção ligada, renderiza
`BiometriaLock` **uma vez por abertura do app** (não a cada background — é
desbloqueio rápido no lugar da senha, não trava de privacidade). A opção é
ligada em **Configurações → Segurança** (só aparece se o aparelho tem
biometria cadastrada; pede a biometria pra confirmar antes de ativar). A flag
é limpa no `signOut` (cada conta reativa). `NSFaceIDUsageDescription` no
`app.json`. A sessão em si NÃO passa pela biometria — ela só é o porteiro.

### ⚠️ Configuração do Supabase

**Banco unificado:** o app usa o **mesmo projeto Supabase do `SISTEMA_INTEGRADO_CBRIO`**
(`https://hhntwfawfnxvuobhdfkb.supabase.co`) — definido no `.env` local. O sistema
é o dono dos dados; o app alimenta ele direto. **NÃO** rodar `supabase/profiles.sql`
nesse projeto (substituiria o trigger do sistema).

Schema relevante do sistema:
- `profiles` (1:1 com `auth.users.id`): `name, email, telefone, avatar_url, role,
  membro_id, is_membro_only`. `role` só aceita `assistente|admin|diretor` — **membro
  = role 'assistente' + is_membro_only = true**.
- `mem_membros`: ficha do membro (`nome, cpf, email, telefone, data_nascimento,
  status, foto_url, voluntario, ...`); `status` ∈ visitante/frequentador/membro/...
- `mem_qrcodes` (`token, cpf`): base do **cartão** (membresia/voluntariado) p/ Wallet.
- `profiles.membro_id → mem_membros.id` é o vínculo usuário↔membro.

**Cadastro de membro:** trigger `on_auth_user_created → handle_new_user()` cria
`profiles` + `mem_membros` (status `visitante`, `is_membro_only`) a partir dos
metadados do signup (`nome, cpf, telefone, data_nascimento`). Versão aplicada em
[`supabase/handle_new_user_membro.sql`](./supabase/handle_new_user_membro.sql).

**Vínculo do membro:** o perfil chama a função `app_salvar_membro(cpf,nome,telefone,email,nascimento)`
(`SECURITY DEFINER`, em `supabase/app_salvar_membro.sql`) que **cruza por CPF, telefone OU
nome**, cria o membro se for novo, atualiza os dados (contornando o RLS com segurança) e
vincula `profiles.membro_id`. Resolve o caso de contas antigas e o save de nascimento.

**Foto de perfil:** bucket `avatars` (Storage) neste projeto + `supabase/storage.sql`.

**Foto de capa dos grupos:** bucket `grupos` (Storage) + `supabase/storage_grupos.sql`.
Path: `grupos/{grupo_id}.{ext}`. Leitura pública; upload/replace só para
admin/diretor (via `profiles.role`) ou líder do grupo (via
`mem_grupos.lider_id`, se a coluna existir — função SQL degrada gracefully).
No app: `lib/useAdminGrupo.ts` gera o flag isAdmin, e `app/(app)/grupo-editar.tsx`
é a tela protegida.

**⚠️ Temporada + grupos de INSCRIÇÃO vêm do backend (2026-08-04):**
`lib/temporadaGrupos.ts` lê `GET /public/grupos/app-inscricao` (sem auth) e
devolve `{ aberta, titulo, grupos[] }` — a MESMA régua do formulário público do
site (grupo ativo, aceitando inscrições, não fechado/pausado, temporada aberta
ou `sempre_aberto`). Consumidores: `inscricao-grupos.tsx` (lista + gate) e
`grupo-detalhe.tsx` (gate do botão "Quero participar"). **NUNCA voltar a ler**
a tabela `app_grupos_temporada` (paralela e órfã — dizia "fechada" com a
temporada aberta; item 1 da auditoria de 03/08) nem `mem_grupos` cru pra lista
de inscrição (perde as travas de grupo fechado/pausado). Falha de rede ⇒
`aberta:false` (fail-closed). `dia_semana`: 0 = domingo (0 é falsy — comparar
com `!= null`).

**Recusa do líder DEVOLVE pra triagem (2026-08-04 · item 2 da auditoria):** o
`POST /app/grupos/pedidos/:id/rejeitar` do backend agora grava `devolvido`
(a equipe de grupos realoca a pessoa) e **não notifica** o inscrito — a pessoa
não sai da fila da coordenação nem recebe recusa. Os modais de recusa
(`grupo-membros.tsx` / `grupo-inscricoes.tsx`) explicam isso ao líder. O
código morto `meusGrupos()` de `lib/grupos.ts` (apontava pro endpoint
`/grupos/meu`, sem chamador) foi removido — o caminho vivo é
`listarMeusGruposLider` (`/app/grupos/meus`).

> Os arquivos `supabase/profiles.sql` e a config antiga referem-se ao projeto
> inicial do app (`otzemqmlprwhtvfxbvkj`), antes da unificação.

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

## ⚠️ App · entrada de PESSOA sob o Contrato de porta (2026-08-04)

Decisão do Marcos: os LÍDERES de grupo são os primeiros a usar o app, e é a
chance de fechar o cadastro de quem falta — então **entrar no app exige
cadastro de gente**, com caminho rápido por CPF pra quem já está na base.
Motivo: o gatilho de `auth.users` (que roda no signup) cria `mem_membros`
**sem passar pelo matcher e sem exigir campo** — medido em prod: 21 cadastros
assim, 13 com nome = prefixo do e-mail, 1 duplicata de pessoa real; 26 das 43
contas do app apontavam pra cadastro sem CPF.

- **`app/(app)/completar-cadastro.tsx`** · 2 caminhos: **rápido** (CPF → código
  no WhatsApp → confirma) e **completo** (nome, telefone, nascimento; CPF
  opcional). Backend: `POST /app/identidade/{por-cpf,confirmar,completar}` +
  `GET /app/identidade/status` (helpers em `lib/api.ts`).
- **`components/auth/CadastroGate.tsx`** (montado no `(app)/_layout.tsx`):
  redireciona pra tela quando o servidor RESPONDE que falta algo. ⚠️ Falha de
  rede/endpoint **não** bloqueia o app (preso na tela sem internet é pior que
  dado incompleto) e o gate **não** esconde a UI — só navega.
- ⚠️ **CPF IDENTIFICA, NÃO AUTENTICA** (lei registrada no CLAUDE.md do
  sistema): o código vai pro telefone JÁ CADASTRADO, nunca pra um número
  digitado na hora — o cadastro dá acesso a grupo, filhos no Kids e histórico
  de contribuição. A tela mostra nome/telefone **mascarados** (vêm assim do
  servidor); não "melhorar" isso exibindo o dado completo.
- ⚠️ Régua do incompleto: nome de gente + telefone + nascimento. **CPF é
  recomendado, não obrigatório** — ninguém fica fora do app por não ter o
  documento em mãos.
- ⚠️ Sem o template de AUTENTICAÇÃO na Meta (`WHATSAPP_TEMPLATE_APP_CODIGO` no
  Vercel) o caminho rápido se declara indisponível e a tela cai no formulário.
- ⚠️ `perfil.tsx` ainda salva por `app_salvar_membro` (RPC antiga que cruza por
  CPF/telefone/**nome**) — porta velha, fora do contrato. Migrar pro
  `/app/identidade/completar` num próximo passo.
