import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Linking, ScrollView, SectionList,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/Colors';
import { youtube } from '@/lib/api';

interface Video {
  id: string;
  titulo: string;
  descricao: string;
  data: string;
  thumbnail: string;
  url: string;
  serie?: string;
}

function extractSerie(titulo: string): string {
  // "Série Transformação | Culto Domingo" → "Série Transformação"
  // "Pense | Reflexão #45" → "Pense"
  const sep = titulo.indexOf('|');
  if (sep > 0) return titulo.slice(0, sep).trim();
  // "Culto Domingo 13/04" → "Cultos"
  if (/culto|cultos/i.test(titulo)) return 'Cultos';
  return 'Outros';
}

export default function Assistir() {
  const [videos, setVideos]   = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  useEffect(() => {
    youtube.cultos().then(setVideos).catch(() => {}).finally(() => setLoading(false));
    youtube.live().then(url => setLiveUrl(url)).catch(() => {});
  }, []);

  const sections = useMemo(() => {
    const map: Record<string, Video[]> = {};
    videos.forEach(v => {
      const s = v.serie || extractSerie(v.titulo);
      if (!map[s]) map[s] = [];
      map[s].push(v);
    });
    return Object.entries(map).map(([title, data]) => ({ title, data }));
  }, [videos]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Assistir</Text>
        <Text style={s.sub}>Cultos e pregações</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={C.primary} />
      ) : (
        <SectionList
          sections={sections.length > 0 ? sections : [{ title: '', data: [] }]}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <>
              {liveUrl ? (
                <TouchableOpacity style={s.liveCard} onPress={() => Linking.openURL(liveUrl)} activeOpacity={0.9}>
                  <View style={s.liveBadge}>
                    <View style={s.liveDot} />
                    <Text style={s.liveText}>AO VIVO</Text>
                  </View>
                  <Text style={s.liveTitulo}>Culto Online CBRio</Text>
                  <Text style={s.liveSub}>Assistir ao vivo no YouTube</Text>
                  <View style={s.liveBtn}>
                    <Ionicons name="play" size={18} color="#fff" />
                    <Text style={s.liveBtnText}>Assistir agora</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={s.proximoCard}>
                  <Ionicons name="tv-outline" size={24} color={C.text2} />
                  <Text style={s.proximoText}>Nenhuma transmissão ao vivo agora</Text>
                </View>
              )}
              {sections.length === 0 && !loading && (
                <Text style={s.emptyText}>
                  Configure EXPO_PUBLIC_YOUTUBE_API_KEY e EXPO_PUBLIC_YOUTUBE_CHANNEL_ID para carregar os cultos.
                </Text>
              )}
            </>
          }
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={s.serieHeader}>
                <Text style={s.serieTitulo}>{section.title}</Text>
                <Text style={s.serieCount}>{section.data.length} vídeo{section.data.length !== 1 ? 's' : ''}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => <VideoCard video={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function VideoCard({ video }: { video: Video }) {
  return (
    <TouchableOpacity style={s.videoCard} onPress={() => Linking.openURL(video.url)} activeOpacity={0.85}>
      <View style={s.thumb}>
        <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.9)" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.videoTitulo} numberOfLines={2}>{video.titulo}</Text>
        <Text style={s.videoData}>{video.data}</Text>
      </View>
      <Ionicons name="open-outline" size={16} color={C.text2} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  header:       { backgroundColor: '#EF4444', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  title:        { fontSize: 26, fontWeight: '800', color: '#fff' },
  sub:          { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  list:         { padding: 16, paddingBottom: 32, gap: 0 },
  liveCard:     { backgroundColor: '#EF4444', borderRadius: 20, padding: 20, marginBottom: 20, gap: 8 },
  liveBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText:     { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  liveTitulo:   { fontSize: 20, fontWeight: '800', color: '#fff' },
  liveSub:      { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  liveBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start', marginTop: 4 },
  liveBtnText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
  proximoCard:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  proximoText:  { fontSize: 14, color: C.text2 },
  serieHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  serieTitulo:  { fontSize: 15, fontWeight: '700', color: C.text },
  serieCount:   { fontSize: 12, color: C.text2 },
  videoCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  thumb:        { width: 72, height: 50, borderRadius: 10, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  videoTitulo:  { fontSize: 13, fontWeight: '700', color: C.text, lineHeight: 18, flex: 1 },
  videoData:    { fontSize: 11, color: C.text2, marginTop: 4 },
  emptyText:    { textAlign: 'center', color: C.text2, fontSize: 13, marginTop: 20, paddingHorizontal: 24, lineHeight: 20 },
});
