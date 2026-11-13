// ============================================================================
// OS ALERTAS QUE FICAM NATIVOS · e o motivo de cada um (11/08/2026)
//
// O Marcos reclamou duas vezes do "modal quadrado", e a resposta é
// `components/ui/Dialogo.tsx`. Mas **três casos não migram**, e não é preguiça:
// migrar cada um deles TROCARIA um incômodo visual por uma falha real.
//
// ⚠️ Este arquivo não roda em runtime — é o registro da decisão, e existe pra
// `test/reguas.test.ts` GUARDAR: se alguém migrar um destes, o portão fica
// vermelho e lê aqui o porquê. Sem isso, "limpar os Alerts que sobraram" é a
// próxima sessão bem-intencionada quebrando o SOS.
// ============================================================================

export type AlertaNativo = { arquivo: string; porque: string };

export const ALERTAS_QUE_FICAM_NATIVOS: readonly AlertaNativo[] = [
  {
    arquivo: "app/(app)/cuidados.tsx",
    porque:
      "SOS. É a única tela do app que pode salvar alguém em minuto zero: oferece CVV 188 e SAMU 192 ANTES de qualquer formulário, com 3 ações, `destructive`, `cancel` e discagem `tel:`. E um dos alertas é o CAMINHO DE FALHA DE REDE — diálogo que depende do estado e do render da tela é estruturalmente pior justamente quando algo já falhou. O nativo é janela do sistema e aparece mesmo com a tela em pane.",
  },
  {
    arquivo: "app/(app)/trocar-senha.tsx",
    porque:
      "A navegação roda na LINHA SEGUINTE ao alerta, sem esperar o OK. Isso só funciona porque o Alert nativo tem UIWindow própria e sobrevive à tela sair por baixo. Um diálogo montado pela tela desmonta junto com ela — a pessoa trocaria a senha e não veria confirmação nenhuma.",
  },
  {
    arquivo: "app/(auth)/redefinir-senha.tsx",
    porque:
      "Mesmo caso do trocar-senha, e aqui é pior: a tela vive em `(auth)`, então depois do `setSession` a pessoa é levada pra área logada e ESTA tela desmonta. Diálogo renderizado por ela sairia de cena junto — a pessoa redefiniria a senha sem nunca ver a confirmação, e no fluxo de recuperação de senha essa é a única prova de que deu certo.",
  },
];

/** Só pra o teste iterar sem repetir a lista. */
export const ARQUIVOS_ALERTA_NATIVO = ALERTAS_QUE_FICAM_NATIVOS.map((a) => a.arquivo);

// ============================================================================
// CONFIRMAÇÕES NATIVAS QUE FICAM · por TÍTULO, com o porquê (23/09/2026)
//
// Relato do Marcos na tela de gerenciar grupo: *"quando eu tentava apertar o
// botão de aprovar, ele abria uma janela quadrada e feia, que não tinha tanto a
// cara do app; o de recusar ficava bonito"*. O Aprovar era `Alert.alert` com
// botões; o Recusar era folha da casa. Medido: 22 confirmações nativas em 15
// arquivos. As de NÍVEL DE TELA (nenhum <Modal> aberto) migraram pro
// `useDialogo`. As abaixo FICAM, e o teste `test/dialogoDaCasa.test.ts` exige
// que TODA confirmação nativa do app esteja aqui — ou em ARQUIVOS_ALERTA_NATIVO.
//
// ⚠️ Os dois motivos que valem:
//   · FOLHA ABERTA POR BAIXO — o diálogo da casa é um <Modal> irmão e, no
//     iPhone, nasce ATRÁS da folha que já está aberta (medido em grupo-visita,
//     comentário no próprio arquivo). Ali o Alert nativo é o único que aparece.
//   · TRÊS OPÇÕES — o diálogo da casa tem 2 botões (cancelar + ação). Câmera /
//     galeria / cancelar não cabe.
// ============================================================================
export type ConfirmacaoNativa = {
  arquivo: string;
  /** Trecho do 1º argumento do Alert.alert (o título). Substring basta. */
  titulos: readonly string[];
  porque: string;
};

export const CONFIRMACOES_NATIVAS_QUE_FICAM: readonly ConfirmacaoNativa[] = [
  {
    arquivo: "app/(app)/grupo-membros.tsx",
    titulos: ["Descartar a frequência?", "Descartar sua mensagem?"],
    porque: "Disparam com a folha da chamada / da ajuda ABERTA. O diálogo da casa nasceria atrás da folha no iPhone.",
  },
  {
    arquivo: "app/(app)/grupo-visita.tsx",
    titulos: ["Descartar o registro?"],
    porque: "Dispara com a folha do registro de visita aberta — o próprio arquivo documenta que o Modal irmão nascia ATRÁS no iPhone.",
  },
  {
    arquivo: "components/voluntariado/Disponibilidade.tsx",
    titulos: ["Remover indisponibilidade"],
    porque: "Dispara de dentro da folha de indisponibilidade (dois Modais irmãos já convivem ali só no Android; iPhone não provado).",
  },
  {
    arquivo: "components/batismo/BatismoGestao.tsx",
    titulos: ["Aprovar para este Batismo?", "Retirar deste Batismo?"],
    porque: "A gestão do batismo inteira vive dentro de um <Modal presentationStyle='pageSheet'>; qualquer diálogo irmão fica atrás dela.",
  },
  {
    arquivo: "app/(app)/kids-filho.tsx",
    titulos: ["Foto da criança"],
    porque: "Três opções (tirar foto / escolher da galeria / cancelar). O diálogo da casa tem dois botões; um action sheet é outro componente.",
  },
  {
    arquivo: "app/(app)/kids-solicitar-vinculo.tsx",
    titulos: ["Foto da criança", "Foto da mãe", "Foto do pai"],
    porque: "Três opções (tirar foto / escolher da galeria / cancelar), nas fotos da criança e dos responsáveis. Mesmo caso do kids-filho.",
  },
];
