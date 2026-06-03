import Svg, { Path } from "react-native-svg";
import { brand } from "@/constants/theme";

type Props = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/**
 * Coração da marca CBRio recriado como vetor (traço aberto com cauda).
 * Usado no splash (pulsando) e no cabeçalho do formulário de login.
 *
 * Para fidelidade total à arte oficial, basta substituir este componente
 * pelo SVG/PNG oficial em assets/ e apontar para ele.
 */
export function CbrioHeart({
  size = 96,
  color = brand.primary,
  strokeWidth = 11,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path
        d="M22 60 C8 44 16 24 36 30 C46 33 50 40 52 46 C55 30 70 18 84 30 C96 41 90 62 70 76 C62 82 56 87 52 93"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
