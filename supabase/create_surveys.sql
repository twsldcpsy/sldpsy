-- ============================================================
-- 問卷系統 (Survey System)
-- 在 Supabase SQL Editor 執行一次即可 (可重複執行)。
-- 所有資料表皆啟用 RLS 且不開放任何 policy，
-- 前端只能透過下方 SECURITY DEFINER 的 RPC 存取。
-- ============================================================

-- 1. Tables ---------------------------------------------------

create table if not exists surveys (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  start_date date not null,
  end_date date not null,
  -- 'single' = 每人一份，送出後可修改 edit_limit 次
  -- 'repeat' = 每人最多填 fill_limit 份，不可修改
  mode text not null default 'single' check (mode in ('single', 'repeat')),
  fill_limit integer not null default 1 check (fill_limit >= 1),
  edit_limit integer not null default 0 check (edit_limit >= 0),
  is_anonymous boolean not null default false,
  is_closed boolean not null default false,
  -- [{id, type, text, required, options[], scale_low, scale_high, show_if:{question_id, values[]}}]
  questions jsonb not null default '[]'::jsonb,
  target_all_psychologists boolean not null default true,
  target_all_officers boolean not null default true,
  target_psychologist_ids uuid[] not null default '{}',
  target_departments text[] not null default '{}',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  check (end_date >= start_date)
);

-- 誰填過、填幾次、被解鎖幾次 (匿名問卷也會記，作為催填與次數限制用)
create table if not exists survey_submissions (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references surveys(id) on delete cascade,
  respondent_type text not null check (respondent_type in ('psychologist', 'officer')),
  respondent_id uuid not null,
  fill_count integer not null default 0,
  edits_used integer not null default 0,
  extra_fills integer not null default 0,
  extra_edits integer not null default 0,
  last_submitted_at timestamptz,
  unique (survey_id, respondent_type, respondent_id)
);

