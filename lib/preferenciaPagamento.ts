import AsyncStorage from "@react-native-async-storage/async-storage";

/** Método de pagamento padrão da Generosidade. */
export type MetodoPagamento = "pix" | "card" | "apple_pay";

const KEY = "cbrio:metodo_pagamento";

export async function getMetodoPagamentoPadrao(): Promise<MetodoPagamento> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === "pix" || v === "card" || v === "apple_pay") return v;
  } catch {
    /* no-op */
  }
  return "pix";
}

export async function setMetodoPagamentoPadrao(m: MetodoPagamento): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, m);
  } catch {
    /* no-op */
  }
}
