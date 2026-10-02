# geral · integracao · erp · conhecimento operacional do app

Movido **na íntegra** do `CLAUDE.md` em 2026-10-01 (o arquivo tinha 268 KB e era carregado em toda chamada). Referência VIVA: leia o índice e a seção do assunto antes de mexer. Seção nova entra no FIM deste arquivo, datada, com uma linha a mais no índice.

**Escopo:** Integração com o ERP: varredura app × ERP, eventos, o que o web muda, censo, Cuidados, notificação com botão, ajuda, generosidade, telemetria, telas mortas, recado aberto ao Matheus (10/08).

## Índice de seções

- 📬 MATHEUS — RECADO ABERTO (10/08/2026 · escrito pela sessão do Marcos)
- ⚠️ AJUDA COM O APP · suporte do produto, no menu (29/08/2026)
- ⚠️ NOTIFICAÇÃO COM BOTÃO · confirmar/pedir troca e aprovar/recusar (29/08/2026)
- ⚠️⚠️ CUIDADOS · DUAS PORTAS, não quatro (11/08/2026 · apontamento 14)
- ⚠️ Varredura app × ERP · o que estava desalinhado (2026-08-05)
- ⚠️ EVENTOS no app · inscrição por dentro, sem link externo (2026-08-05)
- ⚠️ O que o WEB muda aparece no app (e quando) · 2026-08-05
- ⚠️ CENSO no app · só para quem NÃO respondeu (2026-08-08)
- Generosidade — notas de implementação
- Telas mortas e ambiguas · decisoes de 05/08/2026
- ⚠️ Telemetria (`lib/telemetria.ts`) · o contrato com o backend (05/08/2026)

---

## 📬 MATHEUS — RECADO ABERTO (10/08/2026 · escrito pela sessão do Marcos)

> Este bloco existe porque **não há canal direto entre as duas sessões de Claude
> Code**. O `CLAUDE.md` é o canal — a sua sessão carrega este arquivo ao abrir o
> projeto. **Apaga este bloco quando resolver**, ou responde escrevendo aqui.

### 1 · ✅ RESOLVIDO · push do Android (FCM V1) · PROVADO em 29/08/2026

Feito pelo Matheus em 18–20/08: `google-services.json` **commitado** (não é
gitignored) + `android.googleServicesFile` no `app.json` + credencial **FCM V1**
com conta de serviço **dedicada** (`eas-push-fcm`) + **build 7 (versionCode 6)**.

⚠️⚠️ **A prova é o BANCO, não o build** — medido em `app_push_tokens` em
29/08/2026:

| plataforma | tokens | pessoas | último visto |
|---|---|---|---|
| ios | 67 | 58 | 29/08 |
| **android** | **7** | **2** | 20/08 |

Antes disto eram **31 linhas, 100% iOS**. O Android passou a registrar token
**dois dias depois** do binário com FCM — ou seja o carteiro está entregando.
`Default FirebaseApp is not initialized` não aparece mais.

⚠️ **As 2 pessoas são quem instalou o binário novo** (faixa `internal` do Play).
A frota geral do Android só passa a registrar token quando um build com FCM for
**promovido no Play Console** — é passo de GENTE, não de código.

### 2 · Coordenação: onde eu vou mexer (pra não colidirmos)

Vi seus commits de hoje em `completar-cadastro.tsx`, `lib/validators.ts`,
`test/reguas.test.ts`, `lib/translations.ts` e a tela nova `censo.tsx`.

| arquivo | o que eu preciso fazer | risco |
|---|---|---|
| `lib/translations.ts` | +chaves de i18n (dívida em 282, com teto no gate) | conflito fácil |
| `test/reguas.test.ts` | +testes de régua nova | conflito fácil |
| **`lib/ficha.ts`** | **unificar a régua de "o que falta"** | ⚠️ **encosta no seu conserto do CPF** |

⚠️ **O terceiro é o que importa.** Um apontamento do Marcos é que o batismo pede
data de nascimento que a ficha já tem, e o NEXT inscreve sem mostrar a data. A
causa é a mesma: **três réguas diferentes de "o que falta"** (uma com 3 campos,
uma com 6, e o NEXT sem nenhuma).

**Eu vou ESPERAR você confirmar antes de tocar `lib/ficha.ts`.** Se já terminou,
escreve aqui que terminou. Se está em curso, escreve o que você está mudando no
gate pra eu não desfazer.

### 3 · Pergunta sobre o seu #2358

Você mergeou **#2358 — "loop infinito no completar-cadastro: o campo era validado
e descartado"** (em `appIdentidade.js`). É exatamente o bug que o Marcos
descreveu. **Isso cobre o caso todo, ou ficou ponta na tela
`completar-cadastro.tsx`?** Tenho 2 apontamentos na mesma vizinhança e quero
somar ao seu trabalho, não duplicar.

### 4 · O que já foi ao ar hoje, pra você não tropeçar

