-- ============================================================
-- 權限調整 第 9 步：運動戒癮團體專案 —— 考核表（表單維護 + 活動課程連動）
-- 內容：
--   1. ex_participants 新增「參與狀態」（參加中／已結束，既有資料預設參加中）、「處遇類型」（調查／保護管束／假日生活輔導）、
--      「聯絡方式」（可多筆，身分為少年或家長 + 電話）；移除認輔人員欄位（認輔制度取消）；
--      清單不再回傳案號與所屬股別
--   2. ex_form_versions：考核表範本（欄位 + 匯出列印樣式）；每次修改產生新版本，舊版本保留，
--      已填寫的資料永遠對應「當時」的版本（欄位與樣式不會被後來的修改改壞）
--   3. ex_session_youths：每場活動每位少年的 出席狀態、考核狀態、分配的填寫人員、考核表資料
--   4. RPC：
--        ex_form_get／ex_form_save（只有專案管理者與系統管理者可儲存）
--        ex_session_list／ex_session_save（更新：少年名單含狀態；保留既有考核資料）
--        ex_review_get／ex_review_save／ex_review_stamp
--          填寫：專案管理者，或被分配的填寫人員；核章（匯出列印）：專案管理者
--   規則：「已填寫」「已核章」必須有考核表資料；已核章不可再修改；
--         有考核表資料的少年不能被移出該場活動；填寫人員必須是該場「實際出席人員」
-- 資料表不開放直接讀寫，僅能經 RPC 操作（資料庫內驗證 session）。
-- 前提：roles_step1～8 已執行。
-- ============================================================

-- 1. 參與少年：參與狀態、處遇類型、聯絡方式（可多筆），移除認輔人員 ---------------------------
alter table ex_participants add column if not exists status text not null default '參加中';
alter table ex_participants drop constraint if exists ex_participants_status_check;
alter table ex_participants add constraint ex_participants_status_check check (status in ('參加中', '已結束'));

alter table ex_participants add column if not exists treatment_type text;
alter table ex_participants drop constraint if exists ex_participants_treatment_type_check;
alter table ex_participants add constraint ex_participants_treatment_type_check
  check (treatment_type is null or treatment_type in ('調查', '保護管束', '假日生活輔導'));

-- 聯絡方式：[{role: '少年'|'家長', phone: '...'}]
alter table ex_participants add column if not exists contacts jsonb not null default '[]'::jsonb;

-- 認輔制度取消：移除認輔人員欄位（案號、股別、舊的聯絡方式欄位保留於資料表但不再顯示或回傳）
alter table ex_participants drop column if exists counselor_id;

create or replace function ex_participant_list() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', x.id, 'name', x.name, 'gender', x.gender, 'birth_date', x.birth_date,
             'treatment_type', x.treatment_type, 'contacts', x.contacts,
             'status', x.status, 'created_at', x.created_at)
           order by x.created_at desc)
      from ex_participants x
  ), '[]'::jsonb);
end;
$$;

