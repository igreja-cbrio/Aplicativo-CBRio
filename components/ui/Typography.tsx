import { createContext, forwardRef, useContext, useSyncExternalStore } from "react";
import { Text as NativeText, TextInput as NativeTextInput, StyleSheet, type TextProps, type TextInputProps, type TextStyle } from "react-native";
import { currentFontMultiplier, subscribeFontScale, scaleTypography } from "@/lib/fontScale";
import { familyParaPeso } from "@/lib/fonts";

const NestedText = createContext(false);

function useTypography(style: TextProps["style"], allowFontScaling?: boolean, nested = false): TextStyle {
  const scale = useSyncExternalStore(subscribeFontScale, currentFontMultiplier, currentFontMultiplier);
  const flat = StyleSheet.flatten(style) ?? {};
  const scaled = allowFontScaling === false ? flat : scaleTypography(flat, scale);
  if (nested && flat.fontSize == null) delete scaled.fontSize;
  if (nested && !flat.fontFamily && !flat.fontWeight && !flat.fontStyle) return scaled;
  if (scaled.fontFamily) return scaled;
  const { fontWeight, fontStyle, ...rest } = scaled;
  return { ...rest, fontFamily: familyParaPeso(fontWeight, fontStyle === "italic") };
}

/** Preferência aplicada por componente, sem alterar APIs internas do React Native. */
export const Text = forwardRef<NativeText, TextProps>(function Text({ style, children, ...props }, ref) {
  const nested = useContext(NestedText);
  const typography = useTypography(style, props.allowFontScaling, nested);
  return <NativeText {...props} ref={ref} style={typography}><NestedText.Provider value={true}>{children}</NestedText.Provider></NativeText>;
});
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const typography = useTypography(style, props.allowFontScaling);
  return <NativeTextInput {...props} ref={ref} style={typography} />;
});
