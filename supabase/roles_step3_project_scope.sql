-- ============================================================
-- 權限調整 第 3 步：心理服務專案的管理功能、專案管理者的受限版維護
-- 內容：
--   1. 專案新增 key（程式用來辨認專案），第一個專案更名為「心理服務專案」(key = psy_service)；
--      新增「運動戒癮團體專案」(key = exercise_addiction)，不自動指派成員
--   2. app_session_is_project_manager(key)：系統管理者，或該專案（啟用中）的專案管理者
--   3. 心理服務人員（心理師）維護：admin_*_psychologist 的門檻由「系統管理者」改為
--      「心理服務專案的專案管理者或系統管理者」
--   4. 工作人員維護（受限版）：pm_*_officer —— 新增的帳號權限別固定為 general，既有帳號的權限別不可更改；
--      其餘欄位（姓名、股別、身分、聯絡方式、分機、排序）與新增皆可處理，刪除除系統管理者帳號外皆可；
--      唯獨「重設密碼」只能處理權限別為 general 的帳號（否則可重設系統管理者密碼後冒用）
--   5. 公告：新增 created_by；專案管理者只能新增，並只能修改／刪除自己建立的；
--      系統管理者全部可改；既有公告 created_by 為空，視為系統管理者建立
--   6. 問卷：新增 created_by；專案管理者只能看到、修改、刪除、檢視結果自己建立的；
--      系統管理者全部可管理；既有問卷視為系統管理者建立
-- 前提：secure_phase1／2／3、roles_step1、roles_step2 已執行。
-- 不更動：登入函式、session token、其他資料表 RLS、心理師端。
-- ============================================================

-- 1. 專案 key 與更名 ---------------------------------------------------------
alter table projects add column if not exists key text;
create unique index if not exists idx_projects_key on projects(key) where key is not null;

do $$
declare v_id uuid;
begin
  select id into v_id from projects where key = 'psy_service';
  if v_id is null then
    select id into v_id from projects
     where name in ('心理諮商預約專案', '心理服務專案') order by created_at limit 1;
  end if;
  if v_id is null then
    insert into projects (name, description, key)
    values ('心理服務專案', '心理服務相關功能（預約、個案、心理服務人員、統計、核銷）', 'psy_service');
  else
    update projects set name = '心理服務專案', key = 'psy_service' where id = v_id;
  end if;
end $$;

-- 運動戒癮團體專案（頁面尚在設計，成員由系統管理者於專案管理頁指派）
insert into projects (name, description, key)
select '運動戒癮團體專案', '運動戒癮團體相關功能', 'exercise_addiction'
 where not exists (select 1 from projects where key = 'exercise_addiction');

-- 清單多回傳 key（程式用來辨認專案）
create or replace function project_list() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not app_session_is_officer() then raise exception '無權限'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'key', p.key, 'name', p.name, 'description', p.description,
             'is_active', p.is_active, 'created_at', p.created_at,
             'member_count', (select count(*) from project_members m where m.project_id = p.id),
             'my_role', (select m.project_role from project_members m
                          where m.project_id = p.id and m.officer_id = app_session_uid()))
           order by p.created_at)
      from projects p
     where app_session_is_admin()
        or exists (select 1 from project_members m
                    where m.project_id = p.id and m.officer_id = app_session_uid())
  ), '[]'::jsonb);
end;
$$;

