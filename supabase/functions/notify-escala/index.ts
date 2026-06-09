// Notifica o voluntário ao ser escalado em vol_schedules.
// Trigger SQL chama esta function com o NEW row de vol_schedules.
// Resolve volunteer_id -> vol_profiles -> auth_user_id, e dispara
// push + grava em app_notificacoes via helper compartilhado.
import { notificar, makeAdmin } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const row = payload.record ?? payload;
    const volunteerId = row?.volunteer_id as string | undefined;
    if (!volunteerId) return new Response("sem volunteer_id", { status: 200 });

    const sb = makeAdmin();

    // 1) vol_profile -> auth_user_id + membresia_id
    const { data: vp } = await sb
      .from("vol_profiles")
      .select("auth_user_id, membresia_id, full_name")
      .eq("id", volunteerId)
      .maybeSingle();
    if (!vp) return new Response("sem vol_profile", { status: 200 });

    const target = vp.auth_user_id
      ? { userIds: [vp.auth_user_id as string] }
      : vp.membresia_id
      ? { membroIds: [vp.membresia_id as string] }
      : null;
    if (!target) return new Response("vol_profile sem auth/membro", { status: 200 });

    // 2) Nome do culto + data
    let cultoNome = "um culto";
    let dataTxt = "";
    if (row.service_id) {
      const { data: svc } = await sb
        .from("vol_services")
        .select("name, service_type_name, scheduled_at")
        .eq("id", row.service_id)
        .maybeSingle();
      if (svc) {
        cultoNome = (svc.name as string) ?? (svc.service_type_name as string) ?? cultoNome;
        if (svc.scheduled_at) {
          dataTxt = new Date(svc.scheduled_at as string).toLocaleDateString("pt-BR");
        }
      }
    }

    const team = row.team_name ? ` (${row.team_name})` : "";
    const titulo = "Você foi escalado! 🙌";
    const body = `${cultoNome}${team}${dataTxt ? ` — ${dataTxt}` : ""}. Abra o app para confirmar.`;

    await notificar(target, {
      tipo: "escala",
      titulo,
      body,
      data: {
        vol_schedule_id: row.id,
        service_id: row.service_id ?? null,
        team_name: row.team_name ?? null,
        position_name: row.position_name ?? null,
      },
    });

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`erro: ${e}`, { status: 500 });
  }
});
