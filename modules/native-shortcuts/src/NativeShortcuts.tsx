import React, { useEffect, useRef, useState, type ComponentType } from "react";
import { useWindowDimensions } from "react-native";
import { NativeShortcutsHost as NativeView, type NativeShortcutsProps as Props } from "./nativeShortcutsHost";

function MeasuredShortcuts(props: Props) {
  const [ready, setReady] = useState(false);
  const frame = useRef<number | null>(null);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  if (!NativeView) return null;
  return <NativeView {...props} labels={ready ? props.labels : []} onLayout={({ nativeEvent: { layout } }) => {
    if (ready || layout.width <= 0 || layout.height <= 0) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    // O UIKit guarda o tamanho truncado se setItems roda com frame zero.
    // Espera o layout nativo terminar antes de fornecer os títulos, inclusive
    // nos binários já instalados: não precisa alterar o módulo Swift.
    frame.current = requestAnimationFrame(() => { frame.current = null; setReady(true); });
  }} />;
}

function ResponsiveShortcuts(props: Props) {
  const { width, height, fontScale } = useWindowDimensions();
  // Rotação/Display Zoom também precisam recalcular os títulos do UIKit.
  return <MeasuredShortcuts key={`${width}:${height}:${fontScale}`} {...props} />;
}

const NativeShortcuts: ComponentType<Props> | null = NativeView ? ResponsiveShortcuts : null;
export { NativeShortcuts };
