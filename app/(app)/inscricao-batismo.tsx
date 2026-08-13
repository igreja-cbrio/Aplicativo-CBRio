import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { FormScaffold } from "@/components/inscricoes/FormScaffold";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { SeusDados, fichaCompleta } from "@/components/inscricoes/SeusDados";
import { jaTemNaFicha } from "@/lib/ficha";
import { useT } from "@/lib/i18n";
import { useDialogo } from "@/components/ui/Dialogo";
import { criarInscricao } from "@/lib/inscricoes";
import { dateBRToISO, isValidDateBR, maskDateBR } from "@/lib/validators";
import {
  proximoBatismo,
  formatProximoBatismo,
  diasAteProximoBatismo,
} from "@/lib/proximoBatismo";
import { font, radius, spacing, type Palette } from "@/constants/theme";

/** Espelho do que `GET /public/batismo/horarios` devolve (utils/batismoHorario no ERP). */
type HorarioBatismo = { horario: string; label: string; vagas_restantes: number | null };

export default function InscricaoBatismoScreen() {
  const { user } = useAuth();
  const { membro, loading } = useMembro();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const dlg = useDialogo();
  const proxDt = useMemo(() => proximoBatismo(), []);
  const diasFalta = useMemo(() => diasAteProximoBatismo(proxDt), [proxDt]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [camisa, setCamisa] = useState("");
  const [deficiencia, setDeficiencia] = useState(false);
  const [deficienciaDesc, setDeficienciaDesc] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [grupoUrl, setGrupoUrl] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<HorarioBatismo[]>([]);
  const [horarioSel, setHorarioSel] = useState<string | null>(null);

  // ⚠️ A lista de horários vem do SERVIDOR (`GET /public/batismo/horarios`, a
  // MESMA que o formulário público consome). O app NÃO decide o que está aberto
  // nem quanta vaga sobra — é a lei "quem decide o que é válido é o backend".
  // A resposta já esconde fechado e lotado; se falhar, o seletor simplesmente
  // não aparece e a inscrição segue sem horário (o campo é opcional no
  // servidor), em vez de travar a pessoa.
  useEffect(() => {
    apiGet<{ grupo_url?: string | null; horarios?: HorarioBatismo[] }>(
      "/public/batismo/horarios",
      { auth: false }
    )
      .then((r) => {
        setGrupoUrl(r?.grupo_url ?? null);
        const lista = Array.isArray(r?.horarios) ? r.horarios : [];
        setHorarios(lista);
        // Se o horário escolhido saiu da lista (fechou ou lotou entre a abertura
        // da tela e agora), a seleção some — senão a pessoa envia algo que o
        // servidor vai recusar com 409.
        setHorarioSel((sel) => (sel && lista.some((h) => h.horario === sel) ? sel : null));
      })
      .catch(() => {});
  }, []);

  // ⚠️⚠️ PRÉ-PREENCHE O NASCIMENTO DA FICHA (10/08/2026 · apontamento 4).
  // A tela SEMPRE mostrava o campo, mesmo tendo o dado em `useMembro()`.
  // Palavras do Marcos: *"no batismo ele pediu data de nascimento, sendo que
  // supostamente já tem no sistema, deveria ter apenas o pedido do tamanho da
  // camisa."* A regra dele de 05/08 já dizia isso (topo de `lib/ficha.ts`):
  // nas inscrições só se pergunta campo A MAIS.
  // ⚠️ Pré-preencher, e não só esconder: o payload continua carregando a data
  // (`data_nascimento` mais abaixo), então o servidor e o fanout não mudam.
  useEffect(() => {
    if (membro) {
      setNome((v) => v || membro.nome);
      setTelefone((v) => v || membro.telefone);
      setEmail((v) => v || membro.email);
      if (membro.dataNascimento) {
        // ISO (AAAA-MM-DD) → DD/MM/AAAA, que é o formato do campo e do parser.
        const [a, m, d] = String(membro.dataNascimento).slice(0, 10).split("-");
        if (a && m && d) setNascimento((v) => v || `${d}/${m}/${a}`);
      }
    }
  }, [membro]);

  // ⚠️⚠️ CONFIRMAÇÃO ANTES DE ENVIAR (10/08/2026). O formulário disparava direto
  // e a inscrição de batismo é ato pastoral — não um toque a mais numa lista.
  // ⚠️ A pergunta cita a DATA do próximo batismo, que a tela já calculou
  // (`proximoBatismo()`): confirmar sem saber pra quando é não é confirmar.
  function confirmarEnviar() {
    const quando = proxDt ? `

${t("Próximo batismo")}: ${formatProximoBatismo(proxDt)}` : "";
    // Diálogo da casa (11/08).
    void dlg.confirmar({
      titulo: t("Confirmar sua inscrição no batismo?"),
      mensagem: `${t("A equipe vai falar com você sobre os próximos passos.")}${quando}`,
      acao: t("Confirmar inscrição"),
    }).then((ok: boolean) => { if (ok) void enviar(); });
  }

  async function enviar() {
    setError(null);
    if (!nome || !telefone) {
      setError(t("Preencha pelo menos nome e telefone."));
      return;
    }
    if (nascimento && !isValidDateBR(nascimento)) {
      setError(t("Data de nascimento inválida (DD/MM/AAAA)."));
      return;
    }
    setEnviando(true);
    try {
      const partes = nome.trim().split(/\s+/);
      await criarInscricao(
        "batismo",
        {
          nome: partes[0],
          sobrenome: partes.slice(1).join(" "),
          telefone: telefone.trim(),
          email: email.trim() || null,
          data_nascimento: nascimento ? dateBRToISO(nascimento) : null,
          tamanho_camisa: camisa.trim() || null,
          possui_deficiencia: deficiencia,
          deficiencia_descricao: deficiencia ? deficienciaDesc.trim() || null : null,
          observacoes: obs.trim() || null,
          horario_culto: horarioSel,
          cpf: membro?.cpf || null,
          membro_id: membro?.membroId ?? null,
        },
        user?.id
      );
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Não foi possível enviar."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <FormScaffold
      title={t("Batismo")}
      subtitle={t("Inscreva-se para ser batizado(a) na CBRio.")}
      icon="water"
      submitLabel={t("Quero me batizar")}
      onSubmit={confirmarEnviar}
      submitting={enviando || loading}
      enviado={enviado}
      enviadoTexto={grupoUrl ? t("Inscrição confirmada! Entre no grupo do batismo pra receber os próximos passos.") : undefined}
      successExtra={
        grupoUrl ? (
          <Button title={t("Entrar no grupo do batismo")} onPress={() => Linking.openURL(grupoUrl)} />
        ) : undefined
      }
      error={error}
    
      // Diálogo da casa · FORA do ScrollView e de todos os ramos
      overlay={<dlg.Dialogo />}
    >
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Ionicons name="water" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerLabel}>{t("Próximo batismo")}</Text>
          <Text style={styles.bannerData}>{formatProximoBatismo(proxDt)}</Text>
          <Text style={styles.bannerSub}>
            {diasFalta === 0
              ? t("É hoje! 🙌")
              : diasFalta === 1
              ? t("Amanhã")
              : `${t("Em")} ${diasFalta} ${t("dias")}`}
            {"  ·  "}{t("Sempre no 4º domingo do mês.")}
          </Text>
        </View>
      </View>

      {/* ⚠️ Nome/telefone/e-mail NÃO são repedidos quando a ficha já está
          fechada (regra do Marcos, 05/08/2026: nas inscrições só se preenche
          campo A MAIS). Os valores continuam indo no payload — só não são
          digitados de novo. Instalação antiga, com ficha pela metade, ainda vê
          o formulário: senão não conseguiria se inscrever. */}
      {fichaCompleta(membro) ? (
        <SeusDados nome={nome} telefone={telefone} email={email} />
      ) : (
        <>
          <Input label={t("Nome completo")} value={nome} onChangeText={setNome} autoCapitalize="words" />
          <Input label={t("Telefone")} value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholder="+55 21 99999-9999" />
          <Input label={t("E-mail")} value={email} onChangeText={setEmail} keyboardType="email-address" />
        </>
      )}
      {/* ⚠️ Só aparece quando a ficha NÃO tem — a régua é `jaTemNaFicha`, a
          MESMA de `faltaNaFicha` (telefone de 8 dígitos e CPF de 9 contam como
          faltando, porque o servidor recusa). Quem já tem nascimento no cadastro
          vê apenas o tamanho da camisa, que é o campo A MAIS do batismo. */}
      {!jaTemNaFicha(membro, "dataNascimento") && (
        <Input
          label={t("Data de nascimento")}
          value={nascimento}
          onChangeText={(v) => setNascimento(maskDateBR(v))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
        />
      )}
      {/* Horário do culto · só aparece quando o servidor devolveu opção aberta.
          Lista vazia (tudo fechado/lotado, ou falha de rede) = sem seletor: a
          inscrição continua valendo, e a equipe combina o horário depois. */}
      {horarios.length > 0 && (
        <View style={styles.horariosBox}>
          <Text style={styles.horariosLabel}>{t("Horário do culto")}</Text>
          <Text style={styles.horariosHint}>
            {t("Escolha em qual culto você quer ser batizado(a).")}
          </Text>
          <View style={styles.horariosLista}>
            {horarios.map((h) => {
              const ativo = horarioSel === h.horario;
              return (
                <Pressable
                  key={h.horario}
                  onPress={() => setHorarioSel(ativo ? null : h.horario)}
                  style={[styles.chip, ativo && styles.chipAtivo]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativo }}
                >
                  <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
                    {h.label || h.horario}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      <Input label={t("Tamanho da camisa (opcional)")} value={camisa} onChangeText={setCamisa} placeholder="P / M / G / GG" />
      <Checkbox
        checked={deficiencia}
        onChange={setDeficiencia}
        label={t("Possui alguma deficiência ou limitação física?")}
      />
      {deficiencia && (
        <Input
          label={t("Descreva a limitação")}
          value={deficienciaDesc}
          onChangeText={setDeficienciaDesc}
          placeholder={t("Conte como podemos te ajudar")}
        />
      )}
      <Input label={t("Observações (opcional)")} value={obs} onChangeText={setObs} />
    </FormScaffold>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    banner: {
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
    },
    bannerIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },
    bannerLabel: {
      color: "rgba(255,255,255,0.9)",
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    bannerData: { color: "#fff", fontSize: font.size.lg, fontWeight: "900", marginTop: 2 },
    bannerSub: { color: "rgba(255,255,255,0.92)", fontSize: font.size.sm, marginTop: 2 },
    horariosBox: { gap: spacing.xs },
    horariosLabel: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    horariosHint: { color: colors.textMuted, fontSize: font.size.sm },
    horariosLista: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
    chip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    chipAtivo: { borderColor: colors.primary, backgroundColor: colors.primary },
    chipTexto: { color: colors.text, fontSize: font.size.sm, fontWeight: "600" },
    chipTextoAtivo: { color: "#fff" },
    jaBatizadoBox: {
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    jaBatizadoHint: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
  });
