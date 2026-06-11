import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

/**
 * Teste de carga do CBRio — cenário "abertura no culto" (fluxo completo).
 *
 * Cada VU (usuário virtual) faz:
 *   1) Login (Supabase Auth, grant_type=password)
 *   2) Home: destaques + próximos cultos + perfil + membro + contagem de não-lidas
 *   3) Navegação: voluntariado (vol_inscricoes + flag) + lista de notificações
 *   4) Ação: marca a 1ª notificação não-lida como lida (write)
 *
 * Aponte SEMPRE para um projeto de STAGING (variáveis de ambiente):
 *   SUPABASE_URL, SUPABASE_ANON_KEY  (obrigatórios)
 *   TEST_EMAIL_TPL  (default "loadtest+%d@cbrio.test")
 *   TEST_PASSWORD   (default "LoadTest2026!")
 *   USERS           (qtde de usuários semeados; default 2000)
 *
 * Rodar:
 *   k6 run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... loadtest/cbrio-fullflow.js
 */

const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON = __ENV.SUPABASE_ANON_KEY;
const EMAIL_TPL = __ENV.TEST_EMAIL_TPL || "loadtest+%d@cbrio.test";
const PASSWORD = __ENV.TEST_PASSWORD || "LoadTest2026!";
const USERS = parseInt(__ENV.USERS || "2000", 10);

if (!SUPABASE_URL || !ANON) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_ANON_KEY (-e ...).");
}

// ── métricas custom ──────────────────────────────────────────────
const loginTrend = new Trend("cbrio_login_ms", true);
const homeTrend = new Trend("cbrio_home_ms", true);
const loginErr = new Rate("cbrio_login_errors");
const queryErr = new Rate("cbrio_query_errors");
const flows = new Counter("cbrio_flows_ok");

// ── perfil de carga: ramp gradual até 2000 e sustenta ────────────
export const options = {
  scenarios: {
    culto: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 250 },   // aquecimento
        { duration: "2m", target: 1000 },  // sobe
        { duration: "2m", target: 2000 },  // pico alvo
        { duration: "3m", target: 2000 },  // sustenta o pico
        { duration: "1m", target: 0 },     // desaquece
      ],
      gracefulStop: "30s",
    },
  },
  thresholds: {
    // metas de saúde — ajuste conforme o esperado do plano Supabase
    cbrio_login_errors: ["rate<0.02"],
    cbrio_query_errors: ["rate<0.02"],
    http_req_duration: ["p(95)<2500"],
    cbrio_home_ms: ["p(95)<3000"],
  },
};

const rest = `${SUPABASE_URL}/rest/v1`;
const auth = `${SUPABASE_URL}/auth/v1`;

