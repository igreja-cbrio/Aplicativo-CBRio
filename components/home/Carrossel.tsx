import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/contexts/ThemeContext";
import { type Destaque } from "@/lib/destaques";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const SLIDE_W = SCREEN_W - spacing.lg * 2;
const AUTO_MS = 5000;

export function Carrossel({ itens }: { itens: Destaque[] }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList<Destaque>>(null);

  // Auto-rotate
  useEffect(() => {
    if (itens.length < 2) return;
    const t = setInterval(() => {
      const next = (index + 1) % itens.length;
      ref.current?.scrollToIndex({ index: next, animated: true });
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [index, itens.length]);

  function onViewable(info: { viewableItems: ViewToken[] }) {
    const first = info.viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }

  function abrir(d: Destaque) {
    if (!d.link) return;
    if (d.link.startsWith("http")) {
      Linking.openURL(d.link).catch(() => {});
    } else if (d.link.startsWith("/")) {
      router.navigate(d.link as never);
    }
  }

  if (!itens.length) return null;

  return (
    <View>
      <FlatList
        ref={ref}
        data={itens}
        keyExtractor={(d) => d.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={SLIDE_W + spacing.sm}
        decelerationRate="fast"
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.slide}
            onPress={() => abrir(item)}
            disabled={!item.link}
          >
            <Image source={{ uri: item.imagem_url }} style={styles.img} />
            {(item.titulo || item.subtitulo) && (
              <View style={styles.legenda}>
                {!!item.titulo && <Text style={styles.titulo}>{item.titulo}</Text>}
                {!!item.subtitulo && <Text style={styles.subtitulo}>{item.subtitulo}</Text>}
              </View>
            )}
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
      />
      <View style={styles.dots}>
        {itens.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    slide: {
      width: SLIDE_W,
      aspectRatio: 16 / 9,
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.surfaceAlt,
    },
    img: { width: "100%", height: "100%" },
    legenda: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      padding: spacing.md,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    titulo: { color: "#fff", fontSize: font.size.md, fontWeight: "800" },
    subtitulo: { color: "#fff", fontSize: font.size.sm, opacity: 0.9, marginTop: 2 },
    dots: {
      flexDirection: "row",
      gap: 6,
      alignSelf: "center",
      marginTop: spacing.sm,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.glassBorder,
    },
    dotActive: { backgroundColor: colors.primary, width: 18 },
  });
