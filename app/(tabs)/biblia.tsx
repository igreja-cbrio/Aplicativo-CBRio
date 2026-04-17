import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/Colors';
import { Card } from '@/components/ui/Card';
import { youtube } from '@/lib/api';

const LIVROS = [
  'Gênesis','Êxodo','Levítico','Números','Deuteronômio',
  'Josué','Juízes','Rute','1 Samuel','2 Samuel',
  '1 Reis','2 Reis','1 Crônicas','2 Crônicas','Esdras',
  'Neemias','Ester','Jó','Salmos','Provérbios',
  'Eclesiastes','Cantares','Isaías','Jeremias','Lamentações',
  'Ezequiel','Daniel','Oséias','Joel','Amós',
  'Obadias','Jonas','Miquéias','Naum','Habacuque',
  'Sofonias','Ageu','Zacarias','Malaquias',
  'Mateus','Marcos','Lucas','João','Atos',
  'Romanos','1 Coríntios','2 Coríntios','Gálatas','Efésios',
  'Filipenses','Colossenses','1 Tessalonicenses','2 Tessalonicenses',
  '1 Timóteo','2 Timóteo','Tito','Filemom','Hebreus',
  'Tiago','1 Pedro','2 Pedro','1 João','2 João','3 João',
  'Judas','Apocalipse',
];

const VERSICULO_DIARIO = [
  { ref: 'João 3:16', texto: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.' },
  { ref: 'Filipenses 4:13', texto: 'Tudo posso naquele que me fortalece.' },
  { ref: 'Salmos 23:1', texto: 'O Senhor é o meu pastor; nada me faltará.' },
  { ref: 'Jeremias 29:11', texto: 'Porque eu bem sei os planos que tenho a vosso respeito, diz o Senhor; planos de paz, e não de mal, para vos dar um futuro e uma esperança.' },
  { ref: 'Romanos 8:28', texto: 'E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus, daqueles que são chamados segundo o seu propósito.' },
  { ref: 'Provérbios 3:5-6', texto: 'Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento. Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas.' },
  { ref: 'Isaías 40:31', texto: 'Mas os que esperam no Senhor renovarão as suas forças, subirão com asas como águias; correrão, e não se cansarão; caminharão, e não se fatigarão.' },
];

function getVersiculoDiario() {
  const dia = new Date().getDate() % VERSICULO_DIARIO.length;
  return VERSICULO_DIARIO[dia];
}

const BIBLE_API = 'https://bible-api.com';

function livroSlug(livro: string) {
  return livro
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '+');
}

