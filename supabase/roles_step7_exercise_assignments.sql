-- ============================================================
-- 權限調整 第 7 步：運動戒癮團體專案 —— 工作分配維護
-- 內容：
--   1. ex_work_assignments：每位工作人員一份「主責項目」（計劃統籌／協同辦理，可留空）與「工作內容」（長文字）
--   2. ex_assignment_list：列出本專案的全部成員（專案管理者、專案成員），
--      人員被指派進專案時自動出現；股別、姓名、分機取自工作人員資料，僅「主責項目」「工作內容」在此維護
--   3. ex_assignment_save：只有專案管理者（與系統管理者）可編輯主責項目與工作內容，對象限本專案成員；
--      專案成員只能閱讀（ex_assignment_list）
--   人員被移出專案後不再出現在列表，其工作內容保留，之後再加回專案時恢復
-- 資料表不開放直接讀寫，僅能經 RPC 操作（資料庫內驗證 session）。
-- 前提：roles_step1～6 已執行。
-- ============================================================

create table if not exists ex_work_assignments (
  officer_id uuid primary key references probation_officers(id) on delete cascade,
  responsibility text check (responsibility in ('計劃統籌', '協同辦理')),   -- 主責項目
  work_content text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
-- 既有環境（先前已建立資料表）補欄位
alter table ex_work_assignments add column if not exists responsibility text;
alter table ex_work_assignments drop constraint if exists ex_work_assignments_responsibility_check;
alter table ex_work_assignments add constraint ex_work_assignments_responsibility_check
  check (responsibility in ('計劃統籌', '協同辦理'));

alter table ex_work_assignments enable row level security;
revoke all on ex_work_assignments from anon, authenticated;

create or replace function ex_assignment_list() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'officer_id', o.id, 'department', o.department, 'name', o.name,
             'extension_number', o.extension_number, 'project_role', m.project_role,
             'responsibility', a.responsibility, 'work_content', a.work_content, 'updated_at', a.updated_at)
           order by o.display_order, o.department, o.name)
      from project_members m
      join projects p on p.id = m.project_id and p.key = 'exercise_addiction'
      join probation_officers o on o.id = m.officer_id
      left join ex_work_assignments a on a.officer_id = o.id
  ), '[]'::jsonb);
end;
$$;

drop function if exists ex_assignment_save(uuid, text);
create or replace function ex_assignment_save(p_officer_id uuid, p_content text, p_responsibility text default null) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_project_manager('exercise_addiction') then raise exception '僅專案管理者可編輯'; end if;
  if length(coalesce(p_content, '')) > 20000 then raise exception '工作內容過長'; end if;
  if nullif(p_responsibility, '') is not null and p_responsibility not in ('計劃統籌', '協同辦理') then
    raise exception '主責項目錯誤';
  end if;
  if not exists (
       select 1 from project_members m join projects p on p.id = m.project_id
        where p.key = 'exercise_addiction' and m.officer_id = p_officer_id) then
    raise exception '只能編輯本專案成員的工作內容';
  end if;
  insert into ex_work_assignments (officer_id, responsibility, work_content, updated_by)
  values (p_officer_id, nullif(p_responsibility, ''), p_content, app_session_uid())
  on conflict (officer_id) do update
    set responsibility = excluded.responsibility, work_content = excluded.work_content,
        updated_at = now(), updated_by = excluded.updated_by;
  return true;
end;
$$;

grant execute on function ex_assignment_list() to anon, authenticated;
grant execute on function ex_assignment_save(uuid, text, text) to anon, authenticated;
