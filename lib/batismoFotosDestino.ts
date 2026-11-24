// Destino do toque no aviso `batismo` (24/11/2026 · álbum do batismo).
// Arquivo PURO (sem módulo nativo), no molde de `kidsCertificadoDestino.ts`: o
// `notifTap` e a lista de notificações importam daqui.
//
// O ERP manda `{ tipo: 'batismo', destino: 'fotos', album_id }` quando publica o
// álbum. Os lembretes antigos (véspera, dia do batismo) também são `tipo:
// 'batismo'`, mas sem `album_id` — esses continuam indo para `/batismo`.
// Nunca aceita destino livre vindo do push: só o id do álbum, validado como UUID.
// Quem decide se a pessoa vê aquele álbum é o servidor, na tela de fotos.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

export function destinoNotificacaoBatismo(data: Record<string, unknown>) {
  const album = data.album_id;
  if (data.destino === "fotos" && ehUuid(album)) {
    return { pathname: "/batismo-fotos" as const, params: { album } };
  }
  return "/batismo" as const;
}
