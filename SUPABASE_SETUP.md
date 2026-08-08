# Configuração do Supabase — CBRio

> ## ⚠️⚠️ AVISO — LEIA ANTES DE SEGUIR QUALQUER PASSO DAQUI (08/08/2026)
>
> **Este documento descreve o SETUP ORIGINAL do app, de quando ele tinha banco
> próprio. Ele NÃO descreve o sistema de hoje, e seguir os passos como estão
> escritos causa estrago.**
>
> Dois erros que estavam aqui até 08/08:
>
> 1. **O projeto estava errado.** Dizia `otzemqmlprwhtvfxbvkj` — o projeto
>    Supabase INICIAL do app, abandonado na unificação. O projeto **vivo**, com
>    toda a base da igreja, é **`hhntwfawfnxvuobhdfkb`**. (`scripts/ota.js` já
>    aborta a publicação se detectar a URL antiga.)
> 2. **O passo 2 mandava rodar `supabase/profiles.sql` no SQL Editor** — e esse
>    arquivo é FÓSSIL: ele cria `profiles` com colunas `nome` e `cpf`, que **não
>    existem** na tabela viva (conferido no schema de produção). O trigger dele
>    estouraria `42703` dentro do `AFTER INSERT` em `auth.users`, ou seja
>    **quebraria todo cadastro novo**. Quem manda em `profiles` hoje são as
>    migrations do ERP (`SISTEMA_INTEGRADO_CBRIO/supabase/migrations/`), não este
>    repositório.
>
> **Regra que fica**: neste repo, `supabase/*.sql` é **cópia de leitura**, para
> entender o que existe. A FONTE que roda é a pasta de migrations do ERP. Não
> rode SQL daqui no painel.

Projeto vivo: `https://hhntwfawfnxvuobhdfkb.supabase.co`

O passo a passo abaixo fica como registro histórico do setup inicial.

---

## 1. Variáveis de ambiente (.env)

No seu Mac, na raiz do projeto, crie o arquivo `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://hhntwfawfnxvuobhdfkb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<sua anon public key>
```

> A anon key fica em **Dashboard → Project Settings → API → Project API keys → `anon` `public`**.
> Depois de criar/alterar o `.env`, reinicie o Metro com cache limpo: `npx expo start -c`.

---

## 2. Tabela de perfis — ⛔ NÃO RODE

~~No **SQL Editor** do Supabase, rode o conteúdo de `supabase/profiles.sql`.~~

⚠️ **Passo REVOGADO em 08/08/2026.** `supabase/profiles.sql` é fóssil: cria
`profiles` com `nome` e `cpf`, colunas que **não existem** na tabela viva. O
trigger dele estouraria `42703` no `AFTER INSERT` de `auth.users` e **quebraria
todo cadastro novo**. A tabela `profiles` já existe e é mantida pelas migrations
do ERP. O arquivo continua no repo só como referência do que o app esperava no
começo.

---

## 2b. Foto de perfil (Storage)

1. **Storage → New bucket** → nome **`avatars`** → **Public: ON** → criar.
2. No **SQL Editor**, rode [`supabase/storage.sql`](./supabase/storage.sql) (políticas:
   leitura pública + cada usuário gerencia a própria pasta `<uid>/...`).

O app envia a foto para `avatars/<user_id>/avatar.<ext>` e salva a URL pública
em `profiles.avatar_url`. (Requer `expo-image-picker` → **rebuild** do app.)

## 2c. Cartões (membresia/voluntariado)

A tela de Cartões lê do mesmo Supabase. Hoje ela assume a tabela **`cartoes`**
com colunas `user_id, tipo, numero, status, wallet_url`. **Ajustar** estes nomes
em `app/(app)/cartoes.tsx` conforme a estrutura real do `SISTEMA_INTEGRADO_CBRIO`.

## 3. Deep link / Redirect URLs (necessário p/ Google e Apple)

**Authentication → URL Configuration**:

- **Site URL:** `cbrio://`
- **Redirect URLs:** adicione `cbrio://` e `cbrio://*`

O app usa o scheme `cbrio` (definido em `app.json`).

---

## 4. E-mail / senha

**Authentication → Providers → Email**: já vem habilitado.

- Para testar rápido sem caixa de e-mail, em **Providers → Email** você pode
  desativar **"Confirm email"** (aí o login funciona logo após o cadastro).
- Em produção, deixe a confirmação ligada e ajuste os templates em
  **Authentication → Emails**.

---

## 5. Telefone / SMS (OTP)

**Authentication → Providers → Phone** → habilite e escolha um provedor de SMS.
O Supabase **não envia SMS sozinho** — precisa de um provedor (pago):

- **Twilio** (mais comum): crie conta em twilio.com, pegue **Account SID**,
  **Auth Token** e um **Messaging Service SID** (ou número remetente) e cole no
  Supabase.
- Alternativas suportadas: MessageBird, Vonage, Textlocal.

Depois disso, o cadastro do app envia o código e a tela `verificar-telefone`
confirma o OTP.

> Dica de teste: o Supabase permite cadastrar **números de teste** com um código
> fixo (sem gastar SMS) na configuração do provedor Phone.

---

## 6. Google

1. **Google Cloud Console** → crie um projeto → **APIs & Services → Credentials**.
2. Crie um **OAuth client ID** do tipo **Web application**.
3. Em **Authorized redirect URIs**, adicione o callback do Supabase:
   `https://hhntwfawfnxvuobhdfkb.supabase.co/auth/v1/callback`
4. Copie o **Client ID** e **Client Secret**.
5. No Supabase: **Authentication → Providers → Google** → cole Client ID/Secret → salve.

---

## 7. Apple

> Só funciona em **build iOS** (não no Expo Go). Precisa de **Apple Developer** (pago).

1. No **Apple Developer**, configure **Sign in with Apple** para o app id
   `br.com.cbrio.app` (já é o bundle do app).
2. No Supabase: **Authentication → Providers → Apple** → habilite.
   - Para login **nativo** no iOS (que é o que o app usa), em
     **Authorized Client IDs** inclua o bundle `br.com.cbrio.app`.
   - Para o fluxo web/Service ID, preencha Service ID, Team ID, Key ID e a chave.
3. O `app.json` já tem `ios.usesAppleSignIn: true` e o plugin
   `expo-apple-authentication`.

---

## Resumo do que o app espera

- `signIn` (e-mail/senha), `signUpWithPhone` + `verifyPhoneOtp` (SMS),
  `signInWithGoogle` (OAuth), `signInWithApple` (id token nativo).
- `nome` é enviado no cadastro em `options.data.nome` e cai na tabela `profiles`.
- Scheme de deep link: `cbrio://`.
