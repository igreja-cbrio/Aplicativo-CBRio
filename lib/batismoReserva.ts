import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { captureCampusSession } from './campusSession';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function idReservaBatismo(eventoId:string) {
 const scope=captureCampusSession();
 try {
  if(!scope.userId || !scope.campusId || !UUID.test(eventoId)) throw new Error('Selecione o campus e a data do batismo.');
  const key=`cbrio:batismo-reserva:${scope.cacheKey}:${eventoId}`;
  const saved=await AsyncStorage.getItem(key); scope.assertCurrent();
  if(saved && UUID.test(saved)) return saved;
  const id=randomUUID(); await AsyncStorage.setItem(key,id); scope.assertCurrent(); return id;
 } finally {scope.release();}
}
