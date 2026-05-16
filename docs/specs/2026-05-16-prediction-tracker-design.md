# YouSaidSo（你說的哦）— Design Spec

**Date:** 2026-05-16  
**Status:** Approved  

## 產品命名

| 項目 | 名稱 |
|------|------|
| 英文名 | YouSaidSo |
| 中文名 | 你說的哦 |
| 日文名 | 言ったよね（JP 市場） |
| GitHub Repo | `Karrr7/you-said-so` |
| Vercel 專案 | `you-said-so` |
| Supabase 專案 | `you-said-so` |
| 主網域 | `yousaidso.tw` |
| 備用網域 | `yousaidso.com` |

**Logo 方向（B 方案）：** 漫畫對話泡泡，白底 + 厚黑邊框 + 黃色 pop-art shadow，英文 `YouSaidSo`（Bangers 字體）+ 副標 `你說的哦`。Favicon 用單字 `Y` 或縮寫 `YSS`。

---

## 產品定位

追蹤各路公眾人物的公開預言，以嘴炮指數讓一切一翻兩瞪眼。  
目標是讓使用者每天回來看「今天有哪些預言成真或嘴炮了」，透過自然流量變現 Google AdSense。

---

## 平台

- **MVP：Web（Next.js 15 App Router）**— SSR 對 SEO 最友善，直通 Google 自然流量
- **後續：iOS App** — 有流量後再做，用推播通知驅動每日回訪

### 多市場路由與 URL 結構

URL 以 locale prefix 分流：`/tw/`、`/jp/`、`/us/`。MVP 只啟用 `/tw/`，其餘 locale 架構已就緒，新開市場只需在 Source table 新增來源設定 + 在 next-intl 加語系即可。

**URL 結構（slug 優先，對 SEO 有利）：**

| 頁面 | URL 格式 | 範例 |
|------|---------|------|
| 首頁 Feed | `/[locale]` | `/tw` |
| 預言者頁面 | `/[locale]/predictors/[slug]` | `/tw/predictors/gooaye` |
| 預言詳細頁 | `/[locale]/predictions/[slug]` | `/tw/predictions/gooaye-tsmc-1500-2025` |
| 排行榜 | `/[locale]/leaderboard` | `/tw/leaderboard` |
| 分類瀏覽 | `/[locale]/categories/[category]` | `/tw/categories/stock` |
| 提交頁面 | `/[locale]/submit` | `/tw/submit` |
| Admin | `/admin` | `/admin` |
| Privacy / ToS | `/privacy`、`/terms` | `/privacy` |

Predictor slug 用英文或拼音（`gooaye`、`tianji-teacher`），對跨語系 SEO 較友善。Prediction slug 自動組合：`[predictor-slug]-[預言摘要前20字]-[年份]`。

---

## 使用者流程

- **不需登入**：瀏覽首頁、每日 Feed、預言者頁面、排行榜
- **需要 Google 登入**：投票（準 / 嘴炮）、提交新預言

降低摩擦最大化流量，登入只在必要時才要求。

---

## 核心資料模型

> 所有 table 皆有隱含的 `id UUID PRIMARY KEY`（Supabase 預設），不在各欄位清單中重複列出。子表的 `*_id` 欄位皆為對應 table 的 `id` FK。

### Predictor（預言者）

| 欄位 | 說明 |
|------|------|
| `name` | 名稱（股癌、天機老師、TVBS 民調…） |
| `type` | 個人名嘴 / 命理宗教 / 政府官員 / 學術研究 / 民調中心 / 媒體機構 / 外媒 / 企業執行長 / AI 系統 |
| `avatar_url` | 頭像 |
| `category` | 主要領域（台股 / 政治 / 命理 / 科技 / 球賽 / 其他） |
| `locale` | 市場區域（`tw` / `jp` / `us`）|
| `wiki_url` | Wikipedia 或 wiki 頁面連結（nullable） |
| `youtube_channel_url` | YouTube 頻道連結（nullable） |
| `twitter_url` | X / Twitter 個人頁面（nullable） |
| `facebook_url` | Facebook 粉專連結（nullable） |
| `threads_url` | Threads 帳號連結（nullable） |
| `website_url` | 個人官網或部落格（nullable） |
| `bullshit_score` | 嘴炮指數 = 嘴炮次數 / 已判定總數（百分比） |
| `accuracy_rate` | 準確率 = 準確次數 / 已判定總數 |
| `total_predictions` | 總預言數 |

