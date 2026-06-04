import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Map,
  Camera,
  Marker,
  UserLocation,
  type CameraRef,
  LocationManager,
} from "@maplibre/maplibre-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useColors } from "@/contexts/ThemeContext";
import { brand, radius, font, spacing } from "@/constants/theme";
import { diaHorario } from "@/app/(app)/grupos";

const STYLE_URL = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

const RIO: [number, number] = [-43.1964, -22.9083];

export type GrupoPin = {
  id: string;
  nome: string;
  categoria: string | null;
  bairro: string | null;
  dia_semana: number | null;
  horario: string | null;
  lat: number | null;
  lng: number | null;
};

export function GruposMapa({
  grupos,
  onSelect,
}: {
  grupos: GrupoPin[];
  onSelect: (id: string) => void;
}) {
  const { mode } = useTheme();
  const colors = useColors();
  const cameraRef = useRef<CameraRef>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function centralizarUsuario() {
    try {
      const ok = await LocationManager.requestPermissions();
      if (!ok) return;
      const pos = await LocationManager.getCurrentPosition();
      if (!pos) return;
      cameraRef.current?.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 14,
      });
    } catch {}
  }

  const pins = useMemo(
    () => grupos.filter((g) => g.lat != null && g.lng != null),
    [grupos]
  );

  const centro = useMemo<[number, number]>(() => {
    if (pins.length === 0) return RIO;
    const lng = pins.reduce((s, g) => s + (g.lng as number), 0) / pins.length;
    const lat = pins.reduce((s, g) => s + (g.lat as number), 0) / pins.length;
    return [lng, lat];
  }, [pins]);

  const selected = useMemo(
    () => pins.find((g) => g.id === selectedId) ?? null,
    [pins, selectedId]
  );

  return (
    <View style={styles.container}>
      <Map style={styles.map} mapStyle={STYLE_URL[mode]}>
        <Camera ref={cameraRef} initialViewState={{ center: centro, zoom: 10 }} />
        <UserLocation animated accuracy />
        {pins.map((g) => (
          <Marker
            key={g.id}
            lngLat={[g.lng as number, g.lat as number]}
            anchor="bottom"
            onPress={() => setSelectedId(g.id === selectedId ? null : g.id)}
          >
            <View style={styles.markerWrapper}>
              <View
                style={[
                  styles.pin,
                  selectedId === g.id && styles.pinSelected,
                ]}
              />
              <Text style={styles.label} numberOfLines={1}>
                {g.nome}
              </Text>
            </View>
          </Marker>
        ))}
      </Map>

      {selected && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setSelectedId(null)}
        />
      )}

      <Pressable
        onPress={centralizarUsuario}
        style={({ pressed }) => [
          styles.locBtn,
          { backgroundColor: colors.surface, borderColor: colors.glassBorder },
          pressed && { opacity: 0.7 },
        ]}
        hitSlop={6}
      >
        <Ionicons name="locate" size={22} color={brand.primary} />
      </Pressable>

      {selected && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.glassBorder },
          ]}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="people" size={22} color={brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.cardNome, { color: colors.text }]}
              numberOfLines={2}
            >
              {selected.nome}
            </Text>
            <Text
              style={[styles.cardMeta, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {[
                selected.categoria,
                selected.bairro,
                diaHorario(selected.dia_semana, selected.horario),
              ]
                .filter(Boolean)
                .join(" • ")}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.detalhesBtn, pressed && { opacity: 0.8 }]}
            onPress={() => {
              setSelectedId(null);
              onSelect(selected.id);
            }}
          >
            <Text style={styles.detalhesTxt}>Ver</Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  map: { flex: 1 },
  locBtn: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerWrapper: {
    alignItems: "center",
    gap: 2,
  },
  pin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: brand.primary,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  pinSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: brand.primaryMid,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    maxWidth: 90,
    textAlign: "center",
  },
  card: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: "rgba(64,128,151,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardNome: {
    fontSize: font.size.md,
    fontWeight: "700",
  },
  cardMeta: {
    fontSize: font.size.sm,
    marginTop: 2,
  },
  detalhesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: brand.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  detalhesTxt: {
    color: "#fff",
    fontSize: font.size.sm,
    fontWeight: "700",
  },
});
