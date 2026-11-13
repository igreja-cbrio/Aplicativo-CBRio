import { describe, expect, it } from 'vitest';
import { criarCicloChat, persistirChat } from '@/lib/assistenteChatCiclo';

describe('troca de conversa durante requisições', () => {
  it('descarta retorno antigo e não libera a consulta da conversa nova', async () => {
    const ciclo = criarCicloChat();
    const antes = ciclo.atual();
    const consultaAntiga = ciclo.iniciarConsulta()!;
    let concluir!: () => void;
    const lenta = new Promise<void>(r => { concluir = r; });
    const aplicadas: string[] = [];
    const respostaAntiga = lenta.then(() => {
      if (ciclo.vigente(antes)) aplicadas.push('antiga');
      ciclo.terminarConsulta(consultaAntiga);
    });
    ciclo.reiniciar();
    const consultaNova = ciclo.iniciarConsulta()!;
    concluir();
    await respostaAntiga;
    expect(aplicadas).toEqual([]);
    expect(ciclo.iniciarConsulta()).toBeNull();
    ciclo.terminarConsulta(consultaNova);
    expect(ciclo.iniciarConsulta()).not.toBeNull();
  });

  it('remoção e restauração aguardam gravação antiga e falha não trava a fila', async () => {
    let concluir!: () => void;
    const lenta = new Promise<void>(r => { concluir = r; });
    let salvo: string | null = null;
    const gravacao = persistirChat(async () => { await lenta; salvo = 'antiga'; });
    const remocao = persistirChat(async () => { salvo = null; });
    const leitura = persistirChat(async () => salvo);
    concluir();
    await Promise.all([gravacao, remocao]);
    expect(await leitura).toBeNull();
    await expect(persistirChat(async () => { throw new Error('disco'); })).rejects.toThrow('disco');
    expect(await persistirChat(async () => 'nova')).toBe('nova');
  });
});
