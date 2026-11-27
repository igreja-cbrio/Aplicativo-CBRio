// AVISO "CONFIRME SEU NASCIMENTO" POR CIMA DA HOME (27/11/2026 · Fase 3 da entrada).
//
// Para quem já está dentro do app com a data de nascimento marcada como
// suspeita no cadastro da igreja. Decisão do Marcos (26/11): não bloqueia; a
// pessoa pode tocar "Agora não", e o aviso volta até ela preencher.
//
// Quando mostrar e a conferência da data moram em `lib/avisoNascimentoRegra.ts`
// (régua pura, com teste). Quem diz que a data é suspeita é o servidor, pelo
// mesmo GET do `CadastroGate`.
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { usePathname } from "expo-router";
import { Modal } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useMenu } from "@/contexts/MenuContext";
import { useTutorial } from "@/contexts/TutorialContext";
import { useCadastroReady, useNascimentoSuspeitoDe } from "@/components/auth/CadastroGate";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { confirmarNascimentoApp } from "@/lib/api";
import { hojeBRT } from "@/lib/dataBRT";
import { maskDateBR } from "@/lib/validators";
import { trackEvento, trackEventoJa } from "@/lib/telemetria";
import {
  avisoNascimentoDispensado, conferirNascimentoDigitado, dispensarAvisoNascimento,
  mensagemErroNascimento, motivoErroNascimento, nascimentoJaResolvido, podeMostrarAvisoNascimento,
} from "@/lib/avisoNascimentoRegra";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export function AvisoNascimento() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const suspeitoDe = useNascimentoSuspeitoDe();
  const cadastroReady = useCadastroReady();
  const tutorial = useTutorial();
  const { visible: menuOpen } = useMenu();
  const { reload } = useMembro();
  const pathname = usePathname();
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => setActive(estado === "active"));
    return () => sub.remove();
  }, []);

  const [confirmadoDe, setConfirmadoDe] = useState<string | null>(null);
  // Muda quando a pessoa toca "Agora não": a dispensa mora na régua (memória).
  const [, setDispensas] = useState(0);
  const [data, setData] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const visivel = !!uid && podeMostrarAvisoNascimento({
    suspeito: suspeitoDe === uid,
    confirmado: confirmadoDe === uid,
    dispensado: avisoNascimentoDispensado(uid),
    cadastroReady,
    tutorialReady: tutorial ? tutorial.ready : true,
    tutorialPending: tutorial ? tutorial.pending : false,
    pushReady: tutorial ? tutorial.pushReady : true,
    home: pathname === "/",
    active,
    menuOpen,
  });

  // Um evento por vez que o aviso aparece (não a cada render).
  const mostrado = useRef(false);
  useEffect(() => {
    if (visivel && !mostrado.current) trackEvento("nascimento_aviso", { reason: "mostrado" });
    mostrado.current = visivel;
  }, [visivel]);

  if (!uid || !visivel) return null;

  function agoraNao() {
    if (!uid || salvando) return;
    dispensarAvisoNascimento(uid);
    setDispensas((n) => n + 1);
    setErro(null);
    trackEvento("nascimento_aviso", { reason: "agora_nao" });
  }

  async function confirmar() {
    if (!uid || salvando) return;
    setErro(null);
    const conferido = conferirNascimentoDigitado(data, hojeBRT());
    if (!conferido.ok) {
      setErro(t(conferido.erro));
      return;
    }
    setSalvando(true);
    try {
      await confirmarNascimentoApp(conferido.iso);
      trackEventoJa("nascimento_aviso", { reason: "confirmado" });
      setConfirmadoDe(uid);
      setData("");
      void reload();
    } catch (e) {
      // O servidor diz que não há mais o que confirmar: some sem mostrar erro.
      if (nascimentoJaResolvido(e)) {
        setConfirmadoDe(uid);
      } else {
        trackEventoJa("nascimento_aviso", { reason: motivoErroNascimento(e) });
        setErro(t(mensagemErroNascimento(e)));
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={agoraNao} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.fundo} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.cartao} accessibilityViewIsModal>
          <Text style={styles.titulo} accessibilityRole="header">{t("Confirme sua data de nascimento")}</Text>
          <Text style={styles.texto}>
            {t("A data que está no seu cadastro da igreja parece errada. Digite a data certa para a gente corrigir.")}
          </Text>
          <Input
            label={t("Data de nascimento")}
            value={data}
            onChangeText={(v) => setData(maskDateBR(v))}
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            maxLength={10}
            returnKeyType="done"
            onSubmitEditing={confirmar}
          />
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          <Button title={t("Confirmar")} onPress={confirmar} loading={salvando} />
          <Button title={t("Agora não")} variant="ghost" onPress={agoraNao} disabled={salvando} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    fundo: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg },
    cartao: {
      width: "100%",
      maxWidth: 480,
      alignSelf: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.lg,
      gap: spacing.md,
    },
    titulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    texto: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22 },
    erro: { color: colors.danger, fontSize: font.size.sm },
  });
