import { useAuth } from "@/contexts/AuthContext";
import { Text } from "@/components/ui/Typography";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Linking from "expo-linking";

import { createRecoveryClient } from "@/lib/supabase";
import { preparePasswordRecovery } from "@/lib/passwordRecovery";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";

type Estado = "validando" | "pronto" | "invalido" | "concluido";

export default function RedefinirSenha() {
  const { signOut } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const attempt = useRef<Awaited<ReturnType<typeof preparePasswordRecovery>> | null>(null);
  const activeUrl = useRef<string | null>(null);
  const url = Linking.useURL();

  const [estado, setEstado] = useState<Estado>("validando");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Revoga de imediato uma autorização quando chega outro link.
  if (activeUrl.current !== url) { attempt.current?.invalidate(); attempt.current = null; activeUrl.current = url; }
  useEffect(() => {
    let active = true;
    setEstado("validando");
    setSenha(""); setConfirma("");
    const client = createRecoveryClient();
    if (url) void preparePasswordRecovery(url, client).then((value) => {
      if (!active) { value.invalidate(); return; }
      attempt.current = value;
      setEstado("pronto");
    }).catch(() => { if (active) setEstado("invalido"); });
    return () => { active = false; attempt.current?.invalidate(); attempt.current = null; client.auth.stopAutoRefresh(); };
  }, [url]);

  // Link nunca chegou (tela aberta sem deep link): expira pro estado inválido.
  useEffect(() => {
    if (estado !== "validando") return;
    const timer = setTimeout(() => setEstado((e) => (e === "validando" ? "invalido" : e)), 6000);
    return () => clearTimeout(timer);
  }, [estado]);

  async function salvar() {
    if (estado !== "pronto" || !attempt.current || salvando) return;
    if (senha.length < 8) {
      Alert.alert(t("Senha curta"), t("Use pelo menos 8 caracteres."));
      return;
    }
    if (senha !== confirma) {
      Alert.alert(t("Confira a senha"), t("As senhas digitadas não são iguais."));
      return;
    }
    const currentAttempt = attempt.current;
    setSalvando(true);
    try {
      await currentAttempt.save(senha);
      if (attempt.current !== currentAttempt) return;
      attempt.current = null;
      setEstado("concluido");
      try { await signOut("local"); } catch {
        Alert.alert(t("Senha redefinida ✅"), t("A senha foi alterada. Saia da conta pelo menu e entre novamente."));
        router.replace("/");
        return;
      }
      Alert.alert(t("Senha redefinida ✅"), t("Entre novamente usando sua nova senha."));
      router.replace("/(auth)/login");
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível redefinir."));
    }
    finally { setSalvando(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TecladoSeguro  style={{ flex: 1 }}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <CbrioHeart size={56} />
          </View>
          <Text style={styles.title}>{t("Redefinir senha")}</Text>

          {estado === "concluido" && <Text style={styles.texto}>{t("Senha redefinida ✅")} {t("Entre novamente usando sua nova senha.")}</Text>}

          {estado === "validando" && (
            <Text style={styles.texto}>{t("Validando seu link de redefinição…")}</Text>
          )}

          {estado === "invalido" && (
            <>
              <Text style={styles.texto}>
                {t("Esse link expirou ou já foi usado. Peça um novo e abra o e-mail pelo celular com o app instalado.")}
              </Text>
              <Button
                title={t("Pedir novo link")}
                onPress={() => router.replace("/(auth)/recuperar-senha")}
                style={{ marginTop: 16 }}
              />
            </>
          )}

          {estado === "pronto" && (
            <>
              <Text style={styles.texto}>{t("Escolha sua nova senha.")}</Text>
              <Input
                label={t("Nova senha")}
                value={senha}
                onChangeText={setSenha}
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
              />
              <Input
                label={t("Confirmar nova senha")}
                value={confirma}
                onChangeText={setConfirma}
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
              />
              <Button
                title={salvando ? t("Salvando…") : t("Salvar nova senha")}
                onPress={salvar}
                disabled={salvando}
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </ScrollView>
      </TecladoSeguro>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 48, gap: 12 },
    logo: { alignItems: "center", marginBottom: 8 },
    title: { fontSize: 26, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: 4 },
    texto: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  });
}
