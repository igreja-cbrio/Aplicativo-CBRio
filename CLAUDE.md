# CLAUDE.md — Memória do projeto CBRio

> **Regra permanente:** mantenha este arquivo sempre atualizado a cada mudança
> relevante (novo módulo, dependência, decisão de arquitetura, config de
> backend). Ele é a memória e o contexto contínuo do app.

## Visão geral

App de membros da igreja **CBRio**. Está sendo **reconstruído do zero, módulo a
módulo**. Roda em **Android e iOS**.

## Stack

- **Expo SDK 54** + **Expo Router** (rotas tipadas)
- **React Native 0.81** / React 19 / **TypeScript** (strict)
- **Liquid Glass (iOS 26/27)** via `expo-glass-effect` (`GlassView`), com fallback
  `expo-blur` em iOS antigo/Android (`isLiquidGlassAvailable()`). Componente
  `components/ui/GlassCard.tsx` é o veículo padrão. Adotado no Dock e nas
  superfícies proeminentes/controles das telas principais: atalhos da Home,
  cards de Cuidados, seletor de método da Generosidade, lista do Menu, card de
  cartões do Perfil. **Por HIG**, conteúdo denso (instruções PIX, cards de
  status do Voluntariado) e alertas (SOS) ficam SÓLIDOS pra legibilidade — não
  espalhar glass em tudo.
- **Supabase** para autenticação (e futuramente dados)
- **EAS Update (OTA):** `expo-updates` configurado (canais `development`/
  `preview`/`production` no `eas.json`; `runtimeVersion.policy = appVersion`).
  Mudança **só de JS** vai ao ar sem revisão da Apple:
  `eas update --channel production --message "..."`. Só chega a builds com a
  MESMA `version` do app.json e que já contenham `expo-updates` (build iOS
  ≥ 20). Mudança nativa (módulo, plugin, permissão) continua exigindo
  build novo + revisão.
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
- **Navegação autenticada:** tab bar **NATIVA** (`UITabBarController`) via
  `expo-router/unstable-native-tabs` em `app/(app)/(tabs)/_layout.tsx` —
  no iOS 26 vem com **Liquid Glass real** e a interação de pressionar e
  arrastar a lente entre as abas, implementadas pela Apple
  (`minimizeBehavior="onScrollDown"` encolhe a barra ao rolar). Ícones são
  SF Symbols; rótulos passam pelo i18n. Abas: Home, Cuidados, Voluntariado,
  Generosidade, Menu. As DEMAIS telas vivem em `app/(app)/` sob um Stack
  (push de verdade por cima das abas). ⚠️ História: o Dock custom em JS
  (glass + gesto próprio) foi aposentado em 12/06 após 3 rodadas de bugs
  com reconhecedores de gesto (e.x/absoluteX corrompidos, onPressIn
  cancelado pelo long-press, GlassView aninhada apagando filhos) — NÃO
  reimplementar tab bar custom; usar a nativa.

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
  (app)/               # área autenticada — Stack (telas push) sobre as abas
    _layout.tsx        # Stack + MembroProvider
    (tabs)/            # tab bar NATIVA (NativeTabs/UITabBarController)
      _layout.tsx      # 5 triggers com SF Symbols + i18n
      index.tsx        # Home (header fixo + carrossel + cultos + atalhos)
      cuidados.tsx / voluntariado.tsx / generosidade.tsx / menu.tsx
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

## Módulos

| Status | Módulo           | Descrição                                                        |
| :----: | ---------------- | ---------------------------------------------------------------- |
|   ✅   | **Autenticação** | Login/cadastro e-mail/senha, Google, Apple, "lembrar de mim", recuperação de senha (SMS pronto, desligado até ter remetente BR). **Desbloqueio por Face ID/Touch ID** (`lib/biometria.ts` + `components/auth/BiometriaLock.tsx`): trava 1x por abertura quando há sessão salva e a opção está ligada em Configurações → Segurança. |
|   ✅   | **Inscrições**   | Todos os formulários vão via `POST https://cbrio.org/api/app/inscricoes` (helper em `lib/api.ts`, fachada em `lib/inscricoes.ts`). Voluntariado puxa áreas dinâmicas de `GET /public/voluntariado/form-opcoes` (até 3 áreas, com Kids/Bridge exigindo CPF + nome da mãe). Grupos usa o mesmo endpoint com `tipo:"grupos"`. |
|   🚧   | **Voluntariado** | Aba self-service: ver/confirmar **escalas** (`mem_escalas`) ✅. **Push** ao ser escalado: `lib/push.ts` salva token em `app_push_tokens`; Edge Function `supabase/functions/notify-escala` dispara (precisa EAS projectId + device físico + webhook). |
|   ✅   | **Notificações** | `app_notificacoes` (histórico in-app), helper `supabase/functions/_shared/notify.ts`, tela `notificacoes.tsx` com badge e marca-como-lida, `lib/notifTap.ts` roteia o tap (tipos: escala, sos, grupo_pedido, batismo, culto, next). **Push funcionando ponta a ponta** (validado 12/06: triggers SQL de `webhooks_app.sql` aplicados, pg_net ativo, tokens em `app_push_tokens`). **Lembretes agendados** via pg_cron (a cada min) → Edge Function `notify-lembretes` (`supabase/lembretes.sql`): batismo (véspera 18h + dia 8h), NEXT (véspera 18h), culto online (5 min antes, broadcast). Dedup em `app_lembretes_enviados`. |
|   🚧   | **Cuidados**     | Pedido de oração + aconselhamento (grava em `app_inscricoes`) e **SOS** (CVV 188/192 na hora + alerta push aos pastores via Edge Function `notify-cuidado-sos`). |
|   ✅   | **Devocional**   | Tela `devocional.tsx` (atalho na Home): devocionais de **seg a sex** dos planos ativos do sistema (lê `devocional_itens`+`devocional_planos` direto, RLS liberada p/ authenticated). Check-in grava em `mem_devocionais` (tipo pessoal, upsert por membro+data — **é a tabela que alimenta os KPIs** do valor Investir). Incentivo: streak de dias úteis (`lib/devocional.ts`), bolhas da semana, haptic + push lembrete 7h30 (seg–sex, só quem não leu — `notify-lembretes`). Conteúdo é criado no SISTEMA (Cuidados → planos, manual ou IA). |
|   ⬜   | _Próximos_       | A definir, construídos um a um                                   |

## Generosidade — notas de implementação

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
- `updatePassword(novaSenha)` — `supabase.auth.updateUser({ password })`.
- Troca de e-mail de login: no perfil, `updateUser({ email }, { emailRedirectTo:
  "cbrio://perfil" })` — confirmação chega no novo e-mail.
- `signOut()`.

"Lembrar de mim": `lib/supabase.ts` usa um **storage híbrido** — quando ligado,
a sessão é gravada no `AsyncStorage` (persiste após fechar o app); quando
desligado, fica só em memória (some ao reiniciar o app).

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
