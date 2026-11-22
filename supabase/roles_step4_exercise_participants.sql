-- ============================================================
-- 權限調整 第 4 步：運動戒癮團體專案 —— 參與少年資料庫
-- 內容：
--   1. app_session_in_project(key)：系統管理者，或該專案（啟用中）的任一成員（專案管理者、專案成員皆可）
--   2. ex_participants：運動戒癮團體專案自己的參與少年名單（與心理服務專案的個案互相獨立）
--   3. RPC：ex_participant_list／save／delete、project_member_options
--      專案管理者與專案成員都可完整維護（新增、修改、刪除）
--      認輔人員只能是本專案的成員（資料庫驗證）
-- 資料表不開放直接讀寫，僅能經 RPC 操作（資料庫內驗證 session）。
-- 前提：roles_step1／2／3 已執行（專案 key = exercise_addiction 由 step3 建立）。
-- ============================================================

-- 1. 專案成員判斷（任一角色）---------------------------------------------------
create or replace function app_session_in_project(p_key text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select app_session_is_admin()
      or (app_session_is_officer() and exists (
           select 1 from project_members m join projects p on p.id = m.project_id
            where p.key = p_key and p.is_active and m.officer_id = app_session_uid()))
$$;
grant execute on function app_session_in_project(text) to anon, authenticated;

-- 專案成員清單（供下拉選單使用，例如認輔人員）：專案成員即可查詢
create or replace function project_member_options(p_key text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not app_session_in_project(p_key) then raise exception '無權限'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'officer_id', o.id, 'name', o.name, 'department', o.department,
             'project_role', m.project_role)
           order by o.display_order, o.name)
      from project_members m
      join projects p on p.id = m.project_id and p.key = p_key
      join probation_officers o on o.id = m.officer_id
  ), '[]'::jsonb);
end;
$$;
grant execute on function project_member_options(text) to anon, authenticated;

-- 2. 參與少年 ------------------------------------------------------------------
create table if not exists ex_participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text check (gender in ('男', '女', '其他')),
  birth_date date,
  case_number text,
  department text,                                         -- 所屬股別
  contact_info text,                                       -- 少年或家長的聯絡方式
  counselor_id uuid references probation_officers(id) on delete set null,  -- 認輔人員（本專案成員）
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ex_participants_counselor on ex_participants(counselor_id);
alter table ex_participants enable row level security;
revoke all on ex_participants from anon, authenticated;

create or replace function ex_participant_list() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', x.id, 'name', x.name, 'gender', x.gender, 'birth_date', x.birth_date,
             'case_number', x.case_number, 'department', x.department,
             'contact_info', x.contact_info, 'counselor_id', x.counselor_id,
             'counselor_name', o.name, 'created_at', x.created_at)
           order by x.created_at desc)
      from ex_participants x left join probation_officers o on o.id = x.counselor_id
  ), '[]'::jsonb);
end;
$$;

-- 新增（沒有 id）或更新
create or replace function ex_participant_save(p_data jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid := nullif(p_data->>'id', '')::uuid;
  v_name text := trim(coalesce(p_data->>'name', ''));
  v_gender text := nullif(p_data->>'gender', '');
  v_counselor uuid := nullif(p_data->>'counselor_id', '')::uuid;
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  if v_name = '' then raise exception '請輸入姓名'; end if;
  if v_gender is not null and v_gender not in ('男', '女', '其他') then raise exception '性別錯誤'; end if;
  -- 認輔人員只能是本專案的成員
  if v_counselor is not null and not exists (
       select 1 from project_members m join projects p on p.id = m.project_id
        where p.key = 'exercise_addiction' and m.officer_id = v_counselor) then
    raise exception '認輔人員必須是本專案的成員';
  end if;

  if v_id is null then
    insert into ex_participants (name, gender, birth_date, case_number, department, contact_info, counselor_id, created_by)
    values (v_name, v_gender, nullif(p_data->>'birth_date', '')::date, nullif(trim(coalesce(p_data->>'case_number', '')), ''),
            nullif(trim(coalesce(p_data->>'department', '')), ''), nullif(trim(coalesce(p_data->>'contact_info', '')), ''),
            v_counselor, app_session_uid())
    returning id into v_id;
    return v_id;
  end if;

  update ex_participants set
    name = v_name, gender = v_gender, birth_date = nullif(p_data->>'birth_date', '')::date,
    case_number = nullif(trim(coalesce(p_data->>'case_number', '')), ''),
    department = nullif(trim(coalesce(p_data->>'department', '')), ''),
    contact_info = nullif(trim(coalesce(p_data->>'contact_info', '')), ''),
    counselor_id = v_counselor, updated_at = now()
   where id = v_id;
  if not found then raise exception '找不到資料'; end if;
  return v_id;
end;
$$;

create or replace function ex_participant_delete(p_id uuid) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  delete from ex_participants where id = p_id;
  return true;
end;
$$;

grant execute on function ex_participant_list() to anon, authenticated;
grant execute on function ex_participant_save(jsonb) to anon, authenticated;
grant execute on function ex_participant_delete(uuid) to anon, authenticated;
