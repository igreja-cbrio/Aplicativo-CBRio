# App Privacy (rótulos da App Store) — CBRio

Respostas pra preencher em **App Store Connect → App Privacy**. O app
coleta dados, então marque "Yes, we collect data".

## Dados coletados e finalidade

| Categoria (Apple) | Dado | Vinculado ao usuário? | Rastreamento? | Finalidade |
|---|---|---|---|---|
| Contact Info | Nome | Sim | Não | App Functionality |
| Contact Info | E-mail | Sim | Não | App Functionality |
| Contact Info | Telefone | Sim | Não | App Functionality |
| Identifiers | ID de usuário (conta) | Sim | Não | App Functionality |
| Sensitive Info | CPF (documento nacional) | Sim | Não | App Functionality (vínculo de membro/cartão) |
| Location | Localização aproximada | Sim | Não | App Functionality (check-in no NEXT, grupos próximos) |
| User Content | Outro conteúdo (pedidos de oração, mensagens) | Sim | Não | App Functionality |
| User Content | Fotos (avatar) | Sim | Não | App Functionality |
| Financial Info | Histórico de pagamento (doações) | Sim | Não | App Functionality (processado pela Stripe; o app não guarda dados do cartão) |
| Usage Data | Interações no app (notificações, inscrições) | Sim | Não | App Functionality |

## Pontos importantes
- **Tracking: NÃO.** O app não rastreia entre apps/sites de terceiros nem usa
  IDFA → não precisa do prompt de App Tracking Transparency.
- **Dados de cartão**: NÃO são coletados pelo app — o pagamento por cartão/Apple
  Pay é processado direto pela **Stripe** (PCI nível 1). Declarar só
  "histórico de pagamento" (que houve uma doação), não dados do cartão.
- **Localização**: "While Using the App" (NSLocationWhenInUseUsageDescription já
  configurado). Finalidade: check-in no NEXT e grupos próximos. NÃO usar pra
  tracking/ads.
- **CPF**: é dado sensível (documento). Coletado só pra vincular a ficha do
  membro e gerar o cartão. Finalidade App Functionality.
- **Data deletion**: o app tem exclusão de conta in-app (Configurações → Conta →
  Excluir minha conta) — informe a URL/caminho se a Apple pedir.

## Conta de demonstração (App Review)
- E-mail: `appstore.review@cbrio.app`
- Senha: `AppReview2026!`
- (criada na produção; já tem ficha de membro vinculada pra mostrar o cartão)

## Notas pra revisão (campo "Notes")
> App de membros da igreja CBRio. Requer login — use a conta de demo acima.
> A seção "Generosidade" coleta dízimos/ofertas (contribuições voluntárias à
> igreja) via PIX, cartão (Stripe) e Apple Pay — NÃO usa In-App Purchase,
> conforme a diretriz 3.2.1 (doações a organizações). A CBRio é uma igreja
> (organização sem fins lucrativos). Login social com Apple e Google
> disponível (Sign in with Apple incluído).
