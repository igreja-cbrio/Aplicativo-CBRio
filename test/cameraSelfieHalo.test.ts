import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ capture: vi.fn(), remove: vi.fn(), photo: vi.fn(), error: vi.fn(), cameraAvailable: true, state: { currentState: 'active', addEventListener: vi.fn() }, callback: (_s: string) => {} }));
vi.mock('react-native', () => ({ AppState: m.state, Pressable: 'Pressable', Text: 'Text', StyleSheet: { create: (s: unknown) => s, absoluteFill: {} } }));
vi.mock('expo-file-system/legacy', () => ({ deleteAsync: m.remove }));
vi.mock('../components/batismo/HaloBuscaFacial', () => ({ HaloBuscaFacial: ({camera,children,...props}: any) => React.createElement('Halo', props, camera, children) }));
vi.mock('../lib/cameraSelfieNativa', () => ({ carregarCameraSelfie: () => m.cameraAvailable ? { CameraView: 'Camera' } : null }));
import { CameraSelfieHalo } from '../components/batismo/CameraSelfieHalo';
let tree: ReactTestRenderer | undefined;
const props = {colors:{background:'#fff',text:'#000',textMuted:'#555',primary:'#006655',surfaceAlt:'#eee',border:'#ccc'},t:(s:string)=>s,onSelfie:m.photo,onErro:m.error};
const button = () => tree!.root.findByType('Pressable' as any);
const camera = () => tree!.root.findByType('Camera' as any);
async function montar(strict = false) { await act(async () => { const elemento = React.createElement(CameraSelfieHalo, props); tree = create(strict ? React.createElement(React.StrictMode, null, elemento) : elemento, { createNodeMock: e => e.type === ('Camera' as any) ? { takePictureAsync: m.capture } : null }); }); }
async function ready() { await act(async () => camera().props.onCameraReady()); }
async function state(s: string) { await act(async () => { m.state.currentState = s; m.callback(s); }); }
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); m.state.currentState = 'active'; m.cameraAvailable = true; m.state.addEventListener.mockImplementation((_event, callback) => { m.callback = callback; return { remove: vi.fn() }; }); m.remove.mockResolvedValue(undefined); m.capture.mockResolvedValue({uri:'cache/Camera/selfie.jpg',base64:'YQ=='}); });
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.useRealTimers(); });
it('espera a câmera pronta, captura de frente e limpa antes de entregar a selfie', async () => {
 await montar(); expect(camera().props.facing).toBe('front'); expect(button().props.disabled).toBe(true);
 await act(async () => button().props.onPress()); expect(m.capture).not.toHaveBeenCalled();
 await ready(); expect(button().props.disabled).toBe(false);
 await act(async () => button().props.onPress());
 expect(m.capture).toHaveBeenCalledWith(expect.objectContaining({base64:true,exif:false}));
 expect(m.remove).toHaveBeenCalledWith('cache/Camera/selfie.jpg',{idempotent:true});
 expect(m.photo).toHaveBeenCalledWith('data:image/jpeg;base64,YQ==');
 expect(m.remove.mock.invocationCallOrder[0]).toBeLessThan(m.photo.mock.invocationCallOrder[0]);
});
it.each(['background','unmount'])('captura atrasada é descartada e limpa depois de %s', async motivo => {
 let resolver!: (foto: any) => void; m.capture.mockImplementation(() => new Promise(r => {resolver=r;}));
 await montar(); await ready();
 let captura!: Promise<void>;
 await act(async () => { captura = button().props.onPress(); button().props.onPress(); });
 expect(m.capture).toHaveBeenCalledOnce();
 if(motivo==='background') { await state('background'); expect(tree!.root.findAllByType('Camera' as any)).toHaveLength(0); await state('active'); expect(button().props.disabled).toBe(true); }
 else { await act(async()=>tree!.unmount()); tree=undefined; }
 await act(async () => { resolver({uri:'cache/Camera/selfie.jpg',base64:'YQ=='}); await captura; });
 expect(m.remove).toHaveBeenCalledOnce(); expect(m.photo).not.toHaveBeenCalled(); expect(m.error).not.toHaveBeenCalled();
});
it('ignora callbacks de uma câmera que foi para segundo plano e permite nova captura ao voltar', async () => {
 await montar(); const anterior=camera().props; await ready(); await state('background'); await state('active');
 await act(async()=>{anterior.onCameraReady(); anterior.onMountError();});
 expect(button().props.disabled).toBe(true); expect(m.error).not.toHaveBeenCalled();
 await ready(); await act(async()=>button().props.onPress()); expect(m.photo).toHaveBeenCalledOnce();
});
it.each(['camera','cleanup','base64'])('falha de %s não entrega selfie',async tipo=>{
 if(tipo==='camera')m.capture.mockRejectedValue(new Error('camera'));
 if(tipo==='cleanup')m.remove.mockRejectedValue(new Error('io'));
 if(tipo==='base64')m.capture.mockResolvedValue({uri:'cache/Camera/selfie.jpg'});
 await montar();await ready();await act(async()=>button().props.onPress());expect(m.error).toHaveBeenCalledOnce();expect(m.photo).not.toHaveBeenCalled();
});
it('relata falha ao montar e ausência do módulo',async()=>{
 await montar();await act(async()=>camera().props.onMountError());expect(m.error).toHaveBeenCalledOnce();
 await act(async()=>tree!.unmount());tree=undefined;m.cameraAvailable=false;await montar();expect(m.error).toHaveBeenCalledTimes(2);
});

it('não deixa a abertura da câmera carregando indefinidamente',async()=>{
 vi.useFakeTimers();await montar();await act(async()=>{vi.advanceTimersByTime(12_000);});expect(m.error).toHaveBeenCalledOnce();expect(m.photo).not.toHaveBeenCalled();
});
it('câmera pronta cancela o prazo de abertura e segundo plano suspende a espera',async()=>{
 vi.useFakeTimers();await montar();await ready();await act(async()=>{vi.advanceTimersByTime(15_000);});expect(m.error).not.toHaveBeenCalled();
 await state('background');await act(async()=>{vi.advanceTimersByTime(15_000);});expect(m.error).not.toHaveBeenCalled();
 await state('active');await act(async()=>{vi.advanceTimersByTime(12_000);});expect(m.error).toHaveBeenCalledOnce();
});

it('também aceita onCameraReady após a remontagem de efeitos do StrictMode',async()=>{
 await montar(true);await ready();expect(button().props.disabled).toBe(false);await act(async()=>button().props.onPress());expect(m.photo).toHaveBeenCalledOnce();
});