- **ERP #2361** — as **5 travas** de entrada em grupo que o app não tinha
  (gênero, `ativo`, `aceitando_inscricoes`, `fechado`, temporada). Régua nova em
  `backend/utils/entradaGrupoApp.js`. ⚠️ `publicGrupos.js` **ainda tem a cópia**
  dele, de propósito (é a porta pública principal, 462 dos 463 pedidos) — há
  ponteiro nos dois lados e **as duas têm que concordar**.
- **ERP #2362** — a trava de sexo virou **uma regra só** (desconhecido não passa)
  + migration `20260810160000` de backfill: 51 pessoas onde a própria pessoa
  declarou o sexo e o matcher descartava. ⚠️ **Não inferir sexo por nome** — está
  escrito na migration o porquê.
- **ERP #2361** trocou o número do Suporte da Apple: estava `5521999079031`, que
  **não tem caixa nenhuma no sistema**.
- **ERP #2354** (mover a função da API pra `pdx1`/Oregon) está **aberto de
  propósito** — é a API inteira, e o Marcos vai mergear numa janela calma.

## ⚠️ AJUDA COM O APP · suporte do produto, no menu (29/08/2026)

Pedido do Matheus: *"no app, no menu, tivesse um botão de ajuda com app, caso a
pessoa precise tirar dúvidas em relação ao app, seus dados e etc, de forma mais
direta e prática. E aí essas dúvidas devem chegar para o meu WhatsApp. Quero o
nome da pessoa e a dúvida dela, com o número de celular dela."*

⚠️⚠️ **NÃO é `/falar-com-a-igreja`** (a porta única de 11/08), e a diferença é de
**DESTINO**: aquela é fila **PASTORAL** (Cuidados) e esta é **SUPORTE do
produto**. *"Meu grupo não aparece no app"* não é assunto da equipe de cuidado —
misturar encheria a fila do cuidado de bug report e o suporte de pedido de
oração. A tela DIZ isso e aponta a outra porta, pra quem chegou no lugar errado
não ficar sem saída.

- ⚠️ **Esta tela não conhece pessoa nenhuma**: quem recebe vive em
  `whatsapp_config.suporte_app_membro_id`, no ERP. Trocar o destinatário é um
  UPDATE, sem tocar no app (e sem OTA).
- ⚠️ **O celular vem preenchido do cadastro e é editável** — a pessoa pode estar
  escrevendo justamente porque o cadastro está errado. ⚠️ Isso **não sobrescreve**
  `mem_membros.telefone`: o servidor só o usa pra responder.
- ⚠️ **Sem celular NÃO trava o envio**, só avisa que a resposta pode demorar:
  cadastro incompleto é o assunto de boa parte das dúvidas, e barrar deixaria de
  fora quem mais precisa de ajuda.
