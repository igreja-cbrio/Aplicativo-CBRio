// Peças da galeria do álbum do batismo (24/11/2026): a miniatura da grade e o
// visualizador em tela cheia. Ficam FORA do corpo da tela de propósito:
// componente declarado dentro de outro remonta a cada render.
import { Modal } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { memo, useMemo } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import type { FotoAlbum } from "@/lib/batismoFotos";

export const MiniaturaFoto = memo(function MiniaturaFoto({
  foto,
  indice,
  lado,
  selecionando,
  selecionada,
  onToque,
  onToqueLongo,
  onErro,
}: {
  foto: FotoAlbum;
  indice: number;
  lado: number;
  selecionando: boolean;
  selecionada: boolean;
  onToque: (foto: FotoAlbum, indice: number) => void;
  onToqueLongo: (foto: FotoAlbum) => void;
  onErro: (url: string | null) => void;
}) {
  const colors = useColors();
  const t = useT();
  return (
    <Pressable
      onPress={() => onToque(foto, indice)}
      onLongPress={() => onToqueLongo(foto)}
      delayLongPress={350}
      style={({ pressed }) => [
        { width: lado, height: lado, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.surfaceAlt },
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole={selecionando ? "checkbox" : "imagebutton"}
      accessibilityLabel={`${t("Foto")} ${indice + 1}`}
      accessibilityState={selecionando ? { checked: selecionada } : undefined}
    >
      {/* Fica por TRÁS da imagem: aparece enquanto carrega e quando ela falha. */}
      <View style={estilosFixos.icone}>
        <Ionicons name="image-outline" size={22} color={colors.textMuted} />
      </View>
      {!!foto.miniatura && (
        <Image
          source={{ uri: foto.miniatura }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => onErro(foto.miniatura)}
        />
      )}
      {selecionando && (
        <View style={[StyleSheet.absoluteFill, selecionada && { backgroundColor: "rgba(0,0,0,0.28)" }]}>
          <View
            style={[
              estilosFixos.marca,
              { borderColor: "#fff", backgroundColor: selecionada ? colors.primary : "rgba(0,0,0,0.25)" },
            ]}
          >
            {selecionada && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
        </View>
      )}
    </Pressable>
  );
});

const estilosFixos = StyleSheet.create({
  icone: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  marca: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

export type AvisoVisualizador = { texto: string; erro: boolean; ajustes?: boolean };

/**
 * Tela cheia com a foto grande, anterior/próxima e "Baixar".
 * ⚠️ O retorno do "Baixar" aparece AQUI DENTRO (texto embaixo), nunca em
 * diálogo: um diálogo irmão nasce ATRÁS deste <Modal> no iPhone.
 */
export function VisualizadorFotos({
  fotos,
  indice,
  temMais,
  salvando,
  aviso,
  onFechar,
  onIr,
  onBaixar,
  onAbrirAjustes,
  onErroImagem,
}: {
  fotos: readonly FotoAlbum[];
  indice: number | null;
  temMais: boolean;
  salvando: boolean;
  aviso: AvisoVisualizador | null;
  onFechar: () => void;
  onIr: (indice: number) => void;
  onBaixar: (foto: FotoAlbum) => void;
  onAbrirAjustes: () => void;
  onErroImagem: (url: string | null) => void;
}) {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const foto = indice != null ? fotos[indice] : undefined;
  const temAnterior = indice != null && indice > 0;
  const temProxima = indice != null && (indice < fotos.length - 1 || temMais);

  return (
    <Modal visible={!!foto} animationType="fade" onRequestClose={onFechar} transparent statusBarTranslucent>
      <View style={styles.fundo}>
        <View style={[styles.topo, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={onFechar} hitSlop={10} style={styles.botaoRedondo} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          {indice != null && (
            <Text style={styles.contador}>
              {indice + 1} {t("de")} {fotos.length}
              {temMais ? "+" : ""}
            </Text>
          )}
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.palco}>
          {foto?.grande ? (
            <Image
              key={foto.id}
              source={{ uri: foto.grande }}
              style={styles.foto}
              resizeMode="contain"
              onError={() => onErroImagem(foto.grande)}
            />
          ) : (
            <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.6)" />
          )}
          {temAnterior && (
            <Pressable
              onPress={() => indice != null && onIr(indice - 1)}
              style={[styles.seta, { left: spacing.sm }]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("Foto anterior")}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </Pressable>
          )}
          {temProxima && (
            <Pressable
              onPress={() => indice != null && onIr(indice + 1)}
              style={[styles.seta, { right: spacing.sm }]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("Próxima foto")}
            >
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </Pressable>
          )}
        </View>

        <View style={[styles.base, { paddingBottom: insets.bottom + spacing.lg }]}>
          {!!aviso && (
            <View style={styles.avisoLinha} accessibilityLiveRegion="polite">
              <Text style={[styles.avisoTxt, aviso.erro && { color: "#ffb3b3" }]}>{aviso.texto}</Text>
              {aviso.ajustes && (
                <Pressable onPress={onAbrirAjustes} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.avisoLink}>{t("Abrir Ajustes")}</Text>
                </Pressable>
              )}
            </View>
          )}
          {!!foto && (
            <Pressable
              onPress={() => onBaixar(foto)}
              disabled={salvando}
              style={({ pressed }) => [styles.baixar, (pressed || salvando) && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityState={{ busy: salvando, disabled: salvando }}
            >
              {salvando ? <ActivityIndicator color="#fff" /> : <Ionicons name="download-outline" size={20} color="#fff" />}
              <Text style={styles.baixarTxt}>{salvando ? t("Salvando…") : t("Baixar")}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    fundo: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)" },
    topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md },
    botaoRedondo: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    contador: { color: "#fff", fontSize: font.size.sm, fontWeight: "700" },
    palco: { flex: 1, alignItems: "center", justifyContent: "center" },
    foto: { width: "100%", height: "100%" },
    seta: {
      position: "absolute",
      top: "50%",
      marginTop: -22,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    base: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    avisoLinha: { alignItems: "center", gap: 4 },
    avisoTxt: { color: "#fff", fontSize: font.size.sm, textAlign: "center", lineHeight: 19 },
    avisoLink: { color: "#a9d3dc", fontSize: font.size.sm, fontWeight: "800", textDecorationLine: "underline" },
    baixar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 22,
      minHeight: 48,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    baixarTxt: { color: "#fff", fontWeight: "800", fontSize: font.size.md },
  });
