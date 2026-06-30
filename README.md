# 考題專案系統

團隊內部的考題製作專案追蹤系統。從業務接案、出題、老師審稿到音檔送件，
整個製作流程的進度都在這裡管理。

## 功能

- **登入畫面** —— 選擇頭像＋4 位數 PIN 碼登入，依角色（admin／sales／assistant／guest）自動進入對應的預設畫面
- **全專案進度（看板）** —— 七個階段欄位（排隊區 → 出題中 → 修改題目 → 待老師回覆 → 製作錄音稿與學生卷 → 待音檔送件 → 結案），卡片可拖曳換階段，結案時有彩帶慶祝；逾期與 3 天內截稿的卡片會自動亮起警示徽章
- **截稿日（行事曆）** —— 以月曆檢視排隊區與出題中專案的審稿截止日
- **業務分區進度** —— 依業務檢視名下案件，附近期死線、待老師回覆、未結案統計
- **專案詳情** —— 完整欄位、一鍵複製老師 Email、討論串留言（支援回覆、編輯、刪除），有新留言時卡片會顯示未讀提示
- **搜尋** —— 依專案名稱、老師、考試範圍即時搜尋
- **複製專案** —— 以既有專案為範本快速建立新案
- **上傳申請表自動帶入** —— 新增專案時可上傳段考申請表（.doc／.docx），後端用 `word-extractor` 讀檔後以固定欄位規則擷取成品名稱、審題日、老師、Email、範圍、備註等欄位自動帶入，再手動調整。審題日缺漏時，以學校收件日往回推 10 天估算；負責業務／業助／製作人員依登入身份預選；聽力／閱讀題型預設「照舊」。

## 技術架構

| 項目 | 採用 |
|---|---|
| 前端框架 | React 19 + Vite |
| 樣式 | Tailwind CSS v4（`src/index.css` 內以 `@theme` 定義全站設計 token） |
| 後端／資料庫 | Supabase（`projects`、`team_users`、`comments` 三張資料表） |
| Serverless API | `api/`（Vercel functions）：登入驗證、LINE 推播、申請表解析 |
| 申請表解析 | `word-extractor` 讀 .doc／.docx ＋ 固定欄位規則 (regex) 擷取（純伺服器端、不需任何外部 API／金鑰、零成本）|
| 字體 | [獅尾四季春](https://github.com/max32002/swei-spring)（自行 host 於 `public/fonts/`，SIL OFL 授權）；載入期間以 Noto Sans TC（Google Fonts）顯示 |
| 頭像 | DiceBear Notionists |

> 申請表解析的 `/api/parse-exam-form` 函式只在 Vercel 或 `vercel dev` 下執行，純 `npm run dev` 不會啟動；本機要驗證解析結果可直接跑 `node scripts/test-parse-form.mjs`（不需任何金鑰）。

## 開發

### 環境需求

- Node.js 20+
- 一個 Supabase 專案

### 設定

1. 安裝相依套件：

   ```bash
   npm install
   ```

2. 在專案根目錄建立 `.env.local`：

   ```
   VITE_SUPABASE_URL=你的 Supabase 專案網址
   VITE_SUPABASE_ANON_KEY=你的 Supabase anon key
   ```

3. 啟動開發伺服器：

   ```bash
   npm run dev
   ```

### 其他指令

| 指令 | 說明 |
|---|---|
| `npm run build` | 產出正式版到 `dist/` |
| `npm run preview` | 預覽正式版 |
| `npm run lint` | 執行 ESLint |

## 專案結構

```
src/
├── App.jsx                 # 導覽列、視圖切換、全域搜尋
├── LoginScreen.jsx         # 頭像選擇 + PIN 碼登入
├── KanbanBoard.jsx         # 看板（拖曳換階段）
├── CalendarView.jsx        # 截稿日月曆
├── SalesDashboard.jsx      # 業務分區統計與清單
├── ProjectDetailModal.jsx  # 專案詳情與討論串
├── NewProjectModal.jsx     # 新增／複製專案
├── EditProjectModal.jsx    # 編輯專案
├── Skeleton.jsx            # 載入骨架屏積木
├── deadline.js             # 死線文字與顏色的共用邏輯
├── supabaseClient.js       # Supabase 連線
└── index.css               # Tailwind v4 @theme 設計 token（色票、字體、動畫）
```

## 設計系統

全站顏色統一定義在 `src/index.css` 的 `@theme` 區塊，元件一律使用語意化
class（如 `text-ink-muted`、`bg-paper`、`border-line`），不直接寫 hex 色碼。
要調整配色時改 token 一處即可全站生效。

| Token 系列 | 用途 |
|---|---|
| `paper` / `paper-soft` / `paper-warm` | 背景層次 |
| `ink` / `ink-soft` / `ink-muted` / `ink-faint` | 文字層次 |
| `line` / `line-strong` | 框線 |
| `accent` | 主按鈕 |
| `danger` / `warning` / `info`（各含 `-bg`、`-line`） | 低飽和狀態色 |
