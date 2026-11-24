-- 運動戒癮團體專案：表單維護開放給專案成員
-- ex_form_save 的權限由「專案管理者」放寬為「專案成員（含專案管理者與系統管理者）」，其餘邏輯與原本完全相同。
-- 可重複執行（create or replace）。請先執行本檔，再部署前端。

create or replace function ex_form_save(p_fields jsonb, p_print jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare cur ex_form_versions%rowtype; e jsonb; v_ids text[] := '{}'; v_id uuid;
begin
  if not app_session_in_project('exercise_addiction') then raise exception '無權限'; end if;
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

grant execute on function ex_form_save(jsonb, jsonb) to anon, authenticated;
