-- ============================================================
-- 權限調整 第 6 步：專案介紹頁（運動戒癮團體專案「團體頁面維護」）
-- 內容：
--   1. project_pages：每個專案一份介紹頁，分「草稿」與「已發布」兩份內容
--        內容為 jsonb（固定章節欄位 + 自訂章節陣列），純文字
--   2. 編輯：專案成員（任一角色）與系統管理者可存草稿；
--            只有該專案的專案管理者與系統管理者可「發布」「取消發布」
--   3. 閱讀：所有保護官／工作人員帳號（已登入的 officer）可讀「已發布」內容；
--            心理師與未登入者不可
--   4. 近期活動（運動戒癮團體專案）：發布內容若開啟 show_upcoming，閱讀時自動帶入
--      尚未到期的活動，只含 年度、場次、日期、主題、運動項目、場地、狀態；
--      不含任何參與少年、出席名單、人員資料
-- 資料表不開放直接讀寫，僅能經 RPC 操作（資料庫內驗證 session）。
-- 前提：roles_step1～5 已執行。
-- ============================================================

create table if not exists project_pages (
  project_id uuid primary key references projects(id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  published jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table project_pages enable row level security;
revoke all on project_pages from anon, authenticated;

-- 專案管理者（該專案）或系統管理者：以專案 key 判斷（心理服務專案以外的專案同樣適用）
create or replace function app_session_is_project_manager_of(p_key text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select app_session_is_project_manager(p_key)
$$;
revoke execute on function app_session_is_project_manager_of(text) from public, anon, authenticated;

-- 編輯端：取得草稿與發布狀態
create or replace function project_page_get(p_key text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r project_pages%rowtype; v_pid uuid;
begin
  if not app_session_in_project(p_key) then raise exception '無權限'; end if;
  select id into v_pid from projects where key = p_key;
  if v_pid is null then raise exception '找不到專案'; end if;
  select * into r from project_pages where project_id = v_pid;
  return jsonb_build_object(
    'draft', coalesce(r.draft, '{}'::jsonb),
    'is_published', r.published is not null,
    'published_at', r.published_at,
    'updated_at', r.updated_at,
    'has_unpublished_changes', r.published is not null and r.published is distinct from r.draft
  );
end;
$$;

-- 儲存草稿（專案成員皆可）
create or replace function project_page_save_draft(p_key text, p_content jsonb) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_pid uuid;
begin
  if not app_session_in_project(p_key) then raise exception '無權限'; end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' then raise exception '內容格式錯誤'; end if;
  if length(p_content::text) > 100000 then raise exception '內容過長'; end if;
  select id into v_pid from projects where key = p_key;
  if v_pid is null then raise exception '找不到專案'; end if;
  insert into project_pages (project_id, draft, updated_by) values (v_pid, p_content, app_session_uid())
  on conflict (project_id) do update set draft = excluded.draft, updated_at = now(), updated_by = excluded.updated_by;
  return true;
end;
$$;

-- 發布：只有專案管理者與系統管理者
create or replace function project_page_publish(p_key text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_pid uuid;
begin
  if not app_session_is_project_manager_of(p_key) then raise exception '僅專案管理者可發布'; end if;
  select id into v_pid from projects where key = p_key;
  update project_pages set published = draft, published_at = now() where project_id = v_pid;
  if not found then raise exception '請先儲存草稿'; end if;
  return true;
end;
$$;

create or replace function project_page_unpublish(p_key text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_pid uuid;
begin
  if not app_session_is_project_manager_of(p_key) then raise exception '僅專案管理者可取消發布'; end if;
  select id into v_pid from projects where key = p_key;
  update project_pages set published = null, published_at = null where project_id = v_pid;
  return true;
end;
$$;

-- 閱讀端：目前有已發布介紹頁的專案（保護官「普通權限」顯示子頁用）
create or replace function project_page_published_list() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not app_session_is_officer() then raise exception '無權限'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('key', p.key, 'name', p.name, 'published_at', g.published_at,
                                        'title', nullif(g.published->>'intro_name', ''))
                     order by p.created_at)
      from project_pages g join projects p on p.id = g.project_id
     where g.published is not null and p.is_active and p.key is not null
  ), '[]'::jsonb);
end;
$$;

-- 閱讀端：已發布內容（與近期活動）
create or replace function project_page_view(p_key text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r project_pages%rowtype; v_p projects%rowtype; v_upcoming jsonb := '[]'::jsonb;
begin
  if not app_session_is_officer() then raise exception '無權限'; end if;
  select * into v_p from projects where key = p_key and is_active;
  if not found then return null; end if;
  select * into r from project_pages where project_id = v_p.id;
  if not found or r.published is null then return null; end if;

  if p_key = 'exercise_addiction' and coalesce((r.published->>'show_upcoming')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object(
             'year', s.year, 'session_no', s.session_no, 'session_date', s.session_date,
             'topic', s.topic, 'sport', s.sport, 'venue', s.venue, 'status', s.status)
           order by s.session_date, s.year, s.session_no), '[]'::jsonb)
      into v_upcoming
      from ex_sessions s
     where s.session_date >= (now() at time zone 'Asia/Taipei')::date
       and s.status in ('規劃中', '進行中');
  end if;

  return jsonb_build_object('name', v_p.name, 'content', r.published,
                            'published_at', r.published_at, 'upcoming', v_upcoming);
end;
$$;

grant execute on function project_page_get(text) to anon, authenticated;
grant execute on function project_page_save_draft(text, jsonb) to anon, authenticated;
grant execute on function project_page_publish(text) to anon, authenticated;
grant execute on function project_page_unpublish(text) to anon, authenticated;
grant execute on function project_page_published_list() to anon, authenticated;
grant execute on function project_page_view(text) to anon, authenticated;
