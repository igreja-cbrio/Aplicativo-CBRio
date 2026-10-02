# kids · criancas · conhecimento operacional do app

Movido **na íntegra** do `CLAUDE.md` em 2026-10-01 (o arquivo tinha 268 KB e era carregado em toda chamada). Referência VIVA: leia o índice e a seção do assunto antes de mexer. Seção nova entra no FIM deste arquivo, datada, com uma linha a mais no índice.

**Escopo:** Kids e crianças: card do Kids, apresentação de criança (porta nativa, saúde), atalho, Kids arquivado.

## Índice de seções

- ⚠️ HOME · card do Kids nos dias de culto (29/08/2026)
- ⚠️⚠️ KIDS NO APP · ARQUIVADO PELO MARCOS — e 3 achados que ficam (11/08/2026)
- ⚠️ APRESENTAÇÃO DE BEBÊS · o card do app é LINK MORTO (medido 11/08/2026)
- ⚠️⚠️ APRESENTAÇÃO DE CRIANÇA · porta nativa + a criança vira PESSOA (11/08/2026)
- ⚠️⚠️ SAÚDE DA CRIANÇA na apresentação · e a tabela errada (11/08/2026)
- ⚠️⚠️ Atalho "Apresentação de crianças" · NBSP NÃO FORÇA QUEBRA (26→27/08/2026)

---

## ⚠️ HOME · card do Kids nos dias de culto (29/08/2026)

Pedido do Matheus: *"dias de culto aparecer um card assim na tela principal,
para os pais de crianças do kids poderem fazer o pré checkin de forma mais
rápida."*

⚠️⚠️ **O pré-check-in JÁ EXISTIA, funcionava, e ninguém achava.** Medido no banco
em 29/08: **1 pré-check-in na história inteira** (criado naquele dia, testando)
contra **888 check-ins no totem em 30 dias**. A tela `/kids` está inteira — o que
faltava era ela ser alcançável **no dia em que serve**. Mesma classe do portão de
atualização e do avatar do app: a coisa está pronta e o caminho até ela não existe.

**Público hoje: 24 pais** com conta no app e filho ativo autorizado.

- **`lib/kidsHoje.ts`** = régua PURA (`temKidsHoje` · `rotuloFilhos` ·
  `codigoValido`), com **4 mutantes no gate** (`scripts/mutantes.mjs`).
- ⚠️ **A condição sai do que a Home JÁ CARREGOU**: `proximosCultos(7)` traz
  `data` (em BRT) e `has_kids`. Nenhuma consulta nova só pra decidir se o card
  aparece — e a busca dos filhos só acontece **quando hoje tem Kids**.
- ⚠️⚠️ **`has_kids` NULO não conta.** É `vol_service_types.has_kids`, nullable:
  tratar null como "tem" acenderia o card em dia de AMI/Bridge e mandaria o pai
  gerar um código que nenhum totem vai ler. Mutante trava isso.
- ⚠️ **Sem o corte por data o card fica aceso a semana inteira** (a lista da Home
  é de 7 dias) — e o código expira em 12h, então o gerado na quarta morre antes
  do domingo. Mutante trava isso também.
- ⚠️⚠️ **O botão diz "Adiantar", NUNCA "Fazer check-in".** O app não faz check-in:
  ele gera o CÓDIGO que a pessoa apresenta na chegada. Entrada e retirada seguem
  presenciais, por decisão de segurança do módulo — prometer check-in aqui seria
  a tela afirmando o que o produto não faz.
- ⚠️ **Não é uma segunda implementação**: o card chama o MESMO
  `POST /app/kids/pre-checkin` da tela `/kids` e manda a pessoa pra lá pra ver o
  QR. Duas implementações divergiriam, e o sintoma seria "gerei pela Home e o
  código não é o mesmo da tela do Kids".
- **Gera pra TODOS os filhos num toque** — a família chega junta, e é isso que
  torna o card "mais rápido" (o pedido). Quem precisa escolher ajusta em `/kids`.
- ⚠️ **Código VENCIDO não é mostrado como pronto** (`codigoValido` é fail-closed):
  código morto na tela faria o pai chegar no totem com algo que não abre nada.
- ⚠️ **Falha de rede esconde o card**, nunca mostra card quebrado — a tela `/kids`
  segue no menu.

## ⚠️⚠️ KIDS NO APP · ARQUIVADO PELO MARCOS — e 3 achados que ficam (11/08/2026)

