-- ============================================================================
-- 3DSJ Precificadora — Camada de Acesso (Supabase / Postgres)
-- ============================================================================
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Ele cria:
--   1. Schema privado `private` (não exposto na Data API) + função `private.is_admin()`
--   2. Tabela `public.profiles` (usuários, papéis e status de aprovação)
--   3. Tabela `public.buyers` (base de e-mails de compradores para primeiro acesso)
--   4. Trigger automático na criação de usuário em `auth.users`
--   5. Políticas RLS (Row Level Security) estritas e otimizadas
-- ============================================================================

-- 1. Schema privado para funções auxiliares SECURITY DEFINER
create schema if not exists private;

-- 2. Tabela de perfis
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text not null unique,
  whatsapp text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  last_magic_link_sent_at timestamptz
);

-- Índices para performance de busca, filtros e RLS
create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

create index if not exists profiles_status_created_idx
  on public.profiles (status, created_at desc);

-- 3. Tabela de compradores (e-mails pré-autorizados pelo histórico de compra)
create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nome text,
  whatsapp text,
  source text not null default 'compra',
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists buyers_email_lower_idx
  on public.buyers (lower(email));

-- 4. Função auxiliar para verificar se o usuário autenticado é admin aprovado
--    Fica em `private` para não virar RPC pública em `public`.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and status = 'approved'
  );
$$;

grant usage on schema private to authenticated;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- 5. Trigger para sincronizar novos usuários de auth.users -> public.profiles
--    Regra de primeiro administrador: se ainda não existir nenhum registro em
--    `public.profiles`, o primeiro usuário nasce automaticamente como
--    role = 'admin' e status = 'approved'. Todos os demais nascem 'user' / 'pending'
--    (e nunca confiam em raw_user_meta_data para role/status).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_first_user boolean;
  user_nome text;
  user_whatsapp text;
begin
  -- Trava transacional leve para evitar corrida na criação simultânea do 1º usuário
  perform pg_advisory_xact_lock(hashtext('public.profiles.first_admin'));

  select not exists (select 1 from public.profiles) into is_first_user;

  user_nome := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), '');
  user_whatsapp := nullif(trim(new.raw_user_meta_data ->> 'whatsapp'), '');

  insert into public.profiles (id, nome, email, whatsapp, role, status)
  values (
    new.id,
    user_nome,
    lower(trim(new.email)),
    user_whatsapp,
    case when is_first_user then 'admin' else 'user' end,
    case when is_first_user then 'approved' else 'pending' end
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

-- 6. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.buyers enable row level security;

-- Limpa políticas anteriores se o script for reexecutado
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;

-- Usuário lê apenas o próprio perfil
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Admin lê todos os perfis
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using ((select private.is_admin()));

-- Apenas admin cria perfis diretamente (cadastros normais passam pelo trigger / service_role)
create policy "profiles_insert_admin"
  on public.profiles
  for insert
  to authenticated
  with check ((select private.is_admin()));

-- Apenas admin altera perfis (inclusive status e role)
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Apenas admin exclui perfis
create policy "profiles_delete_admin"
  on public.profiles
  for delete
  to authenticated
  using ((select private.is_admin()));

-- Políticas da tabela buyers (apenas admin e service_role acessam)
drop policy if exists "buyers_admin_all" on public.buyers;
create policy "buyers_admin_all"
  on public.buyers
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- 7. Permissões de schema/tabela para PostgREST
grant select on public.profiles to authenticated;
grant insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.buyers to authenticated;
revoke all on public.profiles from anon;
revoke all on public.buyers from anon;

