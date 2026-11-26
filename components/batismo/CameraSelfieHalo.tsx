import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text as NativeText } from "react-native";
import type { CameraView } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import { carregarCameraSelfie } from "../../lib/cameraSelfieNativa";
import { capturarSelfieEmMemoria } from "../../lib/capturaSelfie";
import { HaloBuscaFacial, type PropsHalo } from "./HaloBuscaFacial";

type Props = Pick<PropsHalo, "colors" | "t" | "TextComponent" | "bottomInset"> & {
  onSelfie: (selfie: string) => void;
  onErro: () => void;
};
/** Câmera só monta depois do consentimento e da permissão, ambos tratados pelo fluxo pai. */
export function CameraSelfieHalo({ colors, t, TextComponent = NativeText, bottomInset, onSelfie, onErro }: Props) {
  const pacote = useMemo(carregarCameraSelfie, []);
  const camera = useRef<CameraView | null>(null);
  const viva = useRef(true);
  const geracao = useRef(0);
  const ocupada = useRef(false);
  const [versaoCamera, setVersaoCamera] = useState(0);
  const [ativa, setAtiva] = useState(AppState.currentState === "active");
  const [pronta, setPronta] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const erroRef = useRef(onErro);
  erroRef.current = onErro;
  useEffect(() => {
    viva.current = true;
    setVersaoCamera(geracao.current);
    if (!pacote) erroRef.current();
    const sub = AppState.addEventListener("change", s => {
      if (s !== "active") { geracao.current += 1; setVersaoCamera(geracao.current); setPronta(false); }
      setAtiva(s === "active");
    });
    return () => { viva.current = false; geracao.current += 1; sub.remove(); };
  }, [pacote]);
  // Sem onCameraReady (por exemplo, simulador iOS sem câmera), não fica preso.
  useEffect(() => {
    if (!pacote || !ativa || pronta) return;
    const versao = geracao.current;
    const espera = setTimeout(() => {
      if (viva.current && versao === geracao.current && AppState.currentState === "active") erroRef.current();
    }, 12_000);
    return () => clearTimeout(espera);
  }, [pacote, ativa, pronta, versaoCamera]);

  async function capturar() {
    if (!viva.current || !pronta || !ativa || AppState.currentState !== "active" || !camera.current || ocupada.current) return;
    ocupada.current = true;
    setCapturando(true);
    const versao = geracao.current;
    const atual = camera.current;
    try {
      const selfie = await capturarSelfieEmMemoria(
        () => atual.takePictureAsync({ quality: 0.5, base64: true, exif: false, shutterSound: false }),
        uri => FileSystem.deleteAsync(uri, { idempotent: true }),
      );
      if (!viva.current || versao !== geracao.current) return;
      if (selfie) onSelfie(selfie); else onErro();
    } catch { if (viva.current && versao === geracao.current) onErro(); }
    finally { ocupada.current = false; if (viva.current) setCapturando(false); }
  }
  const callbackAtual = () => viva.current && AppState.currentState === "active" && versaoCamera === geracao.current;
  const Camera = pacote?.CameraView;
  const Texto = TextComponent;
  return <HaloBuscaFacial colors={colors} t={t} TextComponent={Texto} bottomInset={bottomInset}
    titulo={capturando ? t("Capturando sua selfie…") : t("Um rosto. Muitas lembranças.")}
    detalhe={t("Posicione seu rosto no centro, em um lugar bem iluminado.")}
    status={!ativa ? t("Câmera pausada") : !pronta ? t("Abrindo a câmera…") : capturando ? t("Só um instante…") : t("Quando estiver pronto, toque para começar.")}
    lendo={ativa && pronta}
    camera={Camera && ativa ? <Camera key={versaoCamera} ref={camera} style={StyleSheet.absoluteFill} facing="front" mirror mode="picture" flash="off" onCameraReady={() => { if (callbackAtual()) setPronta(true); }} onMountError={() => { if (callbackAtual()) erroRef.current(); }} /> : undefined}>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !pronta || !ativa || capturando }} disabled={!pronta || !ativa || capturando} onPress={capturar}
      style={({ pressed }) => [s.button, { backgroundColor: colors.primary, opacity: !pronta || capturando || pressed ? 0.6 : 1 }]}>
      <Texto style={s.buttonText}>{capturando ? t("Capturando…") : t("Encontrar minhas fotos")}</Texto>
    </Pressable>
  </HaloBuscaFacial>;
}
const s = StyleSheet.create({ button: { minHeight: 50, padding: 14, borderRadius: 18, justifyContent: "center", alignItems: "center" }, buttonText: { color: "#fff", fontSize: 15, fontWeight: "700", textAlign: "center" } });