### Prediction（預言）

| 欄位 | 說明 |
|------|------|
| `content` | 預言內容（句子，非全文） |
| `predictor_id` | 預言者 |
| `locale` | 市場區域（`tw` / `jp` / `us`）— 繼承自 predictor，用於 URL routing 和 feed 分流 |
| `deadline` | 預言截止日 |
| `category` | 分類 |
| `verdict_type` | `objective`（一翻兩瞪眼）/ `subjective`（模糊型）— 建立時由 Claude 標記 |
| `status` | `pending_review` → `active` → `community_vote` → `resolved` |
| `verdict` | `correct` / `bullshit` / `null` |
| `created_at` | 建立時間 |
| `submitted_by` | 提交者 email（nullable — 爬蟲自動建立的為 null） |
| `deleted_at` | 軟刪除時間戳（null = 未刪除） |
| `deleted_by` | 執行刪除者的 email（null = 未刪除） |
| `delete_reason` | 刪除原因（admin 填寫，選填） |

> `source_url` / `source_snapshot` / `source_name` 已移至 `PredictionSource` table，支援同一預言多個來源出處。回應移至 `PredictionResponse` table。

### PredictionSource（預言來源）

同一則預言可對應多個來源（不同媒體報導同一預言時自動 merge）。

| 欄位 | 說明 |
|------|------|
| `prediction_id` | 對應預言 |
| `source_url` | 原始連結 |
| `source_name` | 來源名稱（Yahoo 新聞 / YouTube / PTT…） |
| `source_snapshot` | 抓取當下的文字快照（防連結失效） |
| `discovered_at` | 此來源被發現的時間 |

### PredictionResponse（預言者回應）

判定後預言者的事後說明或辯護，可有多筆（不同時間、不同媒體）。

| 欄位 | 說明 |
|------|------|
| `prediction_id` | 對應預言 |
| `content` | 回應內容摘要 |
| `source_url` | 回應來源連結（採訪、貼文、聲明等） |
| `source_name` | 來源名稱（ETtoday 採訪、Twitter 貼文…） |
| `responded_at` | 回應發佈時間 |

### Vote（投票）

| 欄位 | 說明 |
|------|------|
| `prediction_id` | 對應預言 |
| `user_id` | 投票者 |
| `choice` | `correct` / `bullshit` |

### Source（爬蟲來源設定）

每個 locale 的新聞來源設定抽成獨立 table，新開市場只需新增 row，不改程式碼。

| 欄位 | 說明 |
|------|------|
| `locale` | 市場區域（`tw` / `jp` / `us`） |
| `type` | `rss` / `youtube_channel` |
| `name` | 來源名稱（Yahoo 新聞 TW、CNN、NHK…） |
| `url_or_channel_id` | RSS URL 或 YouTube Channel ID |
| `active` | 是否啟用 |

---

## 內容來源

### 自動爬蟲（Vercel Cron）

**RSS Feed（每 4-6 小時）**  
- Yahoo 新聞 RSS  
- ETtoday RSS  
- 其他提供 RSS 的新聞台  
- 處理：抓標題 + 摘要 → Claude 判斷是否含預言 → 萃取預言句子 + 截止日

**YouTube 頻道清單（每日一次）**  
- 維護一份策展頻道清單（財經名嘴、政治評論、命理師等約 50 個頻道）  
- 抓新影片字幕 → Claude 萃取預言  
- 每日約 15-20 支影片，Claude Haiku 費用 < $0.20/天

