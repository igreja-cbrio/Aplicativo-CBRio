# Aplicativo CBRio

App de membros da igreja CBRio. **Reconstrução do zero, módulo a módulo**, em
Expo + React Native (TypeScript), rodando em **Android e iOS**.

## Stack

- [Expo](https://expo.dev) (SDK 51) + Expo Router
- React Native 0.74 / React 18
- TypeScript
- [Supabase](https://supabase.com) para autenticação

## Como rodar

```bash
npm install
cp .env.example .env   # preencha com as credenciais do Supabase
npm start              # depois pressione "a" (Android) ou "i" (iOS)
```

## Módulos

| Status | Módulo            | Descrição                                            |
| :----: | ----------------- | ---------------------------------------------------- |
|   ✅   | **Autenticação**  | Login, cadastro, recuperação de senha (Supabase)     |
|   ⬜   | _Próximos_        | A definir, construídos um a um                       |

### Módulo 1 — Autenticação

- `contexts/AuthContext.tsx` — sessão, login, cadastro, reset e logout
- `lib/supabase.ts` — cliente Supabase com persistência em AsyncStorage
- `app/(auth)/` — telas de login, cadastro e recuperação de senha
- `app/(app)/` — área autenticada (guard de rotas no `app/_layout.tsx`)
