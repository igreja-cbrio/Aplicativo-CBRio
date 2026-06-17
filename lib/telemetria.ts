// ============================================================================
// Telemetria do app · uso (telas/ações) + erros (crash JS)
// ----------------------------------------------------------------------------
// Envia eventos em lote pro backend (/app/telemetria), que grava em app_eventos.
// Visível no sistema (dashboard de Analytics do app). Tudo best-effort: nunca
// quebra o app nem atrapalha o fluxo. Sem PII (só nomes de tela/ação + meta).
// ============================================================================
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "./supabase";

const BASE = "https://www.cbrio.org/api";
const APP_VERSION = Constants.expoConfig?.version ?? "?";

type Evento = {
  tipo: "tela" | "acao" | "erro";
  nome: string;
  props?: Record<string, unknown>;
};

let fila: Evento[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let iniciado = false;

async function enviar(eventos: Evento[]) {
  if (!eventos.length) return;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  } catch {
    /* sem sessão · envia anônimo */
  }
  try {
    await fetch(`${BASE}/app/telemetria`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        eventos: eventos.map((e) => ({
          tipo: e.tipo,
          nome: e.nome,
          props: e.props ?? null,
          plataforma: Platform.OS,
          app_version: APP_VERSION,
        })),
      }),
    });
  } catch {
    /* offline/erro de rede · descarta silenciosamente */
  }
}

export function flushTelemetria() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!fila.length) return;
  const lote = fila;
  fila = [];
  void enviar(lote);
}

function enfileirar(ev: Evento) {
  fila.push(ev);
  if (fila.length >= 10) {
    flushTelemetria();
    return;
  }
  if (!timer) timer = setTimeout(flushTelemetria, 5000);
}

export function trackTela(nome: string) {
  enfileirar({ tipo: "tela", nome });
}
export function trackEvento(nome: string, props?: Record<string, unknown>) {
  enfileirar({ tipo: "acao", nome, props });
}
export function trackErro(nome: string, props?: Record<string, unknown>) {
  enfileirar({ tipo: "erro", nome, props });
  flushTelemetria(); // erro vai na hora
}

// Inicializa 1x: handler global de erros JS + flush ao ir pra background.
export function initTelemetria() {
  if (iniciado) return;
  iniciado = true;

  const g = global as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (e: unknown, fatal?: boolean) => void;
      setGlobalHandler?: (h: (e: unknown, fatal?: boolean) => void) => void;
    };
  };
  const anterior = g.ErrorUtils?.getGlobalHandler?.();
  g.ErrorUtils?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
    try {
      const err = error as { name?: string; message?: string };
      trackErro(err?.name || "Error", {
        message: String(err?.message || error).slice(0, 500),
        fatal: !!isFatal,
      });
    } catch {
      /* nunca propaga */
    }
    anterior?.(error, isFatal);
  });

  AppState.addEventListener("change", (s) => {
    if (s !== "active") flushTelemetria();
  });
}
