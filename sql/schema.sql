-- ============================================================================
-- نادي الرجال السري (SMC) - Membership System
-- Full schema reset + build script for Supabase (PostgreSQL)
-- Safe to re-run: drops any previous versions of these objects first.
-- ============================================================================

-- 1) EXTENSIONS -------------------------------------------------------------
create extension if not exists pgcrypto;

-- 2) DROP OLD OBJECTS (clean slate) -----------------------------------------
drop function if exists public.fn_login(text, text, text) cascade;
drop function if exists public.fn_change_password(uuid, text, text) cascade;
drop function if exists public.fn_request_password_reset(text) cascade;
drop function if exists public.fn_admin_reset_password(uuid, text, text) cascade;
drop function if exists public.fn_register_member(uuid, text, text, text, text, text, text, text) cascade;
drop function if exists public.fn_change_rank(uuid, text, text) cascade;
drop function if exists public.fn_renew_membership(uuid, text) cascade;
drop function if exists public.fn_ban_toggle(uuid, text) cascade;
drop function if exists public.fn_edit_member(uuid, text, text, text, text, text, text) cascade;
drop function if exists public.fn_search_member(uuid, text) cascade;
drop function if exists public.fn_list_all(uuid) cascade;
drop function if exists public.fn_list_password_reset_requests(uuid) cascade;
drop function if exists public.fn_login_roles(text) cascade;
drop function if exists public.fn_default_expiry(text, timestamptz) cascade;
drop function if exists public.fn_touch_updated_at() cascade;

drop table if exists public.password_reset_requests cascade;
drop table if exists public.rank_history cascade;
drop table if exists public.renewal_history cascade;
drop table if exists public.sessions cascade;
drop table if exists public.members cascade;
drop table if exists public.ranks cascade;
drop sequence if exists public.smc_member_seq;

-- 3) SEQUENCE (never reused, even if a member row is deleted) ---------------
create sequence public.smc_member_seq start 1 increment 1;

-- 4) RANKS lookup (display names / metadata only) ----------------------------
create table public.ranks (
  rank_code   text primary key,
  name_ar     text not null,
  sort_order  smallint not null
);

insert into public.ranks (rank_code, name_ar, sort_order) values
  ('A-SA',     'مسؤول . ساموراي',              1),
  ('A-SAF',    'مسؤول . ساموراي سابق',          2),
  ('A',        'مسؤول',                        3),
  ('S-SA',     'مشرف . ساموراي',                4),
  ('S-SAF',    'مشرف . ساموراي سابق',           5),
  ('S',        'مشرف',                          6),
  ('AF-SA',    'مسؤول سابق . ساموراي',          7),
  ('SF-SA',    'مشرف سابق . ساموراي',           8),
  ('SA',       'ساموراي',                       9),
  ('AF-SAF',   'مسؤول سابق . ساموراي سابق',    10),
  ('SF-SAF',   'مشرف سابق . ساموراي سابق',     11),
  ('AF',       'مسؤول سابق',                   12),
  ('SF',       'مشرف سابق',                    13),
  ('SAF',      'ساموراي سابق',                 14),
  ('M',        'عضو',                          15);

-- 5) MEMBERS ------------------------------------------------------------------
create table public.members (
  id                bigint generated always as identity primary key,
  seq_number        integer not null unique,           -- the NNNN portion, permanent
  membership_code   text not null unique,               -- e.g. SMC-000001-A-SA
  name              text not null,
  phone             text not null,
  residence         text not null,
  rank_code         text not null references public.ranks(rank_code),
  facebook_url      text,
  samurai_url       text,
  password_hash     text,                               -- null for plain members (rank M) who don't log in
  login_roles       text[] not null default '{}',        -- subset of {'admin','supervisor','samurai'}
  registered_by_code text,                               -- membership_code of whoever registered them
  registered_by_name text,
  registered_at     timestamptz not null default now(),
  membership_expires_at date,                            -- null = permanent
  status            text not null default 'active' check (status in ('active','frozen','banned')),
  forgot_password   boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_members_name on public.members using gin (to_tsvector('simple', name));
create index idx_members_code on public.members (membership_code);

-- 6) HISTORY / LOG TABLES ------------------------------------------------------
create table public.rank_history (
  id             bigint generated always as identity primary key,
  member_id      bigint not null references public.members(id) on delete cascade,
  old_rank_code  text,
  new_rank_code  text not null,
  old_code       text,
  new_code       text not null,
  changed_by_code text,
  changed_by_name text,
  changed_at     timestamptz not null default now()
);

