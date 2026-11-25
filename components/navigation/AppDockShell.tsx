import React, { useState, type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { HomeTutorial } from "@/components/onboarding/HomeTutorial";
import { DockInsetContext } from "./DockContent";
import { BottomBar } from "@/components/ui/BottomBar";
import { ChatFab } from "@/components/chat/ChatFab";
import { useTheme } from "@/contexts/ThemeContext";
import { chromeDaTela } from "@/lib/appNavigation";

const ROTAS_COM_CHAT_FAB = new Set(["/", "/meu-grupo", "/voluntariado", "/cuidados", "/devocional", "/generosidade", "/menu"]);

/** Usa o estado deste Stack, não o pathname global do chat que o cobre. */
export function AppDockShell({ rota, children }: { rota: string; children: ReactNode }) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const [dockHeight, setDockHeight] = useState(78 + Math.max(insets.bottom, 12));
  const chrome = chromeDaTela(rota);
  return <HomeTutorial>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {chrome.dock && <StatusBar style={chrome.caminho === "/" || mode === "dark" ? "light" : "dark"} />}
      <DockInsetContext.Provider value={dockHeight}>
        <View style={{ flex: 1 }}>{children}</View>
      </DockInsetContext.Provider>
      {ROTAS_COM_CHAT_FAB.has(chrome.caminho) && <ChatFab bottomOffset={dockHeight} />}
      {chrome.dock && <BottomBar rota={chrome.caminho} onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)} />}
    </View>
  </HomeTutorial>;
}