export default function Biblia() {
  const [aba, setAba]         = useState<'devocional' | 'biblia' | 'pense'>('devocional');
  const [livroIdx, setLivroIdx] = useState(43); // João
  const [cap, setCap]         = useState(1);
  const [versos, setVersos]   = useState<any[]>([]);
  const [loadingBiblia, setLoadingBiblia] = useState(false);
  const [videos, setVideos]   = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  const versiculoDiario = getVersiculoDiario();

  const buscarCapitulo = useCallback(async () => {
    setLoadingBiblia(true);
    try {
      const livro = livroSlug(LIVROS[livroIdx]);
      const res = await fetch(`${BIBLE_API}/${livro}+${cap}?translation=almeida`);
      const data = await res.json();
      setVersos(data.verses || []);
    } catch {
      setVersos([]);
    }
    setLoadingBiblia(false);
  }, [livroIdx, cap]);

  useEffect(() => {
    if (aba === 'biblia') buscarCapitulo();
  }, [aba, buscarCapitulo]);

  useEffect(() => {
    if (aba === 'pense') {
      setLoadingVideos(true);
      youtube.pense().then(setVideos).catch(() => setVideos([])).finally(() => setLoadingVideos(false));
    }
  }, [aba]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Bíblia & Devocional</Text>
        <View style={s.abas}>
          {(['devocional', 'biblia', 'pense'] as const).map(a => (
            <TouchableOpacity key={a} onPress={() => setAba(a)} style={[s.aba, aba === a && s.abaActive]}>
              <Text style={[s.abaText, aba === a && s.abaTextActive]}>
                {a === 'devocional' ? 'Devocional' : a === 'biblia' ? 'Leitura' : 'Pense'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {aba === 'devocional' && (
        <ScrollView contentContainerStyle={s.scroll}>
          <Card style={s.versiculoCard}>
            <Text style={s.versiculoRef}>{versiculoDiario.ref}</Text>
            <Text style={s.versiculoTexto}>{versiculoDiario.texto}</Text>
          </Card>
          <Text style={s.devotionTitle}>Reflexão do dia</Text>
          <Card>
            <Text style={s.devotionText}>
              Cada manhã é uma nova oportunidade de confiar em Deus e andar na fé.
              Reserve um momento hoje para orar, ler a Palavra e estar na presença d'Ele.
              Você não está sozinho nessa jornada.{'\n\n'}
              "Buscai ao Senhor enquanto se pode achar, invocai-o enquanto está perto." — Is 55:6
            </Text>
          </Card>
        </ScrollView>
      )}

      {aba === 'biblia' && (
        <View style={{ flex: 1 }}>
          <View style={s.nav}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.livrosScroll}>
              {LIVROS.map((l, i) => (
                <TouchableOpacity key={l} onPress={() => { setLivroIdx(i); setCap(1); }} style={[s.livroBtn, livroIdx === i && s.livroBtnActive]}>
                  <Text style={[s.livroBtnText, livroIdx === i && s.livroBtnTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.capNav}>
              <TouchableOpacity onPress={() => setCap(c => Math.max(1, c - 1))} style={s.capBtn}>
                <Ionicons name="chevron-back" size={20} color={C.primary} />
              </TouchableOpacity>
              <Text style={s.capLabel}>Cap. {cap}</Text>
              <TouchableOpacity onPress={() => setCap(c => c + 1)} style={s.capBtn}>
                <Ionicons name="chevron-forward" size={20} color={C.primary} />
              </TouchableOpacity>
            </View>
          </View>
          {loadingBiblia
            ? <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
            : <ScrollView contentContainerStyle={s.scroll}>
                {versos.length === 0
                  ? <Text style={s.emptyText}>Toque em "Leitura" para carregar o capítulo.</Text>
                  : versos.map((v: any) => (
                      <Text key={v.verse} style={s.verso}>
                        <Text style={s.versoNum}>{v.verse} </Text>
                        {v.text}
                      </Text>
                    ))
                }
              </ScrollView>
          }
        </View>
      )}

      {aba === 'pense' && (
        <ScrollView contentContainerStyle={s.scroll}>
          {loadingVideos
            ? <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
            : videos.length === 0
              ? <Text style={s.emptyText}>Configure EXPO_PUBLIC_YOUTUBE_API_KEY para carregar os vídeos.</Text>
              : videos.map((v: any) => <VideoCard key={v.id} video={v} />)
          }
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function VideoCard({ video }: { video: any }) {
  return (
    <TouchableOpacity style={s.videoCard} activeOpacity={0.85}>
      <View style={s.videoThumb}>
        <Ionicons name="play-circle" size={32} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.videoTitle} numberOfLines={2}>{video.titulo}</Text>
        <Text style={s.videoDate}>{video.data}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.bg },
  header:            { backgroundColor: C.purple, paddingTop: 20, paddingBottom: 8 },
  title:             { fontSize: 22, fontWeight: '800', color: '#fff', paddingHorizontal: 24, marginBottom: 14 },
  abas:              { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  aba:               { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  abaActive:         { backgroundColor: 'rgba(255,255,255,0.25)' },
  abaText:           { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  abaTextActive:     { color: '#fff', fontWeight: '800' },
  scroll:            { padding: 16, gap: 12, paddingBottom: 32 },
  versiculoCard:     { borderLeftWidth: 4, borderLeftColor: C.purple },
  versiculoRef:      { fontSize: 12, fontWeight: '700', color: C.purple, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  versiculoTexto:    { fontSize: 16, color: C.text, lineHeight: 25, fontStyle: 'italic' },
  devotionTitle:     { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  devotionText:      { fontSize: 14, color: C.text2, lineHeight: 23 },
  nav:               { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.border },
  livrosScroll:      { paddingHorizontal: 12, paddingVertical: 8 },
  livroBtn:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginRight: 6 },
  livroBtnActive:    { backgroundColor: C.primaryDim },
  livroBtnText:      { fontSize: 13, color: C.text2, fontWeight: '500' },
  livroBtnTextActive:{ color: C.primary, fontWeight: '700' },
  capNav:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 16 },
  capBtn:            { padding: 8 },
  capLabel:          { fontSize: 14, fontWeight: '700', color: C.text, minWidth: 60, textAlign: 'center' },
  verso:             { fontSize: 15, color: C.text, lineHeight: 26, marginBottom: 8 },
  versoNum:          { fontSize: 11, fontWeight: '800', color: C.primary },
  emptyText:         { textAlign: 'center', color: C.text2, marginTop: 40, fontSize: 14, paddingHorizontal: 32 },
  videoCard:         { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.border },
  videoThumb:        { width: 80, height: 56, borderRadius: 10, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  videoTitle:        { fontSize: 13, fontWeight: '700', color: C.text, lineHeight: 19 },
  videoDate:         { fontSize: 11, color: C.text2, marginTop: 4 },
});
