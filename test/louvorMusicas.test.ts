import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { linkMusicaSeguro } from '../lib/louvorMusicas';
describe('link de repertório',()=>{
  it('não abre esquemas arbitrários nem credenciais',()=>{
    for(const v of [null,'','javascript:alert(1)','file:///a','intent://x','ftp://x','https://u:p@x','texto']) expect(linkMusicaSeguro(v)).toBeNull();
    expect(linkMusicaSeguro('https://youtu.be/x')).toBe('https://youtu.be/x');
    expect(linkMusicaSeguro('http://example.com')).toBe('http://example.com');
  });
  it('tela usa permissão do servidor, mostra culto e mantém formulário na rolagem da tela',()=>{
    const s=readFileSync('components/voluntariado/MusicasCulto.tsx','utf8');
    expect(s).toContain('culto.pode_editar');
    expect(s).toContain('service_id: cultoId');
    expect(s).toContain('useFocusEffect');
    expect(s).toContain('dlg.confirmar');
    expect(s).toContain('trava.current = true');
    expect(s).not.toContain('<Modal');
    expect(s).not.toContain('Alert.alert');
    expect(s).not.toContain('cleiton');
    // 25/11/2026 · pedido do Marcos: o card ficou grande demais na aba Servir e saiu
    // dela. As músicas do culto agora moram na liturgia (catálogo do Planning Center).
    expect(readFileSync('app/(app)/(principal)/voluntariado.tsx','utf8')).not.toContain('<MusicasCulto');
  });
});
