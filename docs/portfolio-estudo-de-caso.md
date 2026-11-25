# Estudo de Caso / Portfólio

> Copie e adapte. Serve para LinkedIn, site ou anexo de proposta.

## App de Membros + Sistema Integrado — Igreja CBRio

**Papel:** Desenvolvimento full-stack, arquitetura e integrações (solo)
**Período:** [preencha]
**Stack:** React Native (Expo SDK 54), TypeScript, Supabase (Postgres + Edge Functions), Stripe, Apple Pay

### O problema

A igreja precisava centralizar a relação com seus membros — inscrições, doações,
voluntariado, cuidado pastoral e comunicação — que antes viviam espalhados em
planilhas, formulários soltos e mensagens manuais, sem rastreio nem automação.

### A solução

Um **aplicativo mobile nativo (iOS + Android)** integrado a um **sistema/ERP**
próprio, cobrindo o ciclo completo do membro:

- **Autenticação multi-método** — e-mail/senha, Google e Apple (OAuth), com
  sessão persistente e opção "lembrar de mim"
- **Doações ("Generosidade")** — pagamento por **cartão de crédito (Stripe)**,
  **Apple Pay** com tokenização e **Pix** (QR + copia-e-cola)
- **Inscrições** — batismo, grupos, NEXT e voluntariado, com formulários
  dinâmicos servidos pelo backend
- **Cuidado pastoral** — pedidos de oração, aconselhamento e um fluxo de **SOS**
  que dispara alerta push imediato aos pastores
- **Notificações** — histórico in-app + push (Edge Functions) ao ser escalado,
  ter pedido aprovado, etc.
- **Carteira digital** — cartão de membro com QR Code e integração com
  Apple/Google Wallet

### Arquitetura e decisões técnicas

- **Backend serverless** com Supabase Edge Functions (Deno) e banco Postgres com
  **Row Level Security**
- **Pagamentos** processados 100% no provedor (PCI-compliant) — a igreja nunca
  toca dados de cartão
- **Sincronização em tempo real** (Postgres Changes) + estratégia de cache para
  reduzir carga em picos de uso (ex.: domingo de culto)
- **TypeScript strict**, tema claro/escuro, identidade visual própria, textos em
  pt-BR
- Documentação viva de arquitetura mantida no repositório

### Resultado

Sistema em produção, processando doações reais e centralizando a operação da
igreja — substituindo o que normalmente exigiria contratar uma software house
(orçamento típico de mercado: **R$ 60–200 mil**).
