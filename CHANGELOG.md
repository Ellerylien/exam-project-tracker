# 更新紀錄

版本號依[語意化版本](https://semver.org/lang/zh-TW/)編排：有新功能升第二碼（1.**x**.0），只有修正升第三碼（1.x.**y**）。
每個版本在 GitHub 都有對應的 tag 與 Release，要回頭看某一版的程式可到 [Releases](https://github.com/Ellerylien/exam-project-tracker/releases) 下載。

## [1.7.0] 寄信範本 — 2026-09-30

### 新增
- 專案詳情新增「寄信」：一鍵下載「請閱卷」「錄音稿」「教師卷＆學生卷」的 Outlook 郵件草稿，收件人、副本、主旨、內文自動帶入，傳統版 Outlook 開啟即為新郵件
- 郵件格式比照平常寄信：思源宋體 Medium 14pt、單行間距，專案名稱等標示處為思源宋體 SemiBold 深紅 #C00000
- 成員資料新增 Email、英文全名、中文姓名（`team_users`），人員異動改資料庫即可
- 手機上改以 mailto 開啟手機郵件 App（純文字）

## [1.6.0] @提及與階段導覽列 — 2026-09-30

### 新增
- 留言可 @提及成員，被提到的人收到「某某 提到你」的手機通知
- 全專案進度加上階段導覽列，點選或按 1–7、← → 把該欄置中
- 拖曳卡片可以直接放到階段導覽列上換階段

### 變更
- 一般留言不再推手機，只推給被 @ 提及的人

## [1.5.0] 手機推播 — 2026-09-29

### 新增
- 手機／瀏覽器推播（Web Push），免費補足 LINE 額度不足的通知
- 留言可勾選「同步通知 LINE 群組」，只推重要留言；管理者可看本月 LINE 額度

### 修正
- LINE 推播失敗時回報失敗原因，方便在 Supabase 端追查
- 手機推播改用高優先權，避免 Android 休眠時延遲送達
- 手機通知已開啟時移除綠點，避免誘發點擊誤關通知

### 其他
- 分頁圖示改成書本圖示

## [1.4.0] 待申請提醒與未讀通知 — 2026-09-17

### 新增
- 業務分區新增「待申請提醒」，依已申請的段考推算下一次該申請的考試
- 導覽列鈴鐺列出所有未讀回覆，點一下直接開啟專案

### 變更
- 已交件的案件顯示「已交件」，不再倒數

## [1.3.0] 新版申請表與業務分區指標 — 2026-08-28

### 新增
- 支援新版測卷申請表解析，並可反向產生填好的 Word 申請表
- 業務分區三張指標色塊可點擊篩選案件，並加上進出場動畫

### 變更
- 業務分區進度清單將已結案專案排至最下方
- 指標色塊與看板／日曆卡片改用「浮起」表示狀態

### 修正
- 卡片狀態的過渡動畫未生效

## [1.2.0] 上傳申請表自動帶入 — 2026-06-30

### 新增
- 新增專案可上傳段考申請表（.doc／.docx）自動帶入欄位，支援拖曳上傳，並對應負責業務／業助

### 變更
- 「老師回覆處理」按鈕移至專案詳情最上方，待回覆時免捲動即可操作

### 修正
- 放寬欄位行高，避免中文字型把英文下伸字尾切掉

## [1.1.1] 專案檢視欄位修正 — 2026-06-22

### 修正
- 專案檢視頁補上缺失的聽力題型與閱讀題型欄位
- 專案檢視頁欄位名稱字體放大

## [1.1.0] LINE 推播與後端登入驗證 — 2026-06-17

### 新增
- LINE 推播：留言與指定階段的進度變更自動通知業務×業助群組
- PIN 驗證搬到後端（`/api/users`、`/api/login`），以雜湊比對，連續輸錯會暫時鎖定

### 變更
- 登入體驗優化：預熱後端函式、驗證中顯示脈動回饋、淡出時間減半

## [1.0.0] 第一個完整版本 — 2026-06-15

### 新增
- 頭像＋4 位數 PIN 登入，依角色進入對應畫面
- 全專案進度看板（拖曳換階段）、截稿日月曆、業務分區進度
- 專案詳情與討論串、新增／編輯／複製專案
- 手機版 RWD
- 全站設計系統、自行 host 獅尾四季春字體、暗色模式
- 詳情視窗狀態下拉選單、ESC 分層關閉、拖曳目標欄位亮起
- toast 通知、刪除確認視窗、未讀計數徽章
- Supabase Realtime 即時同步
- 結案專案封存、表單離開前確認

### 修正
- 點開專案卡後按 ESC 關閉，卡片殘留 focus 外框

[1.7.0]: https://github.com/Ellerylien/exam-project-tracker/releases/tag/v1.7.0
[1.6.0]: https://github.com/Ellerylien/exam-project-tracker/releases/tag/v1.6.0
[1.5.0]: https://github.com/Ellerylien/exam-project-tracker/releases/tag/v1.5.0
[1.4.0]: https://github.com/Ellerylien/exam-project-tracker/releases/tag/v1.4.0
[1.3.0]: https://github.com/Ellerylien/exam-project-tracker/releases/tag/v1.3.0
[1.2.0]: https://github.com/Ellerylien/exam-project-tracker/releases/tag/v1.2.0
[1.1.1]: https://github.com/Ellerylien/exam-project-tracker/releases/tag/v1.1.1
[1.1.0]: https://github.com/Ellerylien/exam-project-tracker/releases/tag/v1.1.0
[1.0.0]: https://github.com/Ellerylien/exam-project-tracker/releases/tag/v1.0.0