create table public.renewal_history (
  id             bigint generated always as identity primary key,
  member_id      bigint not null references public.members(id) on delete cascade,
  renewed_by_code text,
  renewed_by_name text,
  renewed_at     timestamptz not null default now(),
  new_expiry     date
);

create table public.password_reset_requests (
  id             bigint generated always as identity primary key,
  member_id      bigint not null references public.members(id) on delete cascade,
  requested_at   timestamptz not null default now(),
  resolved       boolean not null default false,
  resolved_at    timestamptz
);

-- 7) SESSIONS (lightweight app-level auth; static site has no server) --------
create table public.sessions (
  token       uuid primary key default gen_random_uuid(),
  member_id   bigint not null references public.members(id) on delete cascade,
  role        text not null check (role in ('admin','supervisor','samurai')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '12 hours')
);

-- 8) ROW LEVEL SECURITY: lock every table down; all access goes through RPCs --
alter table public.members enable row level security;
alter table public.ranks enable row level security;
alter table public.rank_history enable row level security;
alter table public.renewal_history enable row level security;
alter table public.password_reset_requests enable row level security;
alter table public.sessions enable row level security;
-- (no policies created => no direct access for anon/authenticated; only
--  SECURITY DEFINER functions below, owned by the table owner, can touch them)

-- 9) HELPER FUNCTIONS ----------------------------------------------------------
create function public.fn_login_roles(p_rank text)
returns text[] language sql immutable as $$
  select case
    when p_rank in ('A-SA','A-SAF','A')            then array['admin']
    when p_rank in ('S-SA','S-SAF','S')             then array['supervisor']
    when p_rank = 'AF-SA'                            then array['samurai']
    when p_rank = 'SF-SA'                            then array['samurai']
    when p_rank = 'SA'                               then array['samurai']
    else array[]::text[]
  end
  || case when p_rank in ('A-SA') then array['samurai'] else array[]::text[] end
  || case when p_rank in ('S-SA') then array['samurai'] else array[]::text[] end;
$$;

create function public.fn_default_expiry(p_rank text, p_base timestamptz default now())
returns date language sql immutable as $$
  select case
    when p_rank in ('A-SA','A-SAF','A','S-SA','S-SAF','S') then null
    when p_rank = 'SA' then (p_base + interval '2 years')::date
    else (p_base + interval '1 year')::date
  end;
$$;

create function public.fn_touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger trg_members_touch before update on public.members
  for each row execute function public.fn_touch_updated_at();

-- generates the display code "SMC-000001-A-SA" from seq_number + rank_code
create function public.fn_build_code(p_seq integer, p_rank text)
returns text language sql immutable as $$
  select 'SMC-' || lpad(p_seq::text, 6, '0') || '-' || p_rank;
$$;

-- 10) SESSION-CHECK HELPER -----------------------------------------------------
create function public.fn_check_session(p_token uuid, p_required_role text default null)
returns bigint language plpgsql security definer as $$
declare v_member_id bigint; v_role text;
begin
  select member_id, role into v_member_id, v_role
  from public.sessions where token = p_token and expires_at > now();
  if v_member_id is null then
    raise exception 'جلسة غير صالحة أو منتهية';
  end if;
  if p_required_role is not null and v_role <> p_required_role then
    raise exception 'صلاحيات غير كافية';
  end if;
  return v_member_id;
end; $$;

