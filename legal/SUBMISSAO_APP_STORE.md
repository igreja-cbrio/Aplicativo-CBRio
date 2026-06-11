# Runbook — publicar o CBRio na App Store

App Store Connect ID **6778156310** · bundle `br.com.cbrio.app` · versão 1.0.

## 0. Pré-requisitos (uma vez)
- [ ] Hospedar a política de privacidade em `https://www.cbrio.org/privacidade`
      (o conteúdo está em `legal/privacidade.html`). A Apple exige o link.
- [ ] Ter uma página de suporte (pode ser `https://www.cbrio.org/ajuda` ou o
      WhatsApp/CBZap). Vai no campo "Support URL".

## 1. Ficha da loja (metadados)
Duas opções:
- **Automático (recomendado):** os textos/keywords estão em `store.config.json`.
  Rode `eas metadata:push` pra enviar pro App Store Connect.
  > Antes: confirme que o e-mail/URLs em `store.config.json` estão certos.
- **Manual:** App Store Connect → CBRio → versão 1.0 → preencher nome, subtítulo,
  descrição, keywords (copiar de `store.config.json`).

## 2. Screenshots
- Em `store-screenshots/` (1320×2868, tamanho 6.9"). Subir no mínimo o set do
  iPhone 6.9". 3 a 5 boas já bastam (a Apple replica pros tamanhos menores).
- Sugestão de ordem: `1-home`, `2-cartao`, `3-generosidade`, `4-cuidados`, `5-grupos`.

## 3. App Privacy
- Preencher conforme `legal/APP_STORE_PRIVACY.md`. **Tracking: Não.**

## 4. Classificação etária
- Questionário → tudo "None" → resultado esperado **4+** (ver `store.config.json`
  → advisory).

## 5. Build + envio pra revisão
- O build que está no TestFlight serve (ex.: build 15+). Em "Build", anexar o
  mais recente.
- Conta de demo pro revisor (campo "App Review Information"):
  - `appstore.review@cbrio.app` / `AppReview2026!`
- Notas pra revisão: ver `legal/APP_STORE_PRIVACY.md` (parágrafo sobre doações).
- Export compliance: já declarado no app (`ITSAppUsesNonExemptEncryption=false`).
- Submit for Review. Apple revisa em ~24–48h.

## 6. Release
- "Automatically release after approval" (sai sozinho) ou "Manually" (você libera).

## ⚠️ Riscos de rejeição (pré-resolvidos)
1. **Doações** → usa PIX/Stripe/Apple Pay, NÃO IAP (correto p/ 3.2.1). Deixar
   claro nas notas que é contribuição voluntária a uma igreja.
2. **Login obrigatório** → conta de demo fornecida (motivo nº1 de rejeição).
3. **Sign in with Apple** → presente (obrigatório por ter login Google). ✅
4. **Exclusão de conta in-app** → presente (Configurações → Conta). ✅

## Depois de publicar
- Apagar a conta de demo `appstore.review@cbrio.app` só DEPOIS de aprovado
  (a Apple pode re-revisar em updates — manter é mais seguro).