-- 2. 專案管理者判斷 ----------------------------------------------------------
create or replace function app_session_is_project_manager(p_key text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select app_session_is_admin()
      or (app_session_is_officer() and exists (
           select 1 from project_members m join projects p on p.id = m.project_id
            where p.key = p_key and p.is_active
              and m.officer_id = app_session_uid() and m.project_role = 'manager'))
$$;
grant execute on function app_session_is_project_manager(text) to anon, authenticated;

-- 3. 心理服務人員維護：把函式內的門檻由 admin 換成心理服務專案管理者 --------------------
do $$
declare r record; v_def text; v_new text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('admin_update_psychologist', 'admin_delete_psychologist',
                                'admin_create_psychologist', 'admin_reset_password_psychologist') loop
    v_def := pg_get_functiondef(r.oid);
    continue when position('app_session_is_project_manager' in v_def) > 0;   -- 已替換過
    v_new := replace(v_def, 'if not app_session_is_admin() then',
                     'if not app_session_is_project_manager(''psy_service'') then');
    if v_new = v_def then
      raise exception '找不到 % 內的管理者門檻，請先確認第二階段已執行', r.proname;
    end if;
    execute v_new;
  end loop;
end $$;

-- 4. 工作人員維護（受限版）--------------------------------------------------
create or replace function pm_create_officer(
  o_name text, o_department text, o_password text, o_contact_info text,
  o_extension_number text, o_display_order integer default 0, o_staff_type text default '保護官'
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid;
begin
  if not app_session_is_project_manager('psy_service') then raise exception '無權限'; end if;
  insert into probation_officers (name, department, role, password, contact_info, extension_number, display_order, staff_type)
  values (o_name, o_department, 'general', app_pw_hash(o_password), o_contact_info, o_extension_number, o_display_order, o_staff_type)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function pm_update_officer(
  target_id uuid, o_name text, o_department text, o_contact_info text,
  o_extension_number text, o_display_order integer, o_staff_type text default '保護官'
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_project_manager('psy_service') then raise exception '無權限'; end if;
  update probation_officers set name = o_name, department = o_department,
         contact_info = o_contact_info, extension_number = o_extension_number,
         display_order = o_display_order, staff_type = o_staff_type where id = target_id;
  return true;
end;
$$;

create or replace function pm_delete_officer(target_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_project_manager('psy_service') then raise exception '無權限'; end if;
  if not app_session_is_admin() and exists (select 1 from probation_officers where id = target_id and role = 'admin') then
    raise exception '僅系統管理者可刪除系統管理者帳號';
  end if;
  delete from probation_officers where id = target_id;
  return true;
end;
$$;

create or replace function pm_reset_password_officer(target_id uuid, new_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_dept text;
begin
  if not app_session_is_project_manager('psy_service') then raise exception '無權限'; end if;
  if not exists (select 1 from probation_officers where id = target_id and role = 'general') then
    raise exception '僅系統管理者可重設此權限別帳號的密碼';
  end if;
  update probation_officers set password = app_pw_hash(new_password) where id = target_id
  returning department into v_dept;
  if v_dept is not null then perform app_login_clear('off:' || v_dept); end if;
  return true;
end;
$$;

grant execute on function pm_create_officer(text, text, text, text, text, integer, text) to anon, authenticated;
grant execute on function pm_update_officer(uuid, text, text, text, text, integer, text) to anon, authenticated;
grant execute on function pm_delete_officer(uuid) to anon, authenticated;
grant execute on function pm_reset_password_officer(uuid, text) to anon, authenticated;

-- 5. 公告：記錄建立者，專案管理者只能改自己的 ----------------------------------
alter table bulletins add column if not exists created_by uuid;

create or replace function bulletins_set_created_by() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := app_session_uid();      -- 由資料庫記錄，不接受前端傳入
  else
    new.created_by := old.created_by;         -- 建立者不可被改寫
  end if;
  return new;
end;
$$;
drop trigger if exists trg_bulletins_created_by on bulletins;
create trigger trg_bulletins_created_by before insert or update on bulletins
  for each row execute function bulletins_set_created_by();

drop policy if exists s_insert on bulletins;
drop policy if exists s_update on bulletins;
drop policy if exists s_delete on bulletins;
create policy s_insert on bulletins for insert to anon, authenticated
  with check ((select app_session_is_project_manager('psy_service')));
create policy s_update on bulletins for update to anon, authenticated
  using ((select app_session_is_admin())
         or ((select app_session_is_project_manager('psy_service')) and created_by = (select app_session_uid())))
  with check ((select app_session_is_admin())
         or ((select app_session_is_project_manager('psy_service')) and created_by = (select app_session_uid())));
create policy s_delete on bulletins for delete to anon, authenticated
  using ((select app_session_is_admin())
         or ((select app_session_is_project_manager('psy_service')) and created_by = (select app_session_uid())));

-- 6. 問卷：記錄建立者，專案管理者只能管理自己的 ----------------------------------
alter table surveys add column if not exists created_by uuid;

create or replace function surveys_set_created_by() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := app_session_uid();
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_surveys_created_by on surveys;
create trigger trg_surveys_created_by before insert or update on surveys
  for each row execute function surveys_set_created_by();

-- 問卷管理入口：系統管理者，或心理服務專案的專案管理者（且 id 必須是 session 本人）
do $$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'survey_assert_admin';
  if position('app_session_is_project_manager' in v_def) = 0 then
    v_new := replace(v_def, 'not app_session_is_admin()', 'not app_session_is_project_manager(''psy_service'')');
    if v_new = v_def then raise exception '找不到 survey_assert_admin 的管理者門檻'; end if;
    execute v_new;
  end if;
end $$;

-- 單一問卷的擁有權：系統管理者可管全部；專案管理者只能管 created_by 是自己的（新增時 p_survey_id 為空）
create or replace function survey_assert_owner(p_admin_id uuid, p_survey_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if app_session_is_admin() or p_survey_id is null then return; end if;
  if not exists (select 1 from surveys where id = p_survey_id and created_by = app_session_uid()) then
    raise exception '只能管理自己建立的問卷';
  end if;
end;
$$;
revoke execute on function survey_assert_owner(uuid, uuid) from public, anon, authenticated;

-- 各問卷管理函式：在原有檢查後補上擁有權檢查；清單只回傳自己有權管理的問卷
do $$
declare r record; v_def text; v_new text; v_arg text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('survey_admin_get', 'survey_admin_save', 'survey_admin_set_closed',
                                'survey_admin_delete', 'survey_admin_roster', 'survey_admin_results',
                                'survey_admin_grant') loop
    v_def := pg_get_functiondef(r.oid);
    continue when position('survey_assert_owner' in v_def) > 0;   -- 已替換過
    v_arg := case when r.proname = 'survey_admin_save' then 'v_id' else 'p_survey_id' end;
    v_new := replace(v_def, 'perform survey_assert_admin(p_admin_id);',
                     'perform survey_assert_admin(p_admin_id); perform survey_assert_owner(p_admin_id, ' || v_arg || ');');
    if v_new = v_def then raise exception '找不到 % 內的管理者檢查', r.proname; end if;
    execute v_new;
  end loop;

  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'survey_admin_list';
  if position('s.created_by = app_session_uid()' in v_def) = 0 then
    v_new := replace(v_def, E'from surveys s\n    ) t',
                     E'from surveys s\n      where app_session_is_admin() or s.created_by = app_session_uid()\n    ) t');
    if v_new = v_def then raise exception '找不到 survey_admin_list 的查詢範圍'; end if;
    execute v_new;
  end if;
end $$;
