import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Input } from "@/components/ui/Input";
import { FormScaffold } from "@/components/inscricoes/FormScaffold";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { criarInscricao } from "@/lib/inscricoes";
import { supabase } from "@/lib/supabase";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Grupo = { id: string; nome: string; categoria: string | null };

export default function InscricaoGruposScreen() {
  const { user } = useAuth();
  const { membro, loading } = useMembro();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("mem_grupos")
        .select("id, nome, categoria")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      setGrupos((data as Grupo[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (membro) {
      setNome((v) => v || membro.nome);
      setTelefone((v) => v || membro.telefone);
    }
  }, [membro]);

  async function enviar() {
    setError(null);
    if (!grupoId) {
      setError("Escolha um grupo.");
      return;
    }
    if (!nome || !telefone) {
      setError("Preencha nome e telefone.");
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
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <FormScaffold
      title="Grupos"
      subtitle="Escolha um grupo para participar."
      icon="people"
      submitLabel="Quero participar"
      onSubmit={enviar}
      submitting={enviando || loading}
      enviado={enviado}
      error={error}
    >
      <Text style={styles.label}>Grupo</Text>
      <View style={styles.list}>
        {grupos.length === 0 ? (
          <Text style={styles.empty}>Nenhum grupo disponível no momento.</Text>
        ) : (
          grupos.map((g) => {
            const active = grupoId === g.id;
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
              </Pressable>
            );
          })
        )}
      </View>

      <Input label="Seu nome" value={nome} onChangeText={setNome} autoCapitalize="words" />
      <Input label="Telefone" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholder="+55 21 99999-9999" />
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
