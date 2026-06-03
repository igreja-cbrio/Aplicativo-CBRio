# Configuração do Supabase — CBRio

Projeto: `https://otzemqmlprwhtvfxbvkj.supabase.co`

O código cliente já está pronto. Aqui está o passo a passo do que configurar no
**painel do Supabase** e no app para tudo funcionar de verdade.

---

## 1. Variáveis de ambiente (.env)

No seu Mac, na raiz do projeto, crie o arquivo `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://otzemqmlprwhtvfxbvkj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<sua anon public key>
```

> A anon key fica em **Dashboard → Project Settings → API → Project API keys → `anon` `public`**.
> Depois de criar/alterar o `.env`, reinicie o Metro com cache limpo: `npx expo start -c`.

---

## 2. Tabela de perfis

No **SQL Editor** do Supabase, rode o conteúdo de [`supabase/profiles.sql`](./supabase/profiles.sql).
Isso cria a tabela `profiles`, as políticas de RLS e o trigger que cria o perfil
automaticamente no cadastro (puxando o `nome` enviado no signUp).

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
   `https://otzemqmlprwhtvfxbvkj.supabase.co/auth/v1/callback`
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
