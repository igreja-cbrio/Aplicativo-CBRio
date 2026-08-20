// ============================================================================
// Compartilhar o link de inscrição — o membro convidando OUTRA PESSOA.
//
// Pedido do Matheus (20/08/2026): *"nas inscrições, uma funcionalidade para
// compartilhar o link de inscrição. caso uma pessoa queira mandar para outra"*.
//
// ⚠️⚠️ O LINK NUNCA É MONTADO AQUI. Ele vem do servidor — `url` em
// `GET /app/eventos` e `GET /app/inscricoes/portas`, derivado do registro
// canônico de portas. Montar URL no app já produziu um link morto que ficou
// meses no ar (`/apresentacao-criancas`, medido em 11/08/2026), e bundle só se
// conserta por OTA. Aqui só se decide o TEXTO que acompanha o link.
//
// ⚠️ Quem recebe a mensagem NÃO é da igreja e não tem o app. Então o texto diz
// o que é, quando é e onde se inscreve — sem sigla interna e sem assumir
// contexto ("NEXT" sozinho não significa nada pra quem está de fora).
// ============================================================================

/** Tradução; a régua é testada em pt-BR com a identidade. */
type T = (s: string) => string;
const ID: T = (s) => s;

export type ConviteEvento = {
  nome: string;
  /** Já formatado pela tela ("29 ago · 19:00"). Ausente = evento sem data. */
  quando?: string | null;
  local?: string | null;
  /** Link público, vindo do servidor. Sem ele não há convite. */
  url?: string | null;
};

/**
 * Mensagem de convite para um EVENTO.
 * @returns `null` quando não há link — a tela ESCONDE o botão em vez de
 *   compartilhar uma mensagem sem endereço, que é lixo no WhatsApp de alguém.
 */
export function mensagemEvento(ev: ConviteEvento, t: T = ID): string | null {
  const url = (ev?.url || '').trim();
  const nome = (ev?.nome || '').trim();
  if (!url || !nome) return null;

  // O "quando" entra entre parênteses porque é a informação que decide se a
  // pessoa vai — e some quando não existe, em vez de virar "()" ou "sem data".
  const quando = (ev.quando || '').trim();
  const cabeca = quando ? `${nome} (${quando})` : nome;
  return `${t('Vem com a gente na CBRio')}: ${cabeca}. ${t('Inscrições aqui')}: ${url}`;
}

// Convite por porta. Chave = a do catálogo do servidor.
//
// ⚠️ Texto por porta, não um genérico: "Vem se inscrever em Batismo" é o tipo
// de frase que ninguém manda pra um amigo, e o convite é justamente boca a
// boca. Porta que o servidor mandar e não estiver aqui cai no genérico — a
// lista do servidor manda, esta é só a copy.
const CONVITE_PORTA: Record<string, string> = {
  batismo: 'Quer se batizar? Dá uma olhada e se inscreve aqui',
  grupos: 'Vem participar de um grupo de conexão da CBRio',
  next: 'O NEXT é o começo da jornada na CBRio. Se inscreve aqui',
  voluntariado: 'Vem servir com a gente na CBRio',
  apresentacao: 'Quer apresentar seu filho na igreja? É por aqui',
};

export type ConvitePorta = { chave: string; nome: string; url?: string | null };

/** Mensagem de convite para uma PORTA fixa (batismo, grupos, next…). */
export function mensagemPorta(porta: ConvitePorta, t: T = ID): string | null {
  const url = (porta?.url || '').trim();
  if (!url) return null;
  const copy = CONVITE_PORTA[porta.chave];
  // Sem copy específica, o nome que o SERVIDOR mandou é a fonte — nunca uma
  // string inventada aqui, que discordaria da tela.
  const texto = copy ? t(copy) : `${t('Se inscreve aqui')} — ${porta.nome}`;
  return `${texto}: ${url}`;
}

export { CONVITE_PORTA };
