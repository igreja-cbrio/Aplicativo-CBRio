# Backlog de posts para LinkedIn — Série "Construindo o app da CBRio"

> Posts prontos, divididos por tecnologia/ferramenta. Publique aos poucos
> (sugestão: 1 a 3 por semana). Cada post é independente. Edite o tom como
> preferir. As hashtags são sugestões — use 3 a 5 por post.
>
> **Dica de ordem:** comece pelo Post 0 (abertura), depois siga a numeração.
> A cada post você reforça uma competência diferente do seu perfil.

---

## Post 0 — Abertura da série

🚀 Decidi documentar uma jornada por aqui.

Construí (e mantenho) um aplicativo completo de membros para uma igreja —
rodando em iOS e Android, com pagamentos reais, autenticação, notificações e um
sistema integrado por trás.

Nas próximas semanas vou abrir o capô e mostrar, peça por peça, as tecnologias e
decisões por trás dele. Não é tutorial — é "construindo em público": o que usei,
por que usei e o que aprendi.

Se você curte produto, mobile, automação ou IA, vem comigo nessa série. 👇

#desenvolvimento #mobile #buildinpublic #tecnologia

---

## Post 1 — React Native + Expo

📱 Um app. Dois sistemas operacionais. Uma base de código.

O app da igreja roda em iPhone e Android a partir do **mesmo código**, usando
**React Native + Expo**.

Por que isso importa na prática:
→ Metade do tempo e do custo de manter dois apps separados
→ Uma correção conserta os dois ao mesmo tempo
→ Acesso a recursos nativos (câmera, biometria, carteira digital) quando preciso

A lição: escolher a stack certa no início é o que decide se o projeto é
sustentável ou um pesadelo de manutenção lá na frente.

#reactnative #expo #mobile #desenvolvimento

---

## Post 2 — TypeScript

🧱 Código que avisa o erro antes do usuário encontrar.

O app inteiro é escrito em **TypeScript** no modo *strict*.

Na prática, isso significa que boa parte dos bugs aparece **enquanto eu escrevo**,
não depois que o app está na mão de centenas de pessoas. Em algo que mexe com
dados de membros e pagamento, isso não é luxo — é responsabilidade.

Velocidade sem segurança é dívida. TypeScript é o que me deixa ir rápido sem
quebrar o que já funciona.

#typescript #qualidadedesoftware #desenvolvimento

---

## Post 3 — Autenticação e login social (OAuth)

🔐 "Entrar com Google" e "Entrar com Apple" parecem simples. Não são.

No app implementei login por **e-mail/senha, Google e Apple**, com sessão que
persiste, opção de "lembrar de mim" e recuperação de senha.

Por trás dos botões tem **OAuth 2.0**, tokens, fluxo seguro com o provedor e
regras de quando manter ou descartar a sessão.

A meta é invisível: o usuário só quer apertar um botão e entrar. Todo o trabalho
existe justamente pra ele nunca perceber o trabalho.

#oauth #autenticacao #seguranca #mobile

---

## Post 4 — Supabase (backend + banco de dados)

🗄️ Todo app bonito esconde um backend que faz o trabalho pesado.

O do app da igreja roda em **Supabase**: banco de dados **PostgreSQL**,
autenticação e API, tudo integrado.

O ponto que mais me orgulha aqui é a **segurança a nível de linha (Row Level
Security)**: cada pessoa só enxerga os próprios dados, com a regra aplicada
**no banco**, não só na tela. Mesmo que alguém burlasse o app, o banco não
entrega o que não é dele.

Segurança de verdade mora na camada mais profunda — não na interface.

#supabase #postgresql #backend #seguranca

---

## Post 5 — Edge Functions (backend serverless)

⚡ E quando o app precisa fazer algo que o celular não pode fazer sozinho?

Pagamentos, envio de notificação, regras sensíveis — nada disso pode rodar no
celular do usuário (seria inseguro). Pra isso uso **Edge Functions**: pequenos
pedaços de backend que rodam na nuvem, sob demanda.

Sem servidor pra eu administrar, sem máquina ligada 24h gastando dinheiro à toa.
Roda quando é chamado e pronto.

É a infraestrutura que cresce sozinha conforme a necessidade.

