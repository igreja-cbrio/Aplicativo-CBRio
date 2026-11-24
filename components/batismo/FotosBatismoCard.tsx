// Cartão "Fotos do batismo" na tela /batismo (24/11/2026). Substitui a galeria
// antiga do bucket público: aqui só se mostra SE existe álbum para esta conta (o
// servidor decide) e leva para /batismo-fotos.
import { Text } from "@/components/ui/Typography";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { rotuloDaData, type RespostaAlbuns } from "@/lib/batismoFotos";
import type { makeStyles } from "./batismoStyles";

export type EstadoFotosBatismo = { tipo: "carregando" } | { tipo: "erro" } | { tipo: "ok"; resp: RespostaAlbuns };

/** O álbum que o cartão oferece: liberado primeiro; senão o que está em conferência. */
export function albumDoCartao(estado: EstadoFotosBatismo) {
  if (estado.tipo !== "ok") return null;
  const albuns = estado.resp.albuns;
  return albuns.find((a) => a.situacao === "liberado") ?? albuns.find((a) => a.situacao === "conflito") ?? null;
}

export function FotosBatismoCard({
  estado,
  mostrarSemAlbum,
  colors,
  styles,
}: {
  estado: EstadoFotosBatismo;
  /** Batismo já aconteceu (ou é hoje): sem álbum, diz que as fotos vêm depois. */
  mostrarSemAlbum: boolean;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useT();
  if (estado.tipo === "carregando") return null;
  const album = albumDoCartao(estado);

  if (!album) {
    if (!mostrarSemAlbum) return null;
    if (estado.tipo === "ok" && estado.resp.conta !== "ok") return null;
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="images-outline" size={20} color={colors.brandMid} />
          <Text style={styles.cardTitle}>{t("Fotos do batismo")}</Text>
        </View>
        {/* ⚠️ Erro não vira "ainda não publicaram": a pessoa acreditaria. */}
        <Text style={styles.cardTxt}>
          {estado.tipo === "erro"
            ? t("Não foi possível verificar as fotos agora. Tente de novo mais tarde.")
            : t("As fotos do seu batismo aparecem aqui quando a equipe publicar o álbum.")}
        </Text>
      </View>
    );
  }

  const abrir = () => router.navigate({ pathname: "/batismo-fotos", params: { album: album.id } });
  if (album.situacao === "conflito") {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="images-outline" size={20} color={colors.brandMid} />
          <Text style={styles.cardTitle}>{t("Fotos do batismo")}</Text>
        </View>
        <Text style={styles.cardTxt}>
          {t("Encontramos mais de uma data de batismo no seu cadastro. A equipe vai conferir antes de liberar as fotos.")}
        </Text>
        <Pressable onPress={abrir} hitSlop={6} accessibilityRole="button">
          <Text style={styles.linkAcaoTxt}>{t("Ver detalhes")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="images-outline" size={20} color={colors.brandMid} />
        <Text style={styles.cardTitle}>{t("Fotos do batismo")}</Text>
      </View>
      <Text style={styles.cardTxt}>
        {t("Álbum do batismo de")} {rotuloDaData(album.data_batismo)}
        {album.total ? ` · ${album.total} ${album.total === 1 ? t("foto") : t("fotos")}` : ""}
      </Text>
      <Button title={t("Ver as fotos")} onPress={abrir} />
    </View>
  );
}

/** Atalho no topo da gestão: quem gerencia também foi batizado e tem as próprias fotos. */
export function LinkMinhasFotos({
  estado,
  colors,
  styles,
}: {
  estado: EstadoFotosBatismo;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useT();
  const album = albumDoCartao(estado);
  if (!album) return null;
  return (
    <Pressable
      onPress={() => router.navigate({ pathname: "/batismo-fotos", params: { album: album.id } })}
      style={({ pressed }) => [styles.linkAcao, { justifyContent: "flex-start" }, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
    >
      <Ionicons name="images-outline" size={18} color={colors.brandMid} />
      <Text style={styles.linkAcaoTxt}>{t("Minhas fotos do batismo")}</Text>
    </Pressable>
  );
}
