import {
  Skia,
  ImageFormat,
  TextAlign,
  FontWeight,
  FontSlant,
  PaintStyle,
} from "@shopify/react-native-skia";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { DevocionalItem } from "./devocional";

// Card de compartilhamento do devocional, gerado 100% com Skia headless
// (já está no binário — sai por OTA). Formato 1080×1350 (4:5), que cai
// bem tanto no feed quanto nos stories. Sem View nem captura de tela.

const W = 1080;
const H = 1350;
const BG = "#0B1F26"; // teal escuro da marca
const TEAL = "#70A8B0";
const PALE = "#D5E4E6";
const BRANCO = "#F4F8F9";
const FAMILIAS = ["Helvetica Neue", "Helvetica", "Arial"];

type Op = {
  size: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  align?: TextAlign;
  maxLines?: number;
  letterSpacing?: number;
};

function paragrafo(texto: string, op: Op, larguraMax: number) {
  // ⚠️ Skia.ParagraphBuilder.Make/pushStyle rejeitam props = undefined
  // ("Value is undefined, expected a number"). Monta os objetos só com o
  // que existe.
  const paraStyle: Record<string, unknown> = { textAlign: op.align ?? TextAlign.Center };
  if (op.maxLines != null) paraStyle.maxLines = op.maxLines;

  const textStyle: Record<string, unknown> = {
    color: Skia.Color(op.color),
    fontSize: op.size,
    fontFamilies: FAMILIAS,
    fontStyle: {
      weight: op.bold ? FontWeight.Bold : FontWeight.Normal,
      slant: op.italic ? FontSlant.Italic : FontSlant.Upright,
    },
  };
  if (op.letterSpacing != null) textStyle.letterSpacing = op.letterSpacing;

  const builder = Skia.ParagraphBuilder.Make(paraStyle);
  builder.pushStyle(textStyle);
  builder.addText(texto);
  const p = builder.build();
  p.layout(larguraMax);
  return p;
}

/** Gera a imagem do devocional e abre a folha de compartilhamento. */
export async function compartilharDevocional(item: DevocionalItem): Promise<void> {
  const surface = Skia.Surface.MakeOffscreen(W, H);
  if (!surface) throw new Error("Skia indisponível");
  const canvas = surface.getCanvas();

  // Fundo
  const fundo = Skia.Paint();
  fundo.setColor(Skia.Color(BG));
  canvas.drawRect(Skia.XYWHRect(0, 0, W, H), fundo);

  // Moldura interna sutil
  const moldura = Skia.Paint();
  moldura.setStyle(PaintStyle.Stroke);
  moldura.setStrokeWidth(2);
  moldura.setColor(Skia.Color(TEAL));
  moldura.setAlphaf(0.35);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(48, 48, W - 96, H - 96), 28, 28), moldura);

  const M = 110; // margem de texto
  const maxW = W - M * 2;
  let y = 150;

  // Coração 💙
  paragrafo("💙", { size: 92, color: BRANCO }, maxW).paint(canvas, M, y);
  y += 150;

  // Eyebrow
  paragrafo("DEVOCIONAL CBRIO", { size: 30, color: TEAL, bold: true, letterSpacing: 4 }, maxW).paint(canvas, M, y);
  y += 70;

  // Passagem (referência)
  if (item.passagem) {
    const ref = paragrafo(item.passagem.toUpperCase(), { size: 38, color: PALE, bold: true, letterSpacing: 1 }, maxW);
    ref.paint(canvas, M, y);
    y += ref.getHeight() + 50;
  }

  // Texto do versículo (ou título, se não houver passagem_texto)
  const corpo = (item.passagem_texto || item.titulo || "").trim();
  paragrafo(`“${corpo}”`, { size: 52, color: BRANCO, italic: true, maxLines: 9 }, maxW).paint(canvas, M, y);

  // Rodapé
  paragrafo("Baixe o app CBRio e leia o devocional de hoje", { size: 28, color: TEAL }, maxW).paint(canvas, M, H - 150);

  // Exporta
  const img = surface.makeImageSnapshot();
  const base64 = img.encodeToBase64(ImageFormat.PNG, 100);
  const uri = `${FileSystem.cacheDirectory ?? ""}devocional-cbrio.png`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Compartilhar devocional" });
  }
}
