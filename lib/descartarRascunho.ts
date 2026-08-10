// ============================================================================
// NÃO PERCA O QUE A PESSOA JÁ DIGITOU (10/08/2026 · apontamento 15)
//
// Palavras do Marcos: *"alguns lugares quando se está preenchendo alguma ficha,
// ao clicar fora ele apenas sai sem perguntar se você deseja sair, isso faz com
// que clique errado gere uma certa perda para o usuário. Vi isso tentando
// registrar a frequência."*
//
// ⚠️⚠️ CORREÇÃO DA PREMISSA: **não é o toque fora.** Estes modais são
// `transparent` sem `Pressable` no backdrop — tocar fora não fecha nada. O que
// fecha é o **BOTÃO VOLTAR do Android** (`onRequestClose`), e no iPhone o
// arrastar-pra-baixo da folha. O efeito que ele descreveu é real; a causa é
// outra, e isso importa porque o conserto fica no `onRequestClose`, não num
// overlay novo.
//
// ⚠️⚠️ E A REGRA NÃO É "SEMPRE PERGUNTAR". Confirmar a saída de um modal vazio
// é atrito puro: a pessoa abriu sem querer, aperta voltar, e o app pergunta se
// ela tem certeza de descartar... nada. Pergunta que aparece à toa é pergunta
// que se aprende a dispensar no automático — e aí ela não protege mais quando
// importa. Só se pergunta quando há TRABALHO A PERDER.
// ============================================================================

/**
 * Há rascunho a perder?
 *
 * `campos` é o que a pessoa DIGITOU (textos livres). `mudouAlgo` cobre o que ela
 * ALTEROU sem digitar — marcar presença na chamada, escolher uma equipe, ligar
 * um interruptor. O segundo existe porque a queixa veio justamente da tela de
 * frequência, onde o trabalho é toda a chamada e pode não haver texto nenhum.
 *
 * ⚠️ Espaço em branco NÃO conta como rascunho: um toque acidental na tecla de
 * espaço não deve passar a exigir confirmação pra sair.
 */
export function temRascunho(
  campos: Array<string | null | undefined>,
  mudouAlgo = false,
): boolean {
  if (mudouAlgo) return true;
  return campos.some((c) => String(c ?? "").trim().length > 0);
}

/**
 * O que fazer quando a pessoa tenta fechar.
 *
 * Devolve `"fechar"` (nada a perder — sai direto) ou `"perguntar"`.
 *
 * ⚠️ SE ESTÁ SALVANDO, NÃO PERGUNTA E NÃO FECHA: devolve `"aguardar"`. Fechar no
 * meio de um envio deixa a pessoa sem saber se gravou, e é o único desfecho aqui
 * que pode gerar dado duplicado (ela tenta de novo achando que falhou).
 */
export type AcaoAoFechar = "fechar" | "perguntar" | "aguardar";

export function acaoAoFechar(args: {
  campos?: Array<string | null | undefined>;
  mudouAlgo?: boolean;
  salvando?: boolean;
}): AcaoAoFechar {
  if (args.salvando) return "aguardar";
  return temRascunho(args.campos ?? [], args.mudouAlgo ?? false) ? "perguntar" : "fechar";
}
