/** Ditado só atualiza o rascunho; não existe operação de envio neste controlador. */
export type MotorDitado = {
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  isRecognitionAvailable(): boolean;
  start(options: { lang: string; interimResults: boolean; continuous: boolean }): void;
  stop(): void; abort(): void;
  addListener(event: string, callback: (event: any) => void): { remove(): void };
};
export type EstadoDitado = 'parado' | 'permissao' | 'ouvindo' | 'finalizando';
// O emissor nativo é global. Uma tela nova também espera o end da anterior.
const ocupados = new WeakSet<MotorDitado>();
export function criarDitado(motor: MotorDitado | null, callbacks: {
  texto: (value: string) => void; estado: (value: EstadoDitado) => void;
  erro: (value: 'atualizar' | 'permissao' | 'indisponivel' | 'falha' | 'silencio') => void;
}) {
  let geracao = 0, ativo = false, nativo = false, aceitar = false, base = '';
  let ouvintes: { remove(): void }[] = [];
  let prazo: ReturnType<typeof setTimeout> | undefined;
  function concluir() {
    geracao++; ativo = false; nativo = false; aceitar = false;
    ouvintes.forEach(s => s.remove()); ouvintes = []; clearTimeout(prazo);
    if (motor) ocupados.delete(motor);
    callbacks.estado('parado');
  }
  function cancelar(restaurar = false) {
    if (!ativo) return;
    aceitar = false;
    if (restaurar) callbacks.texto(base);
    if (!nativo) { concluir(); return; }
    callbacks.estado('finalizando'); clearTimeout(prazo);
    // Não libera uma nova sessão antes de end: abort é assíncrono em iOS/Android.
    try { motor?.abort(); } catch { callbacks.erro('falha'); }
    prazo = setTimeout(() => callbacks.erro('indisponivel'), 5000);
  }
  async function iniciar(texto: string, idioma: string) {
    if (ativo) return;
    if (!motor) { callbacks.erro('atualizar'); return; }
    if (ocupados.has(motor)) { callbacks.erro('indisponivel'); return; }
    try { if (!motor.isRecognitionAvailable()) { callbacks.erro('indisponivel'); return; } }
    catch { callbacks.erro('indisponivel'); return; }
    const atual = ++geracao; ativo = true; base = texto; ocupados.add(motor);
    callbacks.estado('permissao');
    try {
      const permissao = await motor.requestPermissionsAsync();
      if (atual !== geracao) return;
      if (!permissao.granted) { concluir(); callbacks.erro('permissao'); return; }
      const ouvir = (nome: string, cb: (e: any) => void) => {
        ouvintes.push(motor.addListener(nome, e => { if (atual === geracao && ativo) cb(e); }));
      };
      ouvir('result', e => {
        if (!aceitar) return;
        const fala = e.results?.[0]?.transcript;
        if (typeof fala === 'string') callbacks.texto([base.trim(), fala.trim()].filter(Boolean).join(' ').slice(0, 1000));
      });
      ouvir('end', concluir);
      ouvir('error', e => {
        if (!aceitar) return;
        aceitar = false; callbacks.estado('finalizando');
        if (e.error !== 'aborted') callbacks.erro(e.error === 'no-speech' || e.error === 'speech-timeout' ? 'silencio' : 'falha');
      });
      nativo = true; aceitar = true;
      motor.start({ lang: idioma, interimResults: true, continuous: false });
      callbacks.estado('ouvindo');
      prazo = setTimeout(() => cancelar(), 60000);
    } catch { if (atual === geracao) { concluir(); callbacks.erro('falha'); } }
  }
  function parar() {
    if (!ativo || !nativo) return;
    callbacks.estado('finalizando');
    try { motor?.stop(); } catch { cancelar(); return; }
    clearTimeout(prazo); prazo = setTimeout(() => cancelar(), 4000);
  }
  return { iniciar, parar, cancelar };
}
