// Toque no aviso `batismo` (24/11/2026): com album_id abre a galeria do álbum;
// os lembretes antigos (sem album_id) seguem para /batismo. Molde de
// `kidsCertificadoNotifTap.test.ts`.
import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "../scripts/semComentarios.mjs";
const mocks = vi.hoisted(() => ({ navigate: vi.fn(), handler: null as null | ((r: any) => void), remove: vi.fn() }));
vi.mock("expo-router", () => ({ router: { navigate: mocks.navigate } }));
vi.mock("expo-notifications", () => ({
  addNotificationResponseReceivedListener: (h: any) => { mocks.handler = h; return { remove: mocks.remove }; },
  getLastNotificationResponseAsync: () => Promise.resolve(null), clearLastNotificationResponseAsync: () => Promise.resolve(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() } }));
vi.mock("../lib/telemetria", () => ({ trackEvento: vi.fn() }));
import { attachNotifTapListener } from "../lib/notifTap";

const ALBUM = "00000000-0000-4000-8000-0000000000b7";
const resposta = (identifier: string, date: number, data: Record<string, unknown>) => ({
  notification: { date, request: { identifier, content: { data } } },
});

it("aviso do álbum abre a galeria daquele álbum; lembrete sem id continua em /batismo", () => {
  const stop = attachNotifTapListener();
  const album = resposta("alb-1", 1, { tipo: "batismo", destino: "fotos", album_id: ALBUM });
  mocks.handler!(album);
  mocks.handler!(album); // replay do Android: uma vez só
  expect(mocks.navigate).toHaveBeenCalledTimes(1);
  expect(mocks.navigate).toHaveBeenCalledWith({ pathname: "/batismo-fotos", params: { album: ALBUM } });

  mocks.handler!(resposta("lembrete-1", 2, { tipo: "batismo" }));
  expect(mocks.navigate).toHaveBeenLastCalledWith("/batismo");

  mocks.handler!(resposta("alb-ruim", 3, { tipo: "batismo", destino: "fotos", album_id: "../perfil" }));
  expect(mocks.navigate).toHaveBeenLastCalledWith("/batismo");
  stop();
});

// A LISTA de notificações (`notificacoes.tsx`) é o outro mapa de toque e já
// divergiu do da push antes: os dois precisam usar o MESMO destino.

it("⚠️ MUTATION GUARD · push e lista usam o mesmo destino para `batismo`", () => {
  const ler = (rel: string) => semComentarios(readFileSync(join(process.cwd(), rel), "utf8"));
  for (const arq of ["lib/notifTap.ts", "app/(app)/notificacoes.tsx"]) {
    const src = ler(arq);
    const caso = src.slice(src.indexOf('case "batismo":'), src.indexOf('case "batismo":') + 120);
    expect(caso, `${arq} não roteia "batismo" pelo destino do álbum`).toContain("destinoNotificacaoBatismo(data)");
  }
});
