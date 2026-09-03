// ⚠️⚠️ TELA APOSENTADA no mesmo dia em que nasceu (03/09/2026).
//
// Ela era a fila de aceitações do NEXT em rota própria. Virou a **aba
// "Aceitações"** dentro da tela de gestão (`components/next/NextGestao.tsx`),
// por pedido do Marcos: *"para quem tem permissões, abrisse direto na página de
// gerenciamento"*.
//
// Duas portas pro mesmo lugar é o erro que o módulo de Grupos pagou — lá
// "grupos" no menu e "Grupos" na barra abriam telas diferentes, e a saída foi
// juntar numa só. Aqui a junção veio antes de a divergência existir.
//
// ⚠️ O redirect FICA (não apagar o arquivo): o OTA chega em 2 aberturas e um
// bundle intermediário pode ter empurrado esta rota pra pilha. Precedente da
// casa: `inscricao-next.tsx`.
import { Redirect } from "expo-router";

export default function NextEsperaRedirect() {
  return <Redirect href="/next" />;
}
