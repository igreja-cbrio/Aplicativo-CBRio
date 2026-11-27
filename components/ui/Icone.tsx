import React from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Ícone do app: Ionicons + o CAPACETE de Servir (27/11/2026).
 *
 * Pedido do Marcos: a mão de Servir era a mesma família da mão de Cuidados
 * ("essa mão aparece em cuidados também"). O Ionicons não tem capacete, então
 * "capacete" desenha o `hard-hat` do MaterialCommunityIcons, que já vem no
 * @expo/vector-icons (sem dependência nova, sai por OTA).
 *
 * ⚠️ No iPhone com a barra nativa (UITabBar · modules/native-shortcuts) o símbolo
 * de Servir é SF Symbol fixo no Swift: lá a troca só chega com binário novo.
 */
export type NomeIcone = React.ComponentProps<typeof Ionicons>["name"] | "capacete";

/** O ícone de Servir em todo o app. Mudar aqui muda barra, menu, tutorial e listas. */
export const ICONE_SERVIR: NomeIcone = "capacete";

export function Icone({ name, ...props }: Omit<React.ComponentProps<typeof Ionicons>, "name"> & { name: NomeIcone }) {
  if (name === "capacete") return <MaterialCommunityIcons name="hard-hat" {...props} />;
  return <Ionicons name={name} {...props} />;
}
