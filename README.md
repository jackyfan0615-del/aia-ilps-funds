# AIA ILPS 基金研究台

獨立網頁 App，供「卓達智悅 2」投資相連壽險（ILPS）銷售團隊查閱增長型基金與派息（Z 字）投資選擇。

## 功能

- 增長型 / 派息 Z 字基金目錄（目前 107 + 38）
- 關鍵詞搜尋（代號、名稱、經理）
- 風險與資產類別篩選
- 賣出價與評估日（每日自動更新）
- 基金新增／減少／更名會自動同步 AIA 目錄
- 四套內部參考投資組合（派息／穩健／均衡／進取）
- 會面四題（含「幾時要用錢」）與一頁 A4 客戶摘要（瀏覽器列印／另存 PDF，不存伺服器）
- 週年檢討：本機 localStorage + CSV 匯入／匯出（可由 Notion CRM 匯出）
- 手機友善，可分享給同事

## 本機開發

```bash
npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

## 線上使用

- **網頁 App**：https://aia-ilps-funds.vercel.app
- **GitHub**（Cursor for iOS / Cloud Agent）：https://github.com/jackyfan0615-del/aia-ilps-funds

在 Cursor iOS：用 GitHub 開啟此 repo，或直接在 Safari 開網頁網址。
推送到 `main` 會自動觸發 Vercel 重新部署。

## 每日自動更新

- 即時來源：AIA `FundInfo2` API（`fund_cat=TMP2`）
- 每次抓取都用 **完整最新目錄**，不只更新價格；AIA 新增、下架或更名都會反映
- 頁面快取約 6 小時；若 API 失敗則回退到 `data/funds.json`
- Vercel Cron 每日 **10:00 HKT** 刷新價格與目錄
- GitHub Action 每日 **10:15 HKT** 比對代號：有增減／更名才寫回 `data/funds.json` 與變更紀錄

手動觸發（需 `CRON_SECRET`）：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://aia-ilps-funds.vercel.app/api/cron/update-funds
```

## 週年檢討 CSV 欄位

客戶紀錄只存在使用者瀏覽器，網站沒有伺服器資料庫。可由 Notion CRM 匯出後另存 CSV 匯入。

| 欄位 | 必填 | 說明 |
|---|---|---|
| `name` | 是 | 客戶姓名。亦接受「姓名」「客戶」「Client」 |
| `anniversary` | 是 | 保單週年日。`YYYY-MM-DD` 或 `D/M/YYYY`。亦接受「週年」「保單週年」「Anniversary」 |
| `portfolio` | 是 | `派息入息`／`穩健增長`／`均衡核心`／`進取增長`，或 `income`／`steady`／`balanced`／`growth` |
| `start_date` | 否 | 開始投資日期。空白則用週年日。亦接受「開始日期」「Policy Date」「Start」 |

範例：

```csv
name,anniversary,portfolio,start_date
陳大文,15/3/2024,穩健增長,15/3/2023
```

## API

`GET /api/funds?q=&type=all|growth|dividend&risk=&assetClass=`
