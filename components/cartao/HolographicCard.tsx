import { type FC, useMemo } from "react";
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Mask,
  Path,
  Rect,
  RoundedRect,
  Skia,
} from "@shopify/react-native-skia";
import {
  Extrapolation,
  interpolate,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useDeviceTilt } from "./useDeviceTilt";

interface HolographicCardProps {
  width: number;
  height: number;
  /** Rotação Y do cartão (vem do gesto de flip). */
  rotateY: SharedValue<number>;
  /** Cor de fundo do cartão. */
  color?: string;
  radius?: number;
}

/**
 * Camada holográfica desenhada com Skia: uma grade de pontos iridescentes
 * coberta por uma máscara borrada que se move com a rotação do cartão e a
 * inclinação do aparelho — dá o efeito de "foil" holográfico.
 *
 * Portado do demo "threads-holo-ticket" e adaptado ao cartão CBRio (fundo teal
 * + cantos arredondados) e ao Reanimated v3 do Expo SDK 51.
 */
export const HolographicCard: FC<HolographicCardProps> = ({
  width,
  height,
  rotateY,
  color = "#408097",
  radius = 22,
}) => {
  const { pitch, roll } = useDeviceTilt();

  // Centro da máscara: posição base pela rotação + deslocamento pela inclinação.
  const maskCenterX = useDerivedValue(() => {
    const n = rotateY.value % 360;
    const rot = n < 0 ? n + 360 : n;
    const baseX = width / 2 - Math.sin((rot * Math.PI) / 180) * (width / 2);
    const tiltX = interpolate(
      pitch.value,
      [-Math.PI / 4, Math.PI / 4],
      [-width / 3, width / 3],
      Extrapolation.CLAMP
    );
    return baseX + tiltX;
  });

  const maskCenterY = useDerivedValue(() => {
    const tiltY = interpolate(
      roll.value,
      [-Math.PI / 4, Math.PI / 4],
      [-height / 3, height / 3],
      Extrapolation.CLAMP
    );
    return height / 2 + tiltY;
  });

  // Brilho de leve sempre presente, intensificando durante o flip.
  const maskOpacity = useDerivedValue(() =>
    interpolate(
      Math.abs(rotateY.value),
      [0, 90, 180, 270, 360],
      [0.35, 0.85, 0.35, 0.85, 0.35],
      Extrapolation.CLAMP
    )
  );

  const mask = useMemo(
    () => (
      <Group>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          opacity={maskOpacity}
          color="white"
        />
        <Circle cx={maskCenterX} cy={maskCenterY} r={height / 2.5} color="black">
          <BlurMask blur={200} style="normal" />
        </Circle>
      </Group>
    ),
    [maskOpacity, width, height, maskCenterX, maskCenterY]
  );

  // Recorte com cantos arredondados (mesma curvatura do cartão).
  const clip = useMemo(() => {
    const p = Skia.Path.Make();
    p.addRRect(Skia.RRectXY(Skia.XYWHRect(0, 0, width, height), radius, radius));
    return p;
  }, [width, height, radius]);

  // Grade de círculos que recebe o gradiente iridescente.
  const LogoAmountHorizontal = 25;
  const LogoSize = width / LogoAmountHorizontal;
  const LogoAmountVertical = Math.round(height / LogoSize) + 1;

  const gridPath = useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = 0; i < LogoAmountHorizontal; i++) {
      for (let j = 0; j < LogoAmountVertical; j++) {
        p.addCircle(
          LogoSize / 2 + i * LogoSize,
          LogoSize / 2 + j * LogoSize,
          LogoSize / 2
        );
      }
    }
    return p;
  }, [LogoAmountVertical, LogoSize]);

  // Gradiente holográfico que também reage levemente à inclinação.
  const gradientStart = useDerivedValue(() => ({
    x: interpolate(
      roll.value,
      [-Math.PI / 4, Math.PI / 4],
      [width * 0.1, width * 0.25],
      Extrapolation.CLAMP
    ),
    y: interpolate(
      pitch.value,
      [-Math.PI / 4, Math.PI / 4],
      [height * 0.1, height * 0.25],
      Extrapolation.CLAMP
    ),
  }));

  const gradientEnd = useDerivedValue(() => ({
    x: interpolate(
      roll.value,
      [-Math.PI / 4, Math.PI / 4],
      [width * 0.9, width * 0.75],
      Extrapolation.CLAMP
    ),
    y: interpolate(
      pitch.value,
      [-Math.PI / 4, Math.PI / 4],
      [height * 0.9, height * 0.75],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Canvas style={{ width, height, backgroundColor: "transparent" }}>
      <Group clip={clip}>
        {/* Fundo do cartão (teal da marca) */}
        <RoundedRect
          x={0}
          y={0}
          width={width}
          height={height}
          color={color}
          r={radius}
        />
        {/* Brilho holográfico */}
        <Mask mask={mask} mode="luminance">
          <Path path={gridPath}>
            <LinearGradient
              start={gradientStart}
              end={gradientEnd}
              colors={[
                "#ECD9A8", // champanhe
                "#B89FCC", // lavanda
                "#E5C896", // ouro quente
                "#8FB3D5", // azul suave
                "#E8CF9E", // bege dourado
                "#9B89C0", // periwinkle
                "#EDD5A5", // ouro champanhe
              ]}
              positions={[0, 0.17, 0.33, 0.5, 0.67, 0.83, 1]}
            />
          </Path>
        </Mask>
      </Group>
    </Canvas>
  );
};
