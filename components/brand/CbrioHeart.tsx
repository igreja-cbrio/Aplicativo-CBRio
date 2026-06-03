import { Image } from "react-native";

type Props = {
  size?: number;
  /** Recolore o coração (tintColor). Sem valor, usa o teal original da arte. */
  color?: string;
};

/**
 * Coração da marca CBRio (arte oficial — assets/images/cbrio-heart.png).
 * Usado no cabeçalho dos formulários e na home.
 */
export function CbrioHeart({ size = 96, color }: Props) {
  return (
    <Image
      source={require("../../assets/images/cbrio-heart.png")}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );
}
