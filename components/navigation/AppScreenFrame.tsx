import { useContext, type ReactNode } from "react";
import { View } from "react-native";
import { DockInsetContext } from "./DockContent";
import { TopBar } from "@/components/ui/TopBar";
import { useColors } from "@/contexts/ThemeContext";
import { chromeDaTela } from "@/lib/appNavigation";

/** Cabeçalho viaja com a tela no Stack. A Home por baixo nunca perde altura. */
export function AppScreenFrame({ rota, children }: { rota: string; children: ReactNode }) {
  const colors = useColors();
  const dockHeight = useContext(DockInsetContext);
  const chrome = chromeDaTela(rota);
  return <DockInsetContext.Provider value={chrome.dock ? dockHeight : 0}>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {chrome.header && <TopBar mostrarVoltar={chrome.voltar} rota={chrome.caminho} />}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  </DockInsetContext.Provider>;
}
