import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import * as Updates from "expo-updates";
import { trackErro } from "../../lib/telemetria";

/**
 * ⚠️⚠️ O APP NÃO TINHA NENHUM ERROR BOUNDARY (auditoria 06/08/2026).
 *
 * Varredura em app/, components/, lib/ e contexts/: ZERO ocorrências de
 * `componentDidCatch`/`getDerivedStateFromError`, e nenhuma rota exporta
 * `ErrorBoundary` (o expo-router só protege rota que exporta o dele —
 * `useScreens.js`; e o overlay de erro só existe em DEV, `renderRootComponent`).
 * Em produção, qualquer exceção de render subia até a raiz e o React Native
 * **encerrava o app na cara da pessoa, sem mensagem**.
 *
 * O handler global de `lib/telemetria.ts` REGISTRA o fatal, mas não impede: ele
 * repassa pro handler padrão. Ou seja, a gente sabia do crash e a pessoa
 * continuava sem app.
 *
 * Gatilhos já mapeados: `scrollToIndex` do carrossel da Home sem
 * `getItemLayout`/`onScrollToIndexFailed` (uma leva grande de destaques lança
 * invariant) e dado inesperado do banco em tela de lista.
 *
 * ⚠️ Fica na RAIZ, FORA dos providers (tema, tradução, portão de atualização,
 * auth) — assim ele cobre erro DELES também. Por isso as cores aqui são fixas:
 * não dá pra usar `useColors()` (é classe, e o provider pode ser justamente o
 * que quebrou). São as cores da marca, legíveis nos dois temas.
 */
type Props = { children: React.ReactNode };
type State = { erro: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo) {
    // Best-effort: telemetria nunca pode impedir a tela de erro de aparecer.
    try {
      trackErro("render_crash", {
        message: String(erro?.message || erro).slice(0, 300),
        // Só o topo da pilha de componentes: dá pra achar a tela sem despejar
        // stack gigante (e sem risco de carregar dado da tela junto).
        label: String(info?.componentStack || "").trim().split("\n")[0]?.slice(0, 120),
      });
    } catch {
      // silêncio proposital
    }
  }

  tentarDeNovo = async () => {
    // 1ª tentativa: recarregar o bundle (limpa qualquer estado podre).
    // ⚠️ `Updates.reloadAsync` não existe em dev/Expo Go — daí o guard.
    if (Updates.isEnabled) {
      try {
        await Updates.reloadAsync();
        return;
      } catch {
        // cai no reset de estado abaixo
      }
    }
    // 2ª: só re-renderiza. Se o erro for determinístico a tela volta — mas
    // com um botão, que é melhor que o app fechando sozinho.
    this.setState({ erro: null });
  };

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <View style={estilos.fundo}>
        <View style={estilos.caixa}>
          <Text style={estilos.titulo}>Algo deu errado</Text>
          <Text style={estilos.texto}>
            O app encontrou um problema inesperado nesta tela. Você pode tentar de novo —
            seus dados estão salvos.
          </Text>
          <Pressable
            onPress={this.tentarDeNovo}
            style={({ pressed }) => [estilos.botao, pressed && estilos.botaoPressionado]}
            accessibilityRole="button"
            accessibilityLabel="Tentar de novo"
          >
            <Text style={estilos.botaoTexto}>Tentar de novo</Text>
          </Pressable>
          <Text style={estilos.rodape}>
            Se continuar acontecendo, fale com a equipe da CBRio.
          </Text>
        </View>
      </View>
    );
  }
}

const estilos = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: "#0B1F26", // teal escuro da marca (splash) — legível sempre
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  caixa: { width: "100%", maxWidth: 420, alignItems: "center" },
  titulo: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
    textAlign: "center",
  },
  texto: {
    fontSize: 15,
    lineHeight: 22,
    color: "#C9D6D9",
    textAlign: "center",
    marginBottom: 22,
  },
  botao: {
    backgroundColor: "#00B39D",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    minWidth: 200,
    alignItems: "center",
  },
  botaoPressionado: { opacity: Platform.OS === "ios" ? 0.75 : 0.9 },
  botaoTexto: { color: "#04262B", fontSize: 16, fontWeight: "700" },
  rodape: { fontSize: 12, color: "#7E9094", marginTop: 18, textAlign: "center" },
});

export default ErrorBoundary;
