import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { apiGet, apiPost, criarInscricaoApi, getVoluntariadoOpcoes, getSupervisorInfo, type VoluntariadoOpcao } from "@/lib/api";
import { useRouter } from "expo-router";
import { useVoluntariadoSync } from "@/lib/useVoluntariadoSync";
import { type MinhaEscala } from "@/lib/escalas";

type EscalaApi = {
  id: string;
  team_name: string | null;
  position_name: string | null;
  confirmation_status: string | null;
  service?: { name: string | null; service_type_name: string | null; scheduled_at: string | null } | null;
};
type CheckinHist = { id: string; checked_in_at: string | null; servico: string | null; data: string | null };
type EscalasResp = { escalas: EscalaApi[]; historico: CheckinHist[]; vol_profile_id: string | null };
import { Disponibilidade } from "@/components/voluntariado/Disponibilidade";
import { isValidCPF, maskCPF, onlyDigits } from "@/lib/validators";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const MAX_AREAS = 3;

function fmtDataIso(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  // tenta extrair HH:MM da parte do tempo
  const t = iso.match(/T(\d{2}):(\d{2})/);
  const dataBR = `${m[3]}/${m[2]}/${m[1]}`;
  return t ? `${dataBR} ${t[1]}:${t[2]}` : dataBR;
}

