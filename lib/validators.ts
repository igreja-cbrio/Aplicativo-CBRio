// Máscaras e validações de formulário (pt-BR).

/** Só os dígitos de uma string. */
export const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** Aplica a máscara de CPF: 000.000.000-00 */
export function maskCPF(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}

/** Valida CPF pelos dígitos verificadores. */
export function isValidCPF(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais

  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(cpf[i], 10) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(9) === parseInt(cpf[9], 10) && calc(10) === parseInt(cpf[10], 10);
}

/** Aplica a máscara de data: DD/MM/AAAA */
export function maskDateBR(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/**
 * A data EXISTE no calendário? (DD/MM/AAAA, ano >= 1900, 31/02 recusado.)
 *
 * ⚠️ NÃO tem regra de passado/futuro — quem decide isso é quem chama, porque a
 * resposta depende do campo: nascimento não pode ser futuro, e data de
 * indisponibilidade é futura por definição.
 */
export function isDataCalendarioBR(value: string) {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const day = +m[1];
  const month = +m[2];
  const year = +m[3];
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Roundtrip pelo Date LOCAL (nunca `new Date("YYYY-MM-DD")`, que é UTC e em
  // fuso negativo volta um dia): é o que recusa 31/02 e 29/02 fora do bissexto.
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Data de NASCIMENTO em DD/MM/AAAA: existe no calendário **e não é futura**.
 *
 * ⚠️⚠️ O nome é genérico por histórico, mas a régua é de NASCIMENTO — e isso já
 * custou uma tela: `Disponibilidade.tsx` usava esta função pras datas em que o
 * voluntário NÃO PODE servir, que são futuras por definição, então **toda data
 * digitada ali era recusada** ("Data de início inválida"). Ninguém nunca
 * conseguiu bloquear uma data — era a 2ª razão, independente da RLS, de a
 * feature nunca ter funcionado.
 *
 * Chamadores legítimos (todos data de nascimento): cadastro, perfil,
 * inscrição de batismo, vínculo do Kids e `nascimentoBRParaISO`.
 * ⚠️ Campo que aceita futuro usa `isDataCalendarioBR` + a própria regra.
 */
export function isValidDateBR(value: string) {
  if (!isDataCalendarioBR(value)) return false;
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)!;
  return new Date(+m[3], +m[2] - 1, +m[1]).getTime() <= Date.now();
}

/** Converte DD/MM/AAAA -> AAAA-MM-DD (ISO, para o banco). */
export function dateBRToISO(value: string) {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Nascimento em DD/MM/AAAA → ISO (YYYY-MM-DD) **válido**, ou `null`.
 *
 * ⚠️ Existe porque `/completar-cadastro` — a porta que TODO mundo atravessa pra
 * entrar no app — tinha a própria versão, mais fraca: aceitava **31/02** (só
 * conferia dia 1..31, não o calendário real). A pessoa digitava, enviava, e só
 * o SERVIDOR recusava, com um 400 seco. Régua de campo vive aqui, no `lib/`,
 * pra entrar no portão — nunca dentro do `.tsx`.
 *
 * ⚠️ SEM `new Date("YYYY-MM-DD")` na conversão: essa forma é interpretada em UTC
 * e, em fuso negativo, volta um dia (a armadilha da faixa etária). A comparação
 * com hoje é de STRING ISO, que é segura.
 *
 * @param hoje `YYYY-MM-DD` injetável — o teste não pode depender do relógio.
 */
export function nascimentoBRParaISO(br: string, hoje?: string): string | null {
  if (!isValidDateBR(br)) return null;
  const iso = dateBRToISO(br);
  if (!iso) return null;
  const limite = hoje || (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();
  // Nascimento no futuro não existe.
  if (iso > limite) return null;
  return iso;
}

export type ErroJanela =
  | "de_invalida"
  | "ate_invalida"
  | "fim_antes_do_inicio"
  | "janela_passada";

export type JanelaIndisponibilidade =
  | { ok: true; de: string; ate: string }
  | { ok: false; erro: ErroJanela };

/**
 * Janela de indisponibilidade do voluntário (as datas em que ele NÃO pode
 * servir) → ISO, ou o motivo da recusa.
 *
 * ⚠️ Aqui data futura é o caso NORMAL — foi usar a régua de nascimento
 * (`isValidDateBR`) que fazia a tela recusar 09/08/2026 e 20/10/2026.
 *
 * ⚠️ O corte é pelo FIM, não pelo início: viagem que começou ontem e termina
 * semana que vem é bloqueio legítimo, e é a escala futura que ela protege.
 * Janela que já TERMINOU não é recusada por rigor — é que `listarIndisponibilidades`
 * só exibe `unavailable_to >= hoje`, então ela sumiria da lista assim que
 * salvasse, e "salvei e desapareceu" se lê como perda de dado.
 *
 * @param hoje `YYYY-MM-DD` **em BRT** (`hojeBRT()` de `lib/dataBRT`), injetável
 *   porque teste não pode depender do relógio da máquina. ⚠️ NÃO passar
 *   `toISOString().slice(0,10)`: das 21h do Rio em diante o dia UTC já virou e
 *   a pessoa perderia o direito de bloquear o dia de hoje.
 */
export function janelaIndisponibilidadeBR(
  de: string,
  ate: string,
  hoje: string,
): JanelaIndisponibilidade {
  if (!isDataCalendarioBR(de)) return { ok: false, erro: "de_invalida" };
  if (!isDataCalendarioBR(ate)) return { ok: false, erro: "ate_invalida" };
  const isoDe = dateBRToISO(de);
  const isoAte = dateBRToISO(ate);
  if (!isoDe || !isoAte) return { ok: false, erro: "de_invalida" };
  if (isoAte < isoDe) return { ok: false, erro: "fim_antes_do_inicio" };
  if (isoAte < hoje) return { ok: false, erro: "janela_passada" };
  return { ok: true, de: isoDe, ate: isoAte };
}
