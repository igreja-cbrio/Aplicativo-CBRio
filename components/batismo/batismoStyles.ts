import { StyleSheet } from "react-native";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { BRAND_FONT } from "@/lib/fonts";

export const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    jaBatizado: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.xl, marginTop: spacing.md },
    jaBatizadoIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    jaBatizadoEyebrow: { color: colors.success, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    jaBatizadoTitle: { color: colors.text, fontFamily: BRAND_FONT, fontSize: font.size.xl, textAlign: 'center', marginTop: 5 },
    jaBatizadoTxt: { color: colors.textMuted, fontSize: font.size.sm, textAlign: 'center', lineHeight: 21, marginTop: spacing.sm },
    corrigirRegistro: { marginTop: spacing.lg, paddingVertical: 7, paddingHorizontal: 10 },
    headerGestao: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    gestaoSub: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
    content: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    card: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    cardTitle: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    cardTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    linhaTxt: { color: colors.text, fontSize: font.size.sm, flex: 1, lineHeight: 20 },
    vazio: {
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.xl,
    },
    vazioIcon: { color: colors.textMuted },
    vazioTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "800", textAlign: "center" },
    vazioTxt: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", lineHeight: 22 },
    linkAcao: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    linkAcaoTxt: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    modalIgrejaSheet: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.lg,
    },
    modalIgrejaCard: {
      gap: spacing.md,
    },
  });
