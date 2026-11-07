# sldpsy 專案

## 專案描述
這是一個 React + Vite 的前端應用，使用 Supabase 作為後端服務。

## 技術棧
- **前端框架**: React
- **打包工具**: Vite
- **樣式**: Tailwind CSS
- **後端**: Supabase
- **環境**: Node.js v24+, npm 11+

## 環境變數設定
必須在根目錄建立 `.env.local` 檔案，包含以下變數：

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## 開發紀錄規則
- 每完成一項功能或修正，必須在 `CHANGELOG.md` 的 `[Unreleased]` 區塊補上一行說明（有資料庫異動時註明 `supabase/` 的 SQL 檔名）。
- 發布新版本時，將 `[Unreleased]` 內容改為新版本標題與日期，並同步更新 `src/pages/Home.jsx` 的「系統沿革」。
- commit 訊息沿用「修正版本：○○完成」格式。