-- 11) AUTH: LOGIN ----------------------------------------------------------------
create function public.fn_login(p_code text, p_password text, p_role text)
returns table(session_token uuid, member jsonb)
language plpgsql security definer as $$
declare v_row public.members;
declare v_token uuid;
begin
  select * into v_row from public.members where membership_code = p_code;

  if v_row.id is null then
    raise exception 'رمز العضوية غير صحيح';
  end if;
  if v_row.status = 'banned' then
    raise exception 'هذا الحساب محظور';
  end if;
  if v_row.password_hash is null or not (v_row.password_hash = crypt(p_password, v_row.password_hash)) then
    raise exception 'كلمة السر غير صحيحة';
  end if;
  if not (p_role = ANY(v_row.login_roles)) then
    raise exception 'لا تملك صلاحية الدخول بهذه الصفة';
  end if;

  insert into public.sessions (member_id, role) values (v_row.id, p_role)
  returning token into v_token;

  return query select v_token,
    jsonb_build_object(
      'membership_code', v_row.membership_code,
      'name', v_row.name,
      'rank_code', v_row.rank_code,
      'role', p_role,
      'status', v_row.status
    );
end; $$;

-- 12) AUTH: CHANGE PASSWORD -------------------------------------------------------
create function public.fn_change_password(p_token uuid, p_old text, p_new text)
returns boolean language plpgsql security definer as $$
declare v_member_id bigint; v_hash text;
begin
  v_member_id := public.fn_check_session(p_token);
  select password_hash into v_hash from public.members where id = v_member_id;
  if v_hash is null or not (v_hash = crypt(p_old, v_hash)) then
    raise exception 'كلمة السر الحالية غير صحيحة';
  end if;
  update public.members set password_hash = crypt(p_new, gen_salt('bf')), forgot_password = false
    where id = v_member_id;
  return true;
end; $$;

-- 13) FORGOT PASSWORD ---------------------------------------------------------
create function public.fn_request_password_reset(p_code text)
returns boolean language plpgsql security definer as $$
declare v_id bigint;
begin
  select id into v_id from public.members where membership_code = p_code;
  if v_id is null then
    raise exception 'رمز العضوية غير موجود';
  end if;
  update public.members set forgot_password = true where id = v_id;
  insert into public.password_reset_requests (member_id) values (v_id);
  return true;
end; $$;

create function public.fn_admin_reset_password(p_token uuid, p_target_code text, p_new_password text)
returns boolean language plpgsql security definer as $$
declare v_admin bigint; v_target bigint;
begin
  v_admin := public.fn_check_session(p_token, 'admin');
  select id into v_target from public.members where membership_code = p_target_code;
  if v_target is null then raise exception 'العضو غير موجود'; end if;
  update public.members set password_hash = crypt(p_new_password, gen_salt('bf')), forgot_password = false
    where id = v_target;
  update public.password_reset_requests set resolved = true, resolved_at = now()
    where member_id = v_target and resolved = false;
  return true;
end; $$;

create function public.fn_list_password_reset_requests(p_token uuid)
returns table(membership_code text, name text, current_password_hash text, requested_at timestamptz)
language plpgsql security definer as $$
begin
  perform public.fn_check_session(p_token, 'admin');
  return query
    select m.membership_code, m.name, m.password_hash, r.requested_at
    from public.password_reset_requests r
    join public.members m on m.id = r.member_id
    where r.resolved = false
    order by r.requested_at desc;
end; $$;

