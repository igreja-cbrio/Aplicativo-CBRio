import { FlatList } from '@/components/navigation/DockContent';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/contexts/ThemeContext';
import { useT } from '@/lib/i18n';
import type { MeuBatismo, FotoBatismo } from '@/lib/batismo';
import { makeStyles } from './batismoStyles';
import { BatismoCountdownCard } from './BatismoCountdownCard';
import { contagemBatismo } from '@/lib/batismoContagem';
import { useRelogioBatismo } from '@/lib/useRelogioBatismo';

export function BatismoConteudo({
  batismo,
  fotos,
  fotosLoading,
  checkinFazendo,
  onCheckin,
  onAbrirFoto,
  colors,
  styles,
}: {
  batismo: MeuBatismo;
  fotos: FotoBatismo[];
  fotosLoading: boolean;
  checkinFazendo: boolean;
  onCheckin: () => void;
  onAbrirFoto: (f: FotoBatismo) => void;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useT();
  const agora = useRelogioBatismo();
  const contagem = contagemBatismo(batismo, agora);
  const ehHoje = contagem.estado === 'hoje';
  const passou = contagem.estado === 'passado';
  const realizado = contagem.estado === 'realizado';

  return (
    <>
      <BatismoCountdownCard batismo={batismo} agora={agora} />

      {/* Check-in (no dia) */}
      {ehHoje && (
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons
              name={batismo.checkin_em ? "checkmark-circle" : "qr-code-outline"}
              size={22}
              color={batismo.checkin_em ? colors.success : colors.brandMid}
            />
            <Text style={styles.cardTitle}>
              {batismo.checkin_em ? t("Check-in feito") : t("Faça seu check-in")}
            </Text>
          </View>
          {batismo.checkin_em ? (
            <Text style={styles.cardTxt}>
              {t("Pronto! Te vejo já. 💙")}
            </Text>
          ) : (
            <>
              <Text style={styles.cardTxt}>
                {t("Ao chegar na igreja, confirme sua presença aqui. Isso ajuda nossa equipe a se preparar pra você.")}
              </Text>
              <Button title={t("Fazer check-in")} onPress={onCheckin} loading={checkinFazendo} />
            </>
          )}
        </View>
      )}

      {/* O que levar / dicas */}
      {!passou && !realizado && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Como se preparar")}</Text>
          <Linha icon="shirt-outline" colors={colors} styles={styles}>
            {t("Traga uma muda de roupa seca e toalha.")}
          </Linha>
          <Linha icon="time-outline" colors={colors} styles={styles}>
            {t("Chegue 30 minutos antes pra orientação.")}
          </Linha>
          <Linha icon="heart-outline" colors={colors} styles={styles}>
            {t("Convide quem te leva a viver isso de perto.")}
          </Linha>
          {!!batismo.tamanho_camisa && (
            <Linha icon="pricetag-outline" colors={colors} styles={styles}>
              {t("Camisa:")} <Text style={{ fontWeight: "800" }}>{batismo.tamanho_camisa}</Text>
            </Linha>
          )}
        </View>
      )}

      {/* Galeria de fotos do dia */}
      {(realizado || passou || ehHoje) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Fotos do dia")}</Text>
          {fotosLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : fotos.length === 0 ? (
            <Text style={styles.cardTxt}>
              {t("As fotos do dia ainda não foram publicadas. Volte mais tarde — o marketing posta logo depois do batismo. 📸")}
            </Text>
          ) : (
            <FlatList
              data={fotos}
              keyExtractor={(f) => f.nome}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: 6 }}
              ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onAbrirFoto(item)}
                  style={styles.thumb}
                >
                  <Image source={{ uri: item.url }} style={styles.thumbImg} />
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </>
  );
}

function Linha({
  icon,
  children,
  colors,
  styles,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.brandMid} />
      <Text style={styles.linhaTxt}>{children}</Text>
    </View>
  );
}

