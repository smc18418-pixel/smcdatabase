-- ============================================================================
-- SMC — Patch 2 (additive only)
-- Adds: security questions + answers, forced "change password on first login"
-- flag, self-service rank-change support, admin-assigned initial passwords.
-- Nothing existing is dropped or altered destructively. Safe to re-run.
-- Run this AFTER sql/schema.sql has already been applied once.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1) NEW COLUMNS on members (all nullable / defaulted — no data loss) --------
alter table public.members add column if not exists must_change_password boolean not null default false;
alter table public.members add column if not exists security_q1 text;
alter table public.members add column if not exists security_a1_hash text;
alter table public.members add column if not exists security_q2 text;
alter table public.members add column if not exists security_a2_hash text;
alter table public.members add column if not exists security_q3 text;
alter table public.members add column if not exists security_a3_hash text;
-- (these never appear in fn_search_member / fn_list_all output columns used
--  by the site — the frontend simply doesn't render them; they are only
--  read/written through the dedicated functions below)

-- 2) NEW TABLE: short-lived tickets proving security questions were answered
create table if not exists public.password_reset_tickets (
  ticket      uuid primary key default gen_random_uuid(),
  member_id   bigint not null references public.members(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '15 minutes'),
  used        boolean not null default false
);
alter table public.password_reset_tickets enable row level security;
-- no anon policies -> only reachable via the SECURITY DEFINER functions below

-- 3) fn_login — UPDATED (only change: also returns must_change_password) ----
--    Everything else about this function is identical to before.
create or replace function public.fn_login(p_code text, p_password text, p_role text)
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
      'status', v_row.status,
      'must_change_password', v_row.must_change_password
    );
end; $$;

-- 4) Forced first-login password change (no "old password" needed) ---------
create or replace function public.fn_set_initial_password(p_token uuid, p_new_password text)
returns boolean language plpgsql security definer as $$
declare v_member_id bigint;
begin
  v_member_id := public.fn_check_session(p_token);
  update public.members
    set password_hash = crypt(p_new_password, gen_salt('bf')), must_change_password = false
  where id = v_member_id;
  return true;
end; $$;

-- 5) Verify current password (gate before changing security questions) ------
create or replace function public.fn_verify_own_password(p_token uuid, p_password text)
returns boolean language plpgsql security definer as $$
declare v_member_id bigint; v_hash text;
begin
  v_member_id := public.fn_check_session(p_token);
  select password_hash into v_hash from public.members where id = v_member_id;
  return v_hash is not null and v_hash = crypt(p_password, v_hash);
end; $$;

-- 6) Set / update the 3 security questions + answers -------------------------
create or replace function public.fn_set_security_questions(
  p_token uuid, p_q1 text, p_a1 text, p_q2 text, p_a2 text, p_q3 text, p_a3 text
) returns boolean language plpgsql security definer as $$
declare v_member_id bigint;
begin
  v_member_id := public.fn_check_session(p_token);
  update public.members set
    security_q1 = p_q1, security_a1_hash = crypt(p_a1, gen_salt('bf')),
    security_q2 = p_q2, security_a2_hash = crypt(p_a2, gen_salt('bf')),
    security_q3 = p_q3, security_a3_hash = crypt(p_a3, gen_salt('bf'))
  where id = v_member_id;
  return true;
end; $$;

-- 7) Forgot-password flow: fetch the 3 saved questions (public, no session) --
create or replace function public.fn_get_security_questions(p_code text)
returns table(q1 text, q2 text, q3 text)
language plpgsql security definer as $$
begin
  return query
    select security_q1, security_q2, security_q3
    from public.members
    where membership_code = p_code
      and security_q1 is not null and security_q2 is not null and security_q3 is not null;
end; $$;

