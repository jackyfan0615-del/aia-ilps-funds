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
- 市場短評（每週）與基金焦點（雙週）：以 `content/` 檔案更新
- 客人季度分享頁：組合表現寫在連結裡，伺服器不存姓名
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

## 市場短評／基金焦點（用檔案更新）

內容只存在 repo，**不要把真實市況寫進範本**。檔名 `_` 開頭，或 frontmatter `template: true`／`draft: true` 的檔**不會出現在公開列表**。

### 市場短評（每週）

1. 新增 `content/market/YYYY-MM-DD.md`（或 `.json`）
2. 圖表放 `public/market/`，在檔案裡用網站路徑引用，例如 `/market/2026-10-05.png`
3. 推上 `main` 後 Vercel 會重新部署，列表最新在最上

Markdown 範本見 `content/market/_template.md`：

```md
---
date: 2026-10-05
title: 本週標題
chart: /market/2026-10-05.png
funds: CG1:up, I07:down, Z07:watch
---

一段客人口氣，覆蓋中美及環球股市、債市、黃金、能源。
```

`funds` 可用 `代號:up|down|watch`（亦接受 升／跌／留意），頁面會連到基金詳情。JSON 等價欄位：`date`、`title`、`body`、`chart`、`funds: [{ "code", "tag" }]`。

公開頁：https://aia-ilps-funds.vercel.app/insights/market

### 基金焦點（雙週）

新增 `content/spotlight/YYYY-MM-DD.md`。頁面會用本站既有價格序列即時計近 1 年、波動、最大回撤、股息率／派息來源。

```md
---
date: 2026-10-06
fund: CG1
title: 可省略，預設「基金焦點：代號 名稱」
suitedFor: 年期較長、以資本增值為主的客戶
risks: 股市與匯率波動；短線可有明顯回撤
---

為何這段時間值得留意（角色、風格、近期走勢）。
```

JSON 可用 `why` 或 `body` 當內文。範本：`content/spotlight/_template.md`。

公開頁：https://aia-ilps-funds.vercel.app/insights/spotlight

兩頁都有「複製 WhatsApp 文字」（標題、內文、受影響基金或數據、固定免責）。

固定免責：「以上資料只供參考，不構成任何投資建議。投資涉及風險，基金價格可升可跌，過往表現不代表將來表現。」

## 客人季度分享頁

連結**沒有伺服器儲存**，查詢字串只含基金代號、比重、開始日、季度標籤。選填顯示名稱只寫在 URL **fragment**（`#n=`），瀏覽器不會把它送到伺服器。

格式：

```
/share?h=Z36:25,Z13:10,Z18:30,Z07:10,Z17:25&s=2024-03-15&q=2026Q3#n=%E9%99%B3%E5%A4%A7%E6%96%87
```

- `h`：`代號:比重`，逗號分隔，合計約 100%
- `s`：開始投資日 `YYYY-MM-DD`
- `q`：季度 `2026Q3`
- `#n=`：顯示名稱（可省略）

舊連結若仍寫上一次的成分（例如含 Z77／Z29／N07），一樣可以開啟；頁面按連結裡的持倉計表現，不要求改成最新模型組合。

在研究台「會面四題」一頁摘要區，或「週年檢討」產生連結。頁面顯示開始至今與該季加權 NAV、扣費後參考、現時回撤、成分表、最新市場短評標題與免責；可用瀏覽器列印／另存 PDF。不含佣金或內部建議。

## API

`GET /api/funds?q=&type=all|growth|dividend&risk=&assetClass=`
