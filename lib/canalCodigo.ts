// POR ONDE CHEGA O CÓDIGO: e-mail ou WhatsApp (27/11/2026).
//
// Decisão do Marcos: quem diz "já sou cadastrado" confirma por e-mail OU pelo
// WhatsApp do cadastro; quem não tem e-mail no cadastro, só pelo WhatsApp. Quem
// decide quais canais valem é o SERVIDOR (`canais` na resposta do CPF): ele sabe
// se o cadastro tem e-mail, se o número é só daquela pessoa e se o envio por
// WhatsApp já está liberado. O app só escolhe a tela.
//
// A primeira chamada vai com `consultar: true`: lista os canais sem enviar nada.
// Servidor antigo ignora o `consultar`, envia o e-mail e já devolve
// `verificacao_id`; por isso esse caso vem PRIMEIRO na régua.
//
// Régua PURA (sem React, sem rede).

export type CanalCodigo = "email" | "whatsapp";
export type OpcaoCanal = { canal: CanalCodigo; destino_mascarado: string | null };

type RespostaCpf = {
  encontrado: boolean;
  pode_confirmar?: boolean;
  verificacao_id?: string;
  canais?: unknown;
};

export type PassoDoCpf =
  | { tipo: "codigo" } // o código já saiu: pedir os 6 números
  | { tipo: "pedir"; canal: CanalCodigo } // um canal só: pede o código sem perguntar
  | { tipo: "escolher"; canais: OpcaoCanal[] } // dois canais: a pessoa escolhe
  | { tipo: "sem_caminho" }; // não achou, ou achou sem contato que sirva de prova

export function opcoesDeCanal(bruto: unknown): OpcaoCanal[] {
  if (!Array.isArray(bruto)) return [];
  const vistas = new Set<string>();
  const saida: OpcaoCanal[] = [];
  for (const item of bruto) {
    const canal = (item as { canal?: unknown })?.canal;
    if ((canal !== "email" && canal !== "whatsapp") || vistas.has(canal)) continue;
    vistas.add(canal);
    const destino = (item as { destino_mascarado?: unknown }).destino_mascarado;
    saida.push({ canal, destino_mascarado: typeof destino === "string" && destino ? destino : null });
  }
  return saida;
}

export function passoDepoisDoCpf(r: RespostaCpf): PassoDoCpf {
  if (!r.encontrado || !r.pode_confirmar) return { tipo: "sem_caminho" };
  if (r.verificacao_id) return { tipo: "codigo" };
  const canais = opcoesDeCanal(r.canais);
  if (canais.length === 1) return { tipo: "pedir", canal: canais[0].canal };
  if (canais.length > 1) return { tipo: "escolher", canais };
  return { tipo: "sem_caminho" };
}
