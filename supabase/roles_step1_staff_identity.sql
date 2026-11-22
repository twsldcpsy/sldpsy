-- ============================================================
-- 權限調整 第 1 步：工作人員「身分」屬性
-- 內容：probation_officers 新增 staff_type（保護官／心輔員／保護性社工／測試人員），
--       現有人員一律預設為「保護官」；更新後台人員函式以讀寫 staff_type。
-- 不更動：登入函式、session token、RLS、心理師相關。
-- 前提：secure_phase1／phase2 已執行。需先於新版前端上線前執行。
-- ============================================================

alter table probation_officers add column if not exists staff_type text not null default '保護官';
alter table probation_officers drop constraint if exists probation_officers_staff_type_check;
alter table probation_officers add constraint probation_officers_staff_type_check
  check (staff_type in ('保護官', '心輔員', '保護性社工', '測試人員'));

-- 欄位級權限：與 role 相同，登入者可讀；寫入只經 admin_* 函式
grant select (staff_type) on probation_officers to anon, authenticated;

-- 後台清單（新增 staff_type；密碼欄位仍為 null）
drop function if exists get_admin_view_officers();
create or replace function get_admin_view_officers()
returns table (id uuid, name text, department text, role text, password text, contact_info text,
               extension_number text, created_at timestamptz, display_order integer, staff_type text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_ok() then raise exception '請先登入'; end if;
  return query
  select p.id, p.name, p.department, p.role, null::text, p.contact_info, p.extension_number,
         p.created_at, p.display_order, p.staff_type
  from probation_officers p order by p.display_order asc, p.created_at desc;
end;
$$;
grant execute on function get_admin_view_officers() to anon, authenticated;

-- 新增人員（新簽名多一個 o_staff_type）
drop function if exists admin_create_officer(text, text, text, text, text, text, integer);
create or replace function admin_create_officer(
  o_name text, o_department text, o_role text, o_password text,
  o_contact_info text, o_extension_number text, o_display_order integer default 0,
  o_staff_type text default '保護官'
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid;
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  insert into probation_officers (name, department, role, password, contact_info, extension_number, display_order, staff_type)
  values (o_name, o_department, o_role, app_pw_hash(o_password), o_contact_info, o_extension_number, o_display_order, o_staff_type)
  returning id into new_id;
  return new_id;
end;
$$;
grant execute on function admin_create_officer(text, text, text, text, text, text, integer, text) to anon, authenticated;

-- 更新人員（新簽名多一個 o_staff_type）
drop function if exists admin_update_officer(uuid, text, text, text, text, text, integer);
create or replace function admin_update_officer(
  target_id uuid, o_name text, o_department text, o_role text,
  o_contact_info text, o_extension_number text, o_display_order integer,
  o_staff_type text default '保護官'
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  update probation_officers set name = o_name, department = o_department, role = o_role,
         contact_info = o_contact_info, extension_number = o_extension_number,
         display_order = o_display_order, staff_type = o_staff_type where id = target_id;
  return true;
end;
$$;
grant execute on function admin_update_officer(uuid, text, text, text, text, text, integer, text) to anon, authenticated;