Ele pediu mostrar no app o check-in que o totem já criou (sala, pager, e o código
como substituto do papel perdido). Levantei, ele leu e **arquivou**: *"exclua esse
pedido do kids, vou conversar com a Mari sobre integrações e vou trazer um plano
definido."* ⇒ **NÃO retomar por conta própria.**

✅ **O ÚNICO conserto feito é bug de hoje, não feature**: `kids-filho.tsx`
renderizava **"Sala: X"** a partir de `sala_sugerida`, que o backend calcula pela
**FAIXA ETÁRIA** (`app.js`) — a sala REAL é escolha do voluntário no totem
(`kids_checkins.sala_id`; o servidor só valida). Divergem de propósito: irmão
junto, sala cheia, aniversário na virada de faixa. O pai lia "POP! 1" e batia na
porta errada no meio do culto. Rótulo agora: **"Sala prevista"**.

⚠️⚠️ **TRÊS FATOS MEDIDOS QUE VALEM INDEPENDENTE DISSO** (não repetir leitura
antiga sem olhar):

1. **`codigo_digitado` é RÓTULO FALSO.** O botão "Mesma pessoa que entregou" no
   check-out grava `metodo='codigo_digitado'` **sem ninguém digitar código** (o
   front preenche do check-in já carregado na tela). ⇒ A leitura *"o código caiu
   42→28→0, a equipe abandonou o fluxo"* pode estar simplesmente errada — o que
   mudou foi qual botão o voluntário toca. Auditoria que leia essa coluna como
   "apresentou o papel" **afirma um fato inventado**, e num incidente real de
   criança isso vira prova falsa.
2. **83% dos check-ins fecham pelo cron, não por retirada** (`checkout_forcado`:
   855 de 1.027; 130 de 164 no domingo 09/08). Qualquer tela que diga "está na
   sala X **agora**" mente pra ~80% — inclusive pra quem já está em casa com a
   criança. E o sistema só sabe **quem levou** em 12 de 1.212 retiradas.
3. **`autorizado_buscar` = true em 1.294 de 1.294 vínculos. ZERO false.** O totem
   cria o vínculo autorizado pra quem ENTREGA a criança (542 desde 01/06) e a fila
   com documento nunca rodou. ⇒ **"responsável autorizado" não filtra ninguém** —
   qualquer régua de exibição baseada nisso é porta aberta, não portão.

⚠️ **PORTA DE ESCRITA JÁ ABERTA, sem relação com feature nova:**
`POST /app/kids/filho/:id/saude` aceita **1.000 chars de texto livre** de qualquer
responsável autorizado, e esse texto é **impresso na etiqueta da criança** como
alerta de saúde, lido pelo voluntário no atendimento. Dá pra escrever de casa
"hoje quem busca é o pai X". E `tem_espectro`/`tem_limitacao_fisica`, graváveis
pelo app, são a **régua do pager** no servidor.

## ⚠️ APRESENTAÇÃO DE BEBÊS · o card do app é LINK MORTO (medido 11/08/2026)

Pedido do Marcos: *"Apresentação de Bebês está fora do app, quero que tudo seja
dentro do app."* Medindo antes de construir, o quadro é pior do que "está fora":

- `inscricoes.tsx:66` abre **`https://www.cbrio.org/apresentacao-criancas`**, e essa
  rota **não existe no ERP**: 0 referências em `src/` (nem `App.tsx`, nem
  componente). Devolve **HTTP 200 só pelo catch-all do SPA** da Vercel, então
  parece viva e não renderiza formulário nenhum.
- **`apresentacao_bebes` tem 0 linhas.** Nunca foi usada, por porta nenhuma.
  (⚠️ Uma nota antiga minha dizia "6 de 6 linhas órfãs" — **estava errada**.)
- O único código real é do **TOTEM**: `GET|POST
  /api/membresia/totem/apresentacao-bebe` (+ `src/api.js:1309-1310`), que é do
  balcão e já calcula o **2º domingo do mês** como data.

⚠️ **O que ele quer somar** é o vínculo de família: *"perguntar se o filho é
dela; se sim, indicar o vínculo e completar os dados se a criança não existir como
família; se for outra pessoa, preencher os dados completos dos responsáveis e da
criança."* Estado do dado pra isso: `mem_familias` **2.074** ·
`mem_membros.familia_id` **999 de 4.072** · `kids_criancas` **4.332 vivas** · e
**`mem_vinculos_familiares` com 6 linhas** (a tabela de parentesco está
praticamente vazia).

