import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

/** Binários já publicados não têm ExpoCamera: nunca importar o pacote antes desta guarda. */
export function cameraSelfieDisponivel(): boolean {
  try { return Platform.OS !== "web" && !!requireOptionalNativeModule("ExpoCamera"); }
  catch { return false; }
}

export function carregarCameraSelfie(): typeof import("expo-camera") | null {
  if (!cameraSelfieDisponivel()) return null;
  return require("expo-camera") as typeof import("expo-camera");
}
