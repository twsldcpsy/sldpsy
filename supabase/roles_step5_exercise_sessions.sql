-- ============================================================
-- 權限調整 第 5 步：運動戒癮團體專案 —— 活動課程管理
-- 內容：
--   1. ex_sessions：活動課程（每一堂／場一筆）
--        年度（民國年）、場次、日期、課程主題、運動項目、講師、場地、聯繫窗口、狀態
--   2. ex_session_staff：輪值人員（kind = duty）與實際出席人員（kind = attended），皆限本專案成員
--   3. ex_session_youths：出席少年（來自 ex_participants，少年被刪除時一併移除出席紀錄）
--   4. RPC：ex_session_list／save／delete；專案管理者與專案成員皆可完整維護
-- 資料表不開放直接讀寫，僅能經 RPC 操作（資料庫內驗證 session）。
-- 前提：roles_step1～4 已執行。
-- ============================================================

create table if not exists ex_sessions (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 1 and 999),     -- 民國年
  session_no integer not null check (session_no >= 1),      -- 場次
  session_date date,
  topic text,                                               -- 課程主題
  sport text,                                               -- 運動項目
  lecturer text,                                            -- 講師
  venue text,                                               -- 場地
  contact text,                                             -- 聯繫窗口
  status text not null default '規劃中' check (status in ('規劃中', '進行中', '已結束', '取消')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ex_session_staff (
  session_id uuid not null references ex_sessions(id) on delete cascade,
  officer_id uuid not null references probation_officers(id) on delete cascade,
  kind text not null check (kind in ('duty', 'attended')),
  primary key (session_id, officer_id, kind)
);

create table if not exists ex_session_youths (
  session_id uuid not null references ex_sessions(id) on delete cascade,
  participant_id uuid not null references ex_participants(id) on delete cascade,
  primary key (session_id, participant_id)
);

create index if not exists idx_ex_sessions_year on ex_sessions(year, session_no);
alter table ex_sessions enable row level security;
alter table ex_session_staff enable row level security;
alter table ex_session_youths enable row level security;
revoke all on ex_sessions, ex_session_staff, ex_session_youths from anon, authenticated;

create or replace function ex_session_list() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'year', s.year, 'session_no', s.session_no, 'session_date', s.session_date,
             'topic', s.topic, 'sport', s.sport, 'lecturer', s.lecturer, 'venue', s.venue,
             'contact', s.contact, 'status', s.status,
             'duty', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.name)
                                 from ex_session_staff t join probation_officers o on o.id = t.officer_id
                                where t.session_id = s.id and t.kind = 'duty'), '[]'::jsonb),
             'attended_staff', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.name)
                                 from ex_session_staff t join probation_officers o on o.id = t.officer_id
                                where t.session_id = s.id and t.kind = 'attended'), '[]'::jsonb),
             'youths', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name) order by x.name)
                                 from ex_session_youths y join ex_participants x on x.id = y.participant_id
                                where y.session_id = s.id), '[]'::jsonb))
           order by s.year desc, s.session_no desc, s.session_date desc nulls last)
      from ex_sessions s
  ), '[]'::jsonb);
end;
$$;

-- 新增（沒有 id）或更新；duty_ids／staff_ids／youth_ids 為 uuid 陣列
create or replace function ex_session_save(p_data jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid := nullif(p_data->>'id', '')::uuid;
  v_status text := coalesce(nullif(p_data->>'status', ''), '規劃中');
  v_duty uuid[];
  v_attended uuid[];
  v_youths uuid[];
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  if nullif(p_data->>'year', '') is null then raise exception '請選擇年度'; end if;
  if nullif(p_data->>'session_no', '') is null then raise exception '請輸入場次'; end if;
  if v_status not in ('規劃中', '進行中', '已結束', '取消') then raise exception '狀態錯誤'; end if;

  select coalesce(array_agg(distinct x::uuid), '{}') into v_duty
    from jsonb_array_elements_text(coalesce(p_data->'duty_ids', '[]'::jsonb)) x;
  select coalesce(array_agg(distinct x::uuid), '{}') into v_attended
    from jsonb_array_elements_text(coalesce(p_data->'staff_ids', '[]'::jsonb)) x;
  select coalesce(array_agg(distinct x::uuid), '{}') into v_youths
    from jsonb_array_elements_text(coalesce(p_data->'youth_ids', '[]'::jsonb)) x;

  -- 輪值人員、實際出席人員只能是本專案成員
  if exists (
       select 1 from unnest(v_duty || v_attended) u
        where not exists (select 1 from project_members m join projects p on p.id = m.project_id
                           where p.key = 'exercise_addiction' and m.officer_id = u)) then
    raise exception '輪值人員與實際出席人員必須是本專案的成員';
  end if;
  -- 出席少年必須在參與少年名單中
  if exists (select 1 from unnest(v_youths) u where not exists (select 1 from ex_participants where id = u)) then
    raise exception '出席少年必須在參與少年名單中';
  end if;

  if v_id is null then
    insert into ex_sessions (year, session_no, session_date, topic, sport, lecturer, venue, contact, status, created_by)
    values ((p_data->>'year')::integer, (p_data->>'session_no')::integer,
            nullif(p_data->>'session_date', '')::date,
            nullif(trim(coalesce(p_data->>'topic', '')), ''), nullif(trim(coalesce(p_data->>'sport', '')), ''),
            nullif(trim(coalesce(p_data->>'lecturer', '')), ''), nullif(trim(coalesce(p_data->>'venue', '')), ''),
            nullif(trim(coalesce(p_data->>'contact', '')), ''), v_status, app_session_uid())
    returning id into v_id;
  else
    update ex_sessions set
      year = (p_data->>'year')::integer, session_no = (p_data->>'session_no')::integer,
      session_date = nullif(p_data->>'session_date', '')::date,
      topic = nullif(trim(coalesce(p_data->>'topic', '')), ''), sport = nullif(trim(coalesce(p_data->>'sport', '')), ''),
      lecturer = nullif(trim(coalesce(p_data->>'lecturer', '')), ''), venue = nullif(trim(coalesce(p_data->>'venue', '')), ''),
      contact = nullif(trim(coalesce(p_data->>'contact', '')), ''), status = v_status, updated_at = now()
     where id = v_id;
    if not found then raise exception '找不到資料'; end if;
    delete from ex_session_staff where session_id = v_id;
    delete from ex_session_youths where session_id = v_id;
  end if;

  insert into ex_session_staff (session_id, officer_id, kind) select v_id, u, 'duty' from unnest(v_duty) u;
  insert into ex_session_staff (session_id, officer_id, kind) select v_id, u, 'attended' from unnest(v_attended) u;
  insert into ex_session_youths (session_id, participant_id) select v_id, u from unnest(v_youths) u;
  return v_id;
end;
$$;

create or replace function ex_session_delete(p_id uuid) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  delete from ex_sessions where id = p_id;
  return true;
end;
$$;

grant execute on function ex_session_list() to anon, authenticated;
grant execute on function ex_session_save(jsonb) to anon, authenticated;
grant execute on function ex_session_delete(uuid) to anon, authenticated;