### 使用者提交

1. 使用者貼 URL  
2. 系統嘗試爬取 → Claude 萃取預言句子  
3. 爬取失敗（付費牆 / 反爬）→ 請使用者貼出「預言那句話」  
4. 使用者確認內容 → 進入 AI 審核流程

**版權原則：只存預言句子 + attribution（作者、來源名稱、日期、URL），不存全文。事實陳述不受著作權保護。**

---

## AI 判定流程

```
① 新內容進入（爬蟲或使用者提交）
   status = pending_review
   → Claude Haiku 審核：「這是真正的預言嗎？有明確截止期嗎？」
   → 拒絕：丟棄
   → 通過：進入去重流程 ↓

   去重流程（deduplication）
   → pg_trgm 查詢：同 predictor + deadline ±30 天 + 文字相似度 > 0.7
   → 無命中：status = active，建立新 Prediction
   → 有命中：Claude Haiku 確認「是否為同一預言？」
     → 是：將新來源寫入現有 Prediction 的 PredictionSource，丟棄新 Prediction
     → 否：status = active，建立新 Prediction

② 每日 cron 檢查到期預言
   active + deadline 已過
   → 一翻兩瞪眼型（選舉結果、股價點位）：
     cron 先呼叫外部 API 取得客觀資料（如 Yahoo Finance 股價、選委會結果）
     將原始預言 + 截止日 + 查到的資料一起傳給 Claude Haiku 判定
     status = resolved，verdict = correct / bullshit
     ⚠️ 外部 API 失敗時：retry 3 次（指數退避），24h 內仍失敗 → 自動轉 community_vote
   → 模糊型（AI 泡沫、景氣好壞）：status = community_vote
     開放 72 小時社群投票

③ 社群投票結束
   多數票的一方勝出
   status = resolved，verdict 依票數決定
   同時更新 predictor 的 bullshit_score 和 accuracy_rate
```

---

## 核心頁面

### 首頁 / 每日 Feed
- 今天有哪些預言結果出爐（已判定）排最前
- 接著是即將到期的進行中預言
- 側邊欄：嘴炮排行榜 Top 5

**Feed Card 設計：漫畫對話泡泡**

每則預言用漫畫風格的對話泡泡呈現，不需要為每則預言準備圖片：

- **第一行**：Predictor avatar（左）+ 對話泡泡（右）— 泡泡包住預言句子，泡泡尾巴朝向 avatar，視覺上像 avatar 在「說話」
- **泡泡樣式**：奶油白底 + 3.5px 厚黑邊框 + 5px 黃色 block shadow（pop-art 風格）+ SVG filter 讓邊緣有手繪歪歪感
- **已判定的泡泡**：右下角有斜體蓋章（💨 嘴炮 / 🎯 準了）
- **第二行**：Predictor 名稱 + 準確率 / 嘴炮指數 + 狀態 tag + hashtag + 票數
- **投票中**：第二行下方附即時票數進度條

### 預言者頁面
- 頭像 + 名稱 + 嘴炮指數 badge（紅色百分比）
- 橫排統計：總預言數 / 準了 / 嘴炮 / 準確率
- 時間線：所有歷史預言，可依狀態篩選

### 嘴炮排行榜
- 依嘴炮指數排名（嘴炮最多在最上面）
- 可切換：最準確排行

### 分類瀏覽
- 台股 / 政治 / 命理 / 科技 / 球賽 / AI / 其他

### 提交頁面
- 貼 URL + 可選填預言句子
- 登入後才能提交

### Privacy Policy / Terms of Service
- `/privacy` 和 `/terms` 靜態頁面，上線前必須備妥
- Google AdSense 審核與 Google Login（NextAuth.js）都要求這兩頁存在
- MVP 用標準模板即可，重點是「我們收集哪些資料（email、投票記錄）以及如何使用」

