import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { TRANSLATIONS } from "./translations";

/**
 * i18n do app. Estratégia: a CHAVE de tradução é a própria string em
 * português. `t("Pedido de oração")` devolve o PT por padrão; em EN/ES
 * busca em `TRANSLATIONS`. Se faltar tradução, cai no PT (nunca quebra).
 * A escolha persiste e o `TranslationProvider` re-renderiza o app ao trocar.
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
  bandeira: string; // emoji
  pronto: boolean; // tradução completa?
};

export const LANGS: Lang[] = [
  { code: "pt-BR", label: "Português (Brasil)", nativeLabel: "Português (BR)", bandeira: "🇧🇷", pronto: true },
  { code: "en", label: "English", nativeLabel: "English", bandeira: "🇺🇸", pronto: true },
  { code: "es", label: "Español", nativeLabel: "Español", bandeira: "🇪🇸", pronto: true },
  { code: "fr", label: "Français", nativeLabel: "Français", bandeira: "🇫🇷", pronto: false },
  { code: "it", label: "Italiano", nativeLabel: "Italiano", bandeira: "🇮🇹", pronto: false },
  { code: "de", label: "Deutsch", nativeLabel: "Deutsch", bandeira: "🇩🇪", pronto: false },
  { code: "ja", label: "Japonês", nativeLabel: "日本語", bandeira: "🇯🇵", pronto: false },
  { code: "ko", label: "Coreano", nativeLabel: "한국어", bandeira: "🇰🇷", pronto: false },
  { code: "zh", label: "Chinês", nativeLabel: "中文", bandeira: "🇨🇳", pronto: false },
  { code: "ar", label: "Árabe", nativeLabel: "العربية", bandeira: "🇸🇦", pronto: false },
];

const KEY = "cbrio.lang";

/** Tradução pura (sem hook). A chave é a string PT. */
export function translate(pt: string, lang: LangCode): string {
  if (lang === "pt-BR") return pt;
  const entry = TRANSLATIONS[pt];
  if (!entry) return pt;
  return (entry as Record<string, string>)[lang] ?? pt;
}

function deviceLang(): LangCode {
  const sys = Localization.getLocales?.()[0]?.languageTag ?? "pt-BR";
  if (sys.startsWith("pt")) return "pt-BR";
  const root = sys.split("-")[0];
  const match = LANGS.find((l) => l.code === root && l.pronto);
  return match ? match.code : "pt-BR";
}

type LangContextValue = {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  loaded: boolean;
};

const LangContext = createContext<LangContextValue>({
  lang: "pt-BR",
  setLang: () => {},
  loaded: false,
});

/** Provider de idioma — re-renderiza os consumidores ao trocar. */
export function TranslationProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("pt-BR");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v && LANGS.some((l) => l.code === v && l.pronto)) {
        setLangState(v as LangCode);
      } else {
        setLangState(deviceLang());
      }
      setLoaded(true);
    });
  }, []);

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    AsyncStorage.setItem(KEY, code);
  }, []);

  const value = useMemo(() => ({ lang, setLang, loaded }), [lang, setLang, loaded]);
  return createElement(LangContext.Provider, { value }, children);
}

/** Lê/escreve o idioma escolhido (compatível com o uso anterior). */
export function useLang() {
  return useContext(LangContext);
}

/** Hook do tradutor. `const t = useT(); t("Olá")`. Re-renderiza ao trocar idioma. */
export function useT() {
  const { lang } = useContext(LangContext);
  return useCallback((pt: string) => translate(pt, lang), [lang]);
}