create or replace function ex_participant_save(p_data jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid := nullif(p_data->>'id', '')::uuid;
  v_name text := trim(coalesce(p_data->>'name', ''));
  v_gender text := nullif(p_data->>'gender', '');
  v_status text := coalesce(nullif(p_data->>'status', ''), '參加中');
  v_treat text := nullif(p_data->>'treatment_type', '');
  v_contacts jsonb := '[]'::jsonb;
  e jsonb;
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  if v_name = '' then raise exception '請輸入姓名'; end if;
  if v_gender is not null and v_gender not in ('男', '女', '其他') then raise exception '性別錯誤'; end if;
  if v_status not in ('參加中', '已結束') then raise exception '參與狀態錯誤'; end if;
  if v_treat is not null and v_treat not in ('調查', '保護管束', '假日生活輔導') then raise exception '處遇類型錯誤'; end if;

  -- 聯絡方式：忽略電話為空的項目；身分只能是少年或家長
  if p_data ? 'contacts' and jsonb_typeof(p_data->'contacts') = 'array' then
    if jsonb_array_length(p_data->'contacts') > 10 then raise exception '聯絡方式最多 10 筆'; end if;
    for e in select * from jsonb_array_elements(p_data->'contacts') loop
      continue when trim(coalesce(e->>'phone', '')) = '';
      if coalesce(e->>'role', '') not in ('少年', '家長') then raise exception '聯絡方式的身分只能是少年或家長'; end if;
      if length(e->>'phone') > 50 then raise exception '電話過長'; end if;
      v_contacts := v_contacts || jsonb_build_array(jsonb_build_object('role', e->>'role', 'phone', trim(e->>'phone')));
    end loop;
  end if;

  if v_id is null then
    insert into ex_participants (name, gender, birth_date, treatment_type, contacts, status, created_by)
    values (v_name, v_gender, nullif(p_data->>'birth_date', '')::date, v_treat, v_contacts, v_status, app_session_uid())
    returning id into v_id;
    return v_id;
  end if;

  update ex_participants set
    name = v_name, gender = v_gender, birth_date = nullif(p_data->>'birth_date', '')::date,
    treatment_type = v_treat, contacts = v_contacts, status = v_status, updated_at = now()
   where id = v_id;
  if not found then raise exception '找不到資料'; end if;
  return v_id;
end;
$$;

-- 2. 考核表範本（版本）---------------------------------------------------------
create table if not exists ex_form_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  fields jsonb not null default '[]'::jsonb,   -- [{id,type,label,required,options[],scale_max,hint}]
  print jsonb not null default '{}'::jsonb,    -- {title,subtitle,show_session,show_youth,signatures[],footer}
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table ex_form_versions enable row level security;
revoke all on ex_form_versions from anon, authenticated;

-- 3. 每場活動每位少年的狀態與考核資料 -----------------------------------------------
alter table ex_session_youths add column if not exists attendance text not null default '出席';
alter table ex_session_youths drop constraint if exists ex_session_youths_attendance_check;
alter table ex_session_youths add constraint ex_session_youths_attendance_check check (attendance in ('出席', '缺席', '請假'));
alter table ex_session_youths add column if not exists review_status text not null default '待填寫';
alter table ex_session_youths drop constraint if exists ex_session_youths_review_status_check;
alter table ex_session_youths add constraint ex_session_youths_review_status_check check (review_status in ('待填寫', '已填寫', '已核章'));
alter table ex_session_youths add column if not exists filler_id uuid references probation_officers(id) on delete set null;
alter table ex_session_youths add column if not exists form_version_id uuid references ex_form_versions(id);
alter table ex_session_youths add column if not exists form_data jsonb;
alter table ex_session_youths add column if not exists stamped_at timestamptz;
alter table ex_session_youths add column if not exists stamped_by uuid;

-- 範本 ------------------------------------------------------------------------
create or replace function ex_form_get() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r ex_form_versions%rowtype;
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  select * into r from ex_form_versions order by version desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object('id', r.id, 'version', r.version, 'fields', r.fields, 'print', r.print, 'created_at', r.created_at);
end;
$$;

create or replace function ex_form_save(p_fields jsonb, p_print jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare cur ex_form_versions%rowtype; e jsonb; v_ids text[] := '{}'; v_id uuid;
begin
  if not app_session_is_project_manager('exercise_addiction') then raise exception '僅專案管理者可維護表單'; end if;
  if p_fields is null or jsonb_typeof(p_fields) <> 'array' then raise exception '欄位格式錯誤'; end if;
  if p_print is null or jsonb_typeof(p_print) <> 'object' then raise exception '樣式格式錯誤'; end if;
  if length(p_fields::text) + length(p_print::text) > 200000 then raise exception '內容過長'; end if;

  for e in select * from jsonb_array_elements(p_fields) loop
    if coalesce(e->>'id', '') = '' then raise exception '欄位缺少代號'; end if;
    if e->>'id' = any(v_ids) then raise exception '欄位代號重複'; end if;
    v_ids := v_ids || (e->>'id');
    if coalesce(e->>'type', '') not in ('text', 'textarea', 'number', 'select', 'checkbox', 'scale', 'section') then
      raise exception '欄位類型錯誤';
    end if;
    if trim(coalesce(e->>'label', '')) = '' then raise exception '每個欄位都需要名稱'; end if;
    if e->>'type' in ('select', 'checkbox') and (
         jsonb_typeof(e->'options') <> 'array' or jsonb_array_length(e->'options') < 1) then
      raise exception '選項欄位至少需要一個選項';
    end if;
  end loop;

  select * into cur from ex_form_versions order by version desc limit 1;
  if found and cur.fields = p_fields and cur.print = p_print then return cur.id; end if;   -- 沒有變更，不產生新版本

  insert into ex_form_versions (version, fields, print, created_by)
  values (coalesce(cur.version, 0) + 1, p_fields, p_print, app_session_uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- 活動課程：列表（少年名單含狀態）與儲存 ---------------------------------------------
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
             'youths', coalesce((select jsonb_agg(jsonb_build_object(
                                   'id', x.id, 'name', x.name, 'participant_status', x.status,
                                   'attendance', y.attendance, 'review_status', y.review_status,
                                   'filler_id', y.filler_id, 'filler_name', f.name,
                                   'has_form', y.form_data is not null)
                                 order by x.name)
                                 from ex_session_youths y
                                 join ex_participants x on x.id = y.participant_id
                                 left join probation_officers f on f.id = y.filler_id
                                where y.session_id = s.id), '[]'::jsonb))
           order by s.year desc, s.session_no desc, s.session_date desc nulls last)
      from ex_sessions s
  ), '[]'::jsonb);
