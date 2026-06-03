# Logos e imagens da CBRio

Coloque os arquivos **oficiais** aqui com **exatamente** estes nomes. Assim que
estiverem no repositório, o app passa a usar a arte oficial no lugar do vetor.

## Logos da marca

| Arquivo                      | O que é                                  | Uso no app                       |
| ---------------------------- | ---------------------------------------- | -------------------------------- |
| `cbrio-heart.png`            | Coração (teal `#408097`)                 | header dos formulários, home     |
| `cbrio-heart-light.png`      | Coração na cor areia/claro (`#eae3da`)   | splash sobre fundo escuro        |
| `cbrio-heart-wordmark.png`   | Coração + "cbrio" (versão teal)          | telas de marca / sobre           |
| `cbrio-wordmark.png`         | Apenas a palavra "cbrio" (teal)          | cabeçalhos                       |

> Use **PNG com fundo transparente**, quadrado quando possível, ~1024×1024px
> (ou maior). SVG também serve — me avise que ajusto o carregamento.

## Ícone e splash do app (opcional, recomendado)

| Arquivo               | Tamanho      | Uso                                  |
| --------------------- | ------------ | ------------------------------------ |
| `icon.png`            | 1024×1024    | ícone do app (iOS/Android)           |
| `adaptive-icon.png`   | 1024×1024    | ícone adaptativo Android (só o símbolo) |
| `splash.png`          | ~1284×2778   | imagem da splash nativa              |

Depois que subir, me avise — eu aponto o `app.json` e o componente
`CbrioHeart`/`SplashPulse` para os arquivos.
