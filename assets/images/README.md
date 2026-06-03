# Logos e imagens da CBRio

Arte **oficial** da marca usada pelo app.

## Arquivos em uso

| Arquivo                     | Conteúdo                              | Onde é usado                          |
| --------------------------- | ------------------------------------- | ------------------------------------- |
| `cbrio-heart.png`           | Coração (teal `#408097`)              | header dos formulários, home, ícone Android, base do ícone do app |
| `cbrio-vertical-light.png`  | Coração + "cbrio" (areia `#eae3da`)   | **splash** pulsante (fundo escuro)    |
| `cbrio-vertical.png`        | Coração + "cbrio" (teal)              | uso geral / telas claras              |
| `cbrio-wordmark.png`        | Apenas "cbrio" (teal)                 | cabeçalhos                            |
| `paleta-cores.png`          | Referência da paleta                  | documentação                          |

## Gerados automaticamente (não editar à mão)

| Arquivo         | Como é gerado                                                        |
| --------------- | ------------------------------------------------------------------- |
| `app-icon.png`  | coração sobre fundo areia, 1024×1024, opaco (ícone iOS/Android)     |
| `splash.png`    | logo vertical claro sobre fundo teal `#0B1F26`, 1284×1284           |

> Esses dois são compostos a partir das artes acima. Para regerar após trocar
> uma logo, rode um script com `sharp` compondo coração+fundo (ver histórico do
> commit "logos oficiais"). Referenciados em `app.json` (`icon`, `splash`,
> `android.adaptiveIcon`).
