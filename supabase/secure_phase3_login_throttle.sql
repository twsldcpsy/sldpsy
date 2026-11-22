-- ============================================================
-- 資安強化 第三階段：登入嘗試次數限制（登入畫面與流程不變）
-- 規則：15 分鐘內連續輸錯達上限即鎖定 15 分鐘（鎖定期間連正確密碼也不受理）。
--   心理師：以個人計，5 次；保護官：以股別計，10 次（同股多人共用，容許較多）。
-- 系統管理員「重設密碼」會同時解除該帳號的鎖定。鎖定到期後自動重新計算。
-- 前提：secure_phase1／phase2 已執行。
-- ============================================================

create table if not exists login_attempts (
  key text primary key,                       -- 'psy:<uuid>' 或 'off:<股別>'
  fail_count integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);
alter table login_attempts enable row level security;
revoke all on login_attempts from anon, authenticated;

-- 剩餘鎖定秒數（0 = 未鎖定）
create or replace function app_login_locked_seconds(p_key text) returns integer
language sql security definer set search_path = public as $$
  select coalesce((
    select greatest(1, ceil(extract(epoch from (locked_until - now())))::integer)
      from login_attempts where key = p_key and locked_until > now()
  ), 0)
$$;

create or replace function app_login_record_fail(p_key text, p_max integer) returns void
language plpgsql security definer set search_path = public as $$
declare r login_attempts%rowtype;
begin
  delete from login_attempts
   where window_start < now() - interval '1 day' and (locked_until is null or locked_until < now());

  insert into login_attempts (key) values (p_key) on conflict do nothing;
  select * into r from login_attempts where key = p_key for update;

  -- 視窗過期或鎖定已到期：重新計算
  if r.window_start < now() - interval '15 minutes'
     or (r.locked_until is not null and r.locked_until <= now()) then
    r.fail_count := 0; r.window_start := now(); r.locked_until := null;
  end if;

  r.fail_count := r.fail_count + 1;
  if r.fail_count >= p_max then
    r.locked_until := now() + interval '15 minutes';
  end if;

  update login_attempts
     set fail_count = r.fail_count, window_start = r.window_start, locked_until = r.locked_until
   where key = p_key;
end;
$$;

create or replace function app_login_clear(p_key text) returns void
language sql security definer set search_path = public as $$
  delete from login_attempts where key = p_key
$$;

revoke execute on function app_login_locked_seconds(text) from public, anon, authenticated;
revoke execute on function app_login_record_fail(text, integer) from public, anon, authenticated;
revoke execute on function app_login_clear(text) from public, anon, authenticated;

-- 心理師登入：失敗回傳 null；被鎖定回傳 {locked:true, retry_after:秒}
create or replace function login_psychologist(p_id uuid, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r psychologists%rowtype; v_token text; v_key text; v_wait integer;
begin
  select * into r from psychologists where id = p_id and is_active = true;
  if not found then return null; end if;          -- 不存在的帳號不留紀錄，避免灌爆資料表

  v_key := 'psy:' || p_id::text;
  v_wait := app_login_locked_seconds(v_key);
  if v_wait > 0 then return jsonb_build_object('locked', true, 'retry_after', v_wait); end if;

  if not app_pw_check(r.password, p_password) then
    perform app_login_record_fail(v_key, 5);
    v_wait := app_login_locked_seconds(v_key);
    if v_wait > 0 then return jsonb_build_object('locked', true, 'retry_after', v_wait); end if;
    return null;
  end if;

  perform app_login_clear(v_key);
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

-- 保護官登入（以股別計）
create or replace function login_officer(p_department text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r probation_officers%rowtype; v_token text; v_key text; v_wait integer;
begin
  if p_department is null
     or not exists (select 1 from probation_officers where department = p_department) then
    return null;
  end if;

  v_key := 'off:' || p_department;
  v_wait := app_login_locked_seconds(v_key);
  if v_wait > 0 then return jsonb_build_object('locked', true, 'retry_after', v_wait); end if;

  for r in select * from probation_officers where department = p_department order by display_order, created_at loop
    if app_pw_check(r.password, p_password) then
      perform app_login_clear(v_key);
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

  perform app_login_record_fail(v_key, 10);
  v_wait := app_login_locked_seconds(v_key);
  if v_wait > 0 then return jsonb_build_object('locked', true, 'retry_after', v_wait); end if;
  return null;
end;
$$;

-- 管理員重設密碼時，一併解除該帳號（或該股別）的鎖定
create or replace function admin_reset_password_psychologist(target_id uuid, new_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  update psychologists set password = app_pw_hash(new_password) where id = target_id;
  perform app_login_clear('psy:' || target_id::text);
  return true;
end;
$$;

create or replace function admin_reset_password_officer(target_id uuid, new_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_dept text;
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  update probation_officers set password = app_pw_hash(new_password) where id = target_id
  returning department into v_dept;
  if v_dept is not null then perform app_login_clear('off:' || v_dept); end if;
  return true;
end;
$$;
