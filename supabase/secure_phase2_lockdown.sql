-- ============================================================
-- 資安強化 第二階段（收權限）
-- 前提：secure_phase1_additive.sql 已執行，且「新版前端」已部署上線。
-- 執行後：未登入者（只有 anon key）無法讀寫任何資料表，也無法呼叫管理函式；
--         所有管理／個人函式都在資料庫內檢查 x-app-session token。
-- 登入方式不變。執行後，已開著網頁的使用者需重新登入一次。
-- ============================================================

-- 1. 管理函式：資料庫內驗證「有效 session 且角色為 admin」-------------------
create or replace function admin_update_psychologist(
  target_id uuid, p_name text, p_qualification text, p_contact_info text, p_is_active boolean
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  update psychologists set name = p_name, qualification = p_qualification,
         contact_info = p_contact_info, is_active = p_is_active where id = target_id;
  return true;
end;
$$;

create or replace function admin_delete_psychologist(target_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  delete from psychologists where id = target_id;
  return true;
end;
$$;

create or replace function admin_create_psychologist(
  p_name text, p_qualification text, p_password text, p_contact_info text, p_is_active boolean
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  insert into psychologists (name, qualification, password, contact_info, is_active)
  values (p_name, p_qualification, app_pw_hash(p_password), p_contact_info, p_is_active);
  return true;
end;
$$;

create or replace function admin_reset_password_psychologist(target_id uuid, new_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  update psychologists set password = app_pw_hash(new_password) where id = target_id;
  return true;
end;
$$;

create or replace function admin_create_officer(
  o_name text, o_department text, o_role text, o_password text,
  o_contact_info text, o_extension_number text, o_display_order integer default 0
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid;
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  insert into probation_officers (name, department, role, password, contact_info, extension_number, display_order)
  values (o_name, o_department, o_role, app_pw_hash(o_password), o_contact_info, o_extension_number, o_display_order)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function admin_update_officer(
  target_id uuid, o_name text, o_department text, o_role text,
  o_contact_info text, o_extension_number text, o_display_order integer
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  update probation_officers set name = o_name, department = o_department, role = o_role,
         contact_info = o_contact_info, extension_number = o_extension_number,
         display_order = o_display_order where id = target_id;
  return true;
end;
$$;

create or replace function admin_delete_officer(target_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  delete from probation_officers where id = target_id;
  return true;
end;
$$;

create or replace function admin_reset_password_officer(target_id uuid, new_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  update probation_officers set password = app_pw_hash(new_password) where id = target_id;
  return true;
end;
$$;

-- 2. 清單函式：需有效 session；不再回傳密碼（欄位保留為 null 以相容前端）-------
create or replace function get_admin_view_psychologists()
returns table (id uuid, name text, qualification text, password text, contact_info text,
               is_active boolean, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_ok() then raise exception '請先登入'; end if;
  return query
  select p.id, p.name, p.qualification, null::text, p.contact_info, p.is_active, p.created_at
  from psychologists p order by p.created_at desc;
end;
$$;

create or replace function get_admin_view_officers()
returns table (id uuid, name text, department text, role text, password text, contact_info text,
               extension_number text, created_at timestamptz, display_order integer)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_ok() then raise exception '請先登入'; end if;
  return query
  select p.id, p.name, p.department, p.role, null::text, p.contact_info, p.extension_number,
         p.created_at, p.display_order
  from probation_officers p order by p.display_order asc, p.created_at desc;
end;
$$;

create or replace function get_juveniles_with_department()
returns table (id uuid, name text, gender text, case_type text, probation_officer_id uuid, department text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_ok() then raise exception '請先登入'; end if;
  return query
  select j.id, j.name, j.gender, j.case_number, j.probation_officer_id, coalesce(p.department, '未分股')
  from juveniles j left join probation_officers p on j.probation_officer_id = p.id
  order by j.name;
end;
$$;

-- 3. 個人函式：session 使用者必須就是本人 -----------------------------------
create or replace function get_psychologist_profile_self(p_id uuid)
returns table (name text, qualification text, contact_info text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_ok() or app_session_user_type() <> 'psychologist' or app_session_uid() <> p_id then
    raise exception '無權限';
  end if;
  return query select p.name, p.qualification, p.contact_info from psychologists p where p.id = p_id;
end;
$$;

create or replace function update_psychologist_profile_self(p_id uuid, p_name text, p_qualification text, p_contact_info text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_ok() or app_session_user_type() <> 'psychologist' or app_session_uid() <> p_id then
    raise exception '無權限';
  end if;
  update psychologists set name = p_name, qualification = p_qualification, contact_info = p_contact_info
   where id = p_id;
  return true;
end;
$$;

create or replace function change_own_password_psychologist(old_password text, new_password text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_ok() or app_session_user_type() <> 'psychologist' or app_session_uid() <> p_id then
    raise exception '無權限';
  end if;
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
  if not app_session_ok() or app_session_user_type() <> 'officer' or app_session_uid() <> o_id then
    raise exception '無權限';
  end if;
  if exists (select 1 from probation_officers where id = o_id and app_pw_check(password, old_password)) then
    update probation_officers set password = app_pw_hash(new_password) where id = o_id;
    return true;
  end if;
  return false;
end;
$$;

-- 4. 問卷函式：沿用原簽名，改為驗證 session ---------------------------------
-- 管理員：session 必須是 admin，且傳入的 id 必須就是 session 本人（光知道 admin 的 uuid 沒用）
create or replace function survey_assert_admin(p_admin_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_admin_id is null or not app_session_is_admin() or app_session_uid() <> p_admin_id then
    raise exception '僅限系統管理員操作';
  end if;
end;
$$;

-- 一般使用者：session 必須與傳入的身分類型與 id 相符
create or replace function survey_actor_group(p_type text, p_id uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_group text;
begin
  if not app_session_ok() or app_session_user_type() is distinct from p_type
     or app_session_uid() is distinct from p_id then
    raise exception '無權限';
  end if;
  if p_type = 'psychologist' then
    if not exists (select 1 from psychologists where id = p_id and is_active = true) then
      raise exception '找不到使用者身分';
    end if;
    return '心理師';
  elsif p_type = 'officer' then
    select coalesce(department, '未分股') into v_group from probation_officers where id = p_id;
    if not found then raise exception '找不到使用者身分'; end if;
    return v_group;
  end if;
  raise exception '身分類型錯誤';
end;
$$;
revoke execute on function survey_assert_admin(uuid) from public, anon, authenticated;
revoke execute on function survey_actor_group(text, uuid) from public, anon, authenticated;

-- 5. 移除舊函式（舊登入函式、無用的舊簽名）--------------------------------
drop function if exists verify_psychologist_login(uuid, text);
drop function if exists verify_probation_login(text, text);
drop function if exists admin_create_officer(text, text, text, text, text, text);
drop function if exists admin_update_officer(uuid, text, text, text, text, text);

-- 6. 資料表：移除所有 using(true) 政策，改為「有效 session」------------------
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public'
              and tablename in ('bookings','bulletins','departments','guardians','juveniles',
                                'probation_officers','psychologists') loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

revoke all on bookings, bulletins, departments, guardians, juveniles, probation_officers, psychologists
  from anon, authenticated;

-- 讀取：所有有效登入者
create policy s_read on bookings   for select to anon, authenticated using ((select app_session_ok()));
create policy s_read on bulletins  for select to anon, authenticated using ((select app_session_ok()));
create policy s_read on departments for select to anon, authenticated using ((select app_session_ok()));
create policy s_read on guardians  for select to anon, authenticated using ((select app_session_ok()));
create policy s_read on juveniles  for select to anon, authenticated using ((select app_session_ok()));
create policy s_read on probation_officers for select to anon, authenticated using ((select app_session_ok()));
create policy s_read on psychologists for select to anon, authenticated using ((select app_session_ok()));

-- 預約：心理師與保護官可新增；修改與刪除僅保護官
create policy s_insert on bookings for insert to anon, authenticated with check ((select app_session_ok()));
create policy s_update on bookings for update to anon, authenticated
  using ((select app_session_is_officer())) with check ((select app_session_is_officer()));
create policy s_delete on bookings for delete to anon, authenticated using ((select app_session_is_officer()));

-- 少年、家長：寫入僅保護官
create policy s_insert on juveniles for insert to anon, authenticated with check ((select app_session_is_officer()));
create policy s_update on juveniles for update to anon, authenticated
  using ((select app_session_is_officer())) with check ((select app_session_is_officer()));
create policy s_delete on juveniles for delete to anon, authenticated using ((select app_session_is_officer()));

create policy s_insert on guardians for insert to anon, authenticated with check ((select app_session_is_officer()));
create policy s_update on guardians for update to anon, authenticated
  using ((select app_session_is_officer())) with check ((select app_session_is_officer()));
create policy s_delete on guardians for delete to anon, authenticated using ((select app_session_is_officer()));

-- 公告：寫入僅系統管理員（前端只有維護頁會寫）
create policy s_insert on bulletins for insert to anon, authenticated with check ((select app_session_is_admin()));
create policy s_update on bulletins for update to anon, authenticated
  using ((select app_session_is_admin())) with check ((select app_session_is_admin()));
create policy s_delete on bulletins for delete to anon, authenticated using ((select app_session_is_admin()));

-- 保護官只能改自己的姓名／聯絡方式／分機（角色、密碼欄位無寫入權限）
create policy s_update_self on probation_officers for update to anon, authenticated
  using (id = (select app_session_uid()) and (select app_session_is_officer()))
  with check (id = (select app_session_uid()) and (select app_session_is_officer()));

-- 欄位級權限：密碼欄位完全不開放；不給 TRUNCATE／REFERENCES／TRIGGER
grant select, insert, update, delete on bookings, bulletins, guardians, juveniles to anon, authenticated;
grant select on departments to anon, authenticated;
grant select (id, name, email, is_active, created_at, contact_info, qualification)
  on psychologists to anon, authenticated;
grant select (id, name, department_id, role, email, created_at, contact_info, extension_number,
              department, display_order) on probation_officers to anon, authenticated;
grant update (name, contact_info, extension_number) on probation_officers to anon, authenticated;
