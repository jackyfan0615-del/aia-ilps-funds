# AIA ILPS 基金研究台

獨立網頁 App，供「卓達智悅 2」投資相連壽險（ILPS）銷售團隊查閱增長型基金與派息（Z 字）投資選擇。

## 功能

- 增長型 / 派息 Z 字基金目錄（目前 107 + 38）
- 關鍵詞搜尋（代號、名稱、經理）
- 風險與資產類別篩選
- 賣出價與評估日（每日自動更新）
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

## 每日價格更新

- 即時來源：AIA `FundInfo2` API（`fund_cat=TMP2`）
- 頁面快取約 6 小時；若 API 失敗則回退到 `data/funds.json`
- Vercel Cron 每日 **10:00 HKT**（`0 2 * * *` UTC）呼叫 `/api/cron/update-funds` 強制刷新

手動觸發（需 `CRON_SECRET`）：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://aia-ilps-funds.vercel.app/api/cron/update-funds
```

## API

`GET /api/funds?q=&type=all|growth|dividend&risk=&assetClass=`
