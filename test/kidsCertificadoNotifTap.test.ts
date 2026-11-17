import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ navigate: vi.fn(), handler: null as null | ((r: any) => void), remove: vi.fn() }));
vi.mock("expo-router", () => ({ router: { navigate: mocks.navigate } }));
vi.mock("expo-notifications", () => ({
  addNotificationResponseReceivedListener: (h: any) => { mocks.handler = h; return { remove: mocks.remove }; },
  getLastNotificationResponseAsync: () => Promise.resolve(null), clearLastNotificationResponseAsync: () => Promise.resolve(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() } }));
vi.mock("../lib/telemetria", () => ({ trackEvento: vi.fn() }));
import { attachNotifTapListener } from "../lib/notifTap";

const ID = "00000000-0000-4000-8000-0000000000a1";
it("toque no aviso do certificado abre a tela do Kids com o certificado em destaque, uma vez só", () => {
  const stop = attachNotifTapListener();
  const resp = { notification: { date: 1, request: { identifier: "cert-1", content: { data: { tipo: "kids_certificado_apresentacao", apresentacao_id: ID } } } } };
  mocks.handler!(resp); mocks.handler!(resp);
  expect(mocks.navigate).toHaveBeenCalledTimes(1);
  expect(mocks.navigate).toHaveBeenCalledWith({ pathname: "/kids-certificados", params: { id: ID } });
  const semId = { notification: { date: 2, request: { identifier: "cert-2", content: { data: { tipo: "kids_certificado_apresentacao" } } } } };
  mocks.handler!(semId);
  expect(mocks.navigate).toHaveBeenLastCalledWith({ pathname: "/kids-certificados" });
  stop();
});
