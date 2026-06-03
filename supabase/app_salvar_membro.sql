-- ============================================================
-- SISTEMA_INTEGRADO_CBRIO — função p/ o app vincular/criar/atualizar o membro
-- do próprio usuário logado (SECURITY DEFINER: contorna o RLS com segurança,
-- mexendo APENAS no membro do auth.uid() que chama).
--
-- Regras:
--  1. Se o profile já tem membro_id, usa ele.
--  2. Senão, tenta achar um mem_membros por CPF, telefone OU nome (normalizados).
--  3. Senão, cria um novo membro (status 'visitante', origem 'app').
--  4. Atualiza os dados informados e vincula profiles.membro_id (+ is_membro_only).
-- Retorna o membro_id vinculado.
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
  v_id uuid;
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_tel text := nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), '');
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  -- 1) já vinculado?
  select membro_id into v_id from public.profiles where id = v_uid;

  -- 2) tenta achar por CPF / telefone / nome (normalizados)
  if v_id is null then
    select id into v_id
    from public.mem_membros
    where deleted_at is null
      and (
        (v_cpf is not null and regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf)
        or (v_tel is not null and right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) = right(v_tel, 11))
        or (p_nome is not null and lower(btrim(nome)) = lower(btrim(p_nome)))
      )
    order by
      (v_cpf is not null and regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf) desc,
      (v_tel is not null) desc
    limit 1;
  end if;

  -- 3) senão, cria
  if v_id is null then
    insert into public.mem_membros
      (id, nome, cpf, email, telefone, data_nascimento,
       status, active, quer_servir, origem_cadastro, created_at, updated_at)
    values (
      gen_random_uuid(),
      coalesce(nullif(btrim(p_nome), ''), 'Membro'),
      v_cpf, p_email, p_telefone, p_nascimento,
      'visitante', true, false, 'app', now(), now()
    )
    returning id into v_id;
  else
    -- 4) atualiza apenas o que veio preenchido
    update public.mem_membros set
      telefone = coalesce(p_telefone, telefone),
      data_nascimento = coalesce(p_nascimento, data_nascimento),
      cpf = coalesce(v_cpf, cpf),
      nome = coalesce(nullif(btrim(p_nome), ''), nome),
      updated_at = now()
    where id = v_id;
  end if;

  update public.profiles
    set membro_id = v_id, is_membro_only = true
  where id = v_uid;

  return v_id;
end;
$function$;

grant execute on function public.app_salvar_membro(text, text, text, text, date) to authenticated;
