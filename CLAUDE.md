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
- ⚠️⚠️ **O gate RECONFERE com o servidor antes de rebater (05/08/2026 · não
  regredir).** `incompleto` é estado LOCAL e **nada o limpava**: quem terminava
  o cadastro era mandado pra `/` pelo `concluir()`, o efeito disparava com
  `incompleto` ainda `true` e devolvia a pessoa pra tela — **pra sempre**, até
  fechar e reabrir o app. Medido: o Matheus tentou 2×, a Joana Botafogo **3× em
  dois minutos**, os dois com `profiles.membro_id` preenchido e a ficha completa
  no banco. Agora cada tentativa de sair chama `statusIdentidade()` e só volta se
  o servidor CONFIRMAR que ainda falta; segue **fail-closed** (erro de rede
  mantém o bloqueio de quem já sabemos estar incompleto) e o GET extra só
  acontece com a ficha aberta.
  ⚠️⚠️ **Eram DUAS causas independentes.** A outra é do SERVIDOR: `res.json` do
  Express gera **ETag** e não manda `Cache-Control`, o cache HTTP do RN
  (NSURLSession/OkHttp) revalidava com `If-None-Match`, o Express respondia
  **304 sem corpo** e a camada nativa entregava ao JS a resposta ANTIGA, com
  `completo: false` — **124 de 251** respostas de `/api/app/*` em 6h eram 304.
  Corrigido em `backend/routes/app.js` (PR #2313 do SISTEMA). **Sem as duas, o
  loop volta.**
  ⚠️ Descartado de propósito: `cache: "no-store"` no `apiGet`. O `fetch` do
  React Native é o polyfill `whatwg-fetch` sobre `XMLHttpRequest` e **ignora a
  opção `cache`** — seria decoração que se lê como proteção. Quem resolve é o
  servidor não emitir validador.
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
