import { Image } from 'react-native';
import { Skia, ImageFormat, TextAlign, PaintStyle } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import type { ConviteBatismo } from './batismoConvite';

/** Arte local 9:16. Usa capacidades já presentes nos binários iOS e Android. */
export async function gerarConviteBatismo(convite: ConviteBatismo): Promise<string> {
  const provider = Skia.TypefaceFontProvider.Make();
  const fontes = [
    ['Marca', require('../assets/fonts/iBrand.otf')],
    ['Texto', require('../assets/fonts/Gotham-Book.otf')],
  ] as const;
  for (const [familia, asset] of fontes) {
    const data = await Skia.Data.fromURI(Image.resolveAssetSource(asset).uri);
    const face = Skia.Typeface.MakeFreeTypeFaceFromData(data);
    if (!face) throw new Error('Fonte indisponível');
    provider.registerFont(face, familia);
  }
  const surface = Skia.Surface.MakeOffscreen(1080, 1920);
  if (!surface || !FileSystem.cacheDirectory) throw new Error('Imagem indisponível');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('#193c44'));
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color('#355b62'));
  canvas.drawCircle(1020, 150, 550, paint);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(3);
  paint.setColor(Skia.Color('#8fb5b9'));
  for (let i = 0; i < 4; i++) {
    const path = Skia.Path.Make();
    path.moveTo(-80, 1600 + i * 65);
    path.cubicTo(350, 1450 + i * 65, 700, 1860 + i * 65, 1180, 1640 + i * 65);
    canvas.drawPath(path, paint);
  }
  function texto(value: string, y: number, tamanho: number, familia = 'Texto', maxAltura = 300) {
    let p;
    do {
      const b = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Center }, provider);
      b.pushStyle({ color: Skia.Color('#f5f7f5'), fontSize: tamanho, fontFamilies: [familia] });
      b.addText(value);
      p = b.build();
      p.layout(880);
      tamanho -= 2;
    } while (p.getHeight() > maxAltura && tamanho >= 16);
    p.paint(canvas, 100, y);
  }
  texto('cbrio', 170, 92, 'Marca');
  texto('UMA NOVA HISTÓRIA', 480, 28);
  texto('Vou me\nbatizar!', 560, 146, 'Marca', 390);
  texto(convite.nome, 970, 46, 'Marca', 160);
  texto('Quero você comigo nesse\nmomento tão especial.', 1160, 34);
  texto(convite.data, 1325, 64, 'Marca');
  texto(convite.horario, 1420, 29);
  texto('CBRio · Venha celebrar comigo!', 1510, 28);
  const imagem = surface.makeImageSnapshot();
  const base64 = imagem.encodeToBase64(ImageFormat.PNG, 100);
  const uri = `${FileSystem.cacheDirectory}convite-batismo-${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}
