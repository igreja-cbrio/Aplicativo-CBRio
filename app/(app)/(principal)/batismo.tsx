import { BatismoCountdownCard } from "@/components/batismo/BatismoCountdownCard";
import { BatismoConteudo } from "@/components/batismo/BatismoConteudo";
import { makeStyles } from "@/components/batismo/batismoStyles";
import { Modal, ScrollView } from "@/components/navigation/DockContent";
import { ValorHeader } from "@/components/ui/ValorHeader";
import { Text } from "@/components/ui/Typography";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { useMembro } from "@/lib/useMembro";
import {
  meuBatismo,
  fazerCheckin,
  getBatismoAnterior,
  marcarBatismoAnterior,
  desmarcarBatismoAnterior,
  type MeuBatismo,
  type BatismoAnterior,
} from "@/lib/batismo";
import { listarAlbuns } from "@/lib/batismoFotos";
import { FotosBatismoCard, LinkMinhasFotos, type EstadoFotosBatismo } from "@/components/batismo/FotosBatismoCard";
import { Input } from "@/components/ui/Input";
import { spacing } from "@/constants/theme";
import ConfettiCannon from "react-native-confetti-cannon";

const { width: SCREEN_W } = Dimensions.get("window");

import { BatismoGestaoScreen } from '@/components/batismo/BatismoGestao';
import { getBatismoPapel } from '@/lib/batismoGestao';

