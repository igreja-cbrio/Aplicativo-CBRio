import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Linking from "expo-linking";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CbrioHeart } from "@/components/brand/CbrioHeart";

type Estado = "validando" | "pronto" | "invalido";

/** Extrai params do fragmento (#a=1&b=2) ou da query (?a=1) de um deep link. */
function paramsDoLink(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const trecho = url.includes("#") ? url.split("#")[1] : (url.split("?")[1] ?? "");
  for (const par of trecho.split("&")) {
    const [k, v] = par.split("=");
    if (k && v !== undefined) out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

export default function RedefinirSenha() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { updatePassword } = useAuth();
  const url = Linking.useURL();

  const [estado, setEstado] = useState<Estado>("validando");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function processar() {
      // Se já existe sessão (link processado / usuário logado), libera o form.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (ativo) setEstado("pronto");
        return;
      }
      if (!url) return; // aguarda o useURL entregar o link
      const p = paramsDoLink(url);
      if (p.access_token && p.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: p.access_token,
          refresh_token: p.refresh_token,
        });
        if (ativo) setEstado(error ? "invalido" : "pronto");
      } else if (p.error || p.error_description) {
        if (ativo) setEstado("invalido");
      }
      // Sem tokens e sem erro: segue "validando" até o link chegar.
    }
    processar();
    return () => {
      ativo = false;
    };
  }, [url]);

  // Link nunca chegou (tela aberta sem deep link): expira pro estado inválido.
  useEffect(() => {
    if (estado !== "validando") return;
    const timer = setTimeout(() => setEstado((e) => (e === "validando" ? "invalido" : e)), 6000);
    return () => clearTimeout(timer);
  }, [estado]);

  async function salvar() {
    if (senha.length < 8) {
      Alert.alert(t("Senha curta"), t("Use pelo menos 8 caracteres."));
      return;
    }
    if (senha !== confirma) {
      Alert.alert(t("Confira a senha"), t("As senhas digitadas não são iguais."));
      return;
    }
    setSalvando(true);
    try {
      await updatePassword(senha);
      Alert.alert(t("Senha redefinida ✅"), t("Pronto! Você já está conectado com a nova senha."));
      router.replace("/");
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível redefinir."));
    }
    setSalvando(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <CbrioHeart size={56} />
          </View>
          <Text style={styles.title}>{t("Redefinir senha")}</Text>

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
      </KeyboardAvoidingView>
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