---

## Tech Stack

| 層 | 選擇 |
|---|---|
| Frontend + API | Next.js 15 (App Router) |
| DB | Supabase (PostgreSQL + pg_trgm) |
| 爬蟲排程 | Vercel Cron + Cheerio（RSS）/ youtube-transcript-api |
| AI | Claude API — Haiku（審核 + 萃取 + 判定） |
| Auth | NextAuth.js（Google 登入） |
| 廣告 | Google AdSense |
| 部署 | Vercel |
| 快取策略 | Next.js ISR（Incremental Static Regeneration） |
| i18n | next-intl |

**ISR 快取策略：**

| 頁面 | revalidate | 觸發方式 |
|------|-----------|---------|
| 首頁 Feed | 1 小時 | `revalidateTag('feed')` when verdict resolved |
| 預言者頁面 | 6 小時 | on-demand when predictor stats update |
| 預言詳細頁 | on-demand | `revalidateTag('prediction-[id]')` when verdict changes |
| 排行榜 | 6 小時 | scheduled |

ISR 讓頁面幾乎是靜態速度，對 Core Web Vitals（SEO 排名因素）影響顯著，同時大幅減少 Vercel function 呼叫數量。

---

## 品牌語氣與命名

### 嘴炮指數的設計原則

「嘴炮」保留——這是讓人想分享的靈魂。但用雙向榮譽系統平衡，避免純粹負面：

| 情況 | Badge | 語氣 |
|------|-------|------|
| 準確率 ≥ 70% | 🎯 準神 | 正向肯定 |
| 準確率 30–70% | 📊 有待觀察 | 中性 |
| 準確率 < 30% | 💨 嘴炮 | 娛樂性 |

**免責框架：** 所有頁面底部加「本站判定基於公開資料與社群投票，僅供娛樂參考，不代表任何法律立場。」

判定機制本身（`verdict_type: objective` 必須有客觀依據，`subjective` 交社群投票）是對抗法律爭議的核心防線，比文字修飾更重要。

---

## 分享功能

讓判定結果病毒式傳播是流量核心策略。

### Open Graph 動態卡片

每則 resolved 預言自動生成 OG 圖片（使用 `@vercel/og`）：
- 預言者名稱 + 嘴炮 badge 或 準神 badge
- 預言句子
- 判定結果（✅ 準了 / ❌ 嘴炮）+ 時間

### 分享按鈕

| 平台 | 優先順序 |
|------|---------|
| LINE | 台灣第一（tw locale） |
| X / Twitter | 全 locale |
| Facebook | tw / jp locale |
| Threads | tw locale |
| 複製連結 | 全 locale |

---

## 廣告策略

- 版位：首頁 Feed 中間、預言者頁面底部、排行榜側邊
- 不用登入即可看 = 最大化 PV = 最大化廣告曝光
- SEO 靠 Next.js SSR + 每日更新內容自然積累

---

## Cold Start 策略

網站上線第一天沒有爬蟲資料，需要手動種子資料讓頁面有內容可看。

**目標：上線前手動建立以下資料**

| 項目 | 數量 | 說明 |
|------|------|------|
| Predictor | 10–15 位 | 台灣知名財經、命理、政治類 |
| 已 resolved 的歷史預言 | 30+ 筆 | 直接從過去新聞挑已知結果的，立刻有 ✅/❌ 可看 |
| Active 進行中預言 | 20+ 筆 | 截止日在未來，讓使用者有東西可以投票 |

**為什麼優先放 resolved 的歷史預言：** 用戶第一次來就能看到「嘴炮確定」的結果，比全是「進行中」的頁面更有趣、更有分享動機。

---

## Success Metrics

### Day 1（上線驗收）
- 網站可訪問，`/tw/` 路由正常
- 至少 20 個手動建立的 active 預言
- 爬蟲（RSS）第一次跑成功，有新預言進入 `pending_review`
- Google Search Console 提交 sitemap
- Google AdSense 申請送出