#serverless #edgefunctions #backend #cloud

---

## Post 6 — Pagamentos com cartão (Stripe)

💳 Receber dinheiro de verdade dentro de um app é onde a brincadeira fica séria.

Implementei doações por **cartão de crédito usando a Stripe**.

A decisão mais importante foi de segurança: **os dados do cartão nunca passam
pelo meu sistema**. A digitação acontece no ambiente certificado da Stripe (PCI
nível 1). Eu recebo só a confirmação — nunca o número do cartão.

Quando o assunto é dinheiro, a melhor arquitetura muitas vezes é aquela em que
você **carrega o mínimo de responsabilidade possível**.

#stripe #pagamentos #fintech #seguranca

---

## Post 7 — Apple Pay

🍎 Doar com dois toques e o Face ID.

Além do cartão digitado, o app aceita **Apple Pay**: a pessoa paga com o cartão
que já está no iPhone, autenticando pelo rosto ou digital, sem digitar nada.

Por baixo, o app gera um **token criptografado** da Apple, manda pro backend e a
Stripe processa a cobrança. O usuário vê só a simplicidade; a complexidade fica
escondida onde deve ficar.

Reduzir o atrito na hora de pagar é, literalmente, aumentar a contribuição.

#applepay #pagamentos #ux #mobile

---

## Post 8 — Pix

🇧🇷 Nenhum app brasileiro de pagamento está completo sem Pix.

No app, a área de generosidade oferece **Pix com QR Code e "copia-e-cola"**,
gerados a partir dos dados oficiais da instituição.

A pessoa aponta a câmera ou copia o código e paga em segundos, direto no app do
banco dela.

Conhecer o meio de pagamento que o seu público realmente usa vale mais do que
qualquer tecnologia importada.

#pix #pagamentos #brasil #mobile

---

## Post 9 — Notificações push + tempo real

🔔 O app que fala com você na hora certa.

Implementei **notificações push** e **sincronização em tempo real**: quando algo
acontece no sistema (uma escala, um pedido aprovado, um alerta de cuidado), a
pessoa é avisada na hora — e a tela se atualiza sozinha, sem precisar recarregar.

Tem inclusive um fluxo de **SOS** que dispara um alerta imediato para a equipe
responsável. Tecnologia a serviço de cuidar de gente.

Notificação boa não é a que aparece muito — é a que aparece na hora exata.

#pushnotifications #realtime #mobile #produto

---

## Post 10 — Carteira digital (QR Code / Wallet)

🎟️ O cartão de membro saiu do plástico e entrou no celular.

O app gera um **cartão digital com QR Code** e permite **adicionar à carteira
do celular** (Apple/Google Wallet).

Acabou o cartãozinho perdido na carteira: a identificação do membro está sempre
à mão, no mesmo lugar onde já ficam os cartões e ingressos.

Digitalizar um processo não é só colocar na tela — é tirar o atrito que existia
no mundo físico.

#wallet #qrcode #digital #mobile

---

## Post 11 — Pensando em escala

📈 "E se mil pessoas abrirem o app ao mesmo tempo, no domingo?"

Essa é a pergunta que separa um protótipo de um produto.

Fui revisar o app justamente com esse olhar: onde estavam as consultas
desnecessárias, o que pesava no backend em horário de pico, o que dava pra
**cachear** e o que dava pra deixar de chamar repetidamente.

Funcionar com 1 usuário qualquer código funciona. Funcionar com mil ao mesmo
tempo é engenharia.

#escalabilidade #performance #engenhariadesoftware #backend

---

## Post 12 — Encerramento da série

🧩 Doze posts depois, a peça que une tudo: visão de produto.

Mostrei mobile, autenticação, banco de dados, pagamentos, notificações,
escala...

Mas a verdade é que **a tecnologia é o meio, não o fim**. O que realmente
importou em cada decisão foi a mesma pergunta: *isso resolve melhor o problema
de quem vai usar?*

É isso que eu faço: pego um processo manual ou uma ideia e transformo em uma
solução digital que funciona de verdade, de ponta a ponta.

Se você tem um processo que precisa virar produto — ou uma operação que pede
automação —, vamos conversar. 👇

#produto #automacao #ia #desenvolvimento #buildinpublic
