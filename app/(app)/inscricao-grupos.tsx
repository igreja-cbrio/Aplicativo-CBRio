import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Input } from "@/components/ui/Input";
import { FormScaffold } from "@/components/inscricoes/FormScaffold";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { criarInscricao } from "@/lib/inscricoes";
import { getTemporadaGrupos, type GrupoInscricao } from "@/lib/temporadaGrupos";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Linha secundária do cartão: bairro · dia · horário (o que houver).
function infoGrupo(g: GrupoInscricao): string | null {
  const partes = [
    g.bairro,
    g.dia_semana != null ? DIAS_SEMANA[g.dia_semana] : null, // 0 = domingo (falsy!)
    g.horario ? g.horario.slice(0, 5) : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

export default function InscricaoGruposScreen() {
  const { user } = useAuth();
  const { membro, loading } = useMembro();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [grupos, setGrupos] = useState<GrupoInscricao[]>([]);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [temporadaAberta, setTemporadaAberta] = useState<boolean | null>(null);

  useEffect(() => {
    // Temporada + grupos vêm JUNTOS do backend (mesma régua do form público):
    // grupo fechado/pausado ou de temporada encerrada nunca aparece aqui.
    getTemporadaGrupos().then((t) => {
      setTemporadaAberta(t.aberta);
      setGrupos(t.grupos);
    });
  }, []);

  useEffect(() => {
    if (membro) {
      setNome((v) => v || membro.nome);
      setTelefone((v) => v || membro.telefone);
    }
  }, [membro]);

  async function enviar() {
    setError(null);
    if (temporadaAberta === false) {
      setError(t("As inscrições de grupos estão fechadas no momento."));
      return;
    }
    if (!grupoId) {
      setError(t("Escolha um grupo."));
      return;
    }
    if (!nome || !telefone) {
      setError(t("Preencha nome e telefone."));
      return;
    }
    setEnviando(true);
    try {
      const grupo = grupos.find((g) => g.id === grupoId);
      await criarInscricao(
        "grupo",
        {
          grupo_id: grupoId,
          grupo_nome: grupo?.nome ?? null,
          nome: nome.trim(),
          telefone: telefone.trim(),
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
      title={t("Grupos")}
      subtitle={t("Escolha um grupo para participar.")}
      icon="people"
      submitLabel={t("Quero participar")}
      onSubmit={enviar}
      submitting={enviando || loading}
      enviado={enviado}
      bloqueadoTexto={
        temporadaAberta === false
          ? t("A temporada de inscrição em grupos ainda não abriu. Avisaremos por aqui quando começar. 💙")
          : undefined
      }
      error={error}
    >
      <Text style={styles.label}>{t("Grupo")}</Text>
      <View style={styles.list}>
        {grupos.length === 0 ? (
          <Text style={styles.empty}>{t("Nenhum grupo disponível no momento.")}</Text>
        ) : (
          grupos.map((g) => {
            const active = grupoId === g.id;
            const info = infoGrupo(g);
            return (
              <Pressable
                key={g.id}
                style={[styles.grupo, active && styles.grupoActive]}
                onPress={() => setGrupoId(g.id)}
              >
                <Text style={[styles.grupoNome, active && styles.grupoNomeActive]}>
                  {g.nome}
                </Text>
                {!!g.categoria && <Text style={styles.grupoCat}>{g.categoria}</Text>}
                {!!info && <Text style={styles.grupoCat}>{info}</Text>}
              </Pressable>
            );
          })
        )}
      </View>

      <Input label={t("Seu nome")} value={nome} onChangeText={setNome} autoCapitalize="words" />
      <Input label={t("Telefone")} value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholder="+55 21 99999-9999" />
    </FormScaffold>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    label: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    list: { gap: spacing.sm },
    empty: { color: colors.textMuted, fontSize: font.size.md },
    grupo: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    grupoActive: { borderColor: colors.primary, backgroundColor: colors.glass },
    grupoNome: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    grupoNomeActive: { color: colors.text },
    grupoCat: { color: colors.textMuted, fontSize: font.size.sm },
  });
