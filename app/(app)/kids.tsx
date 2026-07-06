import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { apiGet, apiPost } from "@/lib/api";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Filho = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  observacoes_medicas: string | null;
};

type PreCheckin = {
  id: string;
  codigo: string;
  crianca_ids: string[];
  expira_em: string;
};

type MeusFilhos = {
  membro: { id: string; nome: string } | null;
  filhos: Filho[];
  preCheckin: PreCheckin | null;
};

type Solicitacao = {
  id: string;
  crianca_nome: string;
  status: "pendente" | "aprovado" | "rejeitado" | "cancelado";
  motivo_rejeicao: string | null;
  created_at: string;
};

function idadeLabel(nascimento: string | null): string {
  if (!nascimento) return "";
  const nasc = new Date(nascimento);
  if (isNaN(nasc.getTime())) return "";
  const agora = new Date();
  let meses =
    (agora.getFullYear() - nasc.getFullYear()) * 12 +
    (agora.getMonth() - nasc.getMonth());
  if (agora.getDate() < nasc.getDate()) meses -= 1;
  if (meses < 0) meses = 0;
  if (meses < 24) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

function validadeLabel(expira: string): string {
  const fim = new Date(expira);
  const horas = Math.max(0, Math.round((fim.getTime() - Date.now()) / 3600000));
  const hh = fim.getHours().toString().padStart(2, "0");
  const mm = fim.getMinutes().toString().padStart(2, "0");
  return `Válido até ${hh}:${mm} (${horas}h)`;
}

export default function KidsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [carregando, setCarregando] = useState(true);
  const [filhos, setFilhos] = useState<Filho[]>([]);
  const [pre, setPre] = useState<PreCheckin | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [solicitacoesFalhou, setSolicitacoesFalhou] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const data = await apiGet<MeusFilhos>("/app/kids/meus-filhos");
      setFilhos(data.filhos || []);
      setPre(data.preCheckin || null);
      // Seleção inicial: todos os filhos marcados.
      setSelecionados(new Set((data.filhos || []).map((f) => f.id)));
      setEditando(!data.preCheckin); // sem código ativo → já abre na seleção
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível carregar."));
    } finally {
      setCarregando(false);
    }
    // Solicitações de vínculo (best-effort · não bloqueia a tela) — mas a
    // falha precisa ser visível: quem tem vínculo em análise via a tela limpa
    // e achava que a solicitação tinha sumido.
    apiGet<{ solicitacoes: Solicitacao[] }>("/app/kids/minhas-solicitacoes")
      .then((r) => { setSolicitacoes(r.solicitacoes || []); setSolicitacoesFalhou(false); })
      .catch(() => setSolicitacoesFalhou(true));
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function gerar() {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    setGerando(true);
    setErro(null);
    try {
      const novo = await apiPost<PreCheckin>("/app/kids/pre-checkin", {
        crianca_ids: ids,
      });
      setPre(novo);
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível gerar o check-in."));
    } finally {
      setGerando(false);
    }
  }

  const nomesNoPre = useMemo(() => {
    if (!pre) return [];
    return pre.crianca_ids
      .map((id) => filhos.find((f) => f.id === id)?.nome)
      .filter(Boolean) as string[];
  }, [pre, filhos]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Check-in Kids")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.intro}>
          {t("Prepare o check-in dos seus filhos pelo celular. No totem, a equipe escaneia seu código, confere com você e imprime as etiquetas. A entrada e a retirada continuam presenciais.")}
        </Text>

        {/* Solicitações de vínculo em análise / recusadas */}
        {solicitacoesFalhou && solicitacoes.length === 0 && (
          <View style={styles.solRow}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.solStatus, { flex: 1 }]}>
              {t("Não foi possível verificar suas solicitações de vínculo. Puxe pra atualizar.")}
            </Text>
          </View>
        )}
        {solicitacoes
          .filter((s) => s.status === "pendente" || s.status === "rejeitado")
          .map((s) => (
            <View key={s.id} style={[styles.solRow, s.status === "rejeitado" && styles.solRowRej]}>
              <Ionicons
                name={s.status === "pendente" ? "time-outline" : "close-circle-outline"}
                size={20}
                color={s.status === "pendente" ? "#F59E0B" : "#EF4444"}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.solNome}>{s.crianca_nome}</Text>
                <Text style={styles.solStatus}>
                  {s.status === "pendente"
                    ? t("Em análise pela equipe Kids")
                    : s.motivo_rejeicao || t("Solicitação recusada. Procure a equipe Kids.")}
                </Text>
              </View>
            </View>
          ))}

        {carregando ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brandMid} />
          </View>
        ) : erro ? (
          <GlassCard style={styles.card}>
            <Text style={styles.cardText}>{erro}</Text>
            <Button title={t("Tentar de novo")} onPress={carregar} />
          </GlassCard>
        ) : filhos.length === 0 ? (
          <GlassCard style={styles.card}>
            <Ionicons name="happy-outline" size={32} color={colors.brandMid} />
            <Text style={styles.cardTitle}>{t("Nenhuma criança vinculada")}</Text>
            <Text style={styles.cardText}>
              {t("Você ainda não consta como responsável autorizado de nenhuma criança. Solicite o vínculo enviando os documentos — a equipe Kids confere e libera.")}
            </Text>
            <Button title={t("Solicitar vínculo de uma criança")} onPress={() => router.navigate("/kids-solicitar-vinculo")} />
          </GlassCard>
        ) : pre && !editando ? (
          // ── Código ativo: mostra QR + código pra apresentar no totem ──
          <>
            <GlassCard style={styles.qrCard}>
              <Text style={styles.qrLabel}>{t("Apresente este código no totem Kids")}</Text>
              <View style={styles.qrBox}>
                <QRCode value={pre.codigo} size={190} backgroundColor="#ffffff" color="#0B1F26" />
              </View>
              <Text style={styles.codigo}>{pre.codigo}</Text>
              <Text style={styles.validade}>{validadeLabel(pre.expira_em)}</Text>
            </GlassCard>

            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>
                {nomesNoPre.length === 1 ? t("Criança no check-in") : t("Crianças no check-in")}
              </Text>
              {nomesNoPre.map((nome) => (
                <View key={nome} style={styles.nomeRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.brandMid} />
                  <Text style={styles.nomeTxt}>{nome}</Text>
                </View>
              ))}
            </GlassCard>

            <Button title={t("Trocar crianças")} variant="ghost" onPress={() => setEditando(true)} />
          </>
        ) : (
          // ── Seleção de filhos + gerar código ──
          <>
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>{t("Quem vai hoje?")}</Text>
              <Text style={styles.cardText}>{t("Marque as crianças que você vai levar.")}</Text>
              {filhos.map((f) => {
                const marcado = selecionados.has(f.id);
                const idade = idadeLabel(f.data_nascimento);
                return (
                  <Pressable
                    key={f.id}
                    style={({ pressed }) => [styles.filhoRow, pressed && styles.pressed]}
                    onPress={() => toggle(f.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: marcado }}
                    accessibilityLabel={f.nome}
                  >
                    <View style={[styles.check, marcado && styles.checkOn]}>
                      {marcado && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.filhoNome}>{f.nome}</Text>
                      {!!idade && <Text style={styles.filhoIdade}>{idade}</Text>}
                      {!!f.observacoes_medicas && (
                        <Text style={styles.filhoObs} numberOfLines={2}>
                          ⚠️ {f.observacoes_medicas}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => router.navigate({ pathname: "/kids-filho", params: { id: f.id } })}
                      hitSlop={10}
                      style={styles.filhoInfo}
                      accessibilityRole="button"
                      accessibilityLabel={t("Ver histórico")}
                    >
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </GlassCard>

            <Button
              title={t("Gerar código de check-in")}
              onPress={gerar}
              loading={gerando}
              disabled={selecionados.size === 0}
            />
            {pre && (
              <Button title={t("Cancelar")} variant="ghost" onPress={() => setEditando(false)} />
            )}
          </>
        )}

        {/* Vincular outra criança (quando já há filhos ou código ativo) */}
        {!carregando && !erro && filhos.length > 0 && (
          <Pressable onPress={() => router.navigate("/kids-solicitar-vinculo")} style={styles.linkRow} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={18} color={colors.brandMid} />
            <Text style={styles.linkTxt}>{t("Solicitar vínculo de outra criança")}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    intro: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 21 },
    center: { paddingVertical: spacing.xl, alignItems: "center" },
    card: { gap: spacing.sm, marginTop: spacing.sm, padding: spacing.lg, alignItems: "flex-start" },
    cardTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "700" },
    cardText: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19 },
    qrCard: { gap: spacing.sm, marginTop: spacing.sm, padding: spacing.lg, alignItems: "center" },
    qrLabel: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center" },
    qrBox: { backgroundColor: "#ffffff", padding: spacing.md, borderRadius: radius.lg },
    codigo: { color: colors.text, fontSize: 34, fontWeight: "800", letterSpacing: 6, fontVariant: ["tabular-nums"] },
    validade: { color: colors.textMuted, fontSize: font.size.sm },
    nomeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    nomeTxt: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    filhoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, width: "100%" },
    pressed: { opacity: 0.6 },
    check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.glassBorder, alignItems: "center", justifyContent: "center" },
    checkOn: { backgroundColor: colors.brandMid, borderColor: colors.brandMid },
    filhoNome: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    filhoIdade: { color: colors.textMuted, fontSize: font.size.sm },
    filhoObs: { color: "#F59E0B", fontSize: font.size.sm },
    filhoInfo: { padding: 4 },
    solRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(245,158,11,0.10)", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: "rgba(245,158,11,0.30)" },
    solRowRej: { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.30)" },
    solNome: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    solStatus: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
    linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.sm },
    linkTxt: { color: colors.brandMid, fontSize: font.size.md, fontWeight: "600" },
  });