end;
$$;

-- youths：[{id, attendance, review_status, filler_id}]；沒有 youths 欄位時不動既有少年名單
create or replace function ex_session_save(p_data jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid := nullif(p_data->>'id', '')::uuid;
  v_status text := coalesce(nullif(p_data->>'status', ''), '規劃中');
  v_duty uuid[];
  v_attended uuid[];
  e jsonb; v_pid uuid; v_att text; v_rs text; v_filler uuid; v_has_data boolean;
  v_keep uuid[] := '{}';
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  if nullif(p_data->>'year', '') is null then raise exception '請選擇年度'; end if;
  if nullif(p_data->>'session_no', '') is null then raise exception '請輸入場次'; end if;
  if v_status not in ('規劃中', '進行中', '已結束', '取消') then raise exception '狀態錯誤'; end if;

  select coalesce(array_agg(distinct x::uuid), '{}') into v_duty
    from jsonb_array_elements_text(coalesce(p_data->'duty_ids', '[]'::jsonb)) x;
  select coalesce(array_agg(distinct x::uuid), '{}') into v_attended
    from jsonb_array_elements_text(coalesce(p_data->'staff_ids', '[]'::jsonb)) x;

  if exists (
       select 1 from unnest(v_duty || v_attended) u
        where not exists (select 1 from project_members m join projects p on p.id = m.project_id
                           where p.key = 'exercise_addiction' and m.officer_id = u)) then
    raise exception '輪值人員與實際出席人員必須是本專案的成員';
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
  end if;

  insert into ex_session_staff (session_id, officer_id, kind) select v_id, u, 'duty' from unnest(v_duty) u;
  insert into ex_session_staff (session_id, officer_id, kind) select v_id, u, 'attended' from unnest(v_attended) u;

  if p_data ? 'youths' then
    for e in select * from jsonb_array_elements(coalesce(p_data->'youths', '[]'::jsonb)) loop
      v_pid := (e->>'id')::uuid;
      v_att := coalesce(nullif(e->>'attendance', ''), '出席');
      v_rs := coalesce(nullif(e->>'review_status', ''), '待填寫');
      v_filler := nullif(e->>'filler_id', '')::uuid;
      if not exists (select 1 from ex_participants where id = v_pid) then raise exception '出席少年必須在參與少年名單中'; end if;
      if v_att not in ('出席', '缺席', '請假') then raise exception '出席狀態錯誤'; end if;
      if v_rs not in ('待填寫', '已填寫', '已核章') then raise exception '考核狀態錯誤'; end if;
      if v_filler is not null and not (v_filler = any(v_attended)) then
        raise exception '填寫人員必須是實際出席人員';
      end if;
      select form_data is not null into v_has_data from ex_session_youths where session_id = v_id and participant_id = v_pid;
      if v_rs in ('已填寫', '已核章') and not coalesce(v_has_data, false) then
        raise exception '尚未填寫考核表，無法設為已填寫或已核章';
      end if;
      insert into ex_session_youths (session_id, participant_id, attendance, review_status, filler_id)
      values (v_id, v_pid, v_att, v_rs, v_filler)
      on conflict (session_id, participant_id) do update
        set attendance = excluded.attendance, review_status = excluded.review_status, filler_id = excluded.filler_id;
      v_keep := v_keep || v_pid;
    end loop;

    if exists (select 1 from ex_session_youths where session_id = v_id and not (participant_id = any(v_keep)) and form_data is not null) then
      raise exception '已有考核表資料的少年不能移出名單';
    end if;
    delete from ex_session_youths where session_id = v_id and not (participant_id = any(v_keep));
  end if;

  return v_id;
end;
$$;

-- 考核表 -----------------------------------------------------------------------
-- 取得單一少年的考核表（含版本、樣式、資料、場次與少年資訊；供填寫與列印使用）
create or replace function ex_review_get(p_session_id uuid, p_participant_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare y ex_session_youths%rowtype; s ex_sessions%rowtype; x ex_participants%rowtype; v ex_form_versions%rowtype; f_name text;
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  select * into y from ex_session_youths where session_id = p_session_id and participant_id = p_participant_id;
  if not found then raise exception '找不到資料'; end if;
  select * into s from ex_sessions where id = p_session_id;
  select * into x from ex_participants where id = p_participant_id;
  if y.form_version_id is not null then
    select * into v from ex_form_versions where id = y.form_version_id;
  else
    select * into v from ex_form_versions order by version desc limit 1;
  end if;
  select name into f_name from probation_officers where id = y.filler_id;
  return jsonb_build_object(
    'session', jsonb_build_object('id', s.id, 'year', s.year, 'session_no', s.session_no, 'session_date', s.session_date,
                                  'topic', s.topic, 'sport', s.sport, 'venue', s.venue, 'lecturer', s.lecturer),
    'youth', jsonb_build_object('id', x.id, 'name', x.name, 'gender', x.gender, 'birth_date', x.birth_date),
    'attendance', y.attendance, 'review_status', y.review_status,
    'filler_id', y.filler_id, 'filler_name', f_name,
    'stamped_at', y.stamped_at,
    'form', case when v.id is null then null
                 else jsonb_build_object('id', v.id, 'version', v.version, 'fields', v.fields, 'print', v.print) end,
    'data', y.form_data,
    'can_fill', (app_session_is_project_manager('exercise_addiction') or coalesce(y.filler_id = app_session_uid(), false)) and y.review_status <> '已核章',
    'can_stamp', app_session_is_project_manager('exercise_addiction'));
end;
$$;

-- 填寫：專案管理者，或被分配的填寫人員；已核章不可修改
create or replace function ex_review_save(p_session_id uuid, p_participant_id uuid, p_data jsonb) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare y ex_session_youths%rowtype; v ex_form_versions%rowtype; e jsonb; val jsonb; v_has boolean := false;
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
  select * into y from ex_session_youths where session_id = p_session_id and participant_id = p_participant_id for update;
  if not found then raise exception '找不到資料'; end if;
  if not (app_session_is_project_manager('exercise_addiction') or coalesce(y.filler_id = app_session_uid(), false)) then
    raise exception '只有被分配的填寫人員或專案管理者可以填寫';
  end if;
  if y.review_status = '已核章' then raise exception '已核章的考核表不可修改，請先將考核狀態改回'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception '資料格式錯誤'; end if;
  if length(p_data::text) > 100000 then raise exception '內容過長'; end if;

  if y.form_version_id is not null then
    select * into v from ex_form_versions where id = y.form_version_id;
  else
    select * into v from ex_form_versions order by version desc limit 1;
  end if;
  if v.id is null then raise exception '尚未設定考核表，請專案管理者先到「表單維護」設定'; end if;

  -- 是否有任何欄位有值；必填檢查
  for e in select * from jsonb_array_elements(v.fields) loop
    continue when e->>'type' = 'section';
    val := p_data -> (e->>'id');
    if val is not null and val <> 'null'::jsonb and val <> '""'::jsonb and val <> '[]'::jsonb then v_has := true; end if;
  end loop;

  if not v_has then
    update ex_session_youths set form_data = null, form_version_id = null, review_status = '待填寫'
     where session_id = p_session_id and participant_id = p_participant_id;
    return true;
  end if;

  for e in select * from jsonb_array_elements(v.fields) loop
    continue when e->>'type' = 'section' or coalesce((e->>'required')::boolean, false) = false;
    val := p_data -> (e->>'id');
    if val is null or val = 'null'::jsonb or val = '""'::jsonb or val = '[]'::jsonb then
      raise exception '「%」為必填', e->>'label';
    end if;
  end loop;

  update ex_session_youths
     set form_data = p_data, form_version_id = coalesce(y.form_version_id, v.id), review_status = '已填寫'
   where session_id = p_session_id and participant_id = p_participant_id;
  return true;
end;
$$;

-- 匯出列印即核章：專案管理者；需已有考核表資料。回傳列印用內容
create or replace function ex_review_stamp(p_session_id uuid, p_participant_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare y ex_session_youths%rowtype;
begin
  if not app_session_is_project_manager('exercise_addiction') then raise exception '僅專案管理者可匯出列印與核章'; end if;
  select * into y from ex_session_youths where session_id = p_session_id and participant_id = p_participant_id for update;
  if not found then raise exception '找不到資料'; end if;
  if y.form_data is null then raise exception '尚未填寫考核表，無法匯出列印'; end if;
  if y.review_status <> '已核章' then
    update ex_session_youths set review_status = '已核章', stamped_at = now(), stamped_by = app_session_uid()
     where session_id = p_session_id and participant_id = p_participant_id;
  end if;
  return ex_review_get(p_session_id, p_participant_id);
end;
$$;

grant execute on function ex_participant_list() to anon, authenticated;
grant execute on function ex_participant_save(jsonb) to anon, authenticated;
grant execute on function ex_form_get() to anon, authenticated;
grant execute on function ex_form_save(jsonb, jsonb) to anon, authenticated;
grant execute on function ex_session_list() to anon, authenticated;
grant execute on function ex_session_save(jsonb) to anon, authenticated;
grant execute on function ex_review_get(uuid, uuid) to anon, authenticated;
grant execute on function ex_review_save(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function ex_review_stamp(uuid, uuid) to anon, authenticated;
