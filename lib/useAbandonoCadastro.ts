// Liga a régua `lib/abandonoCadastro.ts` à tela: manda o evento quando a pessoa
// sai do formulário sem enviar (a tela desmonta) e quando o app vai para
// segundo plano com o formulário aberto.
//
// ⚠️ Limite conhecido: se o sistema mata o app em segundo plano, só o evento de
// "pausa" tem chance de chegar (ele sai na hora, por `trackEventoJa`). Por isso
// a leitura no banco é "a última pausa ou saída de cada aparelho sem um envio
// depois", e não a contagem crua dos eventos.
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
  EVENTO_ABANDONO, EVENTO_CAMPO_INVALIDO, criarMedidorAbandono,
  type FormularioMedido, type MedidorAbandono,
} from "@/lib/abandonoCadastro";
import { trackEvento, trackEventoJa } from "@/lib/telemetria";

export type AbandonoCadastro = Pick<MedidorAbandono, "tocar" | "enviar" | "reabrir"> & {
  /** A validação da tela parou neste campo. */
  invalido(campo: string): void;
};

/** @param ativo `false` enquanto o formulário não está na tela (outro passo). */
export function useAbandonoCadastro(source: FormularioMedido, ativo: boolean = true): AbandonoCadastro {
  const medidor = useRef<MedidorAbandono | null>(null);
  if (!medidor.current) medidor.current = criarMedidorAbandono(source);
  const m = medidor.current;

  useEffect(() => {
    if (!ativo) return;
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") return;
      const props = m.abandono("pausa");
      if (props) trackEventoJa(EVENTO_ABANDONO, props);
    });
    return () => {
      sub.remove();
      const props = m.abandono("saiu");
      if (props) trackEventoJa(EVENTO_ABANDONO, props);
    };
  }, [ativo, m]);

  const api = useRef<AbandonoCadastro | null>(null);
  if (!api.current) {
    api.current = {
      tocar: (campo) => m.tocar(campo),
      enviar: () => m.enviar(),
      reabrir: () => m.reabrir(),
      invalido: (campo) => trackEvento(EVENTO_CAMPO_INVALIDO, { source, label: campo }),
    };
  }
  return api.current;
}
