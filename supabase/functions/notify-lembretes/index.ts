// Lembretes agendados — chamada pelo pg_cron A CADA MINUTO via pg_net
// (ver supabase/lembretes.sql). Idempotente: cada lembrete tem uma chave
// única em app_lembretes_enviados (upsert ignoreDuplicates), então rodar
// de novo no mesmo minuto não duplica push.
//
// Cobre:
//  1. Culto com transmissão online — push pra TODOS 5 min antes da hora
//  2. Batismo — véspera às 18h + no dia às 8h (batismo_inscricoes)
//  3. NEXT — véspera do encontro às 18h (next_eventos + next_inscricoes)

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { makeAdmin, notificar } from "../_shared/notify.ts";

const TZ = "America/Sao_Paulo";

/** Componentes da data/hora atual no fuso de Brasília. */
function agoraBRT() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const data = `${get("year")}-${get("month")}-${get("day")}`;
  const hora = parseInt(get("hour"), 10) % 24;
  const minuto = parseInt(get("minute"), 10);
  return { data, minutos: hora * 60 + minuto };
}

function dataMaisDias(dataIso: string, dias: number): string {
  const d = new Date(`${dataIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Marca a chave como enviada; retorna true só na PRIMEIRA vez. */
async function deduplicar(sb: SupabaseClient, chave: string): Promise<boolean> {
  const { data } = await sb
    .from("app_lembretes_enviados")
    .upsert({ chave }, { onConflict: "chave", ignoreDuplicates: true })
    .select("chave");
  return (data?.length ?? 0) > 0;
}

async function lembreteCultoOnline(sb: SupabaseClient, hoje: string, minutosAgora: number) {
  const { data: cultos } = await sb
    .from("cultos")
    .select("id, nome, hora, vol_service_types(has_online_stream, has_online)")
    .eq("data", hoje);
  for (const c of cultos ?? []) {
    const st = c.vol_service_types as { has_online_stream?: boolean; has_online?: boolean } | null;
    if (!st?.has_online_stream && !st?.has_online) continue;
    const [h, m] = String(c.hora).split(":").map(Number);
    const inicio = h * 60 + m;
    // Janela: dos 5 min antes até a hora de início (tolera atraso do cron)
    if (minutosAgora < inicio - 5 || minutosAgora >= inicio) continue;
    if (!(await deduplicar(sb, `culto-online:${c.id}`))) continue;

    const { data: tokens } = await sb.from("app_push_tokens").select("user_id");
    const userIds = [...new Set((tokens ?? []).map((t) => t.user_id as string))];
    const horaFmt = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    await notificar(
      { userIds },
      {
        tipo: "culto",
        titulo: "O culto online começa em 5 minutos 🔴",
        body: `${c.nome ?? "Culto"} ao vivo às ${horaFmt}. Toque pra acompanhar.`,
        data: { culto_id: c.id },
      }
    );
    console.log(`[lembretes] culto online ${c.id} -> ${userIds.length} usuários`);
  }
}

async function lembretesBatismo(sb: SupabaseClient, hoje: string, minutosAgora: number) {
  // Véspera às 18h (janela 18:00–18:09) e dia às 8h (08:00–08:09)
  const casos: { quando: string; janela: [number, number]; chave: string; titulo: string; body: string }[] = [
    {
      quando: dataMaisDias(hoje, 1),
      janela: [18 * 60, 18 * 60 + 9],
      chave: "batismo-vespera",
      titulo: "Amanhã é o seu batismo! 💙",
      body: "Chegue 30 minutos antes, leve roupa de banho e toalha. Estamos te esperando!",
    },
    {
      quando: hoje,
      janela: [8 * 60, 8 * 60 + 9],
      chave: "batismo-dia",
      titulo: "Hoje é o grande dia! 🌊",
      body: "Seu batismo é hoje. Não esqueça a toalha — e faça o check-in no app quando chegar.",
    },
  ];
  for (const caso of casos) {
    if (minutosAgora < caso.janela[0] || minutosAgora > caso.janela[1]) continue;
    const { data: inscricoes } = await sb
      .from("batismo_inscricoes")
      .select("membro_id")
      .eq("data_batismo", caso.quando)
      .in("status", ["pendente", "confirmado"])
      .not("membro_id", "is", null);
    const membroIds: string[] = [];
    for (const i of inscricoes ?? []) {
      if (await deduplicar(sb, `${caso.chave}:${caso.quando}:${i.membro_id}`)) {
        membroIds.push(i.membro_id as string);
      }
    }
    if (!membroIds.length) continue;
    await notificar({ membroIds }, { tipo: "batismo", titulo: caso.titulo, body: caso.body });
    console.log(`[lembretes] ${caso.chave} ${caso.quando} -> ${membroIds.length} membros`);
  }
}

async function lembreteNext(sb: SupabaseClient, hoje: string, minutosAgora: number) {
  // Véspera às 18h (janela 18:00–18:09)
  if (minutosAgora < 18 * 60 || minutosAgora > 18 * 60 + 9) return;
  const amanha = dataMaisDias(hoje, 1);
  const { data: eventos } = await sb
    .from("next_eventos")
    .select("id, titulo")
    .eq("data", amanha)
    .neq("status", "cancelado");
  for (const ev of eventos ?? []) {
    const { data: inscritos } = await sb
      .from("next_inscricoes")
      .select("membro_id")
      .eq("evento_id", ev.id)
      .not("membro_id", "is", null);
    const membroIds: string[] = [];
    for (const i of inscritos ?? []) {
      if (await deduplicar(sb, `next-vespera:${ev.id}:${i.membro_id}`)) {
        membroIds.push(i.membro_id as string);
      }
    }
    if (!membroIds.length) continue;
    await notificar(
      { membroIds },
      {
        tipo: "next",
        titulo: "Amanhã tem NEXT! 💙",
        body: `Seu encontro${ev.titulo ? ` "${ev.titulo}"` : ""} é amanhã. Te esperamos lá!`,
        data: { evento_id: ev.id },
      }
    );
    console.log(`[lembretes] next ${ev.id} -> ${membroIds.length} membros`);
  }
}

async function lembreteDevocional(sb: SupabaseClient, hoje: string, minutosAgora: number) {
  // Dias úteis às 7h30 (janela 07:30–07:39), só se o devocional do dia existe
  // e só pra quem ainda não fez o check-in de hoje.
  const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  if (dow < 1 || dow > 5) return;
  if (minutosAgora < 7 * 60 + 30 || minutosAgora > 7 * 60 + 39) return;

  const { data: item } = await sb
    .from("devocional_itens")
    .select("id, titulo, devocional_planos!inner(ativo)")
    .eq("devocional_planos.ativo", true)
    .eq("data", hoje)
    .limit(1)
    .maybeSingle();
  if (!item) return;
  if (!(await deduplicar(sb, `devocional:${item.id}`))) return;

  // Todos com push, menos quem já leu hoje
  const { data: tokens } = await sb.from("app_push_tokens").select("user_id");
  const todos = [...new Set((tokens ?? []).map((t) => t.user_id as string))];
  const { data: lidos } = await sb
    .from("mem_devocionais")
    .select("membro_id")
    .eq("data_devocional", hoje)
    .eq("tipo", "pessoal");
  const membrosLidos = (lidos ?? []).map((l) => l.membro_id as string);
  let usersLidos: string[] = [];
  if (membrosLidos.length) {
    const { data: profs } = await sb.from("profiles").select("id").in("membro_id", membrosLidos);
    usersLidos = (profs ?? []).map((p) => p.id as string);
  }
  const userIds = todos.filter((u) => !usersLidos.includes(u));
  if (!userIds.length) return;

  await notificar(
    { userIds },
    {
      tipo: "devocional",
      titulo: "Seu devocional de hoje te espera 📖",
      body: `“${item.titulo}” — 5 minutinhos com Deus antes do dia começar.`,
      data: { item_id: item.id },
    }
  );
  console.log(`[lembretes] devocional ${item.id} -> ${userIds.length} usuários`);
}

Deno.serve(async (_req) => {
  try {
    const sb = makeAdmin();
    const { data: hoje, minutos } = agoraBRT();
    await lembreteCultoOnline(sb, hoje, minutos);
    await lembretesBatismo(sb, hoje, minutos);
    await lembreteNext(sb, hoje, minutos);
    await lembreteDevocional(sb, hoje, minutos);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[lembretes] erro:", e);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
});
