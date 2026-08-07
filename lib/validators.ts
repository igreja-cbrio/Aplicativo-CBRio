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

/** Valida uma data no formato DD/MM/AAAA (existente, não futura, ano >= 1900). */
export function isValidDateBR(value: string) {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const day = +m[1];
  const month = +m[2];
  const year = +m[3];
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return false;
  return date.getTime() <= Date.now();
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
