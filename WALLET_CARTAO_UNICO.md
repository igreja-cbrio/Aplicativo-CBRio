# Cartão único CBRio — integração app ⇄ ERP

Objetivo: **um único cartão/QR por pessoa**. O mesmo QR serve para
identificação de membresia e para check-in de voluntário — **quem decide a ação
é o leitor** (o app só mostra o QR e oferece "Adicionar à Wallet").

## Cor do passe na Wallet (azul) — mudança no ERP

A cor do `.pkpass` é definida no ERP (`backend/services/appleWallet.js`,
`buildMembroPass`). Para o passe entrar **azul** na Wallet (igual ao app), trocar
no `pass.json`:

```js
backgroundColor: 'rgb(64,128,151)',   // #408097
foregroundColor: 'rgb(255,255,255)',  // texto branco
labelColor:      'rgb(213,228,230)',  // #D5E4E6
```

E trocar o `logo`/`logo@2x` do passe por uma **versão clara/branca** do wordmark
(o logo petróleo some no fundo azul). O app não controla essas cores — só baixa o
arquivo gerado pelo ERP.

## O que o APP já faz (pronto)
- Tela **Meu cartão** (`app/(app)/cartoes.tsx`): mostra **um** cartão com o **QR
  na tela** (valor = `mem_qrcodes.token` do membro logado) + botão **Adicionar à
  Wallet**.
- **Token**: obtido pela função `app_meu_qrcode()` (cria se faltar) —
  `supabase/app_meu_qrcode.sql`.
- **Wallet** (`lib/wallet.ts`): baixa o `.pkpass` binário do ERP e apresenta a
  tela "Adicionar à Carteira" (via expo-sharing).
  - Membresia: `POST cbrio.org/api/public/membresia/wallet/apple { cpf, data_nascimento }`.

## O que falta NO ERP (outro repositório) para unificar de verdade
1. **Leitor de check-in de voluntário aceitar o QR de membresia.**
   Hoje o check-in usa `vol_profiles.qr_code`. Para o cartão único, o leitor de
   check-in deve aceitar o `mem_qrcodes.token` (membro), resolver `token → CPF →
   membro → vol_profiles` e aplicar a permissão/ação de voluntário. Assim o mesmo
   QR funciona nos dois leitores.
2. **(Opcional) Passe único na Wallet.** Se quiser um só `.pkpass` que sirva para
   tudo, o `appleWallet.js` deve embutir o `mem_qrcodes.token` como QR do passe de
   membresia (que todos têm) — e o passe de voluntário deixa de ser necessário.
3. **Confirmar auth do `/me`.** A rota `GET /api/voluntariado/me/wallet/apple` usa
   `authenticate`. Como o app usa o **mesmo Supabase**, confirmar se esse
   middleware aceita o **JWT do Supabase** (`Authorization: Bearer <access_token>`).
   Se sim, o app consegue puxar o passe de voluntário também; se não, usamos só o
   passe de membresia (recomendado no modelo unificado).

## Passos para ativar
1. Rodar `supabase/app_meu_qrcode.sql` no projeto do sistema.
2. Rebuild do app (entrou `react-native-qrcode-svg`, `react-native-svg`,
   `expo-file-system`, `expo-sharing`): `npx expo run:ios`.
3. No ERP: ajustar o leitor de check-in para aceitar o `mem_qrcodes.token`.
