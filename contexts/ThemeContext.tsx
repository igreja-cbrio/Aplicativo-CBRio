import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { palettes, type Palette } from "@/constants/theme";

export type ThemePreference = "system" | "light" | "dark";
type Mode = "light" | "dark";

/** Escalas de fonte disponíveis (multiplicador aplicado em todo o app). */
export type FontScale = "sm" | "md" | "lg" | "xl";
export const FONT_SCALES: Record<FontScale, number> = {
  sm: 0.92,
  md: 1.0,
  lg: 1.12,
  xl: 1.28,
};

const PREF_KEY = "cbrio.themePref";
const FONT_KEY = "cbrio.fontScale";

type ThemeContextValue = {
  colors: Palette;
  mode: Mode; // tema resolvido (light/dark)
  preference: ThemePreference; // escolha do usuário
  setPreference: (p: ThemePreference) => void;
  fontScale: FontScale;
  fontMultiplier: number; // 0.92 / 1.0 / 1.12 / 1.28
  setFontScale: (s: FontScale) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [fontScale, setFontScaleState] = useState<FontScale>("md");

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "system") {
        setPreferenceState(v);
      }
    });
    AsyncStorage.getItem(FONT_KEY).then((v) => {
      if (v === "sm" || v === "md" || v === "lg" || v === "xl") {
        setFontScaleState(v);
      }
    });
  }, []);

  function setPreference(p: ThemePreference) {
    setPreferenceState(p);
    AsyncStorage.setItem(PREF_KEY, p);
  }

  function setFontScale(s: FontScale) {
    setFontScaleState(s);
    AsyncStorage.setItem(FONT_KEY, s);
  }

  const mode: Mode =
    preference === "system" ? (system === "light" ? "light" : "dark") : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: palettes[mode],
      mode,
      preference,
      setPreference,
      fontScale,
      fontMultiplier: FONT_SCALES[fontScale],
      setFontScale,
    }),
    [mode, preference, fontScale]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  return ctx;
}

export function useColors() {
  return useTheme().colors;
}
