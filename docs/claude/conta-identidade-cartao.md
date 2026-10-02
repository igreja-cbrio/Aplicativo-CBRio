# conta · identidade · cartao · conhecimento operacional do app

Movido **na íntegra** do `CLAUDE.md` em 2026-10-01 (o arquivo tinha 268 KB e era carregado em toda chamada). Referência VIVA: leia o índice e a seção do assunto antes de mexer. Seção nova entra no FIM deste arquivo, datada, com uma linha a mais no índice.

**Escopo:** Conta e identidade: autenticação, cartão (Wallet), entrada de pessoa sob o Contrato de porta.

## Índice de seções

- ⚠️⚠️ CARTÃO · o Android via "Add to Apple Wallet" (2026-08-14)
- Módulo 1 — Autenticação (detalhes)
- ⚠️ App · entrada de PESSOA sob o Contrato de porta (2026-08-04)

---

## ⚠️⚠️ CARTÃO · o Android via "Add to Apple Wallet" (2026-08-14)

Pergunta do Matheus: *"o cartão de membro no Android tem a opção de adicionar à
wallet do Google?"*. Não tinha — e o que havia era pior que a ausência.

`cartoes.tsx` renderizava o `AddToWalletButton` **sem checar plataforma**. No
Android o botão dizia literalmente **"Add to Apple Wallet"** (o fallback
estilizado, porque o módulo nativo da Apple não existe lá) e o toque caía no
ramo `Platform.OS !== "ios"` do `lib/wallet.ts`: gravava o `.pkpass` no cache e
abria o **compartilhar** do sistema. **`.pkpass` é formato da Apple — o Google
Wallet não o abre.** Beco sem saída, com o nome da carteira de outra plataforma.

⚠️⚠️ **E o backend já tinha a porta certa há tempo, sem chamador no app:**
`POST /api/public/membresia/wallet/google` (`backend/routes/publicMembresia.js`)
devolve o link assinado `pay.google.com/gp/v/save/<jwt>` e recebe **o mesmo par
CPF + data de nascimento** que o caminho da Apple. Medido em 14/08: o endpoint
responde `400 CPF invalido` a um corpo inválido — ou seja, passa da checagem que
devolveria `503 Google Wallet não configurado`, então **issuer, conta de serviço
e chave estão configurados em produção**. A página pública de cartão do ERP
(`MemberWalletPass.tsx`) já usa esse mesmo caminho.

- **`lib/carteira.ts`** (pura, no portão, com mutante): `carteiraDe(os)` —
  ios→apple, android→google, resto→`null` (plataforma sem carteira não ganha
  botão) — e `motivoFalhaCarteira(status)`. ⚠️ **503 é da IGREJA, não do cadastro
  da pessoa**: mandar alguém conferir o próprio CPF por causa de credencial que
  falta no servidor é fazê-la procurar erro onde não há.
- **`adicionarCartaoNaCarteira`** (`lib/wallet.ts`) é a porta única da tela.
- ⚠️ **Sai por OTA**: o passe do Google é criado pelo SERVIDOR e entregue como
  link — o app só abre. Nenhum módulo nativo no caminho (ao contrário da Apple,
  que precisa do PassKit compilado).
- ⚠️ **`Linking.openURL`, não navegador in-app**: o Android entrega o link ao app
  da Carteira quando ele está instalado; num navegador embutido a pessoa salvaria
  o passe numa sessão que não é a do aparelho dela.
- ⚠️ O link tem ~1.6 mil caracteres (medido montando o mesmo `genericObject`),
  dentro do limite prático do save link. Se o passe ganhar campos, conferir de
  novo — acima de ~1,8 mil o Google recusa a URL.
- ⏳ **O que só o teste real responde**: se o emissor no Google Console está
  aprovado para PRODUÇÃO ou ainda em modo demo (em demo o passe salva, com aviso
  de demonstração, e só pra quem está na lista de testadores).

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
