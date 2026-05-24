# @karyl-chan/plugin-xiangqi

中國象棋 (xiangqi) 對局 plugin。一個頻道內最多一場對局，由
`/xiangqi start` 啟動，雙方可以**直接在頻道內打中文/ICCS/WXF 棋譜
走子**，或是透過 WebUI 用滑鼠下棋；兩種介面即時同步。

支援：人 vs 人、人 vs AI (fairy-stockfish UCCI，三階難度)。

## 指令 `/xiangqi`

| 子指令 | 用途 |
|---|---|
| `start [opponent] [ai] [side] [clock]` | 開新對局。`opponent` 為空時與 AI 對戰；`ai` 三階 (easy/normal/hard，預設 normal)；`side` 自選 red/black；`clock` 格式 `base+inc` 秒，例如 `600+30`，預設無時限。 |
| `stop` | 主辦或 admin 強制中斷本頻道對局。 |
| `board` | 印出當前棋盤 (ephemeral，10×9 漢字格)。 |
| `status` | 顯示對局者、輪次、步數、棋鐘狀態。 |
| `webui` | 取得個人 WebUI 連結 (任何能看見頻道的人都可索取 → 對局者操作、其餘觀棋)。 |
| `resign` | 投降。 |
| `draw` | 提議和棋；對手按下「接受」才結束。對 AI 自動拒絕。 |
| `takeback` | 請求悔棋；對人需對手同意，對 AI 自動退 1-2 手。 |
| `pgn` | 輸出本局完整棋譜文字。 |
| `manage` | 管理 WebUI (需 `plugin:karyl-xiangqi:manage` capability 或 admin)。|

## 棋譜輸入格式

對局進行中，**對局雙方任何一方在頻道內貼**以下任一格式都會被解析成走子：

| 格式 | 範例 | 備註 |
|---|---|---|
| 中文記譜法 | `炮二平五` / `馬八進七` / `車1進1` | 紅方用漢字數字 `一二三四五六七八九`，黑方用阿拉伯 `1-9`。可前綴 `前/中/後` 消歧。 |
| ICCS 座標 | `h2e2` / `a0a1` / `b7b0` | 縱線 a-i (左到右，紅方視角)，橫線 0-9 (下到上)。 |
| WXF | `C2.5` / `H8+7` / `R1-1` | 大寫 = 紅方，小寫 = 黑方。`.` 平、`+` 進、`-` 退。 |

非該方輪次、非對局者、或不合法的走法都會被靜默忽略 — 一般聊天不會被誤判。

當對局者在 WebUI 用滑鼠走子，bot 會自動在頻道貼出中文 + ICCS 雙併排譯
(e.g. `炮二平五 (h2e2)`)，讓 Discord 上的觀眾與棋譜紀錄保持一致。

## WebUI

兩個介面共用同一個 SPA bundle，由 URL token 區分：

- **對局視圖**：`/xiangqi webui` → SVG 10×9 棋盤、即時棋譜、剩餘時間。
  滑鼠點擊自己的棋子會高亮所有合法目標格，再點目標格送出走子。
  非對局者得到一份觀棋連結。
- **管理視圖**：`/xiangqi manage` (需 manage capability) → 列出所有
  guild 的進行中對局，按下「強停」立即結束。

WebUI 連結是 `<bot 公開 URL>/plugin/karyl-xiangqi/?token=…&c=…&s=…`，token
是 bot 簽的 Ed25519 plugin-session JWT (預設 6 小時)。對局結束後 10 分鐘
WebUI 仍可開啟做為「複盤」。

## AI 引擎

`fairy-stockfish` (UCCI 模式，`UCI_Variant=xiangqi`)。預設從
`/usr/local/bin/fairy-stockfish` 啟動 (Dockerfile 內安裝)；可透過
`XIANGQI_ENGINE_PATH` 環境變數覆寫。

| 難度 | UCI depth |
|---|---|
| easy | 4 |
| normal | 8 |
| hard | 12 |

每場 AI 對局獨立 spawn 一個 child process；5 分鐘 idle 自動 kill。引擎不
存在時 plugin 仍能載入，AI 改用隨機合法走法 (功能可用，棋力為零)。

## 設定與部署

1. 先把 bot 起來 (`docker compose -f docker-compose.bot.yml up -d`)。
2. Bot 上 admin 帳號跑
   `POST /api/plugins/setup-secret { pluginKey: "karyl-xiangqi" }` 取得
   一次性 secret，放入 `KARYL_PLUGIN_SETUP_SECRET_XIANGQI`。
3. `docker compose -f docker-compose.plugins.yml up --build -d karyl-plugin-xiangqi`。
4. 在 admin UI 啟用某 guild 的 `xiangqi` feature → 該 guild 立刻多
   `/xiangqi` 指令，且 plugin 開始收到 `guild.message_create` 事件。

## 開發

```bash
pnpm install
pnpm test         # vitest (~44 cases)
pnpm typecheck
pnpm build        # vite SPA + tsc
pnpm dev          # watch mode
```

## 架構備忘

- 走子主流程 (`flow/move-apply.ts`) 是唯一 chokepoint — 頻道訊息、WebUI
  action、AI timer 三路全部透過它，保證一處驗證、一處 SSE 推送、一處
  Echo 邏輯。
- 訊息監聽 (`/events`) 需自行 HMAC 驗證 — SDK 只內建 `/commands`、
  `/components` 的驗證；本 plugin 用 SDK 公開的 `verifyV0/verifyV1` +
  `getDispatchHmacKey()` 自己驗。
- 對局狀態純記憶體；plugin 重啟即丟。Bot 重啟導致 plugin token 失效時，
  SDK 會自動重註冊。