⚠️⚠️ **NÃO confundir com o que foi recusado**: a recusa de 10/08 foi ligar
`autorizado_buscar=true` (autorização de RETIRADA no Kids) por formulário. Vínculo
de **família** é outra coisa e ele pediu explicitamente. Retirada continua fora.

## ⚠️⚠️ APRESENTAÇÃO DE CRIANÇA · porta nativa + a criança vira PESSOA (11/08/2026)

Pedido do Marcos: *"Apresentação de Bebês está fora do app, quero que tudo seja
dentro do app. Quando a pessoa marcar que quer apresentar bebê, já que já temos os
dados dela dentro do app, tem que perguntar se o filho é dela; se sim, indicar o
vínculo, completar os dados se a criança não existir como família já. Se for outra
pessoa, ela tem que preencher os dados completos dos responsáveis e criança."*

E a regra de identidade, dele: *"quando cadastrar uma criança deve gerar pessoa no
sistema que aparece em minha família, com as regras de criança, **SEM CPF,
identificamos pelo pai**."*

**⚠⚠ O CARD ERA UM LINK MORTO** (medido 11/08): `cbrio.org/apresentacao-criancas`
**não tem rota no ERP** (0 referências em `src/`) e devolvia HTTP 200 só pelo
catch-all do SPA da Vercel — parecia viva e não renderizava formulário nenhum.
`apresentacao_bebes` tinha **0 linhas**. O comentario antigo do card dizia que era
"porta WEB de propósito, pra não criar um 2º caminho de escrita de pessoa": o
racional estava certo e o fato estava errado — **não havia 1º caminho**.

### As duas portas da tela

| escolha | o que pede | o que grava |
|---|---|---|
| **É meu filho ou minha filha** | só os dados da criança | criança vira **pessoa** + entra na **família de quem pediu** + `mem_vinculos_familiares` recíproco (`filho`/`pai_mae`) |
| **É filho de outra pessoa** | dados completos dos responsáveis + da criança | **só o pedido** — nenhuma pessoa, nenhum vínculo |

⚠️ **Filho de terceiro NÃO cria pessoa de propósito**: criar criança **e adulto** a
partir de formulário preenchido por outra pessoa, e ligar duas famílias sem as duas
terem agido, é exatamente o que o Contrato de porta existe pra impedir.

### As regras de criança (`backend/utils/criancaApresentacao.js`)

- **CPF nunca é pedido nem gravado.** `CAMPOS_PROIBIDOS_CRIANCA` recusa se vier, e
  a tela **não tem o campo** (com mutante). Placeholder de CPF em tela de
  autoatendimento seria pedir documento de menor.
- **`status: 'visitante'`, NUNCA `membro_ativo`**: a base de membresia (1.826)
  alimenta o NSM e os KPIs, e criança apresentada não é membro. Já existem **53
  crianças ≤12 anos** em `mem_membros` — a porta não é inédita; o que é novo é ela
  ser consistente.
- **`origem_cadastro='apresentacao_crianca_app'`** — sem marca, um dia ninguém sabe
  por qual porta cada uma das 4.000 pessoas entrou.
- Nascimento validado no SERVIDOR e na tela: **31/02 não passa** (`new Date(2025,
  1, 31)` não estoura no JS, vira 03/03 — só o round-trip pega) e **futura não
  passa**. Meio-dia LOCAL, nunca `new Date("AAAA-MM-DD")` (essa forma é UTC e em
  fuso negativo devolve o dia anterior).
- **Sexo NÃO é obrigatório** (tem mutante): exigir na tela a deixaria mais rígida
  que a porta, e a pessoa travaria num campo que o servidor não pede.

### ⚠⚠ Dedup pela FAMÍLIA, não por quem preencheu

O pai e a mãe cadastrando o **mesmo filho** criariam duas pessoas, e a criança
apareceria duplicada em "Minha família" das duas contas. Sem CPF pra desempatar (é
o ponto da regra), **nome normalizado + nascimento DENTRO da família** é a chave.

### ⚠⚠ NÃO passa pelo matcher canônico, de propósito

O matcher liga por CPF → e-mail+nome → telefone+nome → nascimento+nome, e criança
**não tem nenhuma dessas chaves**. O único ramo que a alcançaria é nascimento+nome,
que casaria com QUALQUER homônimo da mesma data. A identidade dela é o VÍNCULO com o
responsável — *"identificamos pelo pai"*.

### ⚠⚠ O aviso DIZ em qual família a criança entra (guarda do caso Benjamin)

