-- ============================================================
-- 權限調整 第 2 步：專案管理
-- 內容：projects（專案）、project_members（專案成員與專案角色）與管理用 RPC。
--   專案角色：manager（專案管理者）／member（專案成員），依專案各自指派。
--   成員僅限工作人員（probation_officers）；心理師不納入。
--   專案只停用、不提供刪除。
-- 不更動：登入函式、session token、既有 RLS、心理師相關。
-- 前提：secure_phase1／phase2 已執行（需要 app_session_* 函式）。
-- 資料表不開放直接讀寫，僅能經下列 RPC 操作（資料庫內驗證 session）。
-- ============================================================

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists project_members (
  project_id uuid not null references projects(id) on delete cascade,
  officer_id uuid not null references probation_officers(id) on delete cascade,
  project_role text not null check (project_role in ('manager', 'member')),
  created_at timestamptz not null default now(),
  primary key (project_id, officer_id)
);
create index if not exists idx_project_members_officer on project_members(officer_id);

alter table projects enable row level security;
alter table project_members enable row level security;
revoke all on projects, project_members from anon, authenticated;

-- 第一個專案（現有全部功能）；不自動指派任何成員
insert into projects (name, description)
select '心理諮商預約專案', '現有心理諮商預約與管理系統全部功能'
 where not exists (select 1 from projects);

-- 是否可管理該專案成員：系統管理者，或該專案的專案管理者
create or replace function project_can_manage(p_project_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select app_session_is_admin()
      or (app_session_is_officer() and exists (
           select 1 from project_members m
            where m.project_id = p_project_id and m.officer_id = app_session_uid()
              and m.project_role = 'manager'))
$$;
revoke execute on function project_can_manage(uuid) from public, anon, authenticated;

-- 專案清單：系統管理者看全部；其他保護官／工作人員只看自己參與的
create or replace function project_list() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not app_session_is_officer() then raise exception '無權限'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'name', p.name, 'description', p.description,
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

create or replace function project_create(p_name text, p_description text default '') returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid;
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception '請輸入專案名稱'; end if;
  insert into projects (name, description) values (trim(p_name), coalesce(p_description, ''))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function project_update(p_id uuid, p_name text, p_description text, p_is_active boolean)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_is_admin() then raise exception '無權限'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception '請輸入專案名稱'; end if;
  update projects set name = trim(p_name), description = coalesce(p_description, ''),
         is_active = coalesce(p_is_active, true)
   where id = p_id;
  return found;
end;
$$;

-- 專案成員清單（系統管理者或該專案管理者）
create or replace function project_members_list(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not project_can_manage(p_project_id) then raise exception '無權限'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'officer_id', o.id, 'name', o.name, 'department', o.department,
             'staff_type', o.staff_type, 'project_role', m.project_role)
           order by (m.project_role = 'manager') desc, o.display_order, o.name)
      from project_members m join probation_officers o on o.id = m.officer_id
     where m.project_id = p_project_id
  ), '[]'::jsonb);
end;
$$;

-- 新增成員或調整角色（已存在則更新角色）
create or replace function project_member_set(p_project_id uuid, p_officer_id uuid, p_role text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not project_can_manage(p_project_id) then raise exception '無權限'; end if;
  if p_role not in ('manager', 'member') then raise exception '專案角色錯誤'; end if;
  if not exists (select 1 from projects where id = p_project_id) then raise exception '找不到專案'; end if;
  if not exists (select 1 from probation_officers where id = p_officer_id) then raise exception '找不到工作人員'; end if;
  insert into project_members (project_id, officer_id, project_role)
  values (p_project_id, p_officer_id, p_role)
  on conflict (project_id, officer_id) do update set project_role = excluded.project_role;
  return true;
end;
$$;

create or replace function project_member_remove(p_project_id uuid, p_officer_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not project_can_manage(p_project_id) then raise exception '無權限'; end if;
  delete from project_members where project_id = p_project_id and officer_id = p_officer_id;
  return true;
end;
$$;

grant execute on function project_list() to anon, authenticated;
grant execute on function project_create(text, text) to anon, authenticated;
grant execute on function project_update(uuid, text, text, boolean) to anon, authenticated;
grant execute on function project_members_list(uuid) to anon, authenticated;
grant execute on function project_member_set(uuid, uuid, text) to anon, authenticated;
grant execute on function project_member_remove(uuid, uuid) to anon, authenticated;
