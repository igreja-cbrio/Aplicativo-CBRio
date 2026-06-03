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

const PREF_KEY = "cbrio.themePref";

type ThemeContextValue = {
  colors: Palette;
  mode: Mode; // tema resolvido (light/dark)
  preference: ThemePreference; // escolha do usuário
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "system") {
        setPreferenceState(v);
      }
    });
  }, []);

  function setPreference(p: ThemePreference) {
    setPreferenceState(p);
    AsyncStorage.setItem(PREF_KEY, p);
  }

  const mode: Mode =
    preference === "system" ? (system === "light" ? "light" : "dark") : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: palettes[mode], mode, preference, setPreference }),
    [mode, preference]
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