O `GET` devolve o **nome da família + os nomes de quem está nela**, e a tela mostra
antes de confirmar. É a guarda contra o caso **Benjamin/Mariane Gaia** (lei do ERP
· 22/07): quem está agrupada na família da irmã pela Membresia colocaria o próprio
filho na família errada, e o único jeito honesto de evitar é a pessoa **ler**. Tem
mutante — tirar o nome do aviso deixa o portão vermelho.

⚠️ Reusa **`entrarNaFamilia`/`vincularParentesco`** (`services/familiaVinculo`), os
MESMOS do convite de familiar: duas réguas de "entrar na família" divergiriam, e é a
de lá que "Minha família" lê.

⚠⚠ **NÃO toca no Kids**: não cria `kids_criancas`, não cria `kids_responsaveis` e
não liga `autorizado_buscar`. Autorização de **RETIRADA** no totem é a decisão de
proteção de criança que o Marcos arquivou em 11/08 pra conversar com a Mari. Vínculo
de **família** é outra coisa, e foi ela que ele pediu.

⚠️ Idempotente (reenviar não cria 2º pedido pra mesma criança na mesma cerimônia) ·
data = **2º domingo do mês**, espelho do `_proximoSegundoDomingo` do totem (se as
duas discordassem, o app marcaria a família para um domingo e o balcão esperaria
noutro) · aviso ao Kids **AWAITED** (lei de 31/07: o container congela na resposta).

### ⚠️ O portão de i18n aprendeu o que é MÁSCARA DE FORMATO

`placeholder="DD/MM/AAAA"` subia o contador de strings soltas — e o próprio
CLAUDE.md já registrava que essa string **não deve** ser traduzida. `ehFormato()`
(em `scripts/i18n-cobertura.mjs`) ignora máscara de formato, com padrão **estreito**
("Data de nascimento" não casa; "DD/MM/AAAA" casa). Traduzir pra "MM/DD/YYYY" seria
pior que não traduzir: a máscara do campo (`maskDateBR`) é dia-primeiro, e o
placeholder passaria a mentir sobre a ordem que o campo aceita.

## ⚠️⚠️ SAÚDE DA CRIANÇA na apresentação · e a tabela errada (11/08/2026)

Apontamento do Marcos: *"a criação de uma criança no Kids gera mais campos do que
temos na apresentação de bebê, exemplo dos campos de alergia, deficiência
física... Eu só não quero ter crianças ou pessoas com dados faltando porque em um
lugar pede uma coisa e no outro pede outra."*

Ele estava certo. Medido no recorte justo (crianças criadas **desde 28/07**,
quando o formulário do Kids ganhou os campos): **34 pela porta do Kids · 100% com
saúde respondida** contra **2 pela apresentação · 0%**.

⚠️⚠️ **E o dano é operacional, não estético:** `tem_espectro` e
`tem_limitacao_fisica` são a **régua do PAGER** no totem do Kids, obrigatório
desde 03/08 (decisão da Mari). Criança com autismo que entrava por esta porta
chegava no domingo com o campo NULO e **não caía na regra** — o pager só saía se
o voluntário percebesse e editasse a ficha na hora.

A tela ganhou o bloco **"Saúde e inclusão"** com as 3 perguntas do formulário do
Kids (`lib/apresentacaoCrianca.ts` · `PERGUNTAS_SAUDE`, espelho de
`backend/utils/saudeCrianca.js`):

- ⚠️⚠️ **Pergunta em branco NÃO vira `false`.** `saudeParaPayload` só manda o que
  foi respondido — no banco `null` é "ninguém perguntou" (98% da base) e `false`
  é "a família disse que não". Mandar `false` faria a régua do pager **excluir
  ativamente** criança sobre a qual não se sabe nada.
- ⚠️ **Nenhuma é obrigatória.** Travar o envio empurraria a família a responder
  qualquer coisa pra passar — dado ruim é pior que campo vazio.
- Tocar de novo na mesma resposta volta pra "não respondi": é como a pessoa
  desfaz um toque errado sem ficar presa a um "não" que ela não quis dar.
- Responder **"sim"** em TEA ou limitação mostra na hora o aviso do pager — a
  novidade não fica pro domingo de manhã. Quem DECIDE o pager continua sendo o
  totem, no check-in.
- ⚠️ São **3 perguntas, não 8**: `kids_criancas` tem 8 campos de saúde, e entram
  as que movem o domingo (alergia → lanche; TEA e limitação → pager). Pedir 8
  campos numa tela de autoatendimento troca dado bom por formulário abandonado.

### ⚠️⚠️ E o servidor gravava na tabela que a equipe do Kids NÃO lê