function fmtEmail(n) {
  return EMAIL_TPL.replace("%d", String(n));
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// Token por VU (cada VU é um runtime JS isolado no k6). Cada usuário virtual
// LOGA UMA VEZ e reusa a sessão — espelha o real: ninguém digita senha a cada
// abertura. Assim o teste estressa o caminho de LEITURA, não um flood de auth.
let vuToken = null;
let vuEmail = null;

function loginUmaVez() {
  if (vuToken) return vuToken;
  // pequeno jitter pra não sincronizar todos os logins no mesmo instante
  sleep(Math.random() * 2);
  vuEmail = fmtEmail((__VU - 1) % USERS);
  for (let tent = 0; tent < 5; tent++) {
    const res = http.post(
      `${auth}/token?grant_type=password`,
      JSON.stringify({ email: vuEmail, password: PASSWORD }),
      { headers: { apikey: ANON, "Content-Type": "application/json" }, tags: { step: "login" } }
    );
    loginTrend.add(res.timings.duration);
    if (res.status === 200) {
      try {
        vuToken = JSON.parse(res.body).access_token;
        loginErr.add(false);
        return vuToken;
      } catch (_e) {
        /* segue tentando */
      }
    }
    // 429 (rate limit): backoff e tenta de novo
    sleep(2 + Math.random() * 3);
  }
  loginErr.add(true);
  return null;
}

export default function () {
  const token = loginUmaVez();
  if (!token) {
    sleep(3);
    return;
  }

  const h = {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  let membroId = null;

  group("2-home", () => {
    const t0 = Date.now();
    const hoje = new Date();
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 7);

    const reqs = {
      destaques: {
        method: "GET",
        url: `${rest}/app_destaques?select=id,titulo,subtitulo,imagem_url,link,ordem&order=ordem.asc&limit=8`,
        params: { headers: h, tags: { step: "destaques" } },
      },
      cultos: {
        method: "GET",
        url: `${rest}/cultos?select=id,nome,data,hora,vol_service_types(color,has_online_stream,has_kids)&data=gte.${isoDate(hoje)}&data=lte.${isoDate(limite)}&deleted_at=is.null&order=data.asc&order=hora.asc`,
        params: { headers: h, tags: { step: "cultos" } },
      },
      perfil: {
        method: "GET",
        url: `${rest}/profiles?select=name,email,telefone,membro_id,avatar_url`,
        params: { headers: h, tags: { step: "perfil" } },
      },
      naoLidas: {
        method: "GET",
        url: `${rest}/app_notificacoes?select=id&lida_em=is.null`,
        params: {
          headers: Object.assign({ Prefer: "count=exact" }, h),
          tags: { step: "naoLidas" },
        },
      },
    };
    const res = http.batch(reqs);
    homeTrend.add(Date.now() - t0);
    for (const k in res) {
      queryErr.add(!check(res[k], { [`${k} ok`]: (r) => r.status === 200 }));
    }
    try {
      const prof = JSON.parse(res.perfil.body);
      if (prof && prof[0]) membroId = prof[0].membro_id;
    } catch (_e) {
      /* ignore */
    }
    // segunda chamada: ficha do membro (depende do membro_id)
    if (membroId) {
      const m = http.get(
        `${rest}/mem_membros?select=nome,cpf,email,telefone,data_nascimento,voluntario,foto_url&id=eq.${membroId}`,
        { headers: h, tags: { step: "membro" } }
      );
      queryErr.add(!check(m, { "membro ok": (r) => r.status === 200 }));
    }
  });

  sleep(Math.random() * 2 + 1); // usuário lendo a home

  group("3-navega", () => {
    if (membroId) {
      const v = http.get(
        `${rest}/vol_inscricoes?select=id,status,area,ministerios_interesse,integrado_em&membro_id=eq.${membroId}&order=created_at.desc&limit=1`,
        { headers: h, tags: { step: "voluntariado" } }
      );
      queryErr.add(!check(v, { "voluntariado ok": (r) => r.status === 200 }));
    }
    const n = http.get(
      `${rest}/app_notificacoes?select=*&order=criada_em.desc&limit=100`,
      { headers: h, tags: { step: "notificacoes" } }
    );
    queryErr.add(!check(n, { "notificacoes ok": (r) => r.status === 200 }));
  });

  sleep(Math.random() * 2 + 1);

  group("4-acao", () => {
    // marca 1 notificação não-lida como lida (write leve)
    const upd = http.patch(
      `${rest}/app_notificacoes?lida_em=is.null&limit=1`,
      JSON.stringify({ lida_em: new Date().toISOString() }),
      {
        headers: Object.assign(
          { "Content-Type": "application/json", Prefer: "return=minimal" },
          h
        ),
        tags: { step: "marcar_lida" },
      }
    );
    // 200/204 ok; 404 (nenhuma não-lida) também é aceitável
    queryErr.add(
      !check(upd, { "marcar_lida ok": (r) => [200, 204, 404].includes(r.status) })
    );
  });

  flows.add(1);
  sleep(Math.random() * 3 + 2);
}
