/**
 * English (en) dictionary. Mirrors the zh-TW shape. Xiangqi terminology
 * follows the xiangqi.com / lichess-style convention (General / Advisor /
 * Elephant / Horse / Chariot / Cannon / Soldier; Red / Black).
 */

export const en: Record<string, string> = {
  // — plugin meta
  "plugin.description":
    "Chinese Chess (Xiangqi) — play live games in a channel via notation, with a full graphical WebUI.",
  "feature.description":
    "Play Chinese Chess in the channel via text or WebUI; supports human vs human and human vs AI.",

  // — top-level command
  "cmd.description": "Chinese Chess commands",
  "cmd.start.description": "Start a new game",
  "cmd.start.opponentOption":
    "Name a specific opponent (omit to open a public invite anyone can join)",
  "cmd.start.aiLevelOption":
    "Play against the AI at the given difficulty (skips the invite, game starts immediately)",
  "cmd.start.sideOption":
    "Which side you play (red/black); omit to let the opponent pick, or default to Red",
  "cmd.start.clockOption":
    "Time control as base+inc seconds (e.g. 600+30; omit for untimed)",
  "cmd.start.showBoardOption":
    "Include the board snapshot in proxied move posts (off by default; blindfold-style notation only)",
  "cmd.stop.description": "Abort the current game",
  "cmd.board.description": "Print the current board",
  "cmd.status.description": "Show players and whose turn it is",
  "cmd.webui.description": "Get your personal WebUI link",
  "cmd.resign.description": "Resign",
  "cmd.draw.description": "Offer a draw (takes effect when the opponent accepts)",
  "cmd.takeback.description": "Request a takeback (opponent must agree; against AI, undoes immediately)",
  "cmd.pgn.description": "Output this game's move record",
  "cmd.manage.description": "Admin page (requires the manage capability)",

  // — error
  "error.notInGuild": "This command can only be used in a server channel.",
  "error.alreadyRunning": "A game is already in progress in this channel.",
  "error.noGame": "There is no active game in this channel.",
  "error.notPlayer": "You are not a player in this game.",
  "error.notYourTurn": "It is not your turn.",
  "error.noPermission": "You do not have permission to do that.",
  "error.cantChallengeBot": "Cannot challenge a bot account (use the `ai` option to play the AI).",
  "error.cantChallengeSelf": "Cannot challenge yourself.",
  "error.invalidClock": "Bad clock format — use `base+inc` seconds, e.g. `600+30`.",
  "error.invalidAiLevel": "AI level must be one of easy / normal / hard.",
  "error.invalidSide": "`side` must be either red or black.",
  "error.pendingNotMatch": "Still waiting for the invite to be accepted.",

  // — start / invite
  "invite.title": "{challenger} invites {opponent} to play",
  "invite.descriptionRed": "{challenger} (Red) vs {opponent} (Black)",
  "invite.descriptionBlack": "{challenger} (Black) vs {opponent} (Red)",
  "invite.aiStarting": "{challenger} vs AI ({level}) — game starting, you play {side}",
  "invite.timeoutNote": "Game starts when the opponent presses Accept.",
  "invite.acceptBtn": "✅ Accept",
  "invite.declineBtn": "❌ Decline",
  "invite.cancelBtn": "🚫 Cancel",
  "invite.declined": "{opponent} declined the challenge.",
  "invite.cancelled": "Invite cancelled.",
  "invite.publicTitle": "{challenger} is starting a game",
  "invite.publicDescriptionOpen":
    "{challenger} is waiting for an opponent — anyone can press a join button to take the seat.",
  "invite.publicDescriptionFixedSide":
    "{challenger} is playing {side}, waiting for an opponent to join.",
  "invite.joinRedBtn": "🔴 Join as Red",
  "invite.joinBlackBtn": "⚫ Join as Black",
  "invite.joined": "{opponent} joined the game as {side}!",
  "invite.cantJoinOwn": "You created this invite; you cannot join your own.",
  "invite.cantCancelOther": "Only the inviter can cancel this invite.",
  "invite.sentDirect": "Invite sent to {opponent}.",
  "invite.publicCreated": "Open invite created — waiting for an opponent to join.",

  // — board / status
  "board.title": "Game #{shortId}",
  "board.turnNote": "Turn: {side}",
  "board.move": "**Move {n} — {side}** {move}",
  "board.gameOver": "Game over",
  "board.vsLine": "{red} (Red) vs {black} (Black)",
  "board.openLine": "🟢 {red} (Red) vs {black} (Black) — {side} to move",
  "board.checkSuffix": "➡️ Check!",
  "status.movesPlayed": "{n} moves played",
  "status.clock": "Clock: Red {red} / Black {black}",
  "status.clockOff": "No clock",
  "side.red": "Red",
  "side.black": "Black",

  // — end
  "end.checkmate": "Checkmate!",
  "end.stalemate": "Stalemate — {side} has no legal moves",
  "end.resign": "{side} resigned",
  "end.drawAgreed": "Draw by agreement",
  "end.timeout": "{side} ran out of time",
  "end.halfmove60": "Draw by 60-move rule (no capture in 60 moves)",
  "end.repetition": "Draw by threefold repetition",
  "end.aborted": "Game aborted",
  "end.winnerRed": "🔴 Red wins",
  "end.winnerBlack": "⚫ Black wins",
  "end.draw": "Draw",

  // — draw / takeback / resign
  "draw.offered": "{side} offered a draw. The opponent can press Accept to confirm.",
  "draw.acceptBtn": "✅ Accept draw",
  "draw.declineBtn": "❌ Decline",
  "draw.declined": "The opponent declined the draw offer.",
  "takeback.offered":
    "{side} requested a takeback of {plies} ply. The opponent can press Agree to confirm.",
  "takeback.acceptBtn": "↩ Agree to takeback",
  "takeback.declineBtn": "❌ Decline",
  "takeback.declined": "The opponent declined the takeback request.",
  "takeback.appliedAi": "Rolled back {plies} ply.",
  "takeback.applied": "Rolled back {plies} ply.",

  // — webui / manage
  "webui.title": "Xiangqi Game WebUI",
  "webui.descriptionPlayer":
    "Open your personal board with the button below. Moves made in the WebUI are equivalent to playing in the channel — the bot writes them into the move record.",
  "webui.descriptionSpectator":
    "You are not a player in this game, but you can spectate via the WebUI.",
  "webui.openButton": "🎯 Open board",
  "webui.unavailable": "⚠ Could not produce a WebUI link (publicBaseUrl or RPC unavailable).",
  "manage.title": "Karyl Xiangqi admin",
  "manage.description": "List active games; force-stop any channel's game.",
  "manage.openButton": "🛠 Open admin page",
  "manage.notAllowed": "You do not have the manage capability.",
  "manage.botRejected": "Bot refused to issue a manage token.",
  "manage.publicBaseUrlMissing": "⚠ publicBaseUrl is not yet available.",
};
