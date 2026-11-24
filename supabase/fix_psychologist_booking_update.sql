-- ============================================================
-- 修正：心理師無法更新自己的預約（第二階段 RLS 收權限的副作用）
-- 問題：第二階段把 bookings 的修改限定為保護官，但心理師預約頁有「出席／缺席」快速按鈕與「編輯預約」，
--       心理師的更新被資料庫靜默擋下（回應成功、實際 0 列被更新），畫面卻先顯示新狀態，重新整理後退回原狀。
-- 做法：不放寬整張 bookings 的權限（資料庫無法區分心理師與保護官的欄位權限），改用兩個窄函式：
--   1. psychologist_update_booking_status(預約, 新狀態)
--        只能改自己的預約；新狀態限「尚未開始、等待報告、缺席」；
--        已是「完成」「確認缺席」或已核銷的預約不可再改（與畫面「已完成，無法變更」一致）
--   2. psychologist_update_booking(預約, 資料)
--        只能改自己的預約，只能改：個案、類別與對象、人數與說明、日期、開始與結束時間、地點、備註；
--        不能改：狀態、心理師、談話室、核銷（與畫面上被鎖住的欄位一致）；
--        已完成／確認缺席／已核銷的預約不可修改；個案必須是自己的（或維持原本的個案）
-- 保護官與系統管理者的做法完全不變（仍直接更新 bookings）。
-- 前提：secure_phase1／phase2 已執行（需要 app_session_* 函式）。可重複執行，獨立於 roles_step*.sql。
-- ============================================================

create or replace function psychologist_update_booking_status(p_booking_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare b bookings%rowtype;
begin
  if not app_session_ok() or app_session_user_type() is distinct from 'psychologist' then raise exception '無權限'; end if;
  if p_status not in ('尚未開始', '等待報告', '缺席') then raise exception '心理師只能標記為尚未開始、等待報告或缺席'; end if;
  select * into b from bookings where id = p_booking_id for update;
  if not found or b.psychologist_id is distinct from app_session_uid() then raise exception '只能更新自己的預約'; end if;
  if b.status in ('完成', '確認缺席') or coalesce(b.is_verified, false) then
    raise exception '此預約已完成或確認缺席，無法變更';
  end if;
  update bookings set status = p_status where id = p_booking_id;
  return true;
end;
$$;

create or replace function psychologist_update_booking(p_booking_id uuid, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare b bookings%rowtype; v_juv uuid; v_guar uuid;
begin
  if not app_session_ok() or app_session_user_type() is distinct from 'psychologist' then raise exception '無權限'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception '資料格式錯誤'; end if;
  select * into b from bookings where id = p_booking_id for update;
  if not found or b.psychologist_id is distinct from app_session_uid() then raise exception '只能更新自己的預約'; end if;
  if b.status in ('完成', '確認缺席') or coalesce(b.is_verified, false) then
    raise exception '此預約已完成或確認缺席，無法修改';
  end if;

  v_juv := nullif(p_data->>'juvenile_id', '')::uuid;
  v_guar := nullif(p_data->>'guardian_id', '')::uuid;
  -- 個案必須是自己的，或維持預約原本的個案
  if v_juv is not null and v_juv is distinct from b.juvenile_id
     and not exists (select 1 from juveniles where id = v_juv and psychologist_id = app_session_uid()) then
    raise exception '只能選擇自己的個案';
  end if;
  if v_guar is not null and v_guar is distinct from b.guardian_id
     and not exists (select 1 from guardians where id = v_guar and psychologist_id = app_session_uid()) then
    raise exception '只能選擇自己的家長個案';
  end if;

  update bookings set
    juvenile_id = v_juv,
    guardian_id = v_guar,
    juvenile_name = nullif(p_data->>'juvenile_name', ''),
    counseling_type = coalesce(nullif(p_data->>'counseling_type', ''), counseling_type),
    individual_subject = nullif(p_data->>'individual_subject', ''),
    joint_attendees_count = nullif(p_data->>'joint_attendees_count', '')::integer,
    joint_details = nullif(p_data->>'joint_details', ''),
    includes_juvenile = coalesce((p_data->>'includes_juvenile')::boolean, false),
    booking_date = coalesce(nullif(p_data->>'booking_date', '')::date, booking_date),
    start_time = coalesce(nullif(p_data->>'start_time', '')::time, start_time),
    end_time = coalesce(nullif(p_data->>'end_time', '')::time, end_time),
    location = nullif(p_data->>'location', ''),
    notes = nullif(p_data->>'notes', '')
  where id = p_booking_id;
  return true;
end;
$$;

grant execute on function psychologist_update_booking_status(uuid, text) to anon, authenticated;
grant execute on function psychologist_update_booking(uuid, jsonb) to anon, authenticated;
