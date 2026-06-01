/**
 * 繁體中文（zh-TW）翻譯字典。鍵路徑與 en / zh-CN 保持一致。
 * 變數插值使用 `{var}`（避免和 i18next 的 `{{var}}` 風格混淆）。
 */

export const zhTW: Record<string, string> = {
  // — plugin meta
  "plugin.description":
    "中國象棋對戰：在 channel 內以棋譜術語下棋，附完整圖形 WebUI。",
  "feature.description":
    "在頻道內以文字／WebUI 雙介面下中國象棋；支援人對人、人對 AI。",

  // — top-level command
  "cmd.description": "中國象棋對戰指令",
  "cmd.start.description": "開新對局",
  "cmd.start.opponentOption":
    "點名對手 (省略則開公開邀請，任何人可按按鈕加入)",
  "cmd.start.aiLevelOption":
    "與 AI 對戰並指定難度 (有此選項時不發邀請，直接開局)",
  "cmd.start.sideOption":
    "自己執哪方 (red/black)；省略則由對手選 (公開邀請) 或預設執紅 (其他模式)",
  "cmd.start.clockOption":
    "時限格式 base+inc 秒 (例：600+30，省略則無時限)",
  "cmd.start.showBoardOption":
    "代理走棋時輸出含棋盤的詳細 embed (預設關，僅輸出盲棋術語)",
  "cmd.stop.description": "中斷目前對局",
  "cmd.board.description": "印出目前棋盤",
  "cmd.status.description": "顯示對局者與輪次資訊",
  "cmd.webui.description": "取得個人 WebUI 連結",
  "cmd.resign.description": "投降",
  "cmd.draw.description": "提議和棋 (對手按下接受才生效)",
  "cmd.takeback.description": "請求悔棋 (對手同意才生效；對 AI 直接退一步)",
  "cmd.pgn.description": "輸出本局棋譜文字",
  "cmd.manage.description": "管理頁面 (需 manage 權限)",

  // — error
  "error.notInGuild": "此指令僅可在伺服器頻道內使用。",
  "error.alreadyRunning": "本頻道已有對局進行中。",
  "error.noGame": "本頻道沒有進行中的對局。",
  "error.notPlayer": "你不是這場對局的對戰者。",
  "error.notYourTurn": "現在不是你的回合。",
  "error.noPermission": "你沒有執行此操作的權限。",
  "error.cantChallengeBot": "不能挑戰機器人帳號 (請用 npc 選項與 AI 對戰)。",
  "error.cantChallengeSelf": "不能挑戰自己。",
  "error.invalidClock": "時限格式錯誤，請用 `base+inc` 秒，例如 `600+30`。",
  "error.invalidAiLevel": "AI 難度只接受 easy / normal / hard。",
  "error.invalidSide": "side 只接受 red 或 black。",
  "error.pendingNotMatch": "目前還在等待接受邀請。",

  // — start / invite
  "invite.title": "{challenger} 邀請 {opponent} 對局",
  "invite.descriptionRed": "{challenger} (執紅) vs {opponent} (執黑)",
  "invite.descriptionBlack": "{challenger} (執黑) vs {opponent} (執紅)",
  "invite.aiStarting": "{challenger} 與 AI ({level}) 對局開始 — 執{side}",
  "invite.timeoutNote": "對手按下「接受」即開始。",
  "invite.acceptBtn": "✅ 接受",
  "invite.declineBtn": "❌ 拒絕",
  "invite.cancelBtn": "🚫 取消",
  "invite.declined": "{opponent} 拒絕了挑戰。",
  "invite.cancelled": "邀請已取消。",
  "invite.publicTitle": "{challenger} 發起對局",
  "invite.publicDescriptionOpen":
    "{challenger} 在等對手 — 任何人都可按下加入按鈕成為對手。",
  "invite.publicDescriptionFixedSide":
    "{challenger} 執{side}，等候對手加入。",
  "invite.joinRedBtn": "🔴 加入紅方",
  "invite.joinBlackBtn": "⚫ 加入黑方",
  "invite.joined": "{opponent} 加入對局，執{side}！",
  "invite.cantJoinOwn": "你是發起者，不能加入自己的邀請。",
  "invite.cantCancelOther": "只有發起者可以取消邀請。",
  "invite.sentDirect": "已對 {opponent} 發出邀請。",
  "invite.publicCreated": "已開啟對局邀請，等待對手加入。",

  // — board / status
  "board.title": "對局 #{shortId}",
  "board.turnNote": "輪到：{side}",
  "board.move": "**第 {n} 手 — {side}** {move}",
  "board.gameOver": "對局結束",
  "board.vsLine": "{red} (紅) vs {black} (黑)",
  "board.openLine": "🟢 {red} (紅) vs {black} (黑) — {side}先行",
  "board.checkSuffix": "➡️ 將軍！",
  "status.movesPlayed": "已下 {n} 手",
  "status.clock": "時限：紅 {red} / 黑 {black}",
  "status.clockOff": "無時限",
  "side.red": "紅方",
  "side.black": "黑方",

  // — end
  "end.checkmate": "將死！",
  "end.stalemate": "困斃 — {side}無路可走",
  "end.resign": "{side}投降",
  "end.drawAgreed": "雙方同意和棋",
  "end.timeout": "{side}超時",
  "end.halfmove60": "六十著和棋 (連續 60 著未吃子)",
  "end.repetition": "三次重複局面和棋",
  "end.aborted": "對局已中斷",
  "end.winnerRed": "🔴 紅方勝",
  "end.winnerBlack": "⚫ 黑方勝",
  "end.draw": "和棋",

  // — draw / takeback / resign
  "draw.offered": "{side}提議和棋。對手可按下「接受」確認。",
  "draw.acceptBtn": "✅ 接受和棋",
  "draw.declineBtn": "❌ 拒絕",
  "draw.declined": "對手拒絕了和棋提議。",
  "takeback.offered":
    "{side}要求悔棋 {plies} 手。對手可按下「同意」確認。",
  "takeback.acceptBtn": "↩ 同意悔棋",
  "takeback.declineBtn": "❌ 拒絕",
  "takeback.declined": "對手拒絕了悔棋請求。",
  "takeback.appliedAi": "已退回 {plies} 手。",
  "takeback.applied": "已退回 {plies} 手。",
  "draw.offerTitle": "和棋提議",
  "takeback.offerTitle": "悔棋請求",
  "pause.title": "⏸ 對局暫停",
  "pause.drawPending": "{side}提議和棋——請先接受或拒絕才能繼續下棋。",
  "pause.takebackPending":
    "{side}要求悔棋 {plies} 手——請先接受或拒絕才能繼續下棋。",
  "pause.cannotMove": "對局因提議暫停中，請先處理該提議再走子。",

  // — webui / manage
  "webui.title": "象棋對局 WebUI",
  "webui.descriptionPlayer":
    "點擊下方按鈕進入專屬棋盤。在 WebUI 走子等同於在頻道下棋，bot 會幫你寫出棋譜。",
  "webui.descriptionSpectator":
    "你不是本局對局者，但可透過 WebUI 觀棋。",
  "webui.openButton": "🎯 開啟棋盤",
  "webui.openHint":
    "雙方請各自用 `/xiangqi webui` 開啟自己的棋盤（每個 WebUI 連結都是個人專屬，請勿分享）。",
  "webui.unavailable": "⚠ 無法產生 WebUI 連結 (publicBaseUrl 或 RPC 不可用)",
  "manage.title": "Karyl Xiangqi 管理",
  "manage.description": "列出進行中的對局；可強制中斷任何頻道的對局。",
  "manage.openButton": "🛠 開啟管理頁面",
  "manage.notAllowed": "你沒有管理權限。",
  "manage.botRejected": "Bot 拒絕簽發管理 token。",
  "manage.publicBaseUrlMissing": "⚠ publicBaseUrl 尚未可用",
};
