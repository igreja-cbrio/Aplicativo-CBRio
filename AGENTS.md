# Regras de trabalho e publicação

## Produção já tem usuários reais — orientação do Matheus em 26/11/2026

O aplicativo já foi divulgado e é usado por uma parcela relevante da comunidade.
Produção não é ambiente de testes.

- Toda mudança deve ser testada antes de chegar à produção, inclusive por OTA.
- Preparar e validar em ambiente local, simulador, build de desenvolvimento ou
  distribuição de teste, conforme a mudança. Usar dados e serviços de teste
  quando a validação puder alterar registros, enviar notificações ou afetar usuários.
- Executar as verificações automatizadas pertinentes e validar o fluxo afetado.
  Para mudanças de player, mídia ou interação nativa, testes de código sozinhos
  não comprovam reprodução, áudio ou toque: validar também em aparelho/build de
  teste nas plataformas afetadas, incluindo iPhone quando o relato vier do iOS.
- Se a validação necessária estiver bloqueada, manter a correção sem publicar e
  informar claramente o que falta. Não usar uma publicação em produção para
  descobrir se a correção funciona.
- Reunir correções em atualizações planejadas; não publicar uma OTA ou versão
  a cada ajuste. Uma correção urgente precisa ter urgência justificada e ainda
  passar pela validação adequada antes da publicação.
- Distinguir sempre: correção preparada, testes concluídos e versão publicada.
  Um pedido para investigar ou corrigir não equivale, por si só, a publicar.
- Preservar também os procedimentos existentes do projeto para publicação,
  compatibilidade de runtime e revisão. Esta regra vale para trabalhos futuros.
