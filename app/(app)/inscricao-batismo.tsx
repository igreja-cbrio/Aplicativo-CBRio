import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormScaffold } from "@/components/inscricoes/FormScaffold";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { criarInscricao } from "@/lib/inscricoes";
import { dateBRToISO, isValidDateBR, maskDateBR } from "@/lib/validators";
import {
  proximoBatismo,
  formatProximoBatismo,
  diasAteProximoBatismo,
} from "@/lib/proximoBatismo";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export default function InscricaoBatismoScreen() {
  const { user } = useAuth();
  const { membro, loading } = useMembro();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const proxDt = useMemo(() => proximoBatismo(), []);
  const diasFalta = useMemo(() => diasAteProximoBatismo(proxDt), [proxDt]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [camisa, setCamisa] = useState("");
  const [jaBatizado, setJaBatizado] = useState(false);
  const [igrejaAnterior, setIgrejaAnterior] = useState("");
  const [deficiencia, setDeficiencia] = useState(false);
  const [deficienciaDesc, setDeficienciaDesc] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (membro) {
      setNome((v) => v || membro.nome);
      setTelefone((v) => v || membro.telefone);
      setEmail((v) => v || membro.email);
    }
  }, [membro]);

  async function enviar() {
    setError(null);
    if (!nome || !telefone) {
      setError("Preencha pelo menos nome e telefone.");
      return;
    }
    if (nascimento && !isValidDateBR(nascimento)) {
      setError("Data de nascimento inválida (DD/MM/AAAA).");
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
          ja_batizado: jaBatizado,
          igreja_anterior: jaBatizado ? igrejaAnterior.trim() || null : null,
          possui_deficiencia: deficiencia,
          deficiencia_descricao: deficiencia ? deficienciaDesc.trim() || null : null,
          observacoes: obs.trim() || null,
          cpf: membro?.cpf || null,
          membro_id: membro?.membroId ?? null,
        },
        user?.id
      );
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <FormScaffold
      title="Batismo"
      subtitle="Inscreva-se para ser batizado(a) na CBRio."
      icon="water"
      submitLabel="Quero me batizar"
      onSubmit={enviar}
      submitting={enviando || loading}
      enviado={enviado}
      error={error}
    >
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Ionicons name="water" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerLabel}>Próximo batismo</Text>
          <Text style={styles.bannerData}>{formatProximoBatismo(proxDt)}</Text>
          <Text style={styles.bannerSub}>
            {diasFalta === 0
              ? "É hoje! 🙌"
              : diasFalta === 1
              ? "Amanhã"
              : `Em ${diasFalta} dias`}
            {"  ·  "}Sempre no 4º domingo do mês.
          </Text>
        </View>
      </View>

      <View style={styles.jaBatizadoBox}>
        <Checkbox
          checked={jaBatizado}
          onChange={setJaBatizado}
          label="Já sou batizado(a) em outra igreja"
        />
        {jaBatizado && (
          <>
            <Text style={styles.jaBatizadoHint}>
              Você ainda pode se inscrever pra ser batizado(a) na CBRio. Conta
              um pouco pra gente.
            </Text>
            <Input
              label="Em qual igreja você foi batizado(a)?"
              value={igrejaAnterior}
              onChangeText={setIgrejaAnterior}
              placeholder="Nome da igreja"
            />
          </>
        )}
      </View>

      <Input label="Nome completo" value={nome} onChangeText={setNome} autoCapitalize="words" />
      <Input label="Telefone" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholder="+55 21 99999-9999" />
      <Input label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Input
        label="Data de nascimento (opcional)"
        value={nascimento}
        onChangeText={(t) => setNascimento(maskDateBR(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
      />
      <Input label="Tamanho da camisa (opcional)" value={camisa} onChangeText={setCamisa} placeholder="P / M / G / GG" />
      <Checkbox
        checked={deficiencia}
        onChange={setDeficiencia}
        label="Possui alguma deficiência ou limitação física?"
      />
      {deficiencia && (
        <Input
          label="Descreva a limitação"
          value={deficienciaDesc}
          onChangeText={setDeficienciaDesc}
          placeholder="Conte como podemos te ajudar"
        />
      )}
      <Input label="Observações (opcional)" value={obs} onChangeText={setObs} />
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
