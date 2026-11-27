import { createContext, forwardRef, useContext, useSyncExternalStore } from "react";
import { Text as NativeText, TextInput as NativeTextInput, StyleSheet, type TextProps, type TextInputProps, type TextStyle } from "react-native";
import { currentFontMultiplier, subscribeFontScale, scaleTypography, tetoDoSistema } from "@/lib/fontScale";
import { familyParaPeso } from "@/lib/fonts";

const NestedText = createContext(false);

function useEscalaApp() {
  return useSyncExternalStore(subscribeFontScale, currentFontMultiplier, currentFontMultiplier);
}

function useTypography(style: TextProps["style"], scale: number, allowFontScaling?: boolean, nested = false): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const scaled = allowFontScaling === false ? flat : scaleTypography(flat, scale);
  if (nested && flat.fontSize == null) delete scaled.fontSize;
  if (nested && !flat.fontFamily && !flat.fontWeight && !flat.fontStyle) return scaled;
  if (scaled.fontFamily) return scaled;
  const { fontWeight, fontStyle, ...rest } = scaled;
  return { ...rest, fontFamily: familyParaPeso(fontWeight, fontStyle === "italic") };
}

/**
 * Preferência aplicada por componente, sem alterar APIs internas do React Native.
 * O teto da fonte do sistema (lib/fontScale · TETO_FONTE) vale para todo texto
 * do app; quem passar `maxFontSizeMultiplier` explícito decide o próprio.
 */
export const Text = forwardRef<NativeText, TextProps>(function Text({ style, children, maxFontSizeMultiplier, ...props }, ref) {
  const nested = useContext(NestedText);
  const scale = useEscalaApp();
  const typography = useTypography(style, scale, props.allowFontScaling, nested);
  return <NativeText {...props} maxFontSizeMultiplier={maxFontSizeMultiplier ?? tetoDoSistema(scale)} ref={ref} style={typography}><NestedText.Provider value={true}>{children}</NestedText.Provider></NativeText>;
});
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput({ style, maxFontSizeMultiplier, ...props }, ref) {
  const scale = useEscalaApp();
  const typography = useTypography(style, scale, props.allowFontScaling);
  return <NativeTextInput {...props} maxFontSizeMultiplier={maxFontSizeMultiplier ?? tetoDoSistema(scale)} ref={ref} style={typography} />;
});
