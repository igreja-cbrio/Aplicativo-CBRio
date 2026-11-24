// PERMISSÕES E ENVIO PARA A LOJA · versão 1.0.6 (24/11/2026)
//
// O que se trava aqui, e por quê:
// - Todo texto de permissão do iPhone em português. Até a 1.0.5 o aviso da câmera
//   saía "Allow $(PRODUCT_NAME) to access your camera", porque o plugin do
//   expo-image-picker não tinha `cameraPermission` (a busca por selfie do álbum do
//   batismo, o Kids e o chat abrem a câmera).
// - Os plugins que escrevem a MESMA chave do Info.plist têm o MESMO texto. O
//   @expo/config-plugins deixa valer o último plugin da lista, em silêncio: o
//   texto do microfone do expo-audio apagava o do ditado (expo-speech-recognition),
//   e o de fotos do expo-media-library apagaria o do expo-image-picker.
// - Android sem leitura da galeria: o app só SALVA fotos (lib/salvarFotos.ts,
//   `requestPermissionsAsync(true, ...)`), e no Android 13+ salvar não pede
//   permissão nenhuma. A READ_MEDIA_VISUAL_USER_SELECTED que o expo-media-library
//   declara fica bloqueada, e READ_MEDIA_IMAGES/VIDEO nunca entram
//   (`granularPermissions: []`). Pedir permissão da galeria sem `writeOnly`
//   LANÇA "not declared in AndroidManifest" no Android 13+.
// - O envio: o perfil `production` publica na Play de verdade (decisão do #154);
//   para teste existe o perfil `interno`. Numeração remota, canal e ambiente de
//   produção (sem `environment` a chave do Supabase sai vazia no binário, 05/08).
// - OTA × módulo nativo: expo-audio e expo-media-library nunca são importados no
//   topo do arquivo; só por `require` dentro de função guardada, porque o OTA
//   chega a binários que não têm esses módulos (1.0.3 e 1.0.4/1.0.5).
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "../scripts/semComentarios.mjs";

const raiz = join(__dirname, "..");
const app = JSON.parse(readFileSync(join(raiz, "app.json"), "utf8")).expo;
const eas = JSON.parse(readFileSync(join(raiz, "eas.json"), "utf8"));

type Plugin = string | [string, Record<string, unknown>];
const plugin = (nome: string): Record<string, unknown> => {
  const p = (app.plugins as Plugin[]).find((x) => Array.isArray(x) && x[0] === nome) as [string, Record<string, unknown>] | undefined;
  if (!p) throw new Error(`plugin ${nome} sem configuração no app.json`);
  return p[1];
};

describe("textos de permissão do iPhone", () => {
  it("nenhum texto padrão em inglês no app.json", () => {
    expect(JSON.stringify(app)).not.toMatch(/Allow \$\(PRODUCT_NAME\)/);
  });

  it("câmera tem texto próprio em português (perfil, Kids, chat e a selfie do álbum)", () => {
    const camera = plugin("expo-image-picker").cameraPermission;
    expect(typeof camera).toBe("string");
    expect(camera).toMatch(/^O CBRio usa a câmera/);
    expect(camera).toMatch(/selfie/);
  });

  it("fotos: o MESMO texto no expo-image-picker e no expo-media-library", () => {
    const a = plugin("expo-image-picker").photosPermission;
    expect(typeof a).toBe("string");
    expect(plugin("expo-media-library").photosPermission).toBe(a);
    expect(plugin("expo-media-library").savePhotosPermission).toMatch(/batismo/);
  });

  it("microfone: o MESMO texto no áudio do chat, no ditado e no picker", () => {
    const a = plugin("expo-audio").microphonePermission;
    expect(typeof a).toBe("string");
    expect(plugin("expo-speech-recognition").microphonePermission).toBe(a);
    expect(plugin("expo-image-picker").microphonePermission).toBe(a);
  });

  it("localização 'sempre' em português (o plugin legado do expo-location põe a chave)", () => {
    const ip = app.ios.infoPlist;
    expect(ip.NSLocationAlwaysUsageDescription).toBe(ip.NSLocationWhenInUseUsageDescription);
    expect(ip.NSLocationAlwaysAndWhenInUseUsageDescription).toBe(ip.NSLocationWhenInUseUsageDescription);
  });
});

describe("Android sem leitura da galeria", () => {
  it("READ_MEDIA_VISUAL_USER_SELECTED bloqueada e READ_MEDIA_IMAGES/VIDEO fora", () => {
    expect(app.android.blockedPermissions).toContain("android.permission.READ_MEDIA_VISUAL_USER_SELECTED");
    expect(plugin("expo-media-library").granularPermissions).toEqual([]);
    expect(JSON.stringify(app.android.permissions)).not.toMatch(/READ_MEDIA_(IMAGES|VIDEO)/);
  });

  it("a galeria só é pedida para GRAVAR (writeOnly = true)", () => {
    const fonte = semComentarios(readFileSync(join(raiz, "lib/salvarFotos.ts"), "utf8"));
    const chamadas = fonte.match(/galeria\.(request|get)PermissionsAsync\([^)]*\)/g) ?? [];
    expect(chamadas.length).toBeGreaterThan(0);
    for (const c of chamadas) expect(c, c).toMatch(/PermissionsAsync\(true\b/);
  });
});

describe("envio para a loja", () => {
  it("build de produção: numeração remota, canal e ambiente de produção", () => {
    expect(eas.cli.appVersionSource).toBe("remote");
    expect(eas.build.production.autoIncrement).toBe(true);
    expect(eas.build.production.channel).toBe("production");
    expect(eas.build.production.environment).toBe("production");
  });

  it("o perfil production publica na Play; o perfil interno vai só para o teste interno", () => {
    expect(eas.submit.production.android.track).toBe("production");
    expect(eas.submit.interno.android.track).toBe("internal");
    expect(eas.submit.interno.android.serviceAccountKeyPath).toBe(eas.submit.production.android.serviceAccountKeyPath);
  });
});

describe("OTA × módulo nativo", () => {
  const arquivos: string[] = [];
  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) varrer(p);
      else if (/\.(ts|tsx|js|jsx)$/.test(nome)) arquivos.push(p);
    }
  };
  for (const d of ["app", "lib", "components"]) varrer(join(raiz, d));

  it("expo-audio e expo-media-library nunca são importados no topo do arquivo", () => {
    expect(arquivos.length).toBeGreaterThan(50);
    const ruins = arquivos.filter((p) => {
      const fonte = semComentarios(readFileSync(p, "utf8"));
      return /^\s*import\s+(?!type\b)[^;]*from\s+["'](expo-audio|expo-media-library)["']/m.test(fonte);
    });
    expect(ruins.map((p) => p.slice(raiz.length + 1))).toEqual([]);
  });
});
