import type { SupabaseClient } from "@supabase/supabase-js";
import { recoveryTokens } from "./recoveryLink";

/** O cliente recebido é efêmero e exclusivo do link; nunca usa a sessão aberta no app. */
export async function preparePasswordRecovery(url: string | null, client: SupabaseClient) {
  const tokens = recoveryTokens(url);
  if (!tokens) throw new Error("Link de recuperação inválido.");
  const { data, error } = await client.auth.setSession(tokens);
  const target = data.session?.user?.id;
  if (error || !target || data.user?.id !== target) throw new Error("Link de recuperação inválido.");
  let valid = true, saving = false;
  return {
    invalidate() { valid = false; },
    async save(password: string) {
      if (!valid || saving) throw new Error("Link de recuperação inválido.");
      saving = true;
      try {
        const current = await client.auth.getUser();
        if (!valid || current.error || current.data.user?.id !== target) throw new Error("Link de recuperação inválido.");
        const result = await client.auth.updateUser({ password });
        if (result.error) throw result.error;
        valid = false;
      } finally { saving = false; }
    },
  };
}
