/**
 * 简体中文（zh-CN）字典。与 zh-TW 同形，仅完成繁→简转换并采用大陆
 * 通行的象棋术语（将/帅 仍保留双方写法，文字描述统一为「将军／将死／和棋」）。
 */

export const zhCN: Record<string, string> = {
  // — plugin meta
  "plugin.description":
    "中国象棋对战：在频道内以棋谱术语下棋，附完整图形 WebUI。",
  "feature.description":
    "在频道内以文字／WebUI 双界面下中国象棋；支持人对人、人对 AI。",

  // — top-level command
  "cmd.description": "中国象棋对战指令",
  "cmd.start.description": "开新对局",
  "cmd.start.opponentOption":
    "点名对手 (省略则开公开邀请，任何人可按按钮加入)",
  "cmd.start.aiLevelOption":
    "与 AI 对战并指定难度 (有此选项时不发邀请，直接开局)",
  "cmd.start.sideOption":
    "自己执哪方 (red/black)；省略则由对手选 (公开邀请) 或默认执红 (其他模式)",
  "cmd.start.clockOption":
    "时限格式 base+inc 秒 (例：600+30，省略则无时限)",
  "cmd.start.showBoardOption":
    "代理走棋时输出含棋盘的详细 embed (默认关，仅输出盲棋术语)",
  "cmd.stop.description": "中断当前对局",
  "cmd.board.description": "打印当前棋盘",
  "cmd.status.description": "显示对局者与轮次信息",
  "cmd.webui.description": "获取个人 WebUI 链接",
  "cmd.resign.description": "认输",
  "cmd.draw.description": "提议和棋 (对手按下接受才生效)",
  "cmd.takeback.description": "请求悔棋 (对手同意才生效；对 AI 直接退一步)",
  "cmd.pgn.description": "输出本局棋谱文字",
  "cmd.manage.description": "管理页面 (需 manage 权限)",

  // — error
  "error.notInGuild": "此指令仅可在服务器频道内使用。",
  "error.alreadyRunning": "本频道已有对局进行中。",
  "error.noGame": "本频道没有进行中的对局。",
  "error.notPlayer": "你不是本场对局的对战者。",
  "error.notYourTurn": "现在不是你的回合。",
  "error.noPermission": "你没有执行此操作的权限。",
  "error.cantChallengeBot": "不能挑战机器人账号 (请用 ai 选项与 AI 对战)。",
  "error.cantChallengeSelf": "不能挑战自己。",
  "error.invalidClock": "时限格式错误，请用 `base+inc` 秒，例如 `600+30`。",
  "error.invalidAiLevel": "AI 难度只接受 easy / normal / hard。",
  "error.invalidSide": "side 只接受 red 或 black。",
  "error.pendingNotMatch": "目前仍在等待接受邀请。",

  // — start / invite
  "invite.title": "{challenger} 邀请 {opponent} 对局",
  "invite.descriptionRed": "{challenger} (执红) vs {opponent} (执黑)",
  "invite.descriptionBlack": "{challenger} (执黑) vs {opponent} (执红)",
  "invite.aiStarting": "{challenger} 与 AI ({level}) 对局开始 — 执{side}",
  "invite.timeoutNote": "对手按下「接受」即开始。",
  "invite.acceptBtn": "✅ 接受",
  "invite.declineBtn": "❌ 拒绝",
  "invite.cancelBtn": "🚫 取消",
  "invite.declined": "{opponent} 拒绝了挑战。",
  "invite.cancelled": "邀请已取消。",
  "invite.publicTitle": "{challenger} 发起对局",
  "invite.publicDescriptionOpen":
    "{challenger} 在等对手 — 任何人都可按下加入按钮成为对手。",
  "invite.publicDescriptionFixedSide":
    "{challenger} 执{side}，等候对手加入。",
  "invite.joinRedBtn": "🔴 加入红方",
  "invite.joinBlackBtn": "⚫ 加入黑方",
  "invite.joined": "{opponent} 加入对局，执{side}！",
  "invite.cantJoinOwn": "你是发起者，不能加入自己的邀请。",
  "invite.cantCancelOther": "只有发起者可以取消邀请。",
  "invite.sentDirect": "已对 {opponent} 发出邀请。",
  "invite.publicCreated": "已开启对局邀请，等待对手加入。",

  // — board / status
  "board.title": "对局 #{shortId}",
  "board.turnNote": "轮到：{side}",
  "board.move": "**第 {n} 手 — {side}** {move}",
  "board.gameOver": "对局结束",
  "board.vsLine": "{red} (红) vs {black} (黑)",
  "board.openLine": "🟢 {red} (红) vs {black} (黑) — {side}先行",
  "board.checkSuffix": "➡️ 将军！",
  "status.movesPlayed": "已下 {n} 手",
  "status.clock": "时限：红 {red} / 黑 {black}",
  "status.clockOff": "无时限",
  "side.red": "红方",
  "side.black": "黑方",

  // — end
  "end.checkmate": "将死！",
  "end.stalemate": "困毙 — {side}无路可走",
  "end.resign": "{side}认输",
  "end.drawAgreed": "双方同意和棋",
  "end.timeout": "{side}超时",
  "end.halfmove60": "六十着和棋 (连续 60 着未吃子)",
  "end.repetition": "三次重复局面和棋",
  "end.aborted": "对局已中断",
  "end.winnerRed": "🔴 红方胜",
  "end.winnerBlack": "⚫ 黑方胜",
  "end.draw": "和棋",

  // — draw / takeback / resign
  "draw.offered": "{side}提议和棋。对手可按下「接受」确认。",
  "draw.acceptBtn": "✅ 接受和棋",
  "draw.declineBtn": "❌ 拒绝",
  "draw.declined": "对手拒绝了和棋提议。",
  "takeback.offered":
    "{side}要求悔棋 {plies} 手。对手可按下「同意」确认。",
  "takeback.acceptBtn": "↩ 同意悔棋",
  "takeback.declineBtn": "❌ 拒绝",
  "takeback.declined": "对手拒绝了悔棋请求。",
  "takeback.appliedAi": "已退回 {plies} 手。",
  "takeback.applied": "已退回 {plies} 手。",
  "draw.offerTitle": "和棋提议",
  "takeback.offerTitle": "悔棋请求",
  "pause.title": "⏸ 对局暂停",
  "pause.drawPending": "{side}提议和棋——请先接受或拒绝才能继续下棋。",
  "pause.takebackPending":
    "{side}要求悔棋 {plies} 手——请先接受或拒绝才能继续下棋。",
  "pause.cannotMove": "对局因提议暂停中，请先处理该提议再走子。",

  // — webui / manage
  "webui.title": "象棋对局 WebUI",
  "webui.descriptionPlayer":
    "点击下方按钮进入专属棋盘。在 WebUI 走子等同于在频道下棋，bot 会帮你写出棋谱。",
  "webui.descriptionSpectator":
    "你不是本局对局者，但可通过 WebUI 观棋。",
  "webui.openButton": "🎯 打开棋盘",
  "webui.openHint":
    "双方请各自用 `/xiangqi webui` 打开自己的棋盘（每个 WebUI 链接都是个人专属，请勿分享）。",
  "webui.unavailable": "⚠ 无法生成 WebUI 链接 (publicBaseUrl 或 RPC 不可用)",
  "manage.title": "Karyl Xiangqi 管理",
  "manage.description": "列出进行中的对局；可强制中断任何频道的对局。",
  "manage.openButton": "🛠 打开管理页面",
  "manage.notAllowed": "你没有管理权限。",
  "manage.botRejected": "Bot 拒绝签发管理 token。",
  "manage.publicBaseUrlMissing": "⚠ publicBaseUrl 尚未可用",
};
