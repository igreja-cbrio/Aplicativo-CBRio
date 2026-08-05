// ============================================================================
// Telemetria do app · uso (telas/ações) + erros (crash JS)
// ----------------------------------------------------------------------------
// Envia eventos em lote pro backend (/app/telemetria), que grava em app_eventos.
// Visível no sistema em /admin/app-analytics. Tudo best-effort: nunca quebra o
// app nem atrapalha o fluxo. Sem PII (só nomes de tela/ação + meta do aparelho).
//
// ⚠️ CONTRATO COM O BACKEND (backend/services/systemMobileOps.js) — o que sai
// daqui e não estiver na régua dele é DESCARTADO EM SILÊNCIO:
//  · `props` passa por WHITELIST de chaves. Hoje: message · fatal · screen ·
//    route · action · reason · status_code · endpoint · permission ·
//    notification_type · source · entity_id · label. Chave fora da lista é
//    jogada fora sem erro — foi assim que `{ grupo: id }`, `{ tipo }` e
//    `{ criado }` nunca chegaram. Chave nova = mudar a whitelist LÁ também.
//  · `entity_id` é id de COISA (grupo, vídeo, comunicado) — NUNCA de pessoa.
//    `label` é rótulo curto e não-identificante (enum nosso), NUNCA texto que
//    a pessoa digitou.
//  · O endpoint responde HTTP 200 `{ok:false}` quando falha (telemetria não
//    pode quebrar o app), então dá pra morrer calada: em 31/07/2026 o
//    `event_id NOT NULL` novo rejeitou TODO lote e a telemetria ficou 5 dias
//    zerada sem ninguém saber. Hoje o backend avisa gente quando a ingestão
//    falha, e aqui o lote é RETENTADO (o `event_id` deixa o reenvio idempotente).
// ============================================================================
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const BASE = "https://www.cbrio.org/api";
const APP_VERSION = Constants.expoConfig?.version ?? "?";
const BUILD = Constants.nativeBuildVersion ? String(Constants.nativeBuildVersion) : null;
const CHAVE_INSTALACAO = "cbrio:installation_id";

/** Uma abertura do app = uma sessão (só na memória, de propósito). */
const SESSION_ID = Crypto.randomUUID();

function texto(v: unknown): string | null {
  const s = v == null ? "" : String(v).trim();
  return s || null;
}

/**
 * Aparelho/SO a partir do `Platform` do RN — sem dependência nativa nova (o que
 * manteria isto fora do alcance de OTA).
 * ⚠️ NUNCA usar `Constants.deviceName` no iOS: vem como "iPhone de <nome da
 * pessoa>", ou seja, PII. No iOS o RN não expõe o modelo, então vai o formato
 * (handset/pad), que responde "celular ou tablet?" sem identificar ninguém.
 */
const APARELHO = (() => {
  const c = (Platform.constants ?? {}) as Record<string, unknown>;
  if (Platform.OS === "android") {
    return {
      os_version: texto(c.Release) ?? texto(Platform.Version),
      device_model: texto(c.Model),
      manufacturer: texto(c.Manufacturer) ?? texto(c.Brand),
    };
  }
  return {
    os_version: texto(c.osVersion) ?? texto(Platform.Version),
    device_model: texto(c.interfaceIdiom),
    manufacturer: Platform.OS === "ios" ? "Apple" : null,
  };
})();

/** Id estável do aparelho (persiste entre aberturas). Não identifica pessoa. */
let instalacaoPromise: Promise<string> | null = null;
function idInstalacao(): Promise<string> {
  if (!instalacaoPromise) {
    instalacaoPromise = (async () => {
      try {
        const salvo = await AsyncStorage.getItem(CHAVE_INSTALACAO);
        if (salvo) return salvo;
        const novo = Crypto.randomUUID();
        await AsyncStorage.setItem(CHAVE_INSTALACAO, novo);
        return novo;
      } catch {
        return SESSION_ID; // sem persistência: pelo menos agrupa esta sessão
      }
    })();
  }
  return instalacaoPromise;
}

type Evento = {
  tipo: "tela" | "acao" | "erro" | "ping";
  nome: string;
  props?: Record<string, unknown>;
  event_id: string;
  /** Quando ACONTECEU (o `created_at` é quando chegou). */
  occurred_at: string;
  /** Interno · não vai pro servidor. */
  tentativas?: number;
};

const MAX_FILA = 60;
const MAX_TENTATIVAS = 2;

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

  const installation_id = await idInstalacao().catch(() => null);
  let ok = false;
  try {
    const r = await fetch(`${BASE}/app/telemetria`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        eventos: eventos.map((e) => ({
          tipo: e.tipo,
          nome: e.nome,
          props: e.props ?? null,
          plataforma: Platform.OS,
          app_version: APP_VERSION,
          build_number: BUILD,
          event_id: e.event_id,
          occurred_at: e.occurred_at,
          session_id: SESSION_ID,
          installation_id,
          ...APARELHO,
        })),
      }),
    });
    // O endpoint devolve 200 mesmo em falha; quem conta a verdade é o corpo.
    const corpo = (await r.json().catch(() => null)) as { ok?: boolean } | null;
    ok = r.ok && corpo?.ok !== false;
  } catch {
    ok = false; // offline / erro de rede
  }

  if (ok) return;
  // Retentativa limitada. Reenviar é seguro porque o backend deduplica por
  // `event_id` (índice único) — o mesmo evento não entra duas vezes.
  const devolver = eventos
    .map((e) => ({ ...e, tentativas: (e.tentativas ?? 0) + 1 }))
    .filter((e) => (e.tentativas ?? 0) < MAX_TENTATIVAS);
  if (!devolver.length) return;
  fila = [...devolver, ...fila].slice(0, MAX_FILA);
  if (!timer) timer = setTimeout(flushTelemetria, 15000);
}

export function flushTelemetria() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!fila.length) return;
  const lote = fila;
  fila = [];
  void enviar(lote);
}

function enfileirar(ev: Omit<Evento, "event_id" | "occurred_at">) {
  if (fila.length >= MAX_FILA) fila.shift(); // nunca cresce sem limite
  fila.push({
    ...ev,
    event_id: Crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
  });
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

  // Heartbeat de presença (pra "online agora" no painel ao vivo): 1 ping/min
  // enquanto o app está em primeiro plano. Pings não contam nas analytics.
  setInterval(() => {
    if (AppState.currentState === "active") enfileirar({ tipo: "ping", nome: "heartbeat" });
  }, 60000);
}
