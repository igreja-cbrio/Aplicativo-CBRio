import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { criarInscricaoApi, getVoluntariadoOpcoes, type VoluntariadoOpcao } from "@/lib/api";
import { useVoluntariadoSync } from "@/lib/useVoluntariadoSync";
import { getMeuVolProfileId } from "@/lib/disponibilidade";
import { Disponibilidade } from "@/components/voluntariado/Disponibilidade";
import { isValidCPF, maskCPF, onlyDigits } from "@/lib/validators";
import { supabase } from "@/lib/supabase";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const MAX_AREAS = 3;

type Escala = {
  id: string;
  data: string;
  papel: string | null;
  confirmado: boolean | null;
  ministerio: string | null;
};

function fmtData(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export default function VoluntariadoScreen() {
  const { user } = useAuth();
  const { membro, loading } = useMembro();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ---- Sync de status (fonte da verdade do voluntariado) ----
  // Só dispara o sync quando membro já carregou. Sem isso, useVoluntariadoSync(null)
  // resolve na hora com { inscricao: null } e a tela mostra o form por um frame
  // antes do estado real (flash).
  const { me } = useVoluntariadoSync(loading ? undefined : membro?.membroId ?? null);
  const [volProfileId, setVolProfileId] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    getMeuVolProfileId(user.id, membro?.membroId ?? null).then((id) => {
      setVolProfileId(id);
    });
  }, [user?.id, membro?.membroId]);
  const statusIns = me?.inscricao?.status ?? null;
  const semInscricao = me !== null && me.inscricao === null;
  const inscrito = statusIns === "inscrito";
  const enviadoMinisterio = statusIns === "enviado_ministerio";
  const integrado = statusIns === "integrado" || me?.voluntario_ativo === true;

  // ---- Minhas escalas ----
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregandoEscalas, setCarregandoEscalas] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const carregarEscalas = useCallback(async () => {
    if (!membro?.membroId) return;
    setCarregandoEscalas(true);
    const hoje = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("mem_escalas")
      .select("id, data, papel, confirmado, ministerio_id")
      .eq("membro_id", membro.membroId)
      .gte("data", hoje)
      .order("data", { ascending: true });
    const rows =
      (data as {
        id: string;
        data: string;
        papel: string | null;
        confirmado: boolean | null;
        ministerio_id: string | null;
      }[]) ?? [];
    const ids = [...new Set(rows.map((r) => r.ministerio_id).filter(Boolean))] as string[];
    const nomes: Record<string, string> = {};
    if (ids.length) {
      const { data: mins } = await supabase
        .from("mem_ministerios")
        .select("id, nome")
        .in("id", ids);
      (mins as { id: string; nome: string }[] | null)?.forEach((m) => {
        nomes[m.id] = m.nome;
      });
    }
    setEscalas(
      rows.map((r) => ({
        id: r.id,
        data: r.data,
        papel: r.papel,
        confirmado: r.confirmado,
        ministerio: r.ministerio_id ? nomes[r.ministerio_id] ?? null : null,
      }))
    );
    setCarregandoEscalas(false);
  }, [membro?.membroId]);

  useEffect(() => {
    carregarEscalas();
  }, [carregarEscalas]);

  async function confirmar(id: string) {
    setConfirmandoId(id);
    const { error } = await supabase
      .from("mem_escalas")
      .update({ confirmado: true })
      .eq("id", id);
    if (!error) {
      setEscalas((prev) => prev.map((e) => (e.id === id ? { ...e, confirmado: true } : e)));
    }
    setConfirmandoId(null);
  }

  // ---- Inscrição de voluntariado ----
  const [opcoes, setOpcoes] = useState<VoluntariadoOpcao[]>([]);
  const [opcoesLoading, setOpcoesLoading] = useState(true);
  const [opcoesErro, setOpcoesErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [cpf, setCpf] = useState("");
  const [nomeMae, setNomeMae] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (membro) {
      setNome((v) => v || membro.nome);
      setTelefone((v) => v || membro.telefone);
      setEmail((v) => v || membro.email);
      setCpf((v) => v || (membro.cpf ? maskCPF(membro.cpf) : ""));
    }
  }, [membro]);

  useEffect(() => {
    let alive = true;
    setOpcoesLoading(true);
    getVoluntariadoOpcoes()
      .then((data) => {
        if (alive) setOpcoes(data);
      })
      .catch((e) => {
        if (alive) setOpcoesErro(e instanceof Error ? e.message : "Falha ao carregar áreas.");
      })
      .finally(() => {
        if (alive) setOpcoesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  function toggleArea(a: string) {
    setAreas((prev) =>
      prev.includes(a)
        ? prev.filter((x) => x !== a)
        : prev.length >= MAX_AREAS
        ? prev
        : [...prev, a]
    );
  }

  const opcoesAntecedentes = (Array.isArray(opcoes) ? opcoes : []).filter(
    (o) => areas.includes(o.label) && o.exige_dados_menor
  );
  const precisaAntecedentes = opcoesAntecedentes.length > 0;

  async function enviar() {
    setError(null);
    if (me?.inscricao) {
      setError("Você já tem uma inscrição em andamento.");
      return;
    }
    if (!nome || !telefone) {
      setError("Preencha pelo menos nome e telefone.");
      return;
    }
    if (areas.length === 0) {
      setError("Escolha pelo menos uma área para servir.");
      return;
    }
    if (areas.length > MAX_AREAS) {
      setError(`Escolha no máximo ${MAX_AREAS} áreas.`);
      return;
    }
    if (precisaAntecedentes) {
      if (!isValidCPF(cpf)) {
        setError("Para Kids/Bridge, informe um CPF válido.");
        return;
      }
      if (!nomeMae.trim()) {
        setError("Para Kids/Bridge, informe o nome da mãe.");
        return;
      }
    }
    setEnviando(true);
    try {
      const partes = nome.trim().split(/\s+/);
      const cpfDigits = precisaAntecedentes
        ? onlyDigits(cpf)
        : membro?.cpf
        ? onlyDigits(membro.cpf)
        : "";
      const resp = await criarInscricaoApi({
        tipo: "voluntariado",
        nome: partes[0],
        sobrenome: partes.slice(1).join(" "),
        nome_completo: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim(),
        cpf: cpfDigits,
        nome_mae: precisaAntecedentes ? nomeMae.trim() : null,
        areas,
        membro_id: membro?.membroId ?? null,
      });
      setSucessoMsg(resp.message || "Inscrição recebida! Nossa equipe entrará em contato.");
      setEnviado(true);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        // Já tem inscrição em análise — força sincronização e mostra status.
        setError("Você já tem uma inscrição em análise. Acompanhe o status acima.");
        setEnviado(false);
      } else {
        setError(err.message || "Não foi possível enviar.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.badge}>
              <Ionicons name="hand-left" size={28} color={colors.brandPale} />
            </View>
            <Text style={styles.title}>Voluntariado</Text>
          </View>

          {inscrito ? (
            <View style={styles.section}>
              <View style={styles.statusCard}>
                <Ionicons name="hourglass-outline" size={22} color={colors.brandMid} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitulo}>Inscrição em análise</Text>
                  <Text style={styles.statusTxt}>
                    Nossa equipe está revisando sua inscrição e em breve te
                    encaminha pro ministério certo. Você recebe um aviso aqui
                    quando avançar.
                  </Text>
                </View>
              </View>
            </View>
          ) : enviadoMinisterio ? (
            <View style={styles.section}>
              <View style={styles.statusCard}>
                <Ionicons name="paper-plane-outline" size={22} color={colors.brandMid} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitulo}>Encaminhada ao ministério</Text>
                  <Text style={styles.statusTxt}>
                    {me?.inscricao?.area
                      ? `Sua inscrição foi enviada pro ministério de ${me.inscricao.area}. `
                      : "Sua inscrição foi enviada pro ministério. "}
                    O líder vai te chamar em breve.
                  </Text>
                </View>
              </View>
            </View>
          ) : integrado ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Minhas escalas</Text>
              {carregandoEscalas ? (
                <Text style={styles.muted}>Carregando…</Text>
              ) : escalas.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.muted}>Você não tem escalas futuras no momento.</Text>
                </View>
              ) : (
                escalas.map((e) => (
                  <View key={e.id} style={styles.escala}>
                    <View style={styles.escalaInfo}>
                      <Text style={styles.escalaMin}>{e.ministerio ?? "Ministério"}</Text>
                      <Text style={styles.escalaMeta}>
                        {fmtData(e.data)}
                        {e.papel ? ` · ${e.papel}` : ""}
                      </Text>
                    </View>
                    {e.confirmado ? (
                      <View style={styles.confirmado}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                        <Text style={styles.confirmadoTxt}>Confirmada</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={styles.confirmarBtn}
                        onPress={() => confirmar(e.id)}
                        disabled={confirmandoId === e.id}
                      >
                        <Text style={styles.confirmarTxt}>
                          {confirmandoId === e.id ? "..." : "Confirmar"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))
              )}
              {volProfileId && <Disponibilidade volProfileId={volProfileId} />}
            </View>
          ) : enviado ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle" size={40} color={colors.success} />
              <Text style={styles.title}>Inscrição enviada!</Text>
              <Text style={styles.muted}>
                {sucessoMsg ?? "Recebemos sua inscrição de voluntariado. Em breve a equipe fala com você. 💙"}
              </Text>
            </View>
          ) : me === null ? (
            <View style={styles.emptyCard}>
              <Text style={styles.muted}>Carregando…</Text>
            </View>
          ) : me.inscricao ? (
            <View style={styles.section}>
              <View style={styles.statusCard}>
                <Ionicons name="information-circle-outline" size={22} color={colors.brandMid} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitulo}>
                    Você já tem uma inscrição ({me.inscricao.status})
                  </Text>
                  <Text style={styles.statusTxt}>
                    Para evitar duplicatas, só uma inscrição ativa por membro.
                    Acompanhe o status aqui — quando avançar, a tela atualiza
                    sozinha.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.subtitle}>
                Sirva com a gente na CBRio. Escolha as áreas e preencha seus dados.
              </Text>
              <Input label="Nome completo" value={nome} onChangeText={setNome} autoCapitalize="words" />
              <Input label="Telefone" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholder="+55 21 99999-9999" />
              <Input label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />

              <Text style={styles.fieldLabel}>
                Onde você quer servir? (até {MAX_AREAS})
              </Text>
              {opcoesLoading ? (
                <Text style={styles.muted}>Carregando áreas…</Text>
              ) : opcoesErro ? (
                <Text style={styles.error}>{opcoesErro}</Text>
              ) : (
                <View style={styles.chips}>
                  {opcoes.map((o) => {
                    const sel = areas.includes(o.label);
                    const disabled = !sel && areas.length >= MAX_AREAS;
                    return (
                      <Pressable
                        key={o.label}
                        style={[
                          styles.chip,
                          sel && styles.chipSel,
                          disabled && { opacity: 0.4 },
                        ]}
                        onPress={() => !disabled && toggleArea(o.label)}
                      >
                        <Text style={[styles.chipTxt, sel && styles.chipTxtSel]}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Antecedentes (Kids/Bridge — vem do form-opcoes) */}
              {opcoesAntecedentes.map((o) => (
                <View key={o.label} style={styles.aviso}>
                  {!!o.aviso_titulo && <Text style={styles.avisoTitulo}>{o.aviso_titulo}</Text>}
                  {!!o.aviso_texto && <Text style={styles.avisoTexto}>{o.aviso_texto}</Text>}
                </View>
              ))}
              {precisaAntecedentes && (
                <>
                  <Input
                    label="CPF"
                    value={cpf}
                    onChangeText={(t) => setCpf(maskCPF(t))}
                    placeholder="000.000.000-00"
                    keyboardType="number-pad"
                    maxLength={14}
                  />
                  <Input
                    label="Nome da mãe"
                    value={nomeMae}
                    onChangeText={setNomeMae}
                    placeholder="Nome completo da mãe"
                    autoCapitalize="words"
                  />
                </>
              )}

              {error && <Text style={styles.error}>{error}</Text>}
              <Button title="Quero ser voluntário" onPress={enviar} loading={enviando || loading} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
    header: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
    badge: {
      width: 72,
      height: 72,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { color: colors.text, fontSize: font.size.xl, fontWeight: "800", textAlign: "center" },
    subtitle: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", lineHeight: 22 },
    section: { gap: spacing.md },
    sectionTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "700" },
    statusCard: {
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      alignItems: "flex-start",
    },
    statusTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800", marginBottom: 4 },
    statusTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    muted: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", lineHeight: 22 },
    error: { color: colors.danger, fontSize: font.size.sm },
    fieldLabel: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    chipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTxt: { color: colors.text, fontSize: font.size.sm },
    chipTxtSel: { color: "#fff", fontWeight: "700" },
    aviso: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.brandMid,
      padding: spacing.md,
      gap: spacing.xs,
    },
    avisoTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    avisoTexto: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.sm,
    },
    escala: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.lg,
    },
    escalaInfo: { flex: 1, gap: 2 },
    escalaMin: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    escalaMeta: { color: colors.textMuted, fontSize: font.size.sm },
    confirmarBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    confirmarTxt: { color: "#fff", fontSize: font.size.sm, fontWeight: "700" },
    confirmado: { flexDirection: "row", alignItems: "center", gap: 4 },
    confirmadoTxt: { color: colors.success, fontSize: font.size.sm, fontWeight: "600" },
    soon: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.md,
    },
    soonText: { flex: 1, color: colors.textMuted, fontSize: font.size.sm },
  });
