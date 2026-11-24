-- ============================================================
-- 權限調整 第 8 步：公告欄維護依專案管理
-- 內容：
--   1. bulletins 新增 project_id（所屬專案；空 = 系統公告，只有系統管理者能維護）
--   2. 專案管理者只能在「自己管理的專案」新增公告，且只能修改／刪除「自己建立」的公告
--      （系統管理者全部可管；取代 step3 中僅限心理服務專案的政策，改為通用的專案判斷）
--   3. 運動戒癮團體專案的公告只能對工作人員公告：資料庫強制把「心理師」的顯示對象清掉
--      （心理服務專案的公告仍可對心理師與全體工作人員公告）
--   4. 讀取依公告對象過濾（先前只在畫面上過濾）：
--        系統管理者：全部；工作人員：對象含全體工作人員、含自己的股別，或自己建立的；
--        心理師：對象含全體心理師或含自己
--   5. 專案管理者無法把公告改到別的專案（project_id 不可被非系統管理者變更）
-- 前提：roles_step1～7 已執行（step3 的 bulletins.created_by 與觸發器）。
-- ============================================================

alter table bulletins add column if not exists project_id uuid references projects(id) on delete set null;
create index if not exists idx_bulletins_project on bulletins(project_id);

-- 目前登入的工作人員的股別
create or replace function app_session_department() returns text
language sql stable security definer set search_path = public, extensions as $$
  select o.department from probation_officers o where o.id = app_session_uid() and app_session_is_officer()
$$;
grant execute on function app_session_department() to anon, authenticated;

-- 系統管理者，或該專案（啟用中）的專案管理者
create or replace function app_session_manages_project(p_project_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select app_session_is_admin()
      or (app_session_is_officer() and exists (
           select 1 from project_members m join projects p on p.id = m.project_id
            where p.id = p_project_id and p.is_active
              and m.officer_id = app_session_uid() and m.project_role = 'manager'))
$$;
grant execute on function app_session_manages_project(uuid) to anon, authenticated;

-- 觸發器：建立者由資料庫記錄；專案不可被非系統管理者變更；運動戒癮專案的公告不對心理師
create or replace function bulletins_set_created_by() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := app_session_uid();
  else
    new.created_by := old.created_by;
    if not app_session_is_admin() then new.project_id := old.project_id; end if;
  end if;

  if new.project_id is not null and exists (
       select 1 from projects where id = new.project_id and key = 'exercise_addiction') then
    new.target_all_psychologists := false;
    new.target_psychologist_ids := '{}'::uuid[];
  end if;
  return new;
end;
$$;
drop trigger if exists trg_bulletins_created_by on bulletins;
create trigger trg_bulletins_created_by before insert or update on bulletins
  for each row execute function bulletins_set_created_by();

-- 政策 ---------------------------------------------------------------------
drop policy if exists s_read on bulletins;
drop policy if exists s_insert on bulletins;
drop policy if exists s_update on bulletins;
drop policy if exists s_delete on bulletins;

create policy s_read on bulletins for select to anon, authenticated
  using (
    (select app_session_is_admin())
    or ((select app_session_is_officer()) and (
          coalesce(target_all_officers, false)
          or (select app_session_department()) = any(coalesce(target_departments, '{}'::text[]))
          or created_by = (select app_session_uid())))
    or ((select app_session_user_type()) = 'psychologist' and (select app_session_ok()) and (
          coalesce(target_all_psychologists, false)
          or (select app_session_uid()) = any(coalesce(target_psychologist_ids, '{}'::uuid[])))));

create policy s_insert on bulletins for insert to anon, authenticated
  with check ((select app_session_is_admin())
              or (project_id is not null and (select app_session_manages_project(project_id))));

create policy s_update on bulletins for update to anon, authenticated
  using ((select app_session_is_admin())
         or (project_id is not null and (select app_session_manages_project(project_id)) and created_by = (select app_session_uid())))
  with check ((select app_session_is_admin())
         or (project_id is not null and (select app_session_manages_project(project_id)) and created_by = (select app_session_uid())));

create policy s_delete on bulletins for delete to anon, authenticated
  using ((select app_session_is_admin())
         or (project_id is not null and (select app_session_manages_project(project_id)) and created_by = (select app_session_uid())));
