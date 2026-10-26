import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { useMenu } from "@/contexts/MenuContext";

/** Compatibilidade com links antigos: Menu agora é a gaveta da Home. */
export default function MenuScreen() {
  const { openMenu } = useMenu(), router = useRouter();
  useFocusEffect(useCallback(() => {
    router.replace("/");
    openMenu();
  }, [openMenu, router]));
  return <View style={{ flex: 1, backgroundColor: "#314b51" }} />;
}
