// Destino do toque no aviso `kids_certificado_apresentacao` (17/11/2026).
// Arquivo PURO (sem módulo nativo), no molde de `kidsAvisoDestino.ts`: o
// `notifTap` importa daqui. Nunca aceita destino livre vindo do push — só o id
// da inscrição, validado como UUID; sem ele, abre a lista.
export function destinoCertificadoKids(data: Record<string, unknown>) {
  const id = data.apresentacao_id;
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? { pathname: "/kids-certificados" as const, params: { id } }
    : { pathname: "/kids-certificados" as const };
}
