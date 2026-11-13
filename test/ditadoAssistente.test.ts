import { afterEach, expect, it, vi } from 'vitest';
import { criarDitado, type MotorDitado } from '../lib/ditadoAssistente';
afterEach(() => vi.useRealTimers());
function fixture(missing = false) {
  vi.useFakeTimers();
  const listeners: Record<string, (e: any) => void> = {};
  const motor: MotorDitado = { requestPermissionsAsync: vi.fn(async () => ({ granted: true })), isRecognitionAvailable: () => true,
    start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    addListener: (event, cb) => { listeners[event] = cb; return { remove: vi.fn() }; },
  };
  const callbacks = { texto: vi.fn(), estado: vi.fn(), erro: vi.fn() };
  return { motor, callbacks, listeners, controle: criarDitado(missing ? null : motor, callbacks) };
}
it('binário antigo continua seguro e informa atualização', async () => {
  const f = fixture(true); await f.controle.iniciar('', 'pt-BR');
  expect(f.callbacks.erro).toHaveBeenCalledWith('atualizar'); expect(f.motor.start).not.toHaveBeenCalled();
});
it('resultados parciais substituem a fala anterior, preservam base, não concatenam duplicatas', async () => {
  const f = fixture(); await f.controle.iniciar('Bom dia', 'pt-BR');
  f.listeners.result({ results: [{ transcript: 'preciso' }] });
  f.listeners.result({ results: [{ transcript: 'preciso de ajuda' }], isFinal: true });
  expect(f.callbacks.texto.mock.calls.map(x => x[0])).toEqual(['Bom dia preciso', 'Bom dia preciso de ajuda']);
  f.controle.parar(); expect(f.motor.stop).toHaveBeenCalled();
  f.listeners.end(null); expect(f.callbacks.estado).toHaveBeenLastCalledWith('parado');
});
it('cancelar restaura rascunho e ignora eventos atrasados de outra sessão', async () => {
  const f = fixture(); await f.controle.iniciar('Antes', 'pt-BR'); const antigo = f.listeners.result;
  f.controle.cancelar(true); f.listeners.end(null); await f.controle.iniciar('Novo', 'pt-BR');
  antigo({ results: [{ transcript: 'mensagem antiga' }] });
  expect(f.callbacks.texto).toHaveBeenLastCalledWith('Antes');
  f.listeners.result({ results: [{ transcript: 'agora' }] }); expect(f.callbacks.texto).toHaveBeenLastCalledWith('Novo agora');
});
it('sair durante pedido de permissão impede ligar o microfone depois', async () => {
  const f = fixture(); let resolver!: (p: { granted: boolean }) => void;
  f.motor.requestPermissionsAsync = () => new Promise(r => { resolver = r; });
  const inicio = f.controle.iniciar('', 'pt-BR'); f.controle.cancelar(); resolver({ granted: true }); await inicio;
  expect(f.motor.start).not.toHaveBeenCalled();
});
it('permissão negada não inicia captura', async () => {
  const f = fixture(); f.motor.requestPermissionsAsync = async () => ({ granted: false });
  await f.controle.iniciar('', 'pt-BR'); expect(f.motor.start).not.toHaveBeenCalled(); expect(f.callbacks.erro).toHaveBeenCalledWith('permissao');
});
it('limite de texto e término por tempo preservam rascunho, sem captura indefinida', async () => {
  const f = fixture(); await f.controle.iniciar('', 'pt-BR'); f.listeners.result({ results: [{ transcript: 'a'.repeat(2000) }] });
  expect(f.callbacks.texto.mock.calls[0][0]).toHaveLength(1000);
  vi.advanceTimersByTime(60000); expect(f.motor.abort).toHaveBeenCalled(); expect(f.callbacks.estado).toHaveBeenLastCalledWith('finalizando'); f.listeners.end(null); expect(f.callbacks.estado).toHaveBeenLastCalledWith('parado');
});

it('espera end global do cancelamento, inclusive em outro controlador/tela', async () => {
  const f = fixture(); await f.controle.iniciar('', 'pt-BR'); f.controle.cancelar();
  const cb = { texto: vi.fn(), estado: vi.fn(), erro: vi.fn() };
  const novo = criarDitado(f.motor, cb); await novo.iniciar('', 'pt-BR');
  expect(cb.erro).toHaveBeenCalledWith('indisponivel'); expect(f.motor.start).toHaveBeenCalledTimes(1);
  f.listeners.result({ results: [{ transcript: 'resultado atrasado' }] });
  f.listeners.error({ error: 'aborted' }); expect(cb.texto).not.toHaveBeenCalled();
  f.listeners.end(null); await novo.iniciar('', 'pt-BR');
  expect(f.motor.start).toHaveBeenCalledTimes(2);
  f.listeners.result({ results: [{ transcript: 'nova fala' }] }); expect(cb.texto).toHaveBeenCalledWith('nova fala');
});

it('blur mais unmount abortam uma única vez e timeout libera só a interface', async () => {
  const f = fixture(); await f.controle.iniciar('', 'pt-BR');
  f.controle.cancelar(); f.controle.cancelar(); expect(f.motor.abort).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(5000); expect(f.callbacks.estado).toHaveBeenLastCalledWith('parado');
  await f.controle.iniciar('', 'pt-BR'); expect(f.motor.start).toHaveBeenCalledTimes(1);
  expect(f.callbacks.erro).toHaveBeenLastCalledWith('indisponivel');
  f.listeners.end(null); await f.controle.iniciar('', 'pt-BR'); expect(f.motor.start).toHaveBeenCalledTimes(2);
});
