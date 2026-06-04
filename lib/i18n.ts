import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

/**
 * Idiomas suportados pelo app. Por enquanto só pt-BR tem tradução
 * completa; os demais ficam visíveis como "em breve" até a tradução
 * ser feita. A escolha persiste em AsyncStorage e é usada nos próximos
 * commits pra trocar os textos via i18n.
 */

export type LangCode =
  | "pt-BR"
  | "en"
  | "es"
  | "fr"
  | "it"
  | "de"
  | "ja"
  | "ko"
  | "zh"
  | "ar";

export type Lang = {
  code: LangCode;
  label: string;
  nativeLabel: string;
  bandeira: string;     // emoji
  pronto: boolean;       // tradução completa?
};

export const LANGS: Lang[] = [
  { code: "pt-BR", label: "Português (Brasil)", nativeLabel: "Português (BR)", bandeira: "🇧🇷", pronto: true },
  { code: "en", label: "English", nativeLabel: "English", bandeira: "🇺🇸", pronto: false },
  { code: "es", label: "Español", nativeLabel: "Español", bandeira: "🇪🇸", pronto: false },
  { code: "fr", label: "Français", nativeLabel: "Français", bandeira: "🇫🇷", pronto: false },
  { code: "it", label: "Italiano", nativeLabel: "Italiano", bandeira: "🇮🇹", pronto: false },
  { code: "de", label: "Deutsch", nativeLabel: "Deutsch", bandeira: "🇩🇪", pronto: false },
  { code: "ja", label: "Japonês", nativeLabel: "日本語", bandeira: "🇯🇵", pronto: false },
  { code: "ko", label: "Coreano", nativeLabel: "한국어", bandeira: "🇰🇷", pronto: false },
  { code: "zh", label: "Chinês", nativeLabel: "中文", bandeira: "🇨🇳", pronto: false },
  { code: "ar", label: "Árabe", nativeLabel: "العربية", bandeira: "🇸🇦", pronto: false },
];

const KEY = "cbrio.lang";

function deviceLang(): LangCode {
  // Detecta a partir do idioma do sistema; se não for um dos suportados
  // pronto, cai em pt-BR.
  const sys = Localization.getLocales?.()[0]?.languageTag ?? "pt-BR";
  if (sys.startsWith("pt")) return "pt-BR";
  const root = sys.split("-")[0];
  const match = LANGS.find((l) => l.code === root && l.pronto);
  return match ? match.code : "pt-BR";
}

/** Hook simples pra ler/escrever o idioma escolhido (persistido). */
export function useLang() {
  const [lang, setLangState] = useState<LangCode>("pt-BR");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v && LANGS.some((l) => l.code === v)) {
        setLangState(v as LangCode);
      } else {
        setLangState(deviceLang());
      }
      setLoaded(true);
    });
  }, []);

  function setLang(code: LangCode) {
    setLangState(code);
    AsyncStorage.setItem(KEY, code);
  }

  return { lang, setLang, loaded };
}
