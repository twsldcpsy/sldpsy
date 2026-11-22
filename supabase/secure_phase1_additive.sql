-- ============================================================
-- 資安強化 第一階段（只新增、不收權限，舊版前端仍可正常運作）
-- 內容：session token 資料表與輔助函式、新登入函式、密碼雜湊（bcrypt）
-- 登入方式（選股別／姓名＋密碼）不變。既有密碼一次性轉為雜湊，使用者不需更改密碼。
-- 執行順序：第一階段 → 部署新版前端 → 第二階段 (secure_phase2_lockdown.sql)
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- 1. Session 資料表（僅存 token 的 SHA-256，不存原始 token）-----------
create table if not exists app_sessions (
  token_hash text primary key,
  user_type text not null check (user_type in ('psychologist', 'officer')),
  user_id uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_app_sessions_expires on app_sessions(expires_at);
alter table app_sessions enable row level security;
revoke all on app_sessions from anon, authenticated;

-- 2. 密碼輔助（不對外開放）------------------------------------------
create or replace function app_pw_hash(p_plain text) returns text
language sql set search_path = public, extensions as $$
  select crypt(p_plain, gen_salt('bf', 10))
$$;

-- 已是 bcrypt 就比對雜湊；否則（過渡期殘留的明文）直接比對
create or replace function app_pw_check(p_stored text, p_input text) returns boolean
language sql immutable set search_path = public, extensions as $$
  select p_stored is not null and p_input is not null and
    case when p_stored ~ '^\$2[abxy]\$' then p_stored = crypt(p_input, p_stored)
         else p_stored = p_input end
$$;

revoke execute on function app_pw_hash(text) from public, anon, authenticated;
revoke execute on function app_pw_check(text, text) from public, anon, authenticated;

-- 3. Session 輔助：從請求標頭 x-app-session 讀 token ------------------
create or replace function app_session_token() returns text
language sql stable as $$
  select nullif(nullif(current_setting('request.headers', true), '')::json ->> 'x-app-session', '')
$$;

create or replace function app_session_user_type() returns text
language sql stable security definer set search_path = public, extensions as $$
  select s.user_type from app_sessions s
   where s.token_hash = encode(digest(app_session_token(), 'sha256'), 'hex') and s.expires_at > now()
$$;

create or replace function app_session_uid() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select s.user_id from app_sessions s
   where s.token_hash = encode(digest(app_session_token(), 'sha256'), 'hex') and s.expires_at > now()
$$;

-- 任何有效登入者（保護官存在，或心理師仍為啟用）
create or replace function app_session_ok() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from app_sessions s
     where s.token_hash = encode(digest(app_session_token(), 'sha256'), 'hex') and s.expires_at > now()
       and ((s.user_type = 'officer' and exists (select 1 from probation_officers o where o.id = s.user_id))
         or (s.user_type = 'psychologist' and exists (select 1 from psychologists p where p.id = s.user_id and p.is_active = true)))
  )
$$;

create or replace function app_session_is_officer() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(app_session_user_type() = 'officer', false) and app_session_ok()
$$;

-- 角色以資料庫現況為準（不信任 session 建立當下的角色）
create or replace function app_session_is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select app_session_is_officer()
     and exists (select 1 from probation_officers o where o.id = app_session_uid() and o.role = 'admin')
$$;

grant execute on function app_session_user_type() to anon, authenticated;
grant execute on function app_session_uid() to anon, authenticated;
grant execute on function app_session_ok() to anon, authenticated;
grant execute on function app_session_is_officer() to anon, authenticated;
grant execute on function app_session_is_admin() to anon, authenticated;

-- 4. 登入前需要的清單（只回傳最少欄位）-------------------------------
create or replace function get_login_psychologists()
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name from psychologists p where p.is_active = true order by p.name
$$;

create or replace function get_login_departments()
returns table (department text)
language sql stable security definer set search_path = public as $$
  select d.department from (
    select o.department, min(o.display_order) as ord
      from probation_officers o where o.department is not null group by o.department
  ) d order by d.ord, d.department
$$;

grant execute on function get_login_psychologists() to anon, authenticated;
grant execute on function get_login_departments() to anon, authenticated;

