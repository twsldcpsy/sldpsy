# 開發紀錄 CHANGELOG

記錄 sldpsy 的每次變動，新的在上。對外版本號與使用者可見的說明在 `src/pages/Home.jsx` 的「系統沿革」。
日期格式：西元（括號內為民國）。

## [Unreleased]

- （尚無）

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