Achado no mesmo trabalho, e é mais grave que os campos: `POST
/app/apresentacao-crianca` escrevia em **`apresentacao_bebes`**, que só tem o
totem como leitor. Quem a aba Apresentação de crianças do `/kids` lê é
**`apresentacao_criancas`**. A família veria "recebemos" e o balcão não saberia de
nada no domingo. Corrigido no ERP (PR #2408); a tela não muda por causa disso.

### ⚠️ `mem_membros.genero` é `masculino`/`feminino`, nunca `M`/`F`

Medido: 4.045 vivos, 579 com sexo, **ZERO com valor curto**. O servidor comparava
com `'M'` pra decidir quem entra como pai e quem entra como mãe — condição sempre
falsa, então os dois campos saíam nulos. Conserto no ERP. **A tela segue mandando
`M`/`F`** (é o formato do Kids); quem traduz é o servidor.

## ⚠️⚠️ Atalho "Apresentação de crianças" · NBSP NÃO FORÇA QUEBRA (26→27/08/2026)

Pedido do Matheus: *"deixe a palavra crianças embaixo, pq tá meio estranho assim
em 1 linha só"*. Em 26/08 resolvi com **espaço inquebrável** entre "Apresentação"
e "de". Ele testou e voltou: *"não mudou nada no app"*.

**Ele estava certo, e o conserto era incapaz de funcionar:**

1. ⚠️⚠️ **NBSP não FORÇA quebra, só IMPEDE.** Se o texto já couber como está, ele
   não produz efeito nenhum. Eu tratei "impedir quebra no lugar errado" como se
   fosse "forçar quebra no lugar certo" — são coisas diferentes.
2. Pior: ele COLA "Apresentação de" num pedaço só. A célula do atalho tem 33,3%
   da largura do conteúdo (~119 pt num iPhone de 390) e o pedaço grudado fica no
   limite; quando não cabe, o motor quebra onde quiser ou estoura. O resultado
   podia ficar **pior** que o natural.

⚠️ Conferido antes de refazer: o NBSP ESTAVA no bundle publicado. Não faltou OTA
— a técnica é que estava errada.

⇒ **`lib/rotuloAtalho.quebrarAposPrimeiraPalavra`** faz a quebra EXPLÍCITA depois
da primeira palavra: `Apresentação` / `de crianças`. Some a dúvida de medida — a
linha 1 é a palavra mais longa sozinha e a 2 é o resto, as duas com folga até em
aparelho estreito. Quebrar antes da ÚLTIMA palavra deixaria a linha 1 justo no
limite, que é a armadilha de novo.

- A quebra vive no **RENDER** (flag `duasLinhas` no item do `ATALHOS`), não na
  chave de i18n: `\n` na chave obrigaria o tradutor a reproduzir layout. A régua
  é posicional, então funciona em qualquer idioma — en `Children's` /
  `dedication`, es `Presentación` / `de niños`.
- ⚠️ A chave com NBSP **saiu** do dicionário, mas a função **normaliza NBSP**
  antes de procurar o separador: sem isso um rótulo herdado com ` ` seria UMA
  palavra gigante e a função devolveria o texto intacto — o bug de volta, em
  silêncio.
- ⚠️ O regex usa `\u00a0` **explícito**, não o caractere literal: NBSP no meio de
  um regex é invisível no editor, e qualquer reformatação que o troque por espaço
  comum quebraria a régua sem ninguém ver.
- Palavra única (`NEXT`, `Voluntariado`) não é quebrada — inventar quebra dentro
  da palavra é pior que texto apertado.
- Portão: 5 casos em `test/reguas.test.ts` + **2 mutantes** ("o rótulo deixa de
  quebrar", que é literalmente o no-op do NBSP, e "NBSP deixa de contar como
  separador").

⚠️⚠️ **A LIÇÃO QUE PASSA DAQUI: antes de dizer que um conserto de layout está
feito, conferir se ele é MECANICAMENTE CAPAZ do efeito pedido.** "Impedir" e
"forçar" não são a mesma coisa, e uma técnica que depende de o texto não caber é
uma técnica que não faz nada quando ele cabe.

⚠️ Armadilha de FERRAMENTA registrada junto: âncora de mutante em
`scripts/mutantes.mjs` **não pode conter escape** (`\n`, `\u00a0`) — o JS os
interpreta e a string para de casar o texto do arquivo. A 1ª versão dos dois
mutantes morreu com `ÂNCORA PERDIDA` por isso.
