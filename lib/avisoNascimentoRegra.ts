// AVISO "CONFIRME SEU NASCIMENTO" POR CIMA DA HOME (27/11/2026 · Fase 3 da entrada).
//
// Quem já está dentro do app e tem o nascimento marcado como suspeito no
// cadastro da igreja (ano 2000 do calendário antigo, ou data impossível) vê um
// aviso por cima da Home. Decisão do Marcos (26/11): nada de tela bloqueante; a
// pessoa pode recusar, e o aviso volta a aparecer até ela preencher.
//
// Quem diz que a data é suspeita é o SERVIDOR (`nascimento_suspeito` no
// `/app/identidade/status`); a marca cai quando a pessoa confirma
// (`POST /app/identidade/nascimento`). Aqui só mora quando mostrar e a
// conferência da data antes de enviar.
//
// Régua PURA (sem React, sem rede, sem relógio escondido).

import { dateBRToISO, isValidDateBR } from "./validators";

// Mesmos limites de `conferirConfirmacaoNascimento` no ERP
// (`backend/utils/appVinculoRegra.js`): ano a partir de 1920 e 13 anos feitos.
export const ANO_MINIMO_NASCIMENTO = 1920;
export const IDADE_MINIMA_NASCIMENTO = 13;

// "Agora não" vale por este tempo; depois o aviso volta. Fechar e abrir o app
// também traz o aviso de volta (a dispensa fica só em memória).
export const DISPENSA_MS = 12 * 60 * 60 * 1000;

const dispensas = new Map<string, number>();

export function dispensarAvisoNascimento(userId: string, agora: number = Date.now()) {
  dispensas.set(userId, agora);
}

export function avisoNascimentoDispensado(userId: string, agora: number = Date.now()): boolean {
  const em = dispensas.get(userId);
  return em != null && agora - em < DISPENSA_MS;
}

/** Só para o teste e para a troca de conta. */
export function limparDispensasNascimento() {
  dispensas.clear();
}

/**
 * O aviso só entra com a Home parada: depois do portão do cadastro, do convite
 * de notificações e do tutorial, para nunca haver dois avisos ao mesmo tempo.
 */
export function podeMostrarAvisoNascimento(input: {
  suspeito: boolean;
  confirmado: boolean;
  dispensado: boolean;
  cadastroReady: boolean;
  tutorialReady: boolean;
  tutorialPending: boolean;
  pushReady: boolean;
  home: boolean;
  active: boolean;
  menuOpen: boolean;
}): boolean {
  return input.suspeito && !input.confirmado && !input.dispensado
    && input.cadastroReady && input.tutorialReady && !input.tutorialPending && input.pushReady
    && input.home && input.active && !input.menuOpen;
}

export type NascimentoConferido = { ok: true; iso: string } | { ok: false; erro: string };

/**
 * DD/MM/AAAA → ISO pronto para o servidor, ou a chave de tradução do erro.
 * ⚠️ Data que não existe (31/02) tem de parar AQUI: o servidor só confere o
 * formato e a idade, e o banco recusaria com erro 500.
 * @param hojeISO `YYYY-MM-DD` do dia da igreja (injetado; o teste não usa relógio).
 */
export function conferirNascimentoDigitado(br: string, hojeISO: string): NascimentoConferido {
  const invalida: NascimentoConferido = { ok: false, erro: "Confira a data de nascimento (dia, mês e ano com 4 números)." };
  if (!br || br.length < 10 || !isValidDateBR(br, hojeISO)) return invalida;
  const iso = dateBRToISO(br);
  if (!iso || iso > hojeISO) return invalida;
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (ano < ANO_MINIMO_NASCIMENTO) return invalida;
  const [anoHoje, mesHoje, diaHoje] = hojeISO.split("-").map(Number);
  let idade = anoHoje - ano;
  if (mesHoje < mes || (mesHoje === mes && diaHoje < dia)) idade -= 1;
  if (idade < IDADE_MINIMA_NASCIMENTO) {
    return { ok: false, erro: "Informe a sua data de nascimento, não a de um filho." };
  }
  return { ok: true, iso };
}

/** Chave de tradução para o erro do servidor. Nunca o texto cru. */
export function mensagemErroNascimento(e: unknown): string {
  const err = (e && typeof e === "object" ? e : {}) as { status?: unknown; corpo?: { codigo?: unknown } | null };
  const codigo = typeof err.corpo?.codigo === "string" ? err.corpo.codigo : "";
  if (codigo === "nascimento_invalido") return "Confira a data de nascimento (dia, mês e ano com 4 números).";
  if (typeof err.status !== "number") return "Sem conexão com a internet agora. Confira a rede e tente de novo.";
  return "Não foi possível salvar agora. Tente de novo mais tarde.";
}

/** O servidor diz que não há mais o que confirmar: o aviso some sem erro. */
export function nascimentoJaResolvido(e: unknown): boolean {
  const err = (e && typeof e === "object" ? e : {}) as { corpo?: { codigo?: unknown } | null };
  return err.corpo?.codigo === "nascimento_ja_confirmado";
}

/** Só o enum vai para a telemetria. */
export function motivoErroNascimento(e: unknown): string {
  const err = (e && typeof e === "object" ? e : {}) as { status?: unknown; corpo?: { codigo?: unknown } | null };
  if (typeof err.corpo?.codigo === "string" && err.corpo.codigo) return err.corpo.codigo;
  return typeof err.status === "number" ? "erro" : "rede";
}
