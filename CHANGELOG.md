# 開發紀錄 CHANGELOG

記錄 sldpsy 的每次變動，新的在上。對外版本號與使用者可見的說明在 `src/pages/Home.jsx` 的「系統沿革」。
日期格式：西元（括號內為民國）。

## [Unreleased]

- （尚無）

## v1.5.0 — 2026-11-07（115/11/7）

- 系統沿革新增 v1.5.0
- 問卷新增「題目說明」欄位與「分段」區塊（同頁分隔標題，題號不計分段；底下題目全被條件隱藏時分段一併隱藏）
  - 已有人填答後，題目說明與分段文字仍可修正，題目／選項／順序維持鎖定
  - DB：`create_surveys.sql` 有更新（新增 `survey_questions_structure`，更新 save/list/submit），**需重新執行整份檔案**
- 修正「回到首頁」在 GitHub Pages 跳 404：原本用 `window.location.href = '/'` 會導向網域根目錄，改為路由內導向 `navigate('/')`
- 新增問卷系統（系統管理員 →「問卷管理」分頁）
  - 建立問卷：對象（同公告欄）、起訖期間、六種題型、必填、條件跳題、匿名設定
  - 作答模式二選一：單次填答（可修改 N 次）／重複填答（每人最多 N 份）；匿名問卷不可修改
  - 使用者公告欄顯示問卷卡片（「已填寫，可修改（剩 N 次）」）、截止前 3 天橘色／當天紅色提醒、每份問卷首次彈窗提醒一次；截止或提前關閉即消失
  - 管理員：填寫名單（已填／未填）、統計（含各組並排比較）、匯出 Excel、提前關閉、複製、個別解鎖
  - 有人填答後，題目／作答模式／匿名設定鎖定
  - DB：`create_surveys.sql`（新增 surveys、survey_submissions、survey_responses 與 `survey_*` RPC；**需在 Supabase SQL Editor 執行**）

## v1.4.0 — 2026-07-05（115/7/5）

- 手機版體驗優化：彈窗、輸入框、表格改卡片、Dashboard 分頁列
- 新增 PWA manifest 與 icon，支援加入主畫面
- 核銷作業「完成諮商細目」「日費細目」改為個案姓名，支援帶入家長資料
- 系統沿革新增 v1.4.0
- 公告欄新增顯示對象設定與發布期間（DB：`add_bulletin_audience_targeting.sql`、`add_bulletin_publish_period.sql`）
- 預約管理新增諮商提醒狀態
- 核銷作業匯出日期格式調整；新增複選篩選元件 `MultiSelectFilter`
- 新增「親職教育」類別：家長資料庫（`GuardianDatabaseComponent`）與預約管理聯結
  （DB：`create_guardians_table.sql`、`link_guardians_to_bookings.sql`、`add_case_type_and_closure_reason.sql`）

## 2026-04-12

- 設定 GitHub Pages 部署（Vite `base`、HashRouter、GitHub Action）
- 初始 commit

## 更早版本（見 Home.jsx 系統沿革）

- v1.1.9（115/3/22）優化移動裝置介面
- v1.1.8（115/3/11）修復系統 BUG
- v1.1.7（115/3/10）修復日曆心理師顏色重疊、優化手機新增預約介面、強化系統管理員功能
