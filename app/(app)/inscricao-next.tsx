import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Input } from "@/components/ui/Input";
import { FormScaffold } from "@/components/inscricoes/FormScaffold";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { criarInscricao } from "@/lib/inscricoes";
import { supabase } from "@/lib/supabase";
import { dateBRToISO, isValidDateBR, maskDateBR } from "@/lib/validators";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Evento = { id: string; titulo: string | null; data: string };

function fmtData(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export default function InscricaoNextScreen() {
  const { user } = useAuth();
  const { membro, loading } = useMembro();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    (async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("next_eventos")
        .select("id, titulo, data")
        .gte("data", hoje)
        .order("data", { ascending: true });
      setEventos((data as Evento[]) ?? []);
    })();
  }, []);

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
      setError("Preencha nome e telefone.");
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
        "next",
        {
          evento_id: eventoId,
          nome: partes[0],
          sobrenome: partes.slice(1).join(" "),
          telefone: telefone.trim(),
          email: email.trim() || null,
          data_nascimento: nascimento ? dateBRToISO(nascimento) : null,
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
      title="NEXT"
      subtitle="Inscreva-se no próximo NEXT."
      icon="sparkles"
      submitLabel="Quero participar"
      onSubmit={enviar}
      submitting={enviando || loading}
      enviado={enviado}
      error={error}
    >
      {eventos.length > 0 && (
        <>
          <Text style={styles.label}>Evento</Text>
          <View style={styles.list}>
            {eventos.map((ev) => {
              const active = eventoId === ev.id;
              return (
                <Pressable
                  key={ev.id}
                  style={[styles.evento, active && styles.eventoActive]}
                  onPress={() => setEventoId(ev.id)}
                >
                  <Text style={[styles.eventoTitulo, active && { color: colors.text }]}>
                    {ev.titulo ?? "NEXT"}
                  </Text>
                  <Text style={styles.eventoData}>{fmtData(ev.data)}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

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
    </FormScaffold>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    label: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    list: { gap: spacing.sm },
    evento: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    eventoActive: { borderColor: colors.primary, backgroundColor: colors.glass },
    eventoTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    eventoData: { color: colors.textMuted, fontSize: font.size.sm },
  });
