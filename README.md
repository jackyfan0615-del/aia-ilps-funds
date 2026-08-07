# AIA ILPS 基金研究台

獨立網頁 App，供「卓達智悅 2」投資相連壽險（ILPS）銷售團隊查閱增長型基金與派息（Z 字）投資選擇。

## 功能

- 增長型 / 派息 Z 字基金目錄（目前 107 + 38）
- 關鍵詞搜尋（代號、名稱、經理）
- 風險與資產類別篩選
- 賣出價與評估日
- 手機友善，可分享給同事

## 本機開發

```bash
npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

## 部署（給同事用）

建議部署到 Vercel：

1. 將此專案推上 GitHub
2. 在 Vercel Import 該 repo
3. 部署後把公開網址發給同事

## 更新基金資料

資料檔：`data/funds.json`（來源為 AIA 官網投資選擇資訊頁）。

之後可加排程自動抓取；目前可手動更新該 JSON 後重新部署。

## API

`GET /api/funds?q=&type=all|growth|dividend&risk=&assetClass=`
