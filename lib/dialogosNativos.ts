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