-- 8) Verify the 3 answers -> issue a short-lived reset ticket ----------------
create or replace function public.fn_verify_security_answers(p_code text, p_a1 text, p_a2 text, p_a3 text)
returns uuid language plpgsql security definer as $$
declare v_row public.members; v_ticket uuid;
begin
  select * into v_row from public.members where membership_code = p_code;
  if v_row.id is null
     or v_row.security_a1_hash is null
     or not (v_row.security_a1_hash = crypt(p_a1, v_row.security_a1_hash))
     or not (v_row.security_a2_hash = crypt(p_a2, v_row.security_a2_hash))
     or not (v_row.security_a3_hash = crypt(p_a3, v_row.security_a3_hash))
  then
    raise exception 'الإجابات غير صحيحة . حاول مرة أخرى';
  end if;

  insert into public.password_reset_tickets (member_id) values (v_row.id)
  returning ticket into v_ticket;
  return v_ticket;
end; $$;

-- 9) Redeem the ticket to actually set the new password ----------------------
create or replace function public.fn_reset_password_with_ticket(p_ticket uuid, p_new_password text)
returns boolean language plpgsql security definer as $$
declare v_member_id bigint;
begin
  select member_id into v_member_id from public.password_reset_tickets
    where ticket = p_ticket and used = false and expires_at > now();
  if v_member_id is null then
    raise exception 'انتهت صلاحية الطلب . يرجى المحاولة من جديد';
  end if;

  update public.members set password_hash = crypt(p_new_password, gen_salt('bf')), must_change_password = false
    where id = v_member_id;
  update public.password_reset_tickets set used = true where ticket = p_ticket;
  return true;
end; $$;

-- 10) Admin promotes/demotes ANY member, optionally assigning an initial
--     password (forces must_change_password = true for that member) --------
create or replace function public.fn_change_rank_with_password(
  p_token uuid, p_member_code text, p_new_rank_code text, p_initial_password text
) returns jsonb language plpgsql security definer as $$
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
    login_roles = v_new_roles,
    password_hash = case
      when p_initial_password is not null and length(p_initial_password) > 0
        then crypt(p_initial_password, gen_salt('bf'))
      else password_hash end,
    must_change_password = case
      when p_initial_password is not null and length(p_initial_password) > 0
        then true
      else must_change_password end
  where id = v_row.id;

  return (select to_jsonb(m) from public.members m where m.id = v_row.id);
end; $$;

-- 11) Admin changes THEIR OWN rank (self-service): requires re-entering their
--     current password, and invalidates their current session afterward -----
create or replace function public.fn_self_change_rank(p_token uuid, p_new_rank_code text, p_password text)
returns jsonb language plpgsql security definer as $$
declare v_admin_id bigint; v_row public.members;
declare v_new_code text; v_new_expiry date; v_new_roles text[];
begin
  v_admin_id := public.fn_check_session(p_token, 'admin');
  select * into v_row from public.members where id = v_admin_id;

  if v_row.password_hash is null or not (v_row.password_hash = crypt(p_password, v_row.password_hash)) then
    raise exception 'كلمة السر غير صحيحة';
  end if;

  v_new_code := public.fn_build_code(v_row.seq_number, p_new_rank_code);
  v_new_expiry := public.fn_default_expiry(p_new_rank_code, now());
  v_new_roles := public.fn_login_roles(p_new_rank_code);

  insert into public.rank_history (member_id, old_rank_code, new_rank_code, old_code, new_code, changed_by_code, changed_by_name)
    values (v_row.id, v_row.rank_code, p_new_rank_code, v_row.membership_code, v_new_code, v_row.membership_code, v_row.name);

  update public.members set
    rank_code = p_new_rank_code,
    membership_code = v_new_code,
    membership_expires_at = v_new_expiry,
    login_roles = v_new_roles
  where id = v_row.id;

  delete from public.sessions where token = p_token; -- old session no longer valid

  return (select to_jsonb(m) from public.members m where m.id = v_row.id);
end; $$;

-- 12) GRANTS for all new/updated functions -----------------------------------
grant execute on function
  public.fn_login(text, text, text),
  public.fn_set_initial_password(uuid, text),
  public.fn_verify_own_password(uuid, text),
  public.fn_set_security_questions(uuid, text, text, text, text, text, text),
  public.fn_get_security_questions(text),
  public.fn_verify_security_answers(text, text, text, text),
  public.fn_reset_password_with_ticket(uuid, text),
  public.fn_change_rank_with_password(uuid, text, text, text),
  public.fn_self_change_rank(uuid, text, text)
to anon, authenticated;

-- Done. No existing rows, tables, or functions were removed.