export default function VoluntariadoScreen() {
  const { user } = useAuth();
  const { membro, loading } = useMembro();
  const router = useRouter();
  const [ehSupervisor, setEhSupervisor] = useState(false);
  useEffect(() => {
    getSupervisorInfo().then((r) => setEhSupervisor(!!r?.supervisor)).catch(() => {});
  }, []);
  const colors = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ---- Sync de status (fonte da verdade do voluntariado) ----
  // Só dispara o sync quando membro já carregou. Sem isso, useVoluntariadoSync(null)
  // resolve na hora com { inscricao: null } e a tela mostra o form por um frame
  // antes do estado real (flash).
  const { me } = useVoluntariadoSync(loading ? undefined : membro?.membroId ?? null);
  const [volProfileId, setVolProfileId] = useState<string | null>(null);
  const statusIns = me?.inscricao?.status ?? null;
  const semInscricao = me !== null && me.inscricao === null;
  const inscrito = statusIns === "inscrito";
  const enviadoMinisterio = statusIns === "enviado_ministerio";
  const integrado = statusIns === "integrado" || me?.voluntario_ativo === true;

  // ---- Minhas escalas + histórico de check-in (via backend · service_role) ----
  const [escalas, setEscalas] = useState<MinhaEscala[]>([]);
  const [historico, setHistorico] = useState<CheckinHist[]>([]);
  const [carregandoEscalas, setCarregandoEscalas] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const carregarEscalas = useCallback(async () => {
    setCarregandoEscalas(true);
    try {
      const r = await apiGet<EscalasResp>("/app/voluntariado/escalas");
      setEscalas(
        (r.escalas || []).map((e) => ({
          id: e.id,
          service_id: null,
          team_name: e.team_name,
          position_name: e.position_name,
          confirmation_status: e.confirmation_status,
          data: e.service?.scheduled_at ?? null,
          culto: e.service?.name ?? e.service?.service_type_name ?? null,
        }))
      );
      setHistorico(r.historico || []);
      if (r.vol_profile_id) setVolProfileId(r.vol_profile_id);
    } catch {
      // mantém o que tem
    } finally {
      setCarregandoEscalas(false);
    }
  }, []);

  useEffect(() => {
    carregarEscalas();
  }, [carregarEscalas]);

  const [recusaId, setRecusaId] = useState<string | null>(null); // escala abrindo o modal de motivo
  const [recusandoId, setRecusandoId] = useState<string | null>(null); // em envio
  const MOTIVOS_RECUSA = ["Viagem", "Estou doente", "Saí da igreja", "Troquei de área", "Outros"];

  async function recusar(id: string, motivo?: string) {
    setRecusandoId(id);
    try {
      await apiPost(`/app/voluntariado/escalas/${id}/responder`, { status: "declined", motivo: motivo || undefined });
      setEscalas((prev) => prev.map((e) => (e.id === id ? { ...e, confirmation_status: "declined" } : e)));
      setRecusaId(null);
    } catch {
      Alert.alert(t("Não foi possível recusar"), t("Verifique sua conexão e tente novamente."));
    } finally {
      setRecusandoId(null);
    }
  }

  async function confirmar(id: string) {
    setConfirmandoId(id);
    try {
      await apiPost(`/app/voluntariado/escalas/${id}/responder`, { status: "confirmed" });
      setEscalas((prev) =>
        prev.map((e) => (e.id === id ? { ...e, confirmation_status: "confirmed" } : e))
      );
    } catch {
      // ⚠️ Nunca falhar em silêncio: sem isso o usuário achava que confirmou
      // a escala quando o POST falhou (rede/servidor) e ninguém ficava sabendo.
      Alert.alert(
        t("Não foi possível confirmar"),
        t("Verifique sua conexão e tente novamente.")
      );
    } finally {
      setConfirmandoId(null);
    }
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

  // ---- "Já sirvo": cruzar CPF na 1ª entrada pra achar o cadastro de voluntário
  const [cpfBusca, setCpfBusca] = useState("");
  const [buscandoCpf, setBuscandoCpf] = useState(false);
  const [cpfMsg, setCpfMsg] = useState<string | null>(null);
  const [reconhecidoVol, setReconhecidoVol] = useState(false);

  async function buscarPorCpf() {
    setCpfMsg(null);
    if (!isValidCPF(cpfBusca)) {
      setCpfMsg(t("Informe um CPF válido."));
      return;
    }
    setBuscandoCpf(true);
    try {
      const r = await apiPost<{ found: boolean; nome?: string; integrado?: boolean }>(
        "/app/voluntariado/vincular-cpf",
        { cpf: onlyDigits(cpfBusca) }
      );
      if (r.found) {
        // Achou e vinculou o cadastro de voluntário → carrega as escalas dele
        // e mostra a área de voluntário (em vez do formulário de inscrição).
        await carregarEscalas();
        setReconhecidoVol(true);
      } else {
        setCpfMsg(
          t("Não encontramos um cadastro de voluntário com esse CPF. Escolha as áreas abaixo pra se inscrever.")
        );
      }
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        setCpfMsg(t("Este cadastro de voluntário já está vinculado a outra conta. Fale com a coordenação."));
      } else {
        setCpfMsg(err.message || t("Não foi possível cruzar o CPF."));
      }
    } finally {
      setBuscandoCpf(false);
    }
  }

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
        if (alive) setOpcoesErro(e instanceof Error ? e.message : t("Falha ao carregar áreas."));
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
      setError(t("Você já tem uma inscrição em andamento."));
      return;
    }
    if (!nome || !telefone) {
      setError(t("Preencha pelo menos nome e telefone."));
      return;
    }
    if (areas.length === 0) {
      setError(t("Escolha pelo menos uma área para servir."));
      return;
    }
    if (areas.length > MAX_AREAS) {
      setError(`${t("Escolha no máximo")} ${MAX_AREAS} ${t("áreas.")}`);
      return;
    }
    if (precisaAntecedentes) {
      if (!isValidCPF(cpf)) {
        setError(t("Para Kids/Bridge, informe um CPF válido."));
        return;
      }
      if (!nomeMae.trim()) {
        setError(t("Para Kids/Bridge, informe o nome da mãe."));
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
      setSucessoMsg(resp.message || t("Inscrição recebida! Nossa equipe entrará em contato."));
      setEnviado(true);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        // Já tem inscrição em análise — força sincronização e mostra status.
        setError(t("Você já tem uma inscrição em análise. Acompanhe o status acima."));
        setEnviado(false);
      } else {
        setError(err.message || t("Não foi possível enviar."));
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
            <Text style={styles.title}>{t("Voluntariado")}</Text>
          </View>

          {ehSupervisor && (
            <Pressable style={styles.supervisorCard} onPress={() => router.push("/escala-supervisor" as any)}>
              <Ionicons name="calendar" size={22} color={colors.brandPale} />
              <View style={{ flex: 1 }}>
                <Text style={styles.supervisorTitulo}>{t("Montar escala")}</Text>
                <Text style={styles.supervisorTxt}>{t("Você é supervisor · monte e veja as escalas da sua área.")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          )}

          {inscrito ? (
            <View style={styles.section}>
              <View style={styles.statusCard}>
                <Ionicons name="hourglass-outline" size={22} color={colors.brandMid} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitulo}>{t("Inscrição em análise")}</Text>
                  <Text style={styles.statusTxt}>
                    {t("Nossa equipe está revisando sua inscrição e em breve te encaminha pro ministério certo. Você recebe um aviso aqui quando avançar.")}
                  </Text>
                </View>
              </View>
            </View>
          ) : enviadoMinisterio ? (
            <View style={styles.section}>
              <View style={styles.statusCard}>
                <Ionicons name="paper-plane-outline" size={22} color={colors.brandMid} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitulo}>{t("Encaminhada ao ministério")}</Text>
                  <Text style={styles.statusTxt}>
                    {me?.inscricao?.area
                      ? `${t("Sua inscrição foi enviada pro ministério de")} ${me.inscricao.area}. `
                      : t("Sua inscrição foi enviada pro ministério. ")}
                    {t("O líder vai te chamar em breve.")}
                  </Text>
                </View>
              </View>
            </View>
          ) : (integrado || reconhecidoVol) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("Minhas escalas")}</Text>
              {carregandoEscalas ? (
                <Text style={styles.muted}>{t("Carregando…")}</Text>
              ) : escalas.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.muted}>{t("Você não tem escalas futuras no momento.")}</Text>
                </View>
              ) : (
                escalas.map((e) => {
                  const confirmado = e.confirmation_status === "confirmed";
                  const passou = e.data ? new Date(e.data).getTime() < Date.now() : false;
                  const titulo = e.culto ?? e.team_name ?? t("Escala");
                  const detalhes = [
                    e.data ? fmtDataIso(e.data) : null,
                    e.team_name && e.culto ? e.team_name : null,
                    e.position_name,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <View key={e.id} style={styles.escala}>
                      <View style={styles.escalaInfo}>
                        <Text style={styles.escalaMin}>{titulo}</Text>
                        {!!detalhes && <Text style={styles.escalaMeta}>{detalhes}</Text>}
                      </View>
                      {passou ? (
                        // Culto já passou: sem ações (não dá pra recusar depois).
                        confirmado ? (
                          <View style={styles.confirmado}>
                            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                            <Text style={styles.confirmadoTxt}>{t("Confirmada")}</Text>
                          </View>
                        ) : e.confirmation_status === "declined" ? (
                          <View style={styles.recusadaTag}>
                            <Ionicons name="close-circle" size={18} color={colors.danger} />
                            <Text style={styles.recusadaTxt}>{t("Recusada")}</Text>
                          </View>
                        ) : (
                          <Text style={styles.encerradoTxt}>{t("Encerrado")}</Text>
                        )
                      ) : confirmado ? (
                        <View style={styles.escalaAcoes}>
                          <View style={styles.confirmado}>
                            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                            <Text style={styles.confirmadoTxt}>{t("Confirmada")}</Text>
                          </View>
                          <Pressable onPress={() => setRecusaId(e.id)} hitSlop={8} disabled={recusandoId === e.id} accessibilityRole="button" accessibilityLabel={t("Recusar")}>
                            <Text style={styles.recusarLink}>{t("Recusar")}</Text>
                          </Pressable>
                        </View>
                      ) : e.confirmation_status === "declined" ? (
                        <Pressable style={styles.recusadaTag} onPress={() => confirmar(e.id)} disabled={confirmandoId === e.id}>
                          <Ionicons name="close-circle" size={18} color={colors.danger} />
                          <Text style={styles.recusadaTxt}>{confirmandoId === e.id ? "..." : t("Recusada")}</Text>
                        </Pressable>
                      ) : (
                        <View style={styles.escalaAcoes}>
                          <Pressable style={styles.recusarBtn} onPress={() => setRecusaId(e.id)} disabled={recusandoId === e.id}>
                            <Text style={styles.recusarTxt}>{t("Recusar")}</Text>
                          </Pressable>
                          <Pressable style={styles.confirmarBtn} onPress={() => confirmar(e.id)} disabled={confirmandoId === e.id}>
                            <Text style={styles.confirmarTxt}>{confirmandoId === e.id ? "..." : t("Confirmar")}</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
              {volProfileId && <Disponibilidade volProfileId={volProfileId} />}

              {historico.length > 0 && (
                <View style={{ marginTop: spacing.lg }}>
                  <Text style={styles.sectionTitle}>{t("Histórico de check-in")}</Text>
                  {historico.map((h) => {
                    const det = [h.servico, h.data ? fmtDataIso(h.data) : null].filter(Boolean).join(" · ");
                    return (
                      <View key={h.id} style={styles.escala}>
                        <View style={styles.escalaInfo}>
                          <Text style={styles.escalaMin}>{h.servico ?? t("Culto")}</Text>
                          {!!det && <Text style={styles.escalaMeta}>{det}</Text>}
                        </View>
                        <View style={styles.confirmado}>
                          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                          <Text style={styles.confirmadoTxt}>{t("Presente")}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ) : enviado ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle" size={40} color={colors.success} />
              <Text style={styles.title}>{t("Inscrição enviada!")}</Text>
              <Text style={styles.muted}>
                {sucessoMsg ?? t("Recebemos sua inscrição de voluntariado. Em breve a equipe fala com você. 💙")}
              </Text>
            </View>
          ) : me === null ? (
            <View style={styles.emptyCard}>
              <Text style={styles.muted}>{t("Carregando…")}</Text>
            </View>
          ) : me.inscricao ? (
            <View style={styles.section}>
              <View style={styles.statusCard}>
                <Ionicons name="information-circle-outline" size={22} color={colors.brandMid} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitulo}>
                    {t("Você já tem uma inscrição")} ({me.inscricao.status})
                  </Text>
                  <Text style={styles.statusTxt}>
                    {t("Para evitar duplicatas, só uma inscrição ativa por membro. Acompanhe o status aqui — quando avançar, a tela atualiza sozinha.")}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              {/* Já serve? Cruza o CPF com o cadastro de voluntário existente */}
              <View style={styles.cpfCard}>
                <Text style={styles.cpfTitulo}>{t("Você já serve na CBRio?")}</Text>
                <Text style={styles.cpfTxt}>
                  {t("Informe seu CPF pra encontrarmos seu cadastro de voluntário e suas escalas.")}
                </Text>
                <Input
                  label={t("CPF")}
                  value={cpfBusca}
                  onChangeText={(v) => setCpfBusca(maskCPF(v))}
                  keyboardType="number-pad"
                  placeholder="000.000.000-00"
                />
                {!!cpfMsg && <Text style={styles.cpfMsg}>{cpfMsg}</Text>}
                <Button
                  title={buscandoCpf ? t("Buscando…") : t("Já sirvo — buscar meu cadastro")}
                  onPress={buscarPorCpf}
                  disabled={buscandoCpf}
                />
                <Text style={styles.cpfOu}>{t("Ainda não serve? Preencha abaixo pra se inscrever.")}</Text>
              </View>

              <Text style={styles.subtitle}>
                {t("Sirva com a gente na CBRio. Escolha as áreas e preencha seus dados.")}
              </Text>
              <Input label={t("Nome completo")} value={nome} onChangeText={setNome} autoCapitalize="words" />
              <Input label={t("Telefone")} value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholder="+55 21 99999-9999" />
              <Input label={t("E-mail")} value={email} onChangeText={setEmail} keyboardType="email-address" />

              <Text style={styles.fieldLabel}>
                {t("Onde você quer servir? (até")} {MAX_AREAS})
              </Text>
              {opcoesLoading ? (
                <Text style={styles.muted}>{t("Carregando áreas…")}</Text>
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
                    label={t("CPF")}
                    value={cpf}
                    onChangeText={(v) => setCpf(maskCPF(v))}
                    placeholder="000.000.000-00"
                    keyboardType="number-pad"
                    maxLength={14}
                  />
                  <Input
                    label={t("Nome da mãe")}
                    value={nomeMae}
                    onChangeText={setNomeMae}
                    placeholder={t("Nome completo da mãe")}
                    autoCapitalize="words"
                  />
                </>
              )}

              {error && <Text style={styles.error}>{error}</Text>}
              <Button title={t("Quero ser voluntário")} onPress={enviar} loading={enviando || loading} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Recusar escala · motivo opcional */}
      <Modal visible={!!recusaId} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setRecusaId(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Recusar escala")}</Text>
              <Pressable onPress={() => setRecusaId(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.muted2}>{t("Quer dizer o motivo? (opcional)")}</Text>
            <View style={styles.chips}>
              {MOTIVOS_RECUSA.map((m) => (
                <Pressable key={m} style={styles.chip} disabled={!!recusandoId} onPress={() => recusaId && recusar(recusaId, m)}>
                  <Text style={styles.chipTxt}>{t(m)}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.recusarSemMotivo} disabled={!!recusandoId} onPress={() => recusaId && recusar(recusaId)}>
              <Text style={styles.recusarSemMotivoTxt}>{recusandoId ? "..." : t("Recusar sem dizer o motivo")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.lg },
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
    supervisorCard: {
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primary + "18",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    supervisorTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    supervisorTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 18 },
    cpfCard: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primary + "12",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    cpfTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    cpfTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 18 },
    cpfMsg: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 18 },
    cpfOu: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center", marginTop: 2 },
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
    escalaAcoes: { flexDirection: "row", alignItems: "center", gap: 8 },
    recusarBtn: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
    recusarTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "700" },
    recusadaTag: { flexDirection: "row", alignItems: "center", gap: 4 },
    recusadaTxt: { color: colors.danger, fontSize: font.size.sm, fontWeight: "600" },
    recusarLink: { color: colors.textMuted, fontSize: font.size.sm - 1, textDecorationLine: "underline" },
    encerradoTxt: { color: colors.textMuted, fontSize: font.size.sm, fontStyle: "italic" },
    modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sheetTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    muted2: { color: colors.textMuted, fontSize: font.size.sm },
    recusarSemMotivo: { alignItems: "center", paddingVertical: spacing.sm },
    recusarSemMotivoTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600", textDecorationLine: "underline" },
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