export default function BatismoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const { membro, loading: loadingMembro } = useMembro();

  const [batismo, setBatismo] = useState<MeuBatismo | null>(null);
  const [podeGerenciar, setPodeGerenciar] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(true);
  // Álbum do batismo (24/11/2026): quem decide se existe e qual é o servidor.
  const [fotosEstado, setFotosEstado] = useState<EstadoFotosBatismo>({ tipo: "carregando" });
  const [checkinFazendo, setCheckinFazendo] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [batismoAnt, setBatismoAnt] = useState<BatismoAnterior | null>(null);
  const [modalIgrejaAberto, setModalIgrejaAberto] = useState(false);
  const [igrejaTxt, setIgrejaTxt] = useState("");
  const [salvandoIgreja, setSalvandoIgreja] = useState(false);

  const carregarFotos = useCallback(async () => {
    try {
      const resp = await listarAlbuns();
      setFotosEstado({ tipo: "ok", resp });
    } catch {
      // ⚠️ Erro não vira "sem álbum": o cartão diz que não deu para verificar.
      setFotosEstado({ tipo: "erro" });
    }
  }, []);

  const carregar = useCallback(async () => {
    carregarFotos();
    const papel = await getBatismoPapel().catch(() => ({ pode_gerenciar: false }));
    setPodeGerenciar(!!papel.pode_gerenciar);
    if (papel.pode_gerenciar) {
      setCarregando(false);
      return;
    }
    if (!membro?.membroId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const b = await meuBatismo(membro.membroId);
    setBatismo(b);
    setCarregando(false);
    // Status "já sou batizado" do membro
    const ant = await getBatismoAnterior(membro.membroId);
    setBatismoAnt(ant);
    setIgrejaTxt(ant.igreja_batismo_anterior ?? "");
  }, [membro?.membroId, carregarFotos]);

  // ⚠️ RECARREGA AO FOCAR (05/08/2026): o web e o app leem o MESMO banco, mas
  // só refletia o que o web mudou se a tela fosse remontada. Aprovar um pedido,
  // criar um grupo, marcar um batismo como realizado — tudo isso muda por lá e
  // a pessoa volta pra esta tela esperando ver.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function onCheckin() {
    if (!batismo) return;
    setCheckinFazendo(true);
    const resp = await fazerCheckin(batismo.id);
    setCheckinFazendo(false);
    if (resp.ok) {
      setBatismo((b) => (b ? { ...b, checkin_em: resp.checkin_em } : b));
      if (!resp.ja_checkado) setConfettiKey((k) => k + 1);
      Alert.alert(
        resp.ja_checkado ? t("Check-in já feito") : t("Check-in confirmado!"),
        resp.ja_checkado
          ? t("Você já tinha feito o check-in. Bora!")
          : t("Deus te abençoe nesse dia incrível. Te vejo já! 💙")
      );
    } else {
      Alert.alert(t("Não foi possível fazer o check-in"), resp.erro);
    }
  }

  if (podeGerenciar) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.headerGestao}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back}>
            <Ionicons name='chevron-back' size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={{ width: 24 }} />
        </View>
        <ValorHeader rotulo={t('Gestão da equipe')} style={{ paddingHorizontal: spacing.lg }} />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <LinkMinhasFotos estado={fotosEstado} colors={colors} styles={styles} />
        </View>
        <BatismoGestaoScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ width: 24 }} />
        </View>
        <ValorHeader rotulo={t("Meu batismo")} />

        {loadingMembro || carregando || podeGerenciar === null ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : !membro?.membroId ? (
          <Vazio
            icon="link-outline"
            titulo={t("Vincule seu perfil")}
            txt={t("Pra acompanhar seu batismo, complete o cadastro do membro (CPF) no perfil.")}
            cta={t("Ir para o perfil")}
            onPress={() => router.navigate("/perfil")}
            colors={colors}
            styles={styles}
          />
        ) : !batismo && batismoAnt?.batizado_outra_igreja ? (
          <JaBatizado
            igreja={batismoAnt.igreja_batismo_anterior}
            onCorrigir={async () => {
              await desmarcarBatismoAnterior();
              setBatismoAnt({ batizado_outra_igreja: false, igreja_batismo_anterior: null });
              setIgrejaTxt('');
            }}
            colors={colors}
            styles={styles}
          />
        ) : !batismo ? (
          <View style={{ gap: spacing.md }}>
            {batismoAnt?.batizado_outra_igreja && (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.cardTitle}>{t("Já é batizado(a)")}</Text>
                </View>
                <Text style={styles.cardTxt}>
                  {t("Registramos seu batismo")}
                  {batismoAnt.igreja_batismo_anterior ? ` ${t("em")} ${batismoAnt.igreja_batismo_anterior}` : ""}.
                  {" "}{t("Você ainda pode se batizar na CBRio se quiser.")}
                </Text>
                <Pressable
                  onPress={async () => {
                    await desmarcarBatismoAnterior();
                    setBatismoAnt({ batizado_outra_igreja: false, igreja_batismo_anterior: null });
                    setIgrejaTxt("");
                  }}
                  hitSlop={6}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("Remover este registro")}</Text>
                </Pressable>
              </View>
            )}
            <Vazio
              icon="water-outline"
              titulo={batismoAnt?.batizado_outra_igreja ? t("Quer se batizar na CBRio?") : t("Você ainda não se inscreveu")}
              txt={
                batismoAnt?.batizado_outra_igreja
                  ? t("Mesmo já sendo batizado(a), você pode renovar essa decisão aqui.")
                  : t("O batismo é uma decisão linda. Inscreva-se e te acompanhamos até lá.")
              }
              cta={t("Quero me batizar")}
              onPress={() => router.navigate("/inscricao-batismo")}
              colors={colors}
              styles={styles}
            />
            {!batismoAnt?.batizado_outra_igreja && (
              <Pressable
                onPress={() => setModalIgrejaAberto(true)}
                style={({ pressed }) => [styles.linkAcao, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.brandMid} />
                <Text style={styles.linkAcaoTxt}>{t("Já sou batizado(a) em outra igreja")}</Text>
              </Pressable>
            )}
          </View>
        ) : !batismo.data_batismo ? (
          <BatismoCountdownCard batismo={batismo} agora={Date.now()} />
        ) : (
          <BatismoConteudo
            batismo={batismo}
            fotosEstado={fotosEstado}
            checkinFazendo={checkinFazendo}
            onCheckin={onCheckin}
            colors={colors}
            styles={styles}
          />
        )}
        {/* Sem inscrição com data aqui, mas o servidor achou álbum desta conta
            (ex.: batismo registrado por outro caminho): o cartão aparece igual. */}
        {!loadingMembro && !carregando && podeGerenciar === false && !!membro?.membroId && !batismo?.data_batismo && (
          <FotosBatismoCard estado={fotosEstado} mostrarSemAlbum={false} colors={colors} styles={styles} />
        )}
      </ScrollView>

      {/* Sheet nativa (pageSheet) — iOS 26 com swipe-to-dismiss */}
      <Modal
        visible={modalIgrejaAberto}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalIgrejaAberto(false)}
      >
        <View style={styles.modalIgrejaSheet}>
          <View style={styles.modalIgrejaCard}>
            <Text style={styles.cardTitle}>{t("Você foi batizado(a) onde?")}</Text>
            <Text style={styles.cardTxt}>
              {t("Conta pra gente a igreja. Isso ajuda nossa equipe a te conhecer melhor.")}
            </Text>
            <Input
              label={t("Nome da igreja")}
              value={igrejaTxt}
              onChangeText={setIgrejaTxt}
              placeholder={t("Igreja anterior")}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button
                title={t("Cancelar")}
                variant="ghost"
                onPress={() => {
                  setModalIgrejaAberto(false);
                  setIgrejaTxt(batismoAnt?.igreja_batismo_anterior ?? "");
                }}
              />
              <Button
                title={t("Confirmar")}
                loading={salvandoIgreja}
                onPress={async () => {
                  setSalvandoIgreja(true);
                  try {
                    await marcarBatismoAnterior(igrejaTxt);
                    setBatismoAnt({
                      batizado_outra_igreja: true,
                      igreja_batismo_anterior: igrejaTxt.trim() || null,
                    });
                    setModalIgrejaAberto(false);
                  } catch (e) {
                    Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Falha ao salvar."));
                  } finally {
                    setSalvandoIgreja(false);
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {confettiKey > 0 && (
        <ConfettiCannon
          key={confettiKey}
          count={140}
          origin={{ x: SCREEN_W / 2, y: -10 }}
          fallSpeed={3500}
          fadeOut
          autoStart
          explosionSpeed={350}
        />
      )}
    </SafeAreaView>
  );
}

function JaBatizado({ igreja, onCorrigir, colors, styles }: {
  igreja: string | null;
  onCorrigir(): Promise<void>;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useT();
  return (
    <View style={styles.jaBatizado}>
      <View style={styles.jaBatizadoIcon}>
        <Ionicons name='checkmark' size={31} color='#fff' />
      </View>
      <Text style={styles.jaBatizadoEyebrow}>{t('Uma decisão para celebrar')}</Text>
      <Text style={styles.jaBatizadoTitle}>{t('Você já foi batizado(a)')}</Text>
      <Text style={styles.jaBatizadoTxt}>
        {igreja
          ? `${t('Registramos esse passo em')} ${igreja}. ${t('Que alegria ter você caminhando com a gente.')}`
          : t('Que alegria celebrar esse passo da sua caminhada com Jesus.')}
      </Text>
      <Pressable onPress={onCorrigir} hitSlop={8} style={styles.corrigirRegistro}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('Esse registro não está correto')}</Text>
      </Pressable>
    </View>
  );
}

function Vazio({
  icon,
  titulo,
  txt,
  cta,
  onPress,
  styles,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  titulo: string;
  txt: string;
  cta: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.vazio}>
      <Ionicons name={icon} size={48} color={styles.vazioIcon.color as string} />
      <Text style={styles.vazioTitle}>{titulo}</Text>
      <Text style={styles.vazioTxt}>{txt}</Text>
      <Button title={cta} onPress={onPress} />
    </View>
  );
}