-- 14) REGISTER NEW MEMBER (admin only) --------------------------------------------
create function public.fn_register_member(
  p_token uuid, p_name text, p_phone text, p_residence text, p_rank_code text,
  p_facebook text, p_samurai_url text, p_initial_password text
) returns jsonb language plpgsql security definer as $$
declare v_admin_id bigint; v_admin public.members;
declare v_seq integer; v_code text; v_expiry date; v_roles text[]; v_hash text; v_new_id bigint;
begin
  v_admin_id := public.fn_check_session(p_token, 'admin');
  select * into v_admin from public.members where id = v_admin_id;

  v_seq := nextval('public.smc_member_seq');
  v_code := public.fn_build_code(v_seq, p_rank_code);
  v_expiry := public.fn_default_expiry(p_rank_code, now());
  v_roles := public.fn_login_roles(p_rank_code);
  v_hash := case when p_initial_password is not null and length(p_initial_password) > 0
                 then crypt(p_initial_password, gen_salt('bf')) else null end;

  insert into public.members (
    seq_number, membership_code, name, phone, residence, rank_code,
    facebook_url, samurai_url, password_hash, login_roles,
    registered_by_code, registered_by_name, membership_expires_at, status
  ) values (
    v_seq, v_code, p_name, p_phone, p_residence, p_rank_code,
    p_facebook, p_samurai_url, v_hash, v_roles,
    v_admin.membership_code, v_admin.name, v_expiry, 'active'
  ) returning id into v_new_id;

  return (select to_jsonb(m) from public.members m where m.id = v_new_id);
end; $$;

-- 15) CHANGE RANK (promote/demote) - admin only -----------------------------------
create function public.fn_change_rank(p_token uuid, p_member_code text, p_new_rank_code text)
returns jsonb language plpgsql security definer as $$
declare v_admin_id bigint; v_admin public.members; v_row public.members;
declare v_new_code text; v_new_expiry date; v_new_roles text[];
begin
  v_admin_id := public.fn_check_session(p_token, 'admin');
  select * into v_admin from public.members where id = v_admin_id;
  select * into v_row from public.members where membership_code = p_member_code;
  if v_row.id is null then raise exception 'هذا العضو غير موجود في النظام'; end if;

  v_new_code := public.fn_build_code(v_row.seq_number, p_new_rank_code);
  v_new_expiry := public.fn_default_expiry(p_new_rank_code, now());
  v_new_roles := public.fn_login_roles(p_new_rank_code);

  insert into public.rank_history (member_id, old_rank_code, new_rank_code, old_code, new_code, changed_by_code, changed_by_name)
    values (v_row.id, v_row.rank_code, p_new_rank_code, v_row.membership_code, v_new_code, v_admin.membership_code, v_admin.name);

  update public.members set
    rank_code = p_new_rank_code,
    membership_code = v_new_code,
    membership_expires_at = v_new_expiry,
    login_roles = v_new_roles
  where id = v_row.id;

  return (select to_jsonb(m) from public.members m where m.id = v_row.id);
end; $$;

-- 16) RENEW MEMBERSHIP (admin only) -----------------------------------------------
create function public.fn_renew_membership(p_token uuid, p_member_code text)
returns date language plpgsql security definer as $$
declare v_admin_id bigint; v_admin public.members; v_row public.members; v_new_expiry date;
begin
  v_admin_id := public.fn_check_session(p_token, 'admin');
  select * into v_admin from public.members where id = v_admin_id;
  select * into v_row from public.members where membership_code = p_member_code;
  if v_row.id is null then raise exception 'هذا العضو غير موجود في النظام'; end if;

  v_new_expiry := (now() + interval '1 year')::date;
  update public.members set membership_expires_at = v_new_expiry where id = v_row.id;
  insert into public.renewal_history (member_id, renewed_by_code, renewed_by_name, new_expiry)
    values (v_row.id, v_admin.membership_code, v_admin.name, v_new_expiry);

  return v_new_expiry;
end; $$;

-- 17) BAN / UNBAN TOGGLE (admin only) ---------------------------------------------
create function public.fn_ban_toggle(p_token uuid, p_member_code text)
returns text language plpgsql security definer as $$
declare v_admin_id bigint; v_row public.members; v_new_status text;
begin
  v_admin_id := public.fn_check_session(p_token, 'admin');
  select * into v_row from public.members where membership_code = p_member_code;
  if v_row.id is null then raise exception 'هذا العضو غير موجود في النظام'; end if;

  v_new_status := case when v_row.status = 'banned' then 'active' else 'banned' end;
  update public.members set status = v_new_status where id = v_row.id;
  return v_new_status;
