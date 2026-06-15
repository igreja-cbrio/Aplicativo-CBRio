// Notifica o responsável quando a equipe Kids DECIDE a solicitação de vínculo
// (UPDATE em kids_vinculo_solicitacoes pra status aprovado/rejeitado).
// Deploy: supabase functions deploy notify-kids-vinculo --no-verify-jwt
// Trigger: ver supabase/webhooks_app.sql (kids_vinculo_solicitacoes AFTER UPDATE).
import { notificar } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const s = payload.record ?? payload;
    const membroId = s?.solicitante_membro_id;
    const status = s?.status as string | undefined;
    const crianca = (s?.crianca_nome as string) || "a criança";
    if (!membroId || (status !== "aprovado" && status !== "rejeitado")) {
      return new Response("nada a notificar", { status: 200 });
    }

    const aprovado = status === "aprovado";
    const motivo = (s?.motivo_rejeicao as string | null) || null;

    await notificar(
      { membroIds: [membroId] },
      {
        tipo: "kids_vinculo",
        titulo: aprovado ? "Vínculo aprovado ✅" : "Solicitação de vínculo recusada",
        body: aprovado
          ? `${crianca} foi vinculada a você. Já dá pra preparar o check-in pelo app.`
          : `O vínculo com ${crianca} não foi aprovado.${motivo ? ` Motivo: ${motivo}` : " Procure a equipe Kids."}`,
        data: { tipo: "kids_vinculo", solicitacao_id: s?.id, status },
      }
    );

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`erro: ${e}`, { status: 500 });
  }
});