-- 答案本身。匿名問卷的 submission_id 為 NULL，與人名完全切開。
create table if not exists survey_responses (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references surveys(id) on delete cascade,
  submission_id uuid references survey_submissions(id) on delete cascade,
  respondent_type text not null,
  respondent_group text, -- 心理師 = '心理師'，保護官 = 股別名稱，供統計分組
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_survey_responses_survey on survey_responses(survey_id);
create index if not exists idx_survey_submissions_survey on survey_submissions(survey_id);

alter table surveys enable row level security;
alter table survey_submissions enable row level security;
alter table survey_responses enable row level security;

revoke all on surveys, survey_submissions, survey_responses from anon, authenticated;

-- 2. Helpers ---------------------------------------------------

create or replace function survey_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Taipei')::date $$;

create or replace function survey_assert_admin(p_admin_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_admin_id is null or not exists (
    select 1 from probation_officers where id = p_admin_id and role = 'admin'
  ) then
    raise exception '僅限系統管理員操作';
  end if;
end;
$$;

-- 回傳使用者所屬群組 (心理師 / 股別)；身分不存在則拋錯
create or replace function survey_actor_group(p_type text, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_group text;
begin
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

create or replace function survey_in_audience(s surveys, p_type text, p_id uuid, p_group text)
returns boolean language sql stable as $$
  select case
    when p_type = 'psychologist' then s.target_all_psychologists or p_id = any(s.target_psychologist_ids)
    else s.target_all_officers or p_group = any(s.target_departments)
  end
$$;

-- 3. 管理員 RPC -----------------------------------------------

create or replace function survey_admin_list(p_admin_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform survey_assert_admin(p_admin_id);
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.created_at desc) from (
      select s.id, s.title, s.description, s.start_date, s.end_date, s.mode, s.fill_limit,
             s.edit_limit, s.is_anonymous, s.is_closed, s.target_all_psychologists,
             s.target_all_officers, s.target_psychologist_ids, s.target_departments,
             s.created_at, jsonb_array_length(s.questions) as question_count,
             (select count(*) from survey_responses r where r.survey_id = s.id) as response_count,
             (select count(*) from survey_submissions u where u.survey_id = s.id and u.fill_count > 0) as respondent_count
      from surveys s
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function survey_admin_get(p_admin_id uuid, p_survey_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  perform survey_assert_admin(p_admin_id);
  select to_jsonb(s) || jsonb_build_object(
           'has_responses', exists (select 1 from survey_submissions u where u.survey_id = s.id and u.fill_count > 0)
         )
    into v from surveys s where s.id = p_survey_id;
  if v is null then raise exception '找不到問卷'; end if;
  return v;
end;
$$;

-- 新增 (p_survey->>'id' 為空) 或更新問卷。
-- 已有人填答後：題目、作答模式、匿名設定鎖定，其餘可改。
create or replace function survey_admin_save(p_admin_id uuid, p_survey jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p_survey->>'id', '')::uuid;
  v_existing surveys%rowtype;
  v_has_responses boolean;
  v_mode text := coalesce(p_survey->>'mode', 'single');
  v_anon boolean := coalesce((p_survey->>'is_anonymous')::boolean, false);
  v_edit_limit integer := coalesce((p_survey->>'edit_limit')::integer, 0);
  v_fill_limit integer := coalesce((p_survey->>'fill_limit')::integer, 1);
  v_questions jsonb := coalesce(p_survey->'questions', '[]'::jsonb);
  v_psych uuid[];
  v_depts text[];
begin
  perform survey_assert_admin(p_admin_id);

  if coalesce(trim(p_survey->>'title'), '') = '' then raise exception '請輸入問卷標題'; end if;
  if jsonb_typeof(v_questions) <> 'array' or jsonb_array_length(v_questions) = 0 then
    raise exception '請至少新增一題';
  end if;

  -- 匿名問卷無法定位自己的答案，不支援修改
  if v_anon then v_edit_limit := 0; end if;
  if v_mode = 'repeat' then v_edit_limit := 0; else v_fill_limit := 1; end if;

  select coalesce(array_agg(x::uuid), '{}') into v_psych
    from jsonb_array_elements_text(coalesce(p_survey->'target_psychologist_ids', '[]'::jsonb)) x;
  select coalesce(array_agg(x), '{}') into v_depts
    from jsonb_array_elements_text(coalesce(p_survey->'target_departments', '[]'::jsonb)) x;

  if v_id is null then
    insert into surveys (title, description, start_date, end_date, mode, fill_limit, edit_limit,
                         is_anonymous, questions, target_all_psychologists, target_all_officers,
                         target_psychologist_ids, target_departments)
    values (trim(p_survey->>'title'), p_survey->>'description',
            (p_survey->>'start_date')::date, (p_survey->>'end_date')::date,
            v_mode, v_fill_limit, v_edit_limit, v_anon, v_questions,
            coalesce((p_survey->>'target_all_psychologists')::boolean, false),
            coalesce((p_survey->>'target_all_officers')::boolean, false),
            v_psych, v_depts)
    returning id into v_id;
    return v_id;
  end if;

  select * into v_existing from surveys where id = v_id for update;
  if not found then raise exception '找不到問卷'; end if;

  select exists (select 1 from survey_submissions where survey_id = v_id and fill_count > 0)
    into v_has_responses;

  if v_has_responses and (
       v_existing.questions is distinct from v_questions
       or v_existing.mode <> v_mode
       or v_existing.is_anonymous <> v_anon
  ) then
    raise exception '已有人填答，題目、作答模式與匿名設定不可更改';
  end if;

  update surveys set
    title = trim(p_survey->>'title'),
    description = p_survey->>'description',
    start_date = (p_survey->>'start_date')::date,
    end_date = (p_survey->>'end_date')::date,
    mode = v_mode,
    fill_limit = v_fill_limit,
    edit_limit = v_edit_limit,
    is_anonymous = v_anon,
    questions = v_questions,
    target_all_psychologists = coalesce((p_survey->>'target_all_psychologists')::boolean, false),
    target_all_officers = coalesce((p_survey->>'target_all_officers')::boolean, false),
    target_psychologist_ids = v_psych,
    target_departments = v_depts,
    updated_at = now()
  where id = v_id;
  return v_id;
end;
$$;

create or replace function survey_admin_set_closed(p_admin_id uuid, p_survey_id uuid, p_closed boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform survey_assert_admin(p_admin_id);
  update surveys set is_closed = p_closed, updated_at = now() where id = p_survey_id;
  return true;
end;
$$;

create or replace function survey_admin_delete(p_admin_id uuid, p_survey_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform survey_assert_admin(p_admin_id);
  delete from surveys where id = p_survey_id;
  return true;
end;
$$;

-- 名單：應填對象 + 填寫狀況。匿名問卷不回傳填寫時間，避免與答案順序對照。
create or replace function survey_admin_roster(p_admin_id uuid, p_survey_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s surveys%rowtype;
begin
  perform survey_assert_admin(p_admin_id);
  select * into s from surveys where id = p_survey_id;
  if not found then raise exception '找不到問卷'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.respondent_type desc, t.group_name, t.name) from (
      select 'psychologist'::text as respondent_type, p.id as respondent_id, p.name,
             '心理師'::text as group_name,
             coalesce(u.fill_count, 0) as fill_count, coalesce(u.edits_used, 0) as edits_used,
             coalesce(u.extra_fills, 0) as extra_fills, coalesce(u.extra_edits, 0) as extra_edits,
             case when s.is_anonymous then null else u.last_submitted_at end as last_submitted_at
      from psychologists p
      left join survey_submissions u on u.survey_id = s.id and u.respondent_type = 'psychologist' and u.respondent_id = p.id
      where p.is_active = true
        and (s.target_all_psychologists or p.id = any(s.target_psychologist_ids))
      union all
      select 'officer', o.id, o.name, coalesce(o.department, '未分股'),
             coalesce(u.fill_count, 0), coalesce(u.edits_used, 0),
             coalesce(u.extra_fills, 0), coalesce(u.extra_edits, 0),
             case when s.is_anonymous then null else u.last_submitted_at end
      from probation_officers o
      left join survey_submissions u on u.survey_id = s.id and u.respondent_type = 'officer' and u.respondent_id = o.id
      where s.target_all_officers or o.department = any(s.target_departments)
    ) t
  ), '[]'::jsonb);
end;
$$;

-- 結果：每份答案 + 群組。非匿名問卷附上填答者姓名；匿名問卷順序隨機。
create or replace function survey_admin_results(p_admin_id uuid, p_survey_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s surveys%rowtype;
begin
  perform survey_assert_admin(p_admin_id);
  select * into s from surveys where id = p_survey_id;
  if not found then raise exception '找不到問卷'; end if;

  return jsonb_build_object(
    'survey', to_jsonb(s),
    'responses', coalesce((
      select jsonb_agg(row_to_json(t)) from (
        select r.respondent_type, r.respondent_group, r.answers,
               case when s.is_anonymous then null else r.created_at end as submitted_at,
               case when s.is_anonymous then null else coalesce(
                 (select p.name from psychologists p where p.id = u.respondent_id and u.respondent_type = 'psychologist'),
                 (select o.name from probation_officers o where o.id = u.respondent_id and u.respondent_type = 'officer')
               ) end as respondent_name
        from survey_responses r
        left join survey_submissions u on u.id = r.submission_id
        where r.survey_id = s.id
        order by case when s.is_anonymous then random() end, r.created_at
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

-- 個別解鎖：單次填答(具名) → 增加修改次數；其餘 → 增加可填份數
create or replace function survey_admin_grant(
  p_admin_id uuid, p_survey_id uuid, p_type text, p_respondent_id uuid, p_amount integer
) returns boolean language plpgsql security definer set search_path = public as $$
declare s surveys%rowtype;
begin
  perform survey_assert_admin(p_admin_id);
  if p_amount is null or p_amount < 1 then raise exception '解鎖次數需大於 0'; end if;
  select * into s from surveys where id = p_survey_id;
  if not found then raise exception '找不到問卷'; end if;

  insert into survey_submissions (survey_id, respondent_type, respondent_id)
  values (p_survey_id, p_type, p_respondent_id)
  on conflict (survey_id, respondent_type, respondent_id) do nothing;

  if s.mode = 'single' and not s.is_anonymous then
    update survey_submissions set extra_edits = extra_edits + p_amount
     where survey_id = p_survey_id and respondent_type = p_type and respondent_id = p_respondent_id;
  else
    update survey_submissions set extra_fills = extra_fills + p_amount
     where survey_id = p_survey_id and respondent_type = p_type and respondent_id = p_respondent_id;
  end if;
  return true;
end;
$$;

-- 4. 使用者 RPC ------------------------------------------------

-- 公告欄用：我可填、且在期間內、未關閉的問卷與我的進度
create or replace function survey_list_for_me(p_type text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_group text := survey_actor_group(p_type, p_id);
begin
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.end_date, t.title) from (
      select s.id, s.title, s.description, s.start_date, s.end_date, s.mode, s.is_anonymous,
             coalesce(u.fill_count, 0) as fill_count,
             coalesce(u.edits_used, 0) as edits_used,
             (case when s.mode = 'single' then 1 else s.fill_limit end) + coalesce(u.extra_fills, 0) as allowed_fills,
             s.edit_limit + coalesce(u.extra_edits, 0) as allowed_edits,
             (s.end_date - survey_today()) as days_left
      from surveys s
      left join survey_submissions u
        on u.survey_id = s.id and u.respondent_type = p_type and u.respondent_id = p_id
      where s.is_closed = false
        and survey_today() between s.start_date and s.end_date
        and survey_in_audience(s, p_type, p_id, v_group)
    ) t
  ), '[]'::jsonb);
end;
$$;

-- 填寫頁用：題目 + 我的進度 + (單次具名問卷) 我先前的答案
create or replace function survey_get_for_me(p_type text, p_id uuid, p_survey_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_group text := survey_actor_group(p_type, p_id);
  s surveys%rowtype;
  u survey_submissions%rowtype;
  v_answers jsonb;
begin
  select * into s from surveys where id = p_survey_id;
  if not found or s.is_closed or survey_today() not between s.start_date and s.end_date
     or not survey_in_audience(s, p_type, p_id, v_group) then
    raise exception '此問卷目前無法填寫';
  end if;

  select * into u from survey_submissions
   where survey_id = s.id and respondent_type = p_type and respondent_id = p_id;

  if found and s.mode = 'single' and not s.is_anonymous and u.fill_count > 0 then
    select r.answers into v_answers from survey_responses r where r.submission_id = u.id limit 1;
  end if;

  return jsonb_build_object(
    'id', s.id, 'title', s.title, 'description', s.description,
    'start_date', s.start_date, 'end_date', s.end_date, 'mode', s.mode,
    'is_anonymous', s.is_anonymous, 'questions', s.questions,
    'fill_count', coalesce(u.fill_count, 0),
    'edits_used', coalesce(u.edits_used, 0),
    'allowed_fills', (case when s.mode = 'single' then 1 else s.fill_limit end) + coalesce(u.extra_fills, 0),
    'allowed_edits', s.edit_limit + coalesce(u.extra_edits, 0),
    'my_answers', v_answers
  );
end;
$$;

create or replace function survey_submit(p_type text, p_id uuid, p_survey_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_group text := survey_actor_group(p_type, p_id);
  s surveys%rowtype;
  u survey_submissions%rowtype;
  q jsonb;
  v_qid text;
  v_type text;
  v_val jsonb;
  v_visible text[] := '{}';
  v_show jsonb;
  v_ref jsonb;
  v_is_visible boolean;
  v_clean jsonb := '{}'::jsonb;
  v_empty boolean;
  v_allowed integer;
begin
  select * into s from surveys where id = p_survey_id;
  if not found or s.is_closed or survey_today() not between s.start_date and s.end_date
     or not survey_in_audience(s, p_type, p_id, v_group) then
    raise exception '此問卷目前無法填寫';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception '答案格式錯誤';
  end if;

  -- 逐題檢查 (題目依順序，條件跳題只能參照前面的題目)
  for q in select value from jsonb_array_elements(s.questions) loop
    v_qid := q->>'id';
    v_type := q->>'type';
    v_show := q->'show_if';
    v_is_visible := true;
    if v_show is not null and jsonb_typeof(v_show) = 'object' then
      v_is_visible := (v_show->>'question_id') = any(v_visible)
        and exists (
          select 1 from jsonb_array_elements_text(coalesce(v_show->'values', '[]'::jsonb)) x
          where x = (p_answers->(v_show->>'question_id')) #>> '{}'
        );
    end if;
    if not v_is_visible then continue; end if;
    v_visible := v_visible || v_qid;

    v_val := p_answers->v_qid;
    v_empty := v_val is null or jsonb_typeof(v_val) = 'null'
      or (jsonb_typeof(v_val) = 'string' and trim(v_val #>> '{}') = '')
      or (jsonb_typeof(v_val) = 'array' and jsonb_array_length(v_val) = 0);

    if v_empty then
      if coalesce((q->>'required')::boolean, false) then
        raise exception '尚有必填題未作答：%', q->>'text';
      end if;
      continue;
    end if;

    if v_type = 'single' then
      if jsonb_typeof(v_val) <> 'string' or not (q->'options') @> to_jsonb(v_val #>> '{}') then
        raise exception '答案不在選項內：%', q->>'text';
      end if;
    elsif v_type = 'multi' then
      if jsonb_typeof(v_val) <> 'array' or exists (
        select 1 from jsonb_array_elements(v_val) a where not ((q->'options') @> jsonb_build_array(a))
      ) then
        raise exception '答案不在選項內：%', q->>'text';
      end if;
    elsif v_type = 'scale' then
      if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric not between 1 and 5
         or (v_val #>> '{}')::numeric <> trunc((v_val #>> '{}')::numeric) then
        raise exception '量表需為 1 到 5 分：%', q->>'text';
      end if;
    elsif v_type = 'date' then
      begin
        perform (v_val #>> '{}')::date;
      exception when others then
        raise exception '日期格式錯誤：%', q->>'text';
      end;
    else -- text / longtext
      if jsonb_typeof(v_val) <> 'string' or length(v_val #>> '{}') > 5000 then
        raise exception '文字過長或格式錯誤：%', q->>'text';
      end if;
    end if;

    v_clean := v_clean || jsonb_build_object(v_qid, v_val);
  end loop;

  insert into survey_submissions (survey_id, respondent_type, respondent_id)
  values (s.id, p_type, p_id)
  on conflict (survey_id, respondent_type, respondent_id) do nothing;

  select * into u from survey_submissions
   where survey_id = s.id and respondent_type = p_type and respondent_id = p_id for update;

  if s.mode = 'single' and not s.is_anonymous then
    if u.fill_count = 0 then
      insert into survey_responses (survey_id, submission_id, respondent_type, respondent_group, answers)
      values (s.id, u.id, p_type, v_group, v_clean);
      update survey_submissions set fill_count = 1, last_submitted_at = now() where id = u.id;
    else
      if u.edits_used >= s.edit_limit + u.extra_edits then
        raise exception '已達修改次數上限';
      end if;
      update survey_responses set answers = v_clean, updated_at = now() where submission_id = u.id;
      update survey_submissions set edits_used = edits_used + 1, last_submitted_at = now() where id = u.id;
    end if;
  else
    v_allowed := (case when s.mode = 'single' then 1 else s.fill_limit end) + u.extra_fills;
    if u.fill_count >= v_allowed then
      raise exception '已達填答次數上限';
    end if;
    insert into survey_responses (survey_id, submission_id, respondent_type, respondent_group, answers)
    values (s.id, case when s.is_anonymous then null else u.id end, p_type, v_group, v_clean);
    update survey_submissions set fill_count = fill_count + 1, last_submitted_at = now() where id = u.id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 5. Grants ----------------------------------------------------
grant execute on function survey_admin_list(uuid) to anon, authenticated;
grant execute on function survey_admin_get(uuid, uuid) to anon, authenticated;
grant execute on function survey_admin_save(uuid, jsonb) to anon, authenticated;
grant execute on function survey_admin_set_closed(uuid, uuid, boolean) to anon, authenticated;
grant execute on function survey_admin_delete(uuid, uuid) to anon, authenticated;
grant execute on function survey_admin_roster(uuid, uuid) to anon, authenticated;
grant execute on function survey_admin_results(uuid, uuid) to anon, authenticated;
grant execute on function survey_admin_grant(uuid, uuid, text, uuid, integer) to anon, authenticated;
grant execute on function survey_list_for_me(text, uuid) to anon, authenticated;
grant execute on function survey_get_for_me(text, uuid, uuid) to anon, authenticated;
grant execute on function survey_submit(text, uuid, uuid, jsonb) to anon, authenticated;
-- 內部輔助函式不開放前端直接呼叫
revoke execute on function survey_assert_admin(uuid) from public, anon, authenticated;
revoke execute on function survey_actor_group(text, uuid) from public, anon, authenticated;