- ⚠️ **A tela de sucesso NÃO promete WhatsApp** ("quem cuida do app vai te
  responder pelo contato que você deixou"): o canal depende de configuração no
  ERP, e prometer o que não se controla é a tela afirmando o que o produto não
  garante.
- Manda a **versão do bundle** junto — é o que responde "essa pessoa está num OTA
  antigo?", que é metade das dúvidas de app.
- ⚠️ Voltar com texto digitado **pergunta antes de descartar** (régua
  `descartarRascunho`, a mesma da porta pastoral).

## ⚠️ NOTIFICAÇÃO COM BOTÃO · confirmar/pedir troca e aprovar/recusar (29/08/2026)

Pedido do Matheus: *"nas notificações queria as notificações dentro do app
chegassem com botão para confirmar ou pedir troca (quando a pessoa não puder
ir). Pedidos para entrar em grupo também. Claro que se clicar fora dos botões,
deve direcionar para a rota respectiva da notificação."*

- **`lib/acoesNotificacao.ts`** é **ESPELHO EXATO** de
  `backend/utils/acaoNotificacao.js` (ERP) — os mesmos casos rodam nos dois
  repos. ⚠️⚠️ Divergir tem dois estragos: o app oferece um botão que o servidor
  recusa (400 na cara da pessoa) ou esconde um que funcionaria.
- ⚠️⚠️ **Sem ALVO, sem botão.** As notificações de escala anteriores a 29/08 têm
  `data = {tipo:'escala'}` — sem id não há o que responder, e inventar um
  responderia pela escala ERRADA. Elas seguem abrindo a tela no toque.
  `grupo_pedido` sempre levou `pedido_id`.
- ⚠️ **Tocar FORA dos botões continua abrindo a rota** — os botões são
  `Pressable` aninhado e não deixam o toque subir pro card.
- ⚠️⚠️ **"Pedir troca" é RÓTULO; o fato gravado é `declined`.** O sistema **não
  procura substituto** — avisa a coordenação e o supervisor pra REPOR. O texto
  do diálogo diz exatamente isso ("a liderança é avisada pra reorganizar"), sem
  prometer troca automática.
- ⚠️ **"Confirmar presença" vai direto**; as outras três pedem confirmação, com
  o efeito escrito. **Aprovar lembra de LIGAR antes** — é o fluxo que o template
  do WhatsApp instrui desde 29/07, e aprovar por engano põe alguém num grupo sem
  conversa nenhuma. O botão não impede; lembra.
- ⚠️ **Recusar diz que NÃO é rejeição**: volta pra equipe de grupos e a pessoa
  não recebe aviso (lei de 14/07).
- ⚠️ **Parcial é declarado**: uma notificação de escala cobre os N cultos do dia
  (o aviso agrupa por pessoa+dia), então "3 de 4" nunca vira "pronto".
- ⚠️ **Erro também recarrega a lista**: a causa mais comum é a coisa já ter sido
  decidida noutro lugar, e a tela tem que refletir isso.

Testes: `test/acoesNotificacao.test.ts` (10 casos · espelham os do ERP) + **2
mutantes no gate** (escala sem ids ganhando botão · já respondida voltando a
mostrar botão).

## ⚠️⚠️ CUIDADOS · DUAS PORTAS, não quatro (11/08/2026 · apontamento 14)

Desenho do Marcos, depois de eu levantar as portas existentes: *"vamos separar em
duas portas então, uma que é esse contato SOS, que tem que ser destacado como é
hoje, e a outra é o fale com a CBRio: ao clicar, você teria 3 opções — marcar
conversa com pastor, pedir oração, e a terceira opção de enviar mensagem de
dúvida, sugestão, pedido ou feedback."* Aprovado por ele depois de testar:
*"sobre cuidados, ficou ótimo o fale com a cbrio."*

| antes | onde estava | agora |
|---|---|---|
| SOS | `/cuidados`, destacado | **intacto** |
| Pedido de oração | `/cuidados`, cartão com textarea | opção 2 |
| Conversar com pastor | `/cuidados`, cartão com botão | opção 1 |
| Fale conosco | **4 toques**: Menu → Ajustes → Configurações → Ajuda | opção 3 |

- **`lib/portaUnica.ts`** é a régua (`OPCOES_PORTA`, `podeEnviar`,
  `ehDaPortaUnica`), no portão, com **2 mutantes**. Tela:
  `app/(app)/falar-com-a-igreja.tsx`.
- ⚠️⚠️ **O SOS NÃO É ITEM DESTA PORTA, e tem mutante impedindo.** É a única
  dessas portas que pode salvar alguém em minuto zero, e oferece **CVV 188 / SAMU
  192 ANTES de qualquer formulário**. Virar item de lista somaria **dois toques
  entre a pessoa e o socorro**. A porta única mostra um atalho **visível** de
  volta pra urgência — quem chegou na porta errada e está em sofrimento não pode
  ter que voltar e procurar.
- ⚠️ **NENHUM TIPO NOVO, NENHUMA MIGRATION**: as 3 opções mapeiam **1:1** em
  `aconselhamento`, `oracao` e `contato`, que já existiam ⇒ a fila do Cuidados no
  ERP continua entendendo tudo. Inventar categoria criaria um **terceiro
  vocabulário** pra "o que você precisa" (`conversas_setores` e `cui_pedidos` já
  têm o deles). Tem mutante.
- ⚠️ **Conversa com pastor NÃO exige texto** (mutante): hoje é um botão só, e
  quem procura um pastor muitas vezes não sabe (ou não quer) escrever o motivo.
  Oração e dúvida exigem, e espaço em branco não conta.
- ⚠️ A **ORDEM** não é estética: o pedido mais pesado vem primeiro, porque a
  lista é lida de cima pra baixo por quem já está mal.
- `fale-conosco.tsx` perdeu o formulário e ficou só com os **CANAIS** (WhatsApp,
  Instagram, e-mail, mapa) — esses não são porta de preenchimento, são jeitos de
  chegar na igreja.

## ⚠️ Varredura app × ERP · o que estava desalinhado (2026-08-05)

Pedido do Marcos ("avalie todos as variáveis e tabelas dentro do nosso sistema
mobile"). O padrão de TODOS os achados é o mesmo: **o app reproduz a régua do ERP
em vez de consumi-la**, e quando a régua muda de um lado o outro não sabe.
**LEI: quem decide o que é "válido" é o BACKEND.** O app lê tabela direto pelo que
é dado DELE (perfil, devocional, cartão); régua de negócio — o que está aberto,
quem pode se inscrever, qual status vale — vem de endpoint.

- **NEXT (o caso que ele reportou)** · conserto no BACKEND (PR #2288 do sistema):
  `/next/me`, `/next/inscrever` e `/next/encontros/:id/checkin` liam
  `next_eventos`/`next_inscricoes`, a camada aposentada no cutover de turmas
  (17/06). Medido: 8 eventos 'agendado' com data máxima **21/06** contra **2
  turmas abertas** com encontros em 09, 16 e 23/08 — daí o "não há encontros do
  NEXT agendados". O app **não mudou** (o contrato da resposta foi preservado);
  `lib/api.ts` só ganhou os campos novos `turma_id`/`turma_nome`/`horario`.
- **`"recusado"` NUNCA EXISTIU** (`grupo-detalhe.tsx`): o CHECK do banco é
  `pendente|aprovado|rejeitado|devolvido|encaminhado`, e a tela decidia com
  `status !== "recusado"` → quem levava recusa ficava em "aguardando aprovação"
  **pra sempre**, em qualquer grupo (20 pedidos vivos · 14 pessoas · 1 com conta
  no app). Agora a lista de status que vale está explícita e comentada.
- **Filtros que a RLS NÃO cobre** · `mem_grupos` é `FOR SELECT USING (true)`
  (catálogo): sem `deleted_at`/`ativo`, **137 grupos apagados + 38 desativados**
  abriam por deep link com botão "Quero participar". Idem `deleted_at` em
  `mem_contribuicoes` (comprovante de IR) e `vol_inscricoes` (soft-delete
  liberado em 28/07) — hoje 0 apagadas nas duas, então é **gatilho armado**, e o
  filtro é o que impede o dia em que houver.
- **Dia em UTC** (`lib/cultos.ts`): `toISOString()` sobre o agora dá o dia UTC, e
  das 21h BRT em diante ele já virou → **o culto de quarta (20h) saía de "próximos
  cultos" durante o próprio culto**. Toda data de operação da igreja é BRT.
- **Portas de inscrição: o app tinha 4, o sistema tem 7.** Entrou **Apresentação
  de crianças** como porta WEB (abre `cbrio.org/apresentacao-criancas` no
  navegador in-app, como os "Eventos abertos"): a porta exige dado de CRIANÇA e
  consentimento de MENOR (art. 14 §1º) com snapshot do texto, e reimplementar
  seria um 2º caminho de escrita de pessoa — o que o Contrato de porta existe pra
  impedir. Líderes/anfitriões e o totem de bebês seguem fora (são de gestão).
- ✅ **Alarmes que NÃO se sustentaram** (registro proposital): `app_destaques`
  parece ignorar `ativo`/janela mas a **RLS filtra** (`supabase/destaques.sql`);
  e o `sexo` do cadastro **não** é descartado — o backend grava `mem_membros.genero`
  desde hoje mais cedo. Ia "consertar" o que funciona nos dois casos.

⚠️ **O SCHEMA DO APP VIVE NESTE REPO** (`supabase/*.sql`), não nas migrations do
ERP: `app_destaques`, `app_notificacoes`, `app_push_tokens`,
`app_grupos_temporada`, `app_solicitacoes_exclusao`, `handle_new_user_membro`.
É por isso que a lei do gatilho de `auth.users` no CLAUDE.md do sistema registrou
"nunca foi commitado" — não estava lá; está aqui.

### Rodada 2 · fechamento (mesmo dia · "corrigir todos esses achados")

- **BOTÃO FÍSICO DO ANDROID = a mesma árvore da seta** (`BackHandler` em
  `(app)/_layout.tsx` · pedido dele: "faça o botao fisico ser igual ao da seta").
  ⚠️ Na **Home** e em **`/completar-cadastro`** ele NÃO intercepta: engolir o back
  na raiz é como se faz um app que não fecha (a Play Store reclama), e sair do
  cadastro por gesto cai em loop com o `CadastroGate`. ⚠️ `Modal` do react-native
  (6 telas, todas com `onRequestClose`) trata o back no próprio diálogo nativo e
  não chega no handler — modal aberto fecha o modal, como antes.
- **`lib/volStatus.ts` = régua ÚNICA do voluntariado.** O ERP tem **7** status
  (`VolInscricoes.tsx` é a fonte) e o app tratava 3. Medido: `integrado` 575 ·
  `inscrito` 80 · `enviado_ministerio` 68 · **`nao_responde` 69 ·
  `nao_pode_ou_duplicata` 19 · `kids` 3**. A divergência aparecia na MESMA
  abertura: o hub dizia "Pendente" (`!== 'integrado'`) e a tela de Servir mostrava
  o FORMULÁRIO (status fora dos 3 caíam no `else`). Agora: `integrado`/`kids` =
  ativo · `inscrito`/`enviado_ministerio` = pendente · `nao_responde`/
  `nao_pode_ou_duplicata`/`desistente` = **nenhum** com aviso "sua inscrição
  anterior foi encerrada" (o dedup do backend permite re-inscrição). ⚠️ Status
  novo no ERP entra SÓ nesse arquivo; desconhecido vira "nenhum" (deixa a pessoa
  agir) e nunca "pendente" (fila que ninguém trata).
- **+11 leituras ganharam `deleted_at`** (`mem_membros` ×5, `mem_devocionais` ×4,
  `mem_grupos` ×2, `cultos`) — a RLS não filtra nada disso. ⚠️ No `grupo-editar`
  entrou só `deleted_at`, **não** `ativo`: o líder precisa poder editar grupo
  pausado; quem trava a inscrição é a face pública (`/grupo-detalhe`).
- **`lib/dataBRT.ts`** centraliza o dia da igreja (espelho do `hojeBRT()` do
  backend): a lista de cultos, a **chave de cache** dela e o filtro de
  indisponibilidade do voluntariado estavam em UTC. ⚠️ O check-in do devocional
  segue em hora do APARELHO de propósito — o "hoje" de quem lê é o do lugar onde
  a pessoa está; BRT é pra AGENDA (culto, escala, encontro).
- **No servidor** (PR #2290 do sistema): `resolveMembroApp` passou a filtrar
  soft-delete no caminho do profile (cadastro apagado servia o app inteiro — 3
  contas do app foram soft-deletadas em 04/08) e `POST /app/inscricoes` com
  `tipo:'next'` parou de dizer "enviado" sem inscrever ninguém.

**Auditoria automática que PASSOU** (registro pra não refazer): rodei as **38
consultas literais do app contra o schema de produção** — **0 erros de coluna**.
Isso importa porque select nomeando coluna inexistente faz o PostgREST recusar a
query INTEIRA e o app trata como "vazio" (a armadilha do `parcelas_max`).
Conferido também: `kids_vinculo_solicitacoes` usa
`pendente|aprovado|rejeitado|cancelado` e o app compara os certos.

## ⚠️ EVENTOS no app · inscrição por dentro, sem link externo (2026-08-05)

Pedido do Marcos: *"ao clicar em inscrições, aparecem todos os eventos da igreja,
com um seletor de todos os eventos e eventos inscritos; nessa aba, ao clicar deve
aparecer minha inscrição naquele evento — e eu quero que os outros eventos tenham
inscrições PELO APP também, sem link externo como é o caso do celebra."*

- **Seletor `Todos | Meus eventos`** na aba Inscrições (`inscricoes.tsx`) — NÃO é
  aba nova, é recorte da mesma lista. "Meus" vem de `GET /app/eventos/minhas`
  (tabela `inscricoes`), que é o que traz o estado REAL da pessoa.
- **Tela `/evento?id=`** (`evento.tsx`) faz os dois papéis: **já inscrita** → a
  inscrição dela (estado, número da sorte, **QR do comprovante**, "Pagar agora"
  quando pendente, respostas); **não inscrita** → o **formulário dentro do app**.
- ⚠️⚠️ **O FORMULÁRIO NÃO REPETE A RÉGUA DO SERVIDOR.** O
  `POST /app/eventos/:id/inscrever` executa a MESMA função da porta pública
  (`inscreverEspinha`) — contrato de campos, benefício por CPF, vaga atômica,
  consentimento e cobrança idênticos. Aqui só **pré-preenchemos** (a ficha do
  cadastro, via `SeusDados`), pedimos os campos **EXTRA** do form-builder e
  exibimos o erro que o servidor devolver.
- ⚠️ **PAGAMENTO continua na página hospedada** (`/pagamento/<token>`): é onde
  vivem Pix/boleto/cartão e o escopo PCI — dado de cartão nunca entra no app.
- ⚠️ **Evento com campo `imagem` cai no form público** (o app não sobe arquivo pro
  pipeline daquele formulário): melhor mandar pro caminho que funciona do que
  mostrar um campo que não envia. Caso real: "Patrocinadores - Celebra 2026".
- ⚠️ **Ficha incompleta não tenta inscrever**: o contrato exige CPF, nascimento e
  sexo; sem isso o servidor recusaria. A tela leva pro cadastro.
- ⚠️ `MembroBasico` ganhou **`genero`** — `validarCamposPadrao` exige sexo
  (`exigirSexo` é true por padrão), e sem esse campo o app pediria de novo algo
  que a ficha já tem (ou levaria 400 do servidor).
- ⚠️ A resposta do servidor tem **`pagamento` BOOLEAN**, não objeto: o link do
  pagamento se monta do `public_token` (`urlPagamentoDaResposta` em `lib/api.ts`).
  Eu havia tipado como objeto e a tela nunca acharia o link.

## ⚠️ O que o WEB muda aparece no app (e quando) · 2026-08-05

**É o MESMO banco** (projeto Supabase `hhntwfawfnxvuobhdfkb` nos dois) — não existe
sincronização. O que separa "mudou no web" de "apareceu no app" é: **(1) quando a
tela recarrega · (2) se a régua bate nos dois lados · (3) se o app tem onde
mostrar**.

- **Recarregar ao FOCAR passou de 16 pra 22 telas** — entraram batismo,
  grupo-detalhe (a aprovação do pedido acontece no web!), buscador de grupos
  (grupo criado/desativado lá), devocional, culto-detalhe e escala do supervisor.
  ⚠️ **Formulário NÃO recarrega ao focar** (perfil, grupo-editar,
  completar-cadastro): refetch em cima do que a pessoa está digitando é pior que
  dado velho.
- **Realtime existe em UMA tabela**: `vol_inscricoes` (`useVoluntariadoSync`) —
  aceitar um voluntário no web aparece em segundos.
- **Cache**: só destaques da Home e próximos cultos (SWR 10 min). Dado da pessoa
  fica em contexto por sessão e revalida ao voltar do background se passou de 5 min.
- **`useAdminGrupo` parou de decidir por `profiles.role`** (esquema APOSENTADO) —
  agora pergunta ao servidor (`GET /app/grupos/papel`, que calcula pela matriz +
  boost de área). Quem tem grupos ≥ 3 pela matriz editava no web e **não** no app.
  Falha de rede é **fail-closed** (não concede permissão).

## ⚠️ CENSO no app · só para quem NÃO respondeu (2026-08-08)

Pedido do Matheus: *"o censo deve aparecer no app de membros também, para os
membros que não fizeram. Quem já fez, o sistema vai saber pelo CPF, e vai ter um
aviso dizendo que aquela pessoa já preencheu."*

Tela `/censo` (Menu → Você, entre "Sua jornada" e "Generosidade").

### ⚠️⚠️ QUEM DECIDE É O BACKEND — a tela não calcula nada

`GET /api/app/censo` devolve `ja_respondeu` **e** a `url`, e **a url só é
emitida para quem pode responder**. Se um dia esta tela tiver um bug e ignorar a
flag, ela não tem para onde abrir. A trava não depende de o app estar
atualizado — e é bom que não dependa: OTA chega em todo mundo, mas ninguém
controla quando.

### ⚠️⚠️ O CPF é o que fecha a janela do pós-processamento

O vínculo resposta→pessoa no ERP é DEFERIDO de propósito (durante o culto,
resolver identidade custava 7 das 8,3 idas ao banco por resposta). Existe uma
janela — minutos a horas — em que a resposta está no banco, concluída, com o CPF
certo, e **sem `membro_id`**. Checar só por vínculo diria "ainda não respondeu"
para quem acabou de responder no culto, e o segundo envio **não é barrado por
nada** (a idempotência do censo é por APARELHO, não por pessoa).
A regra única vive em `backend/services/censoJaRespondeu.js` (repo do ERP) e é
usada pelos DOIS caminhos — o prefill do formulário público e este endpoint.

### ⚠️ O formulário NÃO foi reescrito em React Native

São 108 perguntas com condicionais, rascunho, fila offline e um bloco sensível,
tudo testado e no ar. A tela abre o MESMO formulário público num `WebView`, com
`?t=<token>` — token de identidade assinado que o backend emitiu para esta
sessão. Reimplementar seria uma segunda fonte de verdade, e a que ficasse para
trás mentiria em silêncio.
- ⚠️ **A pessoa não digita CPF**: o `POST /public/censo/:slug/prefill` aceita
  `{ identidade }` e devolve os valores do cadastro. Pedir CPF + nascimento a
  quem acabou de fazer login com senha é teatro de segurança — o token é
  assinado, o CPF é digitável por qualquer um.
- ⚠️ **`membro_id` nunca trafega cru** — senão bastaria trocar o uuid no
  aparelho para responder no lugar de outra pessoa.
- ⚠️ **Modal, não `WebBrowser`**: sair para o navegador perderia a sessão e faria
  a pessoa se identificar de novo, que é justamente o atrito que o token remove.
- ⚠️ Recarrega ao FOCAR — inclusive ao fechar o WebView, que é exatamente quando
  `ja_respondeu` costuma ter mudado.
- ⚠️ Erro de rede **não** vira "você já respondeu" nem "não tem censo": as duas
  seriam afirmações falsas com cara de informação (a lição do `meu-grupo`).

## Generosidade — notas de implementação

**⚠️ NAO existe tela de PIX no app — e nao recriar sem forma aprovada
(05/08/2026):** por algumas horas a rota `/generosidade` mostrou uma tela so com
a chave PIX da igreja. Foi **RETIRADA no mesmo dia**, por decisao do Marcos, ao
saber que exibir chave de doacao e exatamente o que a guideline **3.2.2(iv)** da
App Store proibe — o mesmo motivo que tirou o modulo de doacoes da submissao em
out/2026, e sair por OTA nao torna a regra menos valida ("nao queremos correr o
risco disso sair do ar; vamos pensar em uma forma de fazer isso posteriormente").
A rota voltou a `<Redirect href="/" />` enquanto `FEATURES.generosidade` e false,
e o item saiu do menu.
- ⚠️ **`constants/pix.ts` ganhou `CNPJ_IGREJA`**: o comprovante anual de doacoes
  imprime "CNPJ …" e estava lendo `PIX_KEY_FORMATADA`. Quando a chave virou
  e-mail, o comprovante passou a dizer **"CNPJ pix@cbrio.com.br"**. Dado fiscal
  nao empresta constante de outro assunto.
- `PIX_KEY` guarda a chave atual e **nao e exibida em lugar nenhum** — o unico
  leitor e o modulo desligado.

- **⚠️ Menu enxuto (04-05/08/2026 · pedido do Marcos):** o menu é o que **NÃO**
  está na barra de baixo nem na faixa de cima. 4 seções — **Você** (Meu perfil ·
  Minha família · Sua jornada) · **Participar** (Inscrições ·
  **Meu grupo** · **Batismo** · NEXT) · Conteúdo (Pregações) · Ajustes
  (Configurações) + Sair.
  Arrumação de 05/08: **Batismo desceu** pra Participar (é inscrição, não dado
  seu) · **Check-in Kids saiu do menu** e virou cartão dentro de **Minha
  família** (quem faz check-in é o responsável, na tela onde ele cuida da
  família) · **Generosidade** entrou em Você e fecha os 4 · **"Inscrições do meu
  grupo" virou "Meu grupo"** apontando pra MESMA tela da barra (`/meu-grupo`) —
  era isso que fazia "grupos" no menu e "Grupos" na barra abrirem coisas
  diferentes; a fila de quem lidera já é cartão lá dentro, então o menu não
  consulta mais `getGrupoPapel()`. **Saíram, e cada um tem destino:** "Início" (não existe
  botão de início — a Home é a seta) · "No culto" (card de ao vivo na Home) ·
  "Avisos" e "Notificações" (o sino, em toda tela — e o **mural virou uma porta
  dentro de Notificações**, senão ficaria inalcançável sem push · a lista in-app
  ganhou `case "comunicado"`, que só existia no `notifTap` da push) · "Cartões"
  (virou **"Cartão de Membro"** no Perfil, com a instrução de uso na linha) ·
  "Grupos"/"Meu grupo"/"Meus grupos" (**3 entradas viraram 1**: `/meu-grupo`
  lista os meus, mostra a fila de inscrições de quem lidera e tem "Entrar em
  outro grupo") · "Fale conosco"/"Sobre a CBRio" (dentro de Configurações).
  ⚠️ **Atalho na Home é só pra o que NÃO está na barra nem no menu** — saíram
  Devocional, Meu grupo, Servir, Cuidados e Inscrições; ficaram Sua jornada,
  NEXT, Batismo, Kids e Generosidade.
  ⚠️ **"Métodos de pagamento" pedido no ponto 3 NÃO existe e não foi inventado:**
  o app nunca guarda dado de cartão (checkout hospedado no provedor · escopo PCI
  fora de nós), então não há cartão pra "salvar ou descadastrar". O que existia
  em Configurações era só a **preferência de qual método abre na Generosidade** —
  e ela agora fica **escondida enquanto `FEATURES.generosidade` é false**
  (configurar uma tela que não existe). Quando as doações voltarem (Benevity), é
  aí que a conversa sobre cartão salvo faz sentido.
- **Comprovante anual de doações (IR):** tela `comprovante-doacoes.tsx`
  (link no rodapé da Generosidade). Lê `mem_contribuicoes` do membro logado
  (RLS `membro_id = current_user_membro_id()` já permite), seletor de ano,
  gera PDF via `expo-print` + compartilha via `expo-sharing`. Só doações
  CONCLUÍDAS entram (cartão/Apple Pay via webhook Stripe; PIX quando o
  financeiro concilia). Nota: doação a igreja não é dedutível — o comprovante
  serve pra ficha "Doações Efetuadas" (código 99).

- **Apple Pay:** módulo nativo local em `modules/apple-pay` (PassKit). A sheet
  devolve o token cru; a Edge Function `generosidade-apple-pay-confirm`
  tokeniza na Stripe (params `pk_token*` no NÍVEL RAIZ do form, não em
  `card[...]`). O botão é o **oficial do sistema** (`PKPaymentButton` tipo
  donate) via view nativa do módulo (`ApplePayButton` em
  `modules/apple-pay/src/ApplePayButton.tsx`) — exigência das HIG; fallback
  custom só pra binário antigo/dev client. ⚠️ O evento da view nativa se chama
  `onApplePress` (NÃO `onPress`: colidiria com o `topPress` core do RN e
  derruba a tela com "Event cannot be both direct and bubbling").
- **Apple Wallet (cartão):** `addPass`/`canAddPasses` também vivem no módulo
  `apple-pay` (PKAddPassesViewController). Substituímos a lib
  `react-native-wallet-pass` (de 2021), que QUEBRA na nova arquitetura do RN
  (constantes não bridgeadas → `PassKit.AddPassButtonStyle` undefined) e era a
  causa do crash da tela de cartões. O botão "Add to Apple Wallet"
  (`components/cartao/AddToWalletButton.tsx`) é estilizado conforme a marca,
  não usa mais view nativa de terceiro.
- **Confirmação de doação:** `components/generosidade/SucessoDoacao.tsx`
  (modal com confete + haptic de sucesso) — Alert de sistema só pra erro.
- **⚠️ .gitignore:** os padrões nativos são ancorados na raiz (`/ios/`,
  `/android/`). NUNCA voltar pra `ios/`/`android/` sem âncora — isso já
  excluiu `modules/apple-pay/ios|android` do upload do EAS e os builds 1–9
  saíram sem o módulo nativo do Apple Pay.

## Telas mortas e ambiguas · decisoes de 05/08/2026

- **Mortas**: `/inscricao-grupos` apagada (acidental). **`/inscricao-next` FICA**
  — e redirect proposital pra `/next`, cobrindo deep link antigo.
  **`/verificar-telefone` FICA** — parada de proposito (SMS/OTP desligado).
- ⚠️ **Parecem mortas e NAO sao** (nao "limpar"): `/login`, `/cadastro` e
  `/recuperar-senha` entram por caminho `(auth)/…`; **`/redefinir-senha` entra
  por DEEP LINK** do e-mail de recuperacao — nenhuma varredura de codigo acha.
- **"Assistir ao vivo" era 3 portas** pro mesmo link do YouTube (Home,
  `/modo-culto`, `/videos`). Saiu de `/videos`: o ao vivo e do CULTO; Pregacoes
  e o acervo.
- **Anotacoes eram duas coisas com o mesmo nome**: `/anotacoes` mostra as do
  DEVOCIONAL (servidor · `mem_devocionais`), e `/modo-culto` guarda as da
  PREGACAO **so no aparelho** (AsyncStorage, por dia). Renomeadas ("Anotacoes do
  devocional" x "Anotacoes da pregacao") + aviso na tela do culto. ⚠️ Mandar a do
  culto pro servidor **exige tabela/endpoint novos** — passo combinado pra depois.
- **Jornada · Conectar** leva pra `/meu-grupo` quem JA tem grupo (antes mandava
  todo mundo pro buscador — o "proximo passo" de quem ja deu o passo).
- **Hub de Inscricoes**: o card de voluntariado virou **"Quero servir"** (a barra
  ja tem "Servir", que e a AREA; aqui e a PORTA de inscricao).
- **Os 3 "hubs"** (`/inscricoes`, Menu, `/jornada`) **NAO foram unificados** —
  decisao do Marcos: "nao acho que competem nao".

## ⚠️ Telemetria (`lib/telemetria.ts`) · o contrato com o backend (05/08/2026)

O app manda telas/ações/erros em lote pra `POST /api/app/telemetria`, que grava
em `app_eventos` (visível em `/admin/app-analytics` no sistema).

**Ela ficou 5 dias MORTA em silêncio** (31/07→04/08): o sistema criou
`app_eventos.event_id NOT NULL` pro dedup e o app não mandava esse campo. A
pegadinha: o normalizador do backend devolvia `event_id: undefined` e
**`Object.keys()` inclui chave com `undefined`**, então o supabase-js montava
`?columns=…,event_id`, o PostgREST inseria NULL e dava `23502` — **lote inteiro
descartado**. Como o endpoint responde **HTTP 200 `{ok:false}`** de propósito
(telemetria não pode quebrar o app) e o app ignorava o corpo, ninguém soube.
Descobri quando fui usar a telemetria pra diagnosticar o próprio app.

- O app agora manda **`event_id`** (uuid por evento · `expo-crypto`),
  **`occurred_at`** (quando ACONTECEU · o `created_at` é quando chegou),
  **`session_id`** (uma abertura), **`installation_id`** (aparelho, persistido em
  `cbrio:installation_id`), **`os_version`**, **`device_model`**,
  **`manufacturer`** e **`build_number`**.
- ⚠️ Tudo de `Platform.constants` + `expo-constants` — **sem dependência nativa
  nova**, senão a mudança não sairia por OTA.
- ⚠️ **`Constants.deviceName` é PROIBIDO**: no iOS vem "iPhone de \<nome da
  pessoa\>" (PII). No iOS mandamos o formato (`handset`/`pad`), que responde
  "celular ou tablet?" sem identificar ninguém.
- O app **checa o corpo** da resposta (`{ok:false}` = falhou, mesmo com 200) e
  **retenta o lote 1×** — reenviar é seguro porque o backend deduplica por
  `event_id`. Fila limitada a 60 eventos (nunca cresce sem limite).
- ⚠️ **`props` passa por WHITELIST no backend** e chave fora da lista é jogada
  fora **sem erro**: das 10 chaves que o app mandava, **só `message` passava**.
  Chaves válidas: `message` · `fatal` · `screen` · `route` · `action` · `reason` ·
  `status_code` · `endpoint` · `permission` · `notification_type` · `entity_id` ·
  `label` · `source`. **`entity_id`** = id de COISA (grupo, vídeo, comunicado),
  **nunca de pessoa; `label`** = rótulo curto de enum NOSSO, **nunca texto que a
  pessoa digitou**. Chave nova exige mudar a whitelist em
  `backend/services/systemMobileOps.js` (repo do sistema) — e responder antes:
  *isso pode identificar alguém?*
