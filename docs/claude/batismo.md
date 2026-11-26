# batismo · conhecimento operacional do app

Movido **na íntegra** do `CLAUDE.md` em 2026-10-01 (o arquivo tinha 268 KB e era carregado em toda chamada). Referência VIVA: leia o índice e a seção do assunto antes de mexer. Seção nova entra no FIM deste arquivo, datada, com uma linha a mais no índice.

**Escopo:** Batismo: escolha da data e do horário (régua de OTA de worktree limpa também está aqui).

## Índice de seções

- Halo suave: câmera frontal e preparação da versão de loja 1.0.7 (26/11/2026)

- ⚠️⚠️ "Encontrar minhas fotos" · busca por selfie no álbum (24/11/2026)
- ⚠️⚠️ Álbum do batismo · galeria privada e download (24/11/2026 · par do ERP #3884)
- Endereço nos convites (16/11/2026)
- Convites pessoais (16/11/2026)

- Contagem pessoal na Home e Meu batismo (16/11/2026)

- ⚠️⚠️ BATISMO · a pessoa ESCOLHE a data (25–26/09/2026 · #177 + #179 · par do ERP #3063)
- ⚠️ Batismo · seletor de HORÁRIO na inscrição (2026-08-13)

---

## ⚠️⚠️ BATISMO · a pessoa ESCOLHE a data (25–26/09/2026 · #177 + #179 · par do ERP #3063)

Pedido do Matheus: *"preciso que na inscrição de batismo tenha como escolher o
mês... isso deve refletir tanto no formulário público quanto no app dos
membros."* Até então a tela calculava a data sozinha (`proximoBatismo()`, a
fórmula do 4º domingo) e **não mandava data nenhuma** no envio.

- **As datas vêm do SERVIDOR**: `GET /public/batismo/horarios` ganhou
  `datas: [{data_batismo, horarios}]` — as 3 próximas datas abertas de
  `batismo_eventos`, cada uma com a ocupação POR data. `data_batismo`/`horarios`
  no topo continuam existindo: é o contrato antigo, pra bundle sem OTA.
- ⚠️⚠️ **Sem `datas` na resposta = comportamento antigo, byte a byte** (servidor
  antigo, timeout): a tela cai na data única do topo. `proximoBatismo()` fica
  só como RESERVA do banner antes de a resposta chegar — **não ensinar essa
  função a calcular N meses**: recriaria a divergência que esta leva fecha (a
  fórmula já errou em dez/2024, batismo antecipado pro 3º domingo).
- ⚠️⚠️ **`data_batismo: dataEscolhida` VIAJA no payload, e é ESCOLHA, não
  required.** A inscrição do app não passa pelo endpoint: grava em
  `app_inscricoes` e o gatilho `fn_app_inscricoes_fanout` cria a linha do
  batismo. Até 25/09 ele carimbava `fn_proximo_quarto_domingo()` FIXO e
  descartava qualquer data — a tela diria novembro, o banco gravaria setembro,
  calado. O ERP corrigiu por patch dinâmico (migration `20260925121000`,
  conferida VIVA em 26/09: a função lê `dados->>'data_batismo'`). Sem data, ou
  data fora da janela aberta, o banco cai na primeira aberta — regra dele, não
  do app. **Nunca travar o envio por causa desse campo.**
- ⚠️ **Seletor só com `datas.length > 1`** — com uma, o banner "Próximo
  batismo: X" já responde. Cartão sem horário aberto fica desabilitado ("sem
  vaga"); trocar a data TROCA os horários e limpa a seleção se o horário não
  existir na data nova (a ocupação é por data, e "09:30" de setembro não é o
  slot de novembro).
- ⚠️ **Data de calendário por componentes LOCAIS** (`isoParaDataLocal`):
  `new Date('2026-09-27')` é meia-noite UTC = 21h do dia anterior no Rio, e o
  cartão do domingo 27 diria "sábado, 26".
- **Banner: "Sempre no 4º domingo" virou "Geralmente"** (#179): as datas são
  cadastro e podem não ser o 4º domingo. A chave antiga fica em
  `lib/translations.ts` pra bundle velho.
- Guarda em `test/reguas.test.ts` ("batismo · escolher a data") + 2 mutantes em
  `scripts/mutantes.mjs` (payload sem data · seletor com 1 data). 4 mutantes
  rodados e mortos em 26/09.

### ⚠️⚠️ O 1º OTA desta feature saiu da BASE ERRADA (26/09/2026)

Update "feat(batismo): escolha da data de batismo no aplicativo" (madrugada de
26/09). Pelo estado do checkout principal `~/Aplicativo-CBRio` — branch
`claude/ledger-android-vc9` em `14a34c1` (base de 21/09) com a tela editada
SEM COMMIT — foi dali que ele saiu: a frota recebeu a escolha de data e
**perdeu #160–#177** — 18 PRs, tudo desde 21/09 (Devocionais, Servir,
Grupos, Next…) — por alguns minutos. O #177
reaplicou a mudança sobre a main atual e o OTA corretivo ("fix(app): restaura
base atual com datas de batismo") saiu em seguida. É a mesma armadilha do
Devocional de 03/09 (update `3aa750e3` sem commit).
⚠️⚠️ **Régua: OTA sai de uma worktree LIMPA em `origin/main` (ou do PR recém
mergeado), nunca do checkout principal** — ele fica dias numa branch antiga.
Antes de `npm run ota`: `git status` limpo **e** `git log -1` igual a
`origin/main`.
⚠️ Em 26/09 o checkout principal AINDA está nessa branch com os 2 arquivos
modificados sem commit — é resíduo do acidente, não trabalho a preservar.

## ⚠️ Batismo · seletor de HORÁRIO na inscrição (2026-08-13)

Pedido do Marcos: *"na inscrição de batismo, tenha a mesma opção de escolher os
horários abertos que tem no formulário de inscrição"*. A tela **já chamava**
`GET /public/batismo/horarios` desde sempre — só usava o `grupo_url` e
**descartava a lista**.

- `inscricao-batismo.tsx` renderiza chips com o que o SERVIDOR mandou e envia
  `horario_culto` no payload. **O app não decide nada**: o endpoint já esconde
  fechado e lotado (régua `utils/batismoHorario.js` no ERP). É a lei "quem
  decide o que é válido é o BACKEND" — não replicar `aberto`/`limite` aqui.
- ⚠️ **Lista vazia = seletor não aparece**, e a inscrição segue valendo (o campo
  é opcional no servidor). Falha de rede não pode virar tela travada num
  formulário que a pessoa já preencheu.
- ⚠️ **Seleção que sumiu da lista é limpa** no refetch: horário que fechou ou
  lotou entre abrir a tela e enviar levaria **409** do servidor.
- ⚠️ Do lado do ERP (mesma leva): o fan-out **não copiava** `horario_culto` pro
  `batismo_inscricoes` — sem a migration `20260813120000` o horário era validado
  e **descartado em silêncio**. Bundle antigo, que não manda o campo, continua
  gravando NULL exatamente como hoje.

## Contagem pessoal na Home e Meu batismo (16/11/2026)

- Home consulta a inscrição do próprio membro (`meuBatismo`) e prioriza um aviso
  clicável para `/batismo` apenas enquanto agendada/hoje. Resultado guarda o ID
  do membro para não reutilizar aviso de outra conta durante troca de perfil.
- `BatismoCountdownCard` mostra dias, horas e minutos até `data_batismo` +
  `horario_culto`, já existente no banco. Sem horário: só dias; sem data válida:
  confirmação de recebimento, sem estimativa. Não há alteração no banco.
- Cálculo puro em `lib/batismoContagem.ts`, BRT explícito, atualizado a cada 30s
  na tela focada/ativa e ao voltar do background. Sem loop de animação contínuo.
- Data passada e check-in não equivalem a batismo realizado. A celebração de
  realização depende de `status=realizado`; check-in continua validado pelo RPC.
- Conteúdo do inscrito e estilos extraídos para `components/batismo/` para a
  prévia usar os mesmos componentes, com dados fictícios e sem autenticação.
- Testes cobrem fuso, virada do dia, data/horário inválidos, sem data/horário,
  ano bissexto e estados cancelado/realizado. Prévia não cria inscrições reais.

### Convites pessoais (16/11/2026)
- `BatismoConviteCard` permite abrir uma mensagem pessoal no WhatsApp (fallback para compartilhar do sistema), sem enviar automaticamente.
- Arte 1080×1920 gerada localmente com Skia e fontes iBrand/Gotham para Stories, com prévia e compartilhamento PNG. O usuário escolhe Instagram ou salva a imagem e a seleciona no Story; não há promessa de publicação direta nem bridge nativa nova.
- Convite usa apenas nome, data e horário da inscrição, com fuso Brasília; sem horário definido, informa confirmação pendente. Não inclui observações/cadastro. Não oferece convites para datas inválidas/passadas, cancelados ou realizados.
- Ambos funcionam com as dependências existentes por OTA. Não cria inscrição, altera dados nem envia mensagem em nome do usuário.

### Endereço nos convites (16/11/2026)
- Texto do WhatsApp e PNG dos Stories incluem Av. das Américas, 7907, Open Mall (subsolo), Barra da Tijuca, Rio de Janeiro/RJ, o mesmo endereço da tela Sobre e dos detalhes do culto.
- O endereço vem de `conviteBatismo.endereco`, em três linhas para legibilidade; nunca usa o endereço residencial do inscrito. A arte redistribui data, horário e rodapé, preservando o formato 1080×1920.

- O convite de texto do WhatsApp inclui “Como chegar” com URL HTTPS de direções
  do Google Maps, usando o mesmo endereço da igreja como destino. A origem fica
  a cargo do Maps/dispositivo; o link também acompanha o compartilhamento nativo
  de texto. A arte dos Stories permanece sem URL.
- Os parênteses de "(subsolo)" vão codificados (`%28`/`%29`): `encodeURIComponent`
  os deixa crus e alguns detectores de link cortam a URL neles. O teste
  `batismoConvite.test.ts` trava o link inteiro e o destino decodificado.

## ⚠️⚠️ Álbum do batismo · galeria privada e download (24/11/2026 · par do ERP #3884)

A galeria antiga lia o bucket público `batismos` (vazio, limite 200, URL pública) e
decidia a data no cliente. Agora quem decide é o ERP (`batismo_album_acessos`): a tela
`/batismo-fotos` só mostra o que `GET /app/batismo/fotos` devolve para a conta da sessão.

- **Rotas**: `/batismo-fotos?album=<uuid>` (pai `/batismo`). `/batismo` mostra o cartão
  "Fotos do batismo" (`FotosBatismoCard`) e quem tem papel de gestão ganha o link "Minhas
  fotos do batismo" no topo da gestão (antes o gestor nunca via o próprio álbum).
- **Miniatura**: caminho relativo `/app/batismo/fotos/miniatura/<token>` vindo do ERP; o
  app só aceita esse prefixo (`urlDaMiniatura`). Token vence em 2–3 h: imagem com erro em
  lista velha recarrega a lista.
- **Original**: link curto do SharePoint pedido **foto a foto, na hora** (`linkDeDownload`),
  só `https` em `*.sharepoint.com`; 401/403/410 renova UMA vez; nunca em log.
- **Salvar** (`lib/salvarFotos.ts` + `lib/filaFotos.ts`, réguas puras com teste):
  1. binário com `ExpoMediaLibrary` (só a PRÓXIMA release de loja): galeria, permissão só
     de adicionar, 2 por vez;
  2. Android sem o módulo (vc 12): pasta escolhida pelo SAF, 1 por vez;
  3. iPhone sem o módulo (build 48): uma foto por vez pela folha do sistema **sem "Salvar
     imagem"** (`excludedActivityTypes: SaveToCameraRoll`) — o binário não tem
     `NSPhotoLibraryAddUsageDescription` e esse item pode derrubar o app; várias de uma vez
     pedem atualizar o app na loja.
  - O `require('expo-media-library')` vive DENTRO da guarda `requireOptionalNativeModule`.
    ⚠️ `expo-media-library ~18.2.1` + plugin no `app.json` (`granularPermissions: []`,
    sem localização) são **mudança nativa pendente**: a catraca do `npm run ota` já estava
    bloqueada pelo `expo-audio`; continua exigindo `CBRIO_OTA_EMBUTIDO_VELHO=1` até a loja.
  - ⏳ Antes da próxima release Android: o manifesto da biblioteca declara
    `READ_MEDIA_VISUAL_USER_SELECTED`; conferir a política da Play (opção:
    `android.blockedPermissions`, sem quebrar o seletor de avatar).
- **Toque no aviso**: `tipo: 'batismo'` + `destino: 'fotos'` + `album_id` UUID →
  `/batismo-fotos` (`lib/batismoFotosDestino.ts`, nos DOIS switches: `notifTap` e
  `notificacoes`). Sem `album_id` (lembretes de véspera/dia) continua `/batismo`.
- Testes: `test/batismoFotos.test.ts`, `test/batismoFotosNotifTap.test.ts`,
  `test/salvarFotos.test.ts`, `test/filaFotos.test.ts` + 9 mutantes em `scripts/mutantes.mjs`.

## ⚠️⚠️ "Encontrar minhas fotos" · busca por selfie no álbum (24/11/2026)

Decisão do Matheus (ciente do risco LGPD): quem tem álbum tira uma selfie e o app separa as
fotos em que a pessoa parece estar. **O reconhecimento roda 100% no celular**, numa WebView
com a página `https://www.cbrio.org/app-busca-facial/index.html?v=1` (face-api, servida pelo
ERP). A selfie e as distâncias **nunca** saem do aparelho nem vão para disco, log, telemetria
ou servidor; o servidor só registra o ACEITE.

- **Peças**: régua pura `lib/buscaFacial.ts` (teste `test/buscaFacial.test.ts`), fluxo
  `components/batismo/BuscaFacial.tsx` (modal da `/batismo-fotos`, **sem rota nova**), modo
  "Resultado da busca" na própria galeria, `lib/telaAcordada.ts` (nativo `ExpoKeepAwake`
  direto, que vem com o pacote `expo`; **sem dependência nova**: tudo sai por OTA).
- **Contrato com o ERP**: `GET /app/batismo/fotos` traz `busca_facial: liberada|menor|indisponivel`
  (ausente = resposta antiga = sem botão); cada foto de `/itens` traz `busca_url` (miniatura de
  640 px, mesmo prefixo validado por `urlDaMiniatura`). Aceite:
  `POST /app/batismo/fotos/:albumId/busca-facial/consentimento` com
  `{ versao: "2026-11-24", declarou_maioridade: true, idioma: pt|en|es }`; só `{ ok: true }`
  começa. 403 `menor`, 429 `limite`, 404, 409 e 401 viram mensagem honesta
  (`erroDoConsentimento`). O aceite é postado **uma vez por abertura do fluxo** (outra selfie
  depois de "sem rosto" não gasta o limite diário de novo).
- **Aceite**: texto da versão 2026-11-24 em constantes (`TEXTOS_CONSENTIMENTO`, traduzido; o
  teste cobra porque o portão de i18n não enxerga `t(CONSTANTE)`) + **duas** caixas
  obrigatórias ("Concordo em usar meu rosto nesta busca." · "Tenho 18 anos ou mais.") + aviso
  de dados (~0,08 MB por foto).
- **Selfie**: só câmera frontal (`quality 0.5`, `base64`, `exif:false`), nunca galeria. O JPEG
  que o picker grava no cache é apagado (`deleteAsync`) logo depois de ler o base64. A selfie
  fica só num `ref` enquanto a busca existe.
- **WebView** só monta depois do aceite e da selfie, 1×1 e quase transparente DENTRO do layout
  (fora da tela o iOS pode pausar o JS); `originWhitelist` `https://www.cbrio.org` +
  `onShouldStartLoadWithRequest` só para `/app-busca-facial`. `iniciar` só depois do `pronto`.
- **Mensagens da página = dado não confiável** (`lerMensagem`): lista fechada de `t`, id tem que
  estar no lote enviado, `d` número finito ≥ 0 ou null, `msg` livre descartado, código de erro
  desconhecido vira `interno`. Mensagem de outra URL é ignorada.
- **Limiares medidos** (face-api 1.7.15: mesma pessoa 0,152; pessoas diferentes 0,515 e 0,596):
  `d < 0,45` = "Fotos suas"; `0,45 ≤ d < 0,55` = "Pode ser você · pouca certeza"; foto sem match a
  até 2 posições de uma foto sua também entra em pouca certeza (rajada), com a linha "Algumas
  foram tiradas logo antes ou depois de uma foto sua."
- **O RN é o dono da lista e dos resultados**: WebView que morre
  (`onContentProcessDidTerminate`/`onRenderProcessGone`, até 3 vezes sem progresso) ou app no
  segundo plano ⇒ a WebView é recriada e recebe `iniciar` só com as fotos sem resposta.
- **Falhas por foto**: `falha_foto` com 503/429/410/0 conta como não verificada e vale "Tentar de
  novo" só nelas (410 = pede as páginas de novo antes, para ter `busca_url` novas); 404 não.
- **Resultado**: a galeria recebe só ids e contagens (`ResultadoBusca`) e mostra duas seções com
  "Selecionar todas" usando a seleção e o download em lote que já existiam.
  X/voltar durante a busca entrega o que achou até ali (cada busca conta no limite do dia).
- ⚠️⚠️ **O resultado FICA ao sair e voltar** (pedido do Matheus, 24/11/2026, desenho do
  conselho): `lib/resultadoBuscaMemoria.ts` guarda na **MEMÓRIA do app** (nunca AsyncStorage,
  SecureStore, arquivo, servidor, log ou telemetria: o teste reprova), por conta (uid) + álbum,
  até 24 h e só na régua de hoje. Só ids e contagens, copiados campo a campo. Busca nova só
  substitui quando entrega algo verificado. Apaga: sair da conta e QUALQUER troca de uid no
  `onAuthStateChange` (refresh vencido não passa pelo `signOut`), "Apagar resultado", álbum fora
  da lista/não liberado, `busca_facial` diferente de `liberada` (o interruptor leva o guardado
  junto). "Ver o álbum todo" só troca de vista (aparece "Ver o resultado da sua busca").
  ⚠️ Ao voltar, a tela carrega o álbum INTEIRO antes de mostrar o resultado: a grade só tem a
  1ª página e o resto pareceria "não encontrado". Avisa fotos do resultado que saíram do álbum
  e fotos novas não verificadas. Some quando o app fecha (ou o sistema o mata): guardar em
  disco é decisão do Matheus e exigiria emenda da LEI e texto novo no aceite (o servidor só
  aceita uma `versao`).
- **Não verificado sem aparelho**: WebGL dentro da WebView 1×1 nos dois sistemas, o tempo real
  de 946 fotos, a câmera frontal dentro do `<Modal>`, se o binário publicado tem o nativo
  `ExpoKeepAwake` (sem ele, a tela pode apagar e a busca retoma na volta).
- Mutantes: limiar inclusivo, sequência vazando, id fora do lote, 404 retentável, aceite sem
  `ok: true` (em `scripts/mutantes.mjs`).
- Mutantes do resultado guardado: interruptor não apaga, nunca vence, busca vazia apaga o
  bom, troca de conta não apaga, sair da tela volta a apagar.

## Halo suave na busca por selfie · 26/11/2026 (preparado, não publicado)

Matheus escolheu a opção Halo suave na prévia e autorizou implementar. A captura
agora pode acontecer dentro do app, com o rosto no centro de um contorno que pulsa.
O toque em “Encontrar minhas fotos” tira a selfie; não há captura automática nem
promessa de alinhamento/escaneamento 3D. O consentimento e os dois aceites anteriores
continuam obrigatórios, antes de pedir permissão e abrir a câmera.

- `CameraSelfieHalo.tsx`: câmera frontal `expo-camera ~17.0.10` (SDK 54), foto com
  qualidade 0,5/base64, sem EXIF, sem gravação de áudio. Desmonta no segundo plano;
  captura que chega depois de fechar/pausar é descartada. Toque duplo é bloqueado.
- `cameraSelfieNativa.ts`: consulta `requireOptionalNativeModule("ExpoCamera")`
  ANTES do `require("expo-camera")`. Os binários antigos continuam usando o
  ImagePicker e recebem o halo somente depois da selfie. A câmera embutida exige
  nova instalação; uma OTA sozinha não acrescenta o módulo nativo. O runtime
  existente permanece literal `1.0.0`, seguindo a regra dos módulos opcionais.
- `capturaSelfie.ts`: só entrega o base64 depois de apagar o JPEG temporário;
  falha de limpeza impede prosseguir. `selfieImagem.ts` contém a validação pura,
  reexportada por `buscaFacial.ts` para manter compatibilidade. Higiene de sobras
  cobre `Camera/` e `ImagePicker/`, de forma independente se uma pasta falhar.
- `HaloBuscaFacial.tsx`: apresentação compartilhável, animação nativa de escala e
  opacidade. Respeita “Reduzir movimento” e pausa fora do primeiro plano. A leitura
  não exibe percentual fictício; a comparação usa as contagens reais recebidas do
  motor existente. Fotos que falharam contam como “processadas”, não “verificadas”.
- A selfie continua apenas na memória do fluxo (incluindo sua prévia), sem upload,
  persistência, logs ou telemetria. Motor, limiares, resultados e permissões de
  álbuns não mudaram. A permissão de microfone do chat foi preservada na composição
  dos plugins; o novo fluxo não pede nem utiliza microfone.
- CBRio Testes tem uma demonstração isolada com os mesmos componentes e câmera,
  sem álbuns reais e sem reconhecimento. A comparação de exemplo é identificada
  como demonstração. Validar câmera frontal, enquadramento, captura, saída e volta
  em aparelhos iOS/Android antes de liberar a nova experiência à comunidade.

O simulador iOS não monta a prévia nativa (ExpoCamera 17 a exclui com
`#if !targetEnvironment(simulator)`); pode não emitir `onCameraReady` nem erro.
A abertura agora tem prazo de 12 segundos, suspenso em segundo plano e cancelado
quando pronta. O laboratório oferece “Ver animação” em caso de câmera indisponível.
Callbacks antigos não destravam a nova câmera, inclusive na remontagem de efeitos
em StrictMode. Relato reproduzido no Device Hub pelo Matheus durante o teste.

Validação desta implementação: `npm run verificar` passou com 1.070 testes,
TypeScript e limite de i18n; exportação iOS/Android concluída. Build Release do
CBRio Testes 1.4.0 (5) compilado e instalado no simulador iPhone 17 Pro iOS 26.2.
Conferidos pela interface: saída da espera da câmera em 12 s, “Câmera indisponível”
→ “Ver animação”, etapa de comparação com contagens e retorno, temas claro/escuro.
O ensaio de captura real e a validação em Android físico continuam pendentes.
Nenhuma publicação em produção foi feita neste trabalho.

CBRio Testes 1.4.0 (5) foi também gerado por EAS local, assinado, instalado e
confirmado no iPhone cadastrado. O usuário ainda precisa conferir a captura nesse
aparelho. O pacote separado está em `~/Downloads/CBRio-Testes-Halo-1.4.0.ipa`;
procedimento e SHA-256 estão no README do repositório CBRio-Testes.


## Halo suave · preparação da versão de loja 1.0.7 · 26/11/2026

Matheus confirmou que o teste no iPhone funcionou e autorizou a publicação.
Escolheu expressamente a experiência completa pela loja, não apenas a animação
após a selfie por OTA. A versão pública candidata é 1.0.7; runtime continua 1.0.0.

O laboratório 1.4.0 (5) apresentou crash ao iniciar no iOS 27, causado pela
compilação local com Xcode 27 sem UIScene. O laboratório 1.4.1 (6) corrigiu esse
bootstrap, foi reinstalado, abriu três vezes sem novo crash e foi aprovado pelo
usuário com câmera. O adaptador de UIScene é exclusivo do laboratório. A versão
de loja permanece no Xcode 26.2 fixado no perfil de produção; não usar o Xcode 27
local para gerar esta versão sem uma migração completa e verificada do app.

A aprovação confirma a experiência de câmera do iPhone. A demonstração isolada
não executa reconhecimento nem consulta álbuns reais. Validação Android e
conferência do binário de loja permanecem etapas da preparação; não registrar
build enviado como versão disponível ao público. Nenhuma OTA faz parte desta entrega.
