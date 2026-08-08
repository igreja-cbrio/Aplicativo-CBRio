-- ⚠️ CÓPIA DE LEITURA — não é a fonte (marcado em 08/08/2026).
-- Este arquivo documenta um objeto que existe no projeto `hhntwfawfnxvuobhdfkb`,
-- mas quem CRIA e ALTERA esse objeto são as migrations do ERP
-- (`SISTEMA_INTEGRADO_CBRIO/supabase/migrations/`). Rodar daqui pode reverter
-- uma alteração feita lá — confira a migration correspondente antes.

-- ============================================================
-- app_salvar_membro — salva a ficha do membro JÁ VINCULADO à conta que chama.
--
-- ⚠️⚠️ NÃO É MAIS A FONTE. A definição canônica vive numa migration do ERP:
--   SISTEMA_INTEGRADO_CBRIO/supabase/migrations/
--     20260806140000_app_salvar_membro_sem_vinculo_por_nome.sql
-- Este arquivo é uma CÓPIA de leitura, mantida em sincronia só pra quem procura
-- o schema do app aqui não achar a versão velha. **Aplicar sempre pela
-- migration** — foi um arquivo desatualizado neste repo que fez o gatilho de
-- `auth.users` ficar 2 meses fora do git (lei de 04/08 no CLAUDE.md do ERP).
--
-- ─── O QUE MUDOU EM 06/08/2026 (auditoria · achado CRÍTICO) ────────────────
-- A versão anterior, quando o profile ainda NÃO tinha `membro_id`, procurava um
-- `mem_membros` por CPF **ou telefone ou NOME EXATO** e vinculava a conta ao
-- primeiro que achasse, SEM prova de posse. Qualquer conta logada digitava o
-- nome de um homônimo e passava a ver o grupo, o comprovante de contribuições e
-- os FILHOS NO KIDS daquela pessoa (é `profiles.membro_id` que alimenta
-- `current_user_membro_id()` nas policies de Kids e contribuições).
-- Também gravava CPF sem validar o dígito verificador e marcava
-- `is_membro_only = true` em qualquer chamador — inclusive staff.
--
-- ⚠️ LEI: **CPF IDENTIFICA, NÃO AUTENTICA.** Vincular conta a cadastro é ato de
-- identidade e passa SÓ por `POST /app/identidade/*` (CPF acha o cadastro → o
-- código vai pro contato QUE JÁ ESTÁ NO CADASTRO → quem prova posse é
-- vinculado). Não reintroduzir ramo de busca aqui.
--
-- ⚠️ A função continua existindo (e com a mesma assinatura) porque
-- `app/(app)/perfil.tsx` ainda a chama. Quando a tela passar a salvar por
-- `PUT /app/membro/perfil`, esta função pode ser DROPADA.
-- ============================================================
create or replace function public.app_salvar_membro(
  p_cpf text,
  p_nome text,
  p_telefone text,
  p_email text,
  p_nascimento date
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_tel text := nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), '');
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  -- Só o cadastro JÁ vinculado a esta conta. Sem busca, sem criação.
  select membro_id into v_id from public.profiles where id = v_uid;

  -- ⚠️⚠️ NÃO REINTRODUZIR RAMO DE BUSCA AQUI (nem por CPF).
  if v_id is null then
    return null;
  end if;

  update public.mem_membros set
    telefone        = coalesce(nullif(btrim(p_telefone), ''), telefone),
    nome            = coalesce(nullif(btrim(p_nome), ''), nome),
    data_nascimento = coalesce(p_nascimento, data_nascimento),
    -- CPF só PREENCHE campo vazio, e só com DV válido (política do gatilho de
    -- auth e do censo). Sobrescrever CPF existente é decisão humana.
    cpf = case
            when coalesce(btrim(cpf), '') <> '' then cpf
            when v_cpf is not null and public.fn_cpf_dv_valido(v_cpf) then v_cpf
            else cpf
          end,
    updated_at = now()
  where id = v_id
    and deleted_at is null;

  -- ⚠️ NÃO toca em `profiles` (a versão antiga marcava is_membro_only = true
  -- pra qualquer chamador, inclusive staff).

  return v_id;
end;
$function$;

grant execute on function public.app_salvar_membro(text, text, text, text, date) to authenticated;