### Day 30（自動化驗收）
- RSS + YouTube 爬蟲每日穩定執行，累積 100+ active 預言
- 至少 5 個預言已 `resolved`（人工或 AI 判定）
- Google 收錄 50+ 頁
- 月 UV > 500

### Day N（規模化門檻）
- 月 UV > 10,000 → 開始有 AdSense 實際收入
- 月 UV > 50,000 → 評估開 `/jp/` 市場
- 社群投票活躍（每次投票平均 > 50 票）→ 評估 iOS App

---

## Security

### 1. Rate Limiting

| 對象 | 限制 |
|------|------|
| 登入用戶 — 提交預言 | 5 筆 / 天 / 帳號 |
| 登入用戶 — 投票 | 1 票 / 預言（DB 唯一性約束） |
| 未登入訪客 — API 呼叫 | 60 req / 分鐘 / IP（Vercel Middleware） |
| 同一 IP 短時間大量提交 | 自動暫時封鎖（sliding window，1 小時冷卻） |

### 2. Supabase Row Level Security（RLS）

- `prediction` 表：只能透過 server-side API Route 寫入，client 無法直接 insert
- `vote` 表：`UNIQUE(prediction_id, user_id)` 約束，一人一票在 DB 層強制
- 用戶只能讀取自己的 vote 記錄，不能讀或改別人的

### 3. Input Validation

- **URL**：提交前驗證格式，封鎖 `localhost`、私有 IP（10.x、192.168.x）、已知濫用域名
- **內容長度**：預言句子上限 500 字
- **截止日**：必須是未來日期，且不超過提交日起 5 年

### 4. Content Abuse Prevention

- Claude Haiku 審核是第一道過濾（`pending_review` 階段）
- 每則 active 預言提供「檢舉」按鈕 → 寫入 `reports` table → 進人工審核佇列
- 同一帳號連續被檢舉 3 次 → 自動暫停提交權限，等人工審核

### 5. Soft Delete（軟刪除）

預言不做實體刪除，改用 `deleted_at` + `deleted_by` + `delete_reason` 三個欄位標記。所有查詢加 `.is('deleted_at', null)` filter 排除已刪除資料。

**刪除權限：**

| 操作者 | 可刪除的 status | 備註 |
|---|---|---|
| 提交者本人 | `pending_review` 只 | 一旦 `active` 即不可自刪（已有投票 / 公開展示） |
| Admin | 任何 status | 需填 `delete_reason` |

**API：** `DELETE /api/predictions/[id]`
- 提交者本人呼叫：檢查 `submitted_by === session.user.email` 且 `status === 'pending_review'`，通過則寫入 `deleted_at` / `deleted_by`
- Admin 呼叫：檢查 admin whitelist，寫入 `deleted_at` / `deleted_by` / `delete_reason`

**前端入口：**
- 提交者：提交成功頁或個人頁面顯示「撤回」按鈕（僅 `pending_review`）
- Admin：`/admin` 後台每則預言有「刪除」按鈕，需填原因

### 6. Admin 後台

- 路由：`/admin`，僅限 email whitelist（環境變數設定）進入，NextAuth session 驗證
- 功能：手動 resolve / 刪除預言、查看 `reports` 佇列、解除帳號封鎖

---

## 不在 MVP 範圍內

- iOS App（有流量後再做）
- 使用者個人化（追蹤特定預言者的通知）
- 多語言
- 付費功能
- 自訂嵌入 widget

---

## 風險與注意事項

| 風險 | 對策 |
|------|------|
| 爬蟲被封 | robots.txt 遵守 + rate limiting + User-Agent 標明身份 |
| 版權爭議 | 只存預言句子，不存全文，標明出處 |
| AI 判定爭議 | 模糊案例走社群投票，保留人工覆核入口 |
| 嘴炮指數爭議 | 公開算法，讓社群可以挑戰 |
