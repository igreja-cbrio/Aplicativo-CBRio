// ════════════════════════════════════════════════════════════════════════════
//  Botões dentro do card da notificação (Matheus · 29/08/2026)
//
//  ⚠️ Quem decide QUAIS botões é `lib/acoesNotificacao`, espelho da régua do
//  servidor. Aqui fica só o gesto: confirmar quando a ação pesa, chamar o
//  endpoint, e devolver o resultado em português.
//
//  ⚠️⚠️ Tocar FORA dos botões continua abrindo a rota da notificação — os
//  botões são `Pressable` aninhado e não deixam o toque subir pro card.
// ════════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { useDialogo } from "@/components/ui/Dialogo";
import { apiPost } from "@/lib/api";
import { trackEvento } from "@/lib/telemetria";
import { acoesDaNotificacao, rotuloAcao, rotuloFeito, ehAcaoPrincipal, type AcaoNotificacao } from "@/lib/acoesNotificacao";
import { font, spacing, type Palette } from "@/constants/theme";

type Props = {
  id: string;
  tipo: string;
  data: unknown;
  /** Recarrega a lista quando algo mudou de verdade. */
  onFeito: () => void;
};

export function AcoesNotificacao({ id, tipo, data, onFeito }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const dlg = useDialogo();
  const [enviando, setEnviando] = useState<AcaoNotificacao | null>(null);

  const { acoes, feita } = acoesDaNotificacao(tipo, data);

  if (feita) {
    return (
      <View style={styles.feitoLinha}>
        <Text style={styles.feito}>{t(rotuloFeito(feita))}</Text>
      </View>
    );
  }
  if (!acoes.length) return null;

  async function confirmarSePreciso(acao: AcaoNotificacao): Promise<boolean> {
    // ⚠️ "Confirmar presença" vai direto: é a resposta esperada de quem foi
    // escalado, e um diálogo aí só põe atrito no caminho certo.
    if (acao === "confirmar") return true;

    if (acao === "nao_posso") {
      return dlg.confirmar({
        titulo: t("Avisar que não vai poder?"),
        // ⚠️ O texto NÃO promete substituto: o sistema avisa quem repõe, não
        // procura ninguém. Prometer troca automática seria a tela afirmando o
        // que o produto não faz.
        mensagem: t("A liderança da sua área é avisada na hora pra reorganizar a escala."),
        acao: t("Avisar"),
      });
    }
    if (acao === "aprovar") {
      return dlg.confirmar({
        // ⚠️ O fluxo combinado com a liderança é LIGAR antes de aprovar (é o
        // que o template do WhatsApp instrui desde 29/07). O botão não impede,
        // mas lembra — aprovar por engano põe alguém num grupo sem conversa.
        titulo: t("Aprovar a entrada?"),
        mensagem: t("A pessoa entra no grupo e recebe o aviso. Se ainda não falou com ela, ligue antes."),
        acao: t("Aprovar"),
      });
    }
    return dlg.confirmar({
      titulo: t("Recusar o pedido?"),
      // Recusa do líder NÃO é terminal (lei de 14/07): volta pra equipe.
      mensagem: t("O pedido volta pra equipe de grupos, que fala com a pessoa. Ela não recebe aviso de recusa."),
      acao: t("Recusar"),
      perigo: true,
    });
  }

  async function agir(acao: AcaoNotificacao) {
    if (enviando) return;
    if (!(await confirmarSePreciso(acao))) return;
    setEnviando(acao);
    try {
      const r = await apiPost<{ respondidas?: number; falhas?: number; total?: number; acao?: string }>(
        `/app/notificacoes/${id}/acao`,
        { acao },
      );
      trackEvento("notificacao_acao", { label: acao });
      // ⚠️ Parcial é DECLARADO: "3 de 4" nunca vira "pronto". Quem lê "pronto"
      // não volta pra resolver a que faltou.
      if (r?.falhas) {
        await dlg.avisar(
          t("Respondemos em parte"),
          t("{n} de {total} escalas foram atualizadas. Abra o Voluntariado pra ver o resto.")
            .replace("{n}", String(r.respondidas ?? 0))
            .replace("{total}", String(r.total ?? 0)),
        );
      }
      onFeito();
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      await dlg.avisar(t("Não deu pra concluir"), msg || t("Tente de novo em instantes."));
      // ⚠️ Recarrega mesmo no erro: a causa mais comum é a coisa JÁ ter sido
      // decidida noutro lugar, e aí a lista tem que refletir isso.
      onFeito();
    } finally {
      setEnviando(null);
    }
  }

  return (
    <View style={styles.linha}>
      {acoes.map((acao) => {
        const principal = ehAcaoPrincipal(acao);
        return (
          <Pressable
            key={acao}
            onPress={() => agir(acao)}
            disabled={!!enviando}
            accessibilityRole="button"
            accessibilityLabel={t(rotuloAcao(acao))}
            style={({ pressed }) => [
              styles.botao,
              principal ? styles.principal : styles.secundario,
              (pressed || !!enviando) && { opacity: 0.7 },
            ]}
          >
            {enviando === acao
              ? <ActivityIndicator size="small" color={principal ? "#fff" : colors.text} />
              : <Text style={[styles.texto, principal ? styles.textoPrincipal : styles.textoSecundario]}>
                  {t(rotuloAcao(acao))}
                </Text>}
          </Pressable>
        );
      })}
      <dlg.Dialogo />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    linha: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    botao: {
      flex: 1,
      borderRadius: 999,
      paddingVertical: 11,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44, // alvo de toque confortável
    },
    principal: { backgroundColor: colors.primary },
    secundario: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder },
    texto: { fontSize: font.size.sm, fontWeight: "800" },
    textoPrincipal: { color: "#fff" },
    textoSecundario: { color: colors.text },
    feitoLinha: { marginTop: spacing.sm },
    feito: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "700" },
  });
