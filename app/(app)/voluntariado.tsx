import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
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
import { SeusDados, fichaCompleta } from "@/components/inscricoes/SeusDados";
import { apiGet, apiPost, criarInscricaoApi, getVoluntariadoOpcoes, getSupervisorInfo, type VoluntariadoOpcao } from "@/lib/api";
import { useRouter } from "expo-router";
import { useVoluntariadoSync } from "@/lib/useVoluntariadoSync";
import { estadoVoluntariado, volEncerrado } from "@/lib/volStatus";
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
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { SecaoRecolhivel } from "@/components/ui/SecaoRecolhivel";
import { resumoEscalas } from "@/lib/resumoEscalas";

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
  // ⚠️ Régua ÚNICA em lib/volStatus.ts (a MESMA do hub de Inscrições). O ERP tem
  // 7 status e esta tela tratava 3 — `nao_responde`/`nao_pode_ou_duplicata`/
  // `kids` caíam no `else` (formulário) enquanto o hub dizia "Pendente".
  const estadoVol = estadoVoluntariado(statusIns, me?.voluntario_ativo);
  const inscrito = statusIns === "inscrito";
  const enviadoMinisterio = statusIns === "enviado_ministerio";
  const integrado = estadoVol === "ativo";
  // A equipe encerrou a fila desta pessoa: o formulário é reoferecido (o dedup do
  // backend permite), mas dizendo o que aconteceu — em vez de fingir que ela
  // nunca se inscreveu.
  const filaEncerrada = volEncerrado(statusIns);

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

  // O que o cabeçalho da seção recolhida diz (régua em lib/resumoEscalas.ts).
  const resumoEsc = resumoEscalas(escalas, new Date());

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
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <TecladoSeguro        style={styles.flex}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          ) : integrado ? (
            <View style={styles.section}>
              {/* ⚠️ Recolhida por padrão (pedido do Matheus · 13/08/2026). O
                  cabeçalho avisa quantas esperam resposta — escala que pede ação
                  não pode ficar escondida atrás do triângulo. */}
              <SecaoRecolhivel
                titulo={t("Minhas escalas")}
                resumo={
                  carregandoEscalas
                    ? null
                    : resumoEsc.pendentes > 0
                      ? `${resumoEsc.pendentes} ${resumoEsc.pendentes === 1 ? t("aguarda você") : t("aguardam você")}`
                      : String(resumoEsc.total)
                }
                destaque={resumoEsc.pendentes > 0}
              >
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
                        // ⚠️ "Recusar" era um link cinza sublinhado ao lado do
                        // "Confirmada" e ninguém achava (relato do Matheus ·
                        // 13/08/2026). Virou botão de verdade, embaixo do
                        // status: quem não pode ir precisa avisar a coordenação,
                        // e avisar tarde custa a vaga do domingo.
                        <View style={styles.escalaAcoesCol}>
                          <View style={styles.confirmado}>
                            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                            <Text style={styles.confirmadoTxt}>{t("Confirmada")}</Text>
                          </View>
                          <Pressable
                            onPress={() => setRecusaId(e.id)}
                            hitSlop={8}
                            disabled={recusandoId === e.id}
                            accessibilityRole="button"
                            accessibilityLabel={t("Recusar")}
                            style={({ pressed }) => [styles.recusarBtn, pressed && { opacity: 0.6 }]}
                          >
                            <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
                            <Text style={styles.recusarTxt}>{t("Recusar")}</Text>
                          </Pressable>
                        </View>
                      ) : e.confirmation_status === "declined" ? (
                        <Pressable style={styles.recusadaTag} onPress={() => confirmar(e.id)} disabled={confirmandoId === e.id}>
                          <Ionicons name="close-circle" size={18} color={colors.danger} />
                          <Text style={styles.recusadaTxt}>{confirmandoId === e.id ? "..." : t("Recusada")}</Text>
                        </Pressable>
                      ) : (
                        <View style={styles.escalaAcoes}>
                          <Pressable
                            style={({ pressed }) => [styles.recusarBtn, pressed && { opacity: 0.6 }]}
                            onPress={() => setRecusaId(e.id)}
                            disabled={recusandoId === e.id}
                            accessibilityRole="button"
                          >
                            <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
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
              </SecaoRecolhivel>

              {volProfileId && <Disponibilidade volProfileId={volProfileId} />}

              {historico.length > 0 && (
                <SecaoRecolhivel titulo={t("Histórico de check-in")} resumo={String(historico.length)}>
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
                </SecaoRecolhivel>
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
              {/* A equipe encerrou a fila desta pessoa (`nao_responde` /
                  `nao_pode_ou_duplicata` / `desistente`). O formulário volta a
                  aparecer — o dedup do backend permite —, mas dizendo o que
                  aconteceu: antes o app mostrava "Pendente" no hub e o
                  formulário aqui, sem explicar nada. */}
              {filaEncerrada && (
                <View style={styles.statusCard}>
                  <Ionicons name="refresh-outline" size={22} color={colors.brandMid} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusTitulo}>{t("Sua inscrição anterior foi encerrada")}</Text>
                    <Text style={styles.statusTxt}>
                      {t("Não conseguimos concluir o processo da última vez. Se quiser servir, pode se inscrever de novo abaixo.")}
                    </Text>
                  </View>
                </View>
              )}
              {/* ⚠⚠ O BLOCO "Já sirvo — informe seu CPF" SAIU DAQUI (11/08/2026).
                  Dois motivos, e o primeiro basta: ele chamava
                  `POST /app/voluntariado/vincular-cpf`, um endpoint que **nunca
                  existiu no backend**. Era o ÚNICO caminho de saída desta tela pra
                  quem já serve, e devolvia 404 — a pessoa lia "não foi possível
                  cruzar o CPF" e concluia que o problema era o CPF dela.
                  ⚠️ Segundo motivo: quem resolve isso agora é o SERVIDOR, sozinho
                  (`backend/utils/perfilVoluntarioApp.js` · auth_user_id →
                  membresia_id → e-mail, com self-heal da coluna). Medido: cobre
                  as 8 contas escaladas que caiam aqui, sem ninguém digitar nada.
                  ⚠️ E não reintroduzir busca por CPF DIGITADO: "CPF identifica, não
                  autentica" é lei do projeto — aqui ela daria as escalas, o
                  telefone e o e-mail de quem tivesse o CPF conhecido. */}

              <Text style={styles.subtitle}>
                {fichaCompleta(membro)
                  ? t("Sirva com a gente na CBRio. Escolha as áreas onde quer servir.")
                  : t("Sirva com a gente na CBRio. Escolha as áreas e preencha seus dados.")}
              </Text>
              {fichaCompleta(membro) ? (
                <SeusDados nome={nome} telefone={telefone} email={email} />
              ) : (
                <>
                  <Input label={t("Nome completo")} value={nome} onChangeText={setNome} autoCapitalize="words" />
                  <Input label={t("Telefone")} value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholder="+55 21 99999-9999" />
                  <Input label={t("E-mail")} value={email} onChangeText={setEmail} keyboardType="email-address" />
                </>
              )}

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
      </TecladoSeguro>

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
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.lg },
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
    // Escala confirmada: status em cima, botão de recusar embaixo (o link
    // discreto ao lado do "Confirmada" passava despercebido).
    escalaAcoesCol: { alignItems: "flex-end", gap: 8 },
    recusarBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.danger + "14",
    },
    recusarTxt: { color: colors.danger, fontSize: font.size.sm, fontWeight: "700" },
    recusadaTag: { flexDirection: "row", alignItems: "center", gap: 4 },
    recusadaTxt: { color: colors.danger, fontSize: font.size.sm, fontWeight: "600" },
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
