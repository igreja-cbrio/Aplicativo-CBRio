// O mapa ÚNICO de rotas do toque em notificação (24/11/2026). Cada tipo que o
// ERP/app manda tem que cair na tela certa; tipo desconhecido NÃO navega.
import { expect, it } from "vitest";
import { destinoParaNotificacao, TIPOS_SEM_DESTINO } from "../lib/destinoNotificacao";

const ALBUM = "00000000-0000-4000-8000-0000000000b7";

it("cada tipo conhecido leva pra rota certa", () => {
  const casos: [string, Record<string, unknown>, unknown][] = [
    ["chat_assistente", {}, "/fale-conosco-chat"],
    ["escala", {}, "/voluntariado"],
    ["sos", {}, "/cuidados"],
    ["sos", { inscricao_id: "s1" }, { pathname: "/cuidados", params: { sos: "s1" } }],
    ["cuidado", {}, "/cuidados"],
    ["grupo_pedido", {}, "/grupo-inscricoes"],
    ["grupo_encontro_registrado", {}, "/meu-grupo"],
    ["grupo_visita_registrada", {}, "/meu-grupo"],
    ["grupo_saida", {}, "/meu-grupo"],
    ["carta_transferencia_pronta", {}, "/carta-transferencia"],
    ["batismo", {}, "/batismo"],
    ["batismo", { destino: "fotos", album_id: ALBUM }, { pathname: "/batismo-fotos", params: { album: ALBUM } }],
    ["culto", {}, "/"],
    ["culto", { culto_id: "c1" }, { pathname: "/culto-detalhe", params: { id: "c1" } }],
    ["next", {}, "/next"],
    ["devocional", {}, "/devocional"],
    ["kids_vinculo", {}, "/kids"],
    ["kids_chamar_responsavel", {}, "/kids"],
    ["kids_mural", {}, { pathname: "/kids-mural" }],
    ["inscricao_evento_checkin", {}, "/inscricoes"],
    ["inscricao_evento_checkin", { evento_id: "e1" }, { pathname: "/evento", params: { id: "e1" } }],
    ["inscricao_grupos", {}, "/inscricoes"],
    ["inscricao_batismo", {}, "/inscricoes"],
    // O ERP manda link '/assistente-ia', que não existe no app: o destino é o chat.
    ["bug_corrigido", { link: "/assistente-ia" }, "/fale-conosco-chat"],
  ];
  for (const [tipo, data, esperado] of casos) {
    expect(destinoParaNotificacao(tipo, data), `tipo ${tipo}`).toEqual(esperado);
  }
});

it("tipos com helper próprio seguem na rota do helper", () => {
  // Os helpers já são testados nos arquivos deles; aqui o contrato é o mapa chamar.
  expect(destinoParaNotificacao("kids_certificado_apresentacao", {})).toEqual({ pathname: "/kids-certificados" });
  expect(destinoParaNotificacao("comunicado", {})).toBeTruthy();
  expect(destinoParaNotificacao("inscricao_evento", {})).toBeTruthy();
  expect(destinoParaNotificacao("kids_devocional", {})).toBeTruthy();
});

it("saudação sem tela não navega e não é falha de rota", () => {
  expect(TIPOS_SEM_DESTINO.has("aniversario")).toBe(true);
  expect(destinoParaNotificacao("aniversario", {})).toBeNull();
});

it("tipo desconhecido não navega (a telemetria do notifTap registra)", () => {
  expect(destinoParaNotificacao("tipo_que_nao_existe", {})).toBeNull();
  expect(destinoParaNotificacao(undefined, {})).toBeNull();
});
