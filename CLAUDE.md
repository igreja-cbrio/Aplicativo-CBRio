# CLAUDE.md — Memória do projeto CBRio

> **Regra permanente:** mantenha este arquivo sempre atualizado a cada mudança
> relevante (novo módulo, dependência, decisão de arquitetura, config de
> backend). Ele é a memória e o contexto contínuo do app.

## Visão geral

App de membros da igreja **CBRio**. Está sendo **reconstruído do zero, módulo a
módulo**. Roda em **Android e iOS**.

## Stack

- **Expo SDK 51** + **Expo Router** (rotas tipadas)
- **React Native 0.74** / React 18 / **TypeScript** (strict)
- **Supabase** para autenticação (e futuramente dados)
- **Estilização:** `StyleSheet` nativo (decisão: melhor performance/confiabilidade
  no celular; sem Tailwind/NativeWind). Tema central em `constants/theme.ts`.
- Ícones: `@expo/vector-icons` (bundled com Expo).

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
  (app)/               # área autenticada (próximos módulos entram aqui)
    _layout.tsx
    index.tsx
components/
  ui/                  # Button, Input, SocialButton, Checkbox
contexts/
  AuthContext.tsx      # sessão e todos os métodos de auth
lib/
  supabase.ts          # cliente Supabase + storage híbrido (lembrar de mim)
constants/
  theme.ts             # cores, espaçamentos, tipografia
```

## Módulos

| Status | Módulo           | Descrição                                                        |
| :----: | ---------------- | ---------------------------------------------------------------- |
|   ✅   | **Autenticação** | Login e-mail/senha, Google, Apple, "lembrar de mim", cadastro com SMS, recuperação de senha |
|   ⬜   | _Próximos_       | A definir, construídos um a um                                   |

## Módulo 1 — Autenticação (detalhes)

Métodos em `contexts/AuthContext.tsx`:

- `signIn(email, password, remember)` — login e-mail/senha; `remember` controla
  a persistência da sessão (storage híbrido).
- `signUpWithPhone(nome, email, phone, password)` — cria a conta e envia código
  por SMS. O usuário vai para `verificar-telefone`.
- `verifyPhoneOtp(phone, token)` — confirma o código SMS e abre a sessão.
- `signInWithGoogle()` — OAuth via Supabase + `expo-web-browser`.
- `signInWithApple()` — `expo-apple-authentication` + `signInWithIdToken` (iOS).
- `resetPassword(email)` — envia link de recuperação.
- `signOut()`.

"Lembrar de mim": `lib/supabase.ts` usa um **storage híbrido** — quando ligado,
a sessão é gravada no `AsyncStorage` (persiste após fechar o app); quando
desligado, fica só em memória (some ao reiniciar o app).

### ⚠️ Configuração necessária no painel do Supabase

O código cliente está pronto, mas estes provedores precisam ser configurados no
dashboard do Supabase para funcionarem de verdade:

1. **Google**: Authentication → Providers → Google (Client ID/Secret). Adicionar
   a redirect URL do app (`cbrio://`).
2. **Apple**: Authentication → Providers → Apple (Service ID, Team ID, Key). Só
   funciona em build iOS real/simulador, não no Expo Go.
3. **Phone/SMS**: Authentication → Providers → Phone, com provedor de SMS
   (ex.: Twilio/MessageBird) e credenciais.
4. Variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no `.env`.

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

**Logos:** wordmark "cbrio", heart+wordmark e o **coração** isolado. O coração
está recriado como **vetor SVG** em `components/brand/CbrioHeart.tsx` (cor,
tamanho e espessura configuráveis) — não depende de arquivo de imagem. Para
fidelidade pixel-perfect, substituir por arte oficial em `assets/`.

- **Splash / carregamento** (`components/brand/SplashPulse.tsx`): coração da
  CBRio **pulsando** (scale + opacity em loop) enquanto a sessão é restaurada.
  Usado em `app/_layout.tsx`.
- **Header dos formulários** (login, cadastro, etc.): coração dentro de um
  círculo "glass".

## Convenções

- Textos de UI em **português (pt-BR)**.
- Identidade visual: tema escuro teal (`#0B1F26`), card, botões arredondados
  (pill), cor primária `#408097`.
- Sempre que um módulo for adicionado/alterado, atualizar a tabela de Módulos
  e os detalhes correspondentes aqui.
```
