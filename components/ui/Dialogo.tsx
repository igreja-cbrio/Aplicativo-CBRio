// ============================================================================
// DIÁLOGO DA CASA · o fim do "modal quadrado" (11/08/2026)
//
// Reclamação do Marcos, DUAS vezes: *"o modal não está na cara do sistema, está
// quadrado"*. Medido: **90 `Alert.alert` em 27 arquivos, 90 de 90 nativos** — não
// existia nenhum componente de diálogo no repo, então toda confirmação do app
// saía com a caixa cinza do Android.
//
// ⚠️⚠️ POR QUE ELE É RENDERIZADO PELA TELA, E NÃO POR UM PROVIDER NA RAIZ.
// `<Modal>` do React Native é container NATIVO, apresentado a partir do primeiro
// view controller da cadeia (`RCTModalHostViewComponentView.mm` +
// `UIView+React.m`). Um diálogo montado por provider/`View`/rota fica **ATRÁS**
// de qualquer `<Modal>` aberto — e é justamente em cima de modal que metade das
// confirmações deste app acontece. Provider seria um diálogo invisível.
//
// ⚠️ O padrão usado é **IRMÃO**, não aninhado: `Disponibilidade.tsx` e
// `grupo-visita.tsx` já montam dois `<Modal>` simultâneos e isso está no ar desde
// 07/08 (o teste em Android gravou linha em `vol_availability`). Aninhamento tem
// **zero precedente** neste repo — não é hora de estrear.
//
// ⚠️⚠️ O QUE NÃO MIGRA PRA CÁ está listado em `lib/dialogosNativos.ts`, com o
// motivo de cada um, e há teste guardando. Resumo: o **SOS** e os dois casos que
// navegam na linha seguinte ao alerta continuam nativos de propósito.
// ============================================================================
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { useT } from "@/lib/i18n";

export type PedidoDialogo = {
  titulo: string;
  mensagem?: string;
  /** Rótulo do botão que CONFIRMA. Diga o verbo ("Sair do grupo"), não "OK". */
  acao?: string;
  /** Rótulo do que cancela. `null` = diálogo de aviso (um botão só). */
  cancelar?: string | null;
  /** Ação irreversível/destrutiva — pinta o botão de perigo. */
  perigo?: boolean;
};

type Estado = PedidoDialogo & { aberto: boolean };

const FECHADO: Estado = { aberto: false, titulo: "" };

/**
 * Diálogo da casa, com a MESMA API mental do `Alert.alert` mas assíncrona.
 *
 * ```tsx
 * const dlg = useDialogo();
 * if (!(await dlg.confirmar({ titulo: t("Sair do grupo?"), acao: t("Sair"), perigo: true }))) return;
 * // ...
 * <dlg.Dialogo />   // irmão dos outros <Modal> da tela
 * ```
 *
 * ⚠️ `confirmar` devolve `Promise<boolean>` e **nunca rejeita**: fechar por fora,
 * pelo botão físico ou no cancelar resolve `false`. Diálogo que lança viraria
 * `unhandledRejection` no meio de um fluxo que a pessoa só quis abandonar.
 */
export function useDialogo() {
  const [estado, setEstado] = useState<Estado>(FECHADO);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);
  const colors = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const fechar = useCallback((valor: boolean) => {
    setEstado(FECHADO);
    // ⚠️ Resolve UMA vez só: fechar por fora e tocar em Cancelar podem disparar
    // juntos, e resolver duas vezes deixaria a promise anterior pendurada.
    const r = resolverRef.current;
    resolverRef.current = null;
    r?.(valor);
  }, []);

  const confirmar = useCallback((p: PedidoDialogo) => {
    // Um diálogo por vez: pedido novo com um aberto cancela o anterior, senão a
    // promise antiga nunca resolve e o fluxo que a esperava trava pra sempre.
    resolverRef.current?.(false);
    setEstado({ ...p, aberto: true });
    return new Promise<boolean>((resolve) => { resolverRef.current = resolve; });
  }, []);

  /** Aviso de um botão só (o antigo `Alert.alert(titulo, msg)`). */
  const avisar = useCallback(
    (titulo: string, mensagem?: string) => confirmar({ titulo, mensagem, cancelar: null, acao: t("OK") }),
    [confirmar, t],
  );

  const Dialogo = useCallback(() => (
    <Modal
      visible={estado.aberto}
      transparent
      animationType="fade"
      statusBarTranslucent
      // ⚠️ Botão físico do Android fecha como cancelar — é a convenção do sistema
      // e o `_layout` não intercepta o back de dentro de Modal.
      onRequestClose={() => fechar(false)}
    >
      {/* ⚠️⚠️ `accessible={false}` NO FUNDO, e é obrigatório. `Pressable` marca
          `accessible` por padrão; no iOS isso vira `isAccessibilityElement` e o
          UIKit **para de descer nos filhos** — com VoiceOver a única coisa
          alcançável seria o próprio fundo, cuja ação é CANCELAR. Ou seja: a
          pessoa cega não conseguiria confirmar nada. O `Alert.alert` que este
          componente substitui é `UIAlertController`, 100% acessível; regredir
          isso seria trocar estética por exclusão. O `onPress` continua valendo. */}
      <Pressable style={styles.fundo} onPress={() => fechar(false)} accessible={false}>
        <Pressable style={styles.caixa} accessibilityViewIsModal onPress={() => {}}>
          <Text style={styles.titulo}>{estado.titulo}</Text>
          {!!estado.mensagem && <Text style={styles.msg}>{estado.mensagem}</Text>}
          <View style={styles.botoes}>
            {estado.cancelar !== null && (
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => fechar(false)} accessibilityRole="button">
                <Text style={styles.btnGhostTxt}>{estado.cancelar || t("Cancelar")}</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.btn, estado.perigo ? styles.btnPerigo : styles.btnOk]}
              onPress={() => fechar(true)}
              accessibilityRole="button"
            >
              <Text style={styles.btnOkTxt}>{estado.acao || t("Confirmar")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  ), [estado, fechar, styles, t]);

  return { confirmar, avisar, Dialogo };
}

const makeStyles = (c: Palette) => StyleSheet.create({
  fundo: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", padding: spacing.lg,
  },
  caixa: {
    width: "100%", maxWidth: 420, backgroundColor: c.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: c.glassBorder,
    padding: spacing.lg, gap: spacing.sm,
  },
  titulo: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
  msg: { color: c.textMuted, fontSize: font.size.md, lineHeight: 21 },
  botoes: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  btn: {
    flex: 1, minHeight: 48, borderRadius: radius.full,
    alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md,
  },
  btnGhost: { borderWidth: 1, borderColor: c.glassBorder },
  btnGhostTxt: { color: c.text, fontSize: font.size.md, fontWeight: "700" },
  btnOk: { backgroundColor: c.primary },
  btnPerigo: { backgroundColor: c.danger },
  btnOkTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "800" },
});