end; $$;

-- 18) EDIT MEMBER DATA (admin only) -----------------------------------------------
create function public.fn_edit_member(
  p_token uuid, p_member_code text, p_name text, p_phone text,
  p_residence text, p_facebook text, p_samurai_url text
) returns jsonb language plpgsql security definer as $$
declare v_admin_id bigint; v_row public.members;
begin
  v_admin_id := public.fn_check_session(p_token, 'admin');
  select * into v_row from public.members where membership_code = p_member_code;
  if v_row.id is null then raise exception 'هذا العضو غير موجود في النظام'; end if;

  update public.members set
    name = coalesce(p_name, name),
    phone = coalesce(p_phone, phone),
    residence = coalesce(p_residence, residence),
    facebook_url = coalesce(p_facebook, facebook_url),
    samurai_url = coalesce(p_samurai_url, samurai_url)
  where id = v_row.id;

  return (select to_jsonb(m) from public.members m where m.id = v_row.id);
end; $$;

-- 19) SEARCH / LIST (any logged-in role; column use is trimmed in the frontend) ---
create function public.fn_search_member(p_token uuid, p_query text)
returns setof public.members language plpgsql security definer as $$
begin
  perform public.fn_check_session(p_token);
  return query
    select * from public.members
    where membership_code ilike '%'||p_query||'%' or name ilike '%'||p_query||'%'
    order by seq_number asc;
end; $$;

create function public.fn_list_all(p_token uuid)
returns setof public.members language plpgsql security definer as $$
begin
  perform public.fn_check_session(p_token);
  return query select * from public.members order by seq_number asc;
end; $$;

-- 20) GRANTS ----------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant execute on function
  public.fn_login(text, text, text),
  public.fn_change_password(uuid, text, text),
  public.fn_request_password_reset(text),
  public.fn_admin_reset_password(uuid, text, text),
  public.fn_list_password_reset_requests(uuid),
  public.fn_register_member(uuid, text, text, text, text, text, text, text),
  public.fn_change_rank(uuid, text, text),
  public.fn_renew_membership(uuid, text),
  public.fn_ban_toggle(uuid, text),
  public.fn_edit_member(uuid, text, text, text, text, text, text),
  public.fn_search_member(uuid, text),
  public.fn_list_all(uuid)
to anon, authenticated;

-- 21) SEED: register Ahmed Hamed Al-Mu'tasim as member #1 (Admin . Samurai) ------
do $$
declare v_seq integer; v_code text; v_expiry date; v_roles text[]; v_new_id bigint;
begin
  v_seq := nextval('public.smc_member_seq');           -- = 1
  v_code := public.fn_build_code(v_seq, 'A-SA');         -- SMC-000001-A-SA
  v_expiry := public.fn_default_expiry('A-SA', now());   -- null (permanent)
  v_roles := public.fn_login_roles('A-SA');              -- {admin, samurai}

  insert into public.members (
    seq_number, membership_code, name, phone, residence, rank_code,
    facebook_url, samurai_url, password_hash, login_roles,
    registered_by_code, registered_by_name, membership_expires_at, status
  ) values (
    v_seq, v_code, 'أحمد حامد المعتصم', '0903333299', 'العباسية', 'A-SA',
    'https://www.facebook.com/ahmd.hamd.alm.tsm',
    'https://www.facebook.com/profile.php?id=61578498590754',
    crypt('SMC@Change_Me_2026', gen_salt('bf')),   -- TEMPORARY password - change on first login
    v_roles,
    v_code, 'أحمد حامد المعتصم', v_expiry, 'active'
  ) returning id into v_new_id;

  -- self-registered, so update the registered_by_code to the final code (same value here)
  update public.members set registered_by_code = v_code where id = v_new_id;
end $$;

-- Done. First login:
--   membership code: SMC-000001-A-SA
--   temporary password: SMC@Change_Me_2026   <-- CHANGE THIS IMMEDIATELY AFTER FIRST LOGIN