-- 5. 新登入函式：成功回傳 token，失敗回傳 null --------------------------
create or replace function login_psychologist(p_id uuid, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r psychologists%rowtype; v_token text;
begin
  select * into r from psychologists where id = p_id and is_active = true;
  if not found or not app_pw_check(r.password, p_password) then return null; end if;
  if r.password !~ '^\$2[abxy]\$' then
    update psychologists set password = app_pw_hash(p_password) where id = r.id;
  end if;
  delete from app_sessions where expires_at < now();
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into app_sessions (token_hash, user_type, user_id, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), 'psychologist', r.id, now() + interval '12 hours');
  return jsonb_build_object('token', v_token, 'id', r.id, 'name', r.name);
end;
$$;

create or replace function login_officer(p_department text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r probation_officers%rowtype; v_token text;
begin
  for r in select * from probation_officers where department = p_department order by display_order, created_at loop
    if app_pw_check(r.password, p_password) then
      if r.password !~ '^\$2[abxy]\$' then
        update probation_officers set password = app_pw_hash(p_password) where id = r.id;
      end if;
      delete from app_sessions where expires_at < now();
      v_token := encode(gen_random_bytes(32), 'hex');
      insert into app_sessions (token_hash, user_type, user_id, expires_at)
      values (encode(digest(v_token, 'sha256'), 'hex'), 'officer', r.id, now() + interval '12 hours');
      return jsonb_build_object('token', v_token, 'id', r.id, 'name', r.name,
                                'department', r.department, 'role', r.role);
    end if;
  end loop;
  return null;
end;
$$;

create or replace function app_logout() returns boolean
language sql security definer set search_path = public, extensions as $$
  delete from app_sessions where token_hash = encode(digest(app_session_token(), 'sha256'), 'hex');
  select true
$$;

grant execute on function login_psychologist(uuid, text) to anon, authenticated;
grant execute on function login_officer(text, text) to anon, authenticated;
grant execute on function app_logout() to anon, authenticated;

-- 6. 舊登入／改密碼函式改為相容雜湊（簽名不變，舊前端照常運作）-----------
create or replace function verify_psychologist_login(input_id uuid, input_password text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select exists (select 1 from psychologists p
                  where p.id = input_id and p.is_active = true and app_pw_check(p.password, input_password))
$$;

create or replace function verify_probation_login(input_department text, input_password text)
returns table (id uuid, name text, department text, role text)
language sql security definer set search_path = public, extensions as $$
  select p.id, p.name, p.department, p.role from probation_officers p
   where p.department = input_department and app_pw_check(p.password, input_password)
   order by p.display_order, p.created_at limit 1
$$;

create or replace function change_own_password_psychologist(old_password text, new_password text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from psychologists where id = p_id and app_pw_check(password, old_password)) then
    update psychologists set password = app_pw_hash(new_password) where id = p_id;
    return true;
  end if;
  return false;
end;
$$;

create or replace function change_own_password_officer(old_password text, new_password text, o_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from probation_officers where id = o_id and app_pw_check(password, old_password)) then
    update probation_officers set password = app_pw_hash(new_password) where id = o_id;
    return true;
  end if;
  return false;
end;
$$;

-- 新增／重設密碼一律存雜湊（權限檢查在第二階段補上）
create or replace function admin_reset_password_psychologist(target_id uuid, new_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  update psychologists set password = app_pw_hash(new_password) where id = target_id;
  return true;
end;
$$;

create or replace function admin_reset_password_officer(target_id uuid, new_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  update probation_officers set password = app_pw_hash(new_password) where id = target_id;
  return true;
end;
$$;

create or replace function admin_create_psychologist(
  p_name text, p_qualification text, p_password text, p_contact_info text, p_is_active boolean
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into psychologists (name, qualification, password, contact_info, is_active)
  values (p_name, p_qualification, app_pw_hash(p_password), p_contact_info, p_is_active);
  return true;
end;
$$;

create or replace function admin_create_officer(
  o_name text, o_department text, o_role text, o_password text,
  o_contact_info text, o_extension_number text, o_display_order integer default 0
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid;
begin
  insert into probation_officers (name, department, role, password, contact_info, extension_number, display_order)
  values (o_name, o_department, o_role, app_pw_hash(o_password), o_contact_info, o_extension_number, o_display_order)
  returning id into new_id;
  return new_id;
end;
$$;

-- 7. 既有明文密碼一次性轉為 bcrypt（密碼本身不變，使用者照舊登入）---------
update psychologists set password = app_pw_hash(password)
 where password is not null and password !~ '^\$2[abxy]\$';
update probation_officers set password = app_pw_hash(password)
 where password is not null and password !~ '^\$2[abxy]\$';
