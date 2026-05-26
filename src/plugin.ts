import {
  defineGuildFeature,
  definePlugin,
  definePluginCapability,
  definePluginCommand,
  definePluginComponent,
  type CommandContext,
  type CommandReply,
  type ComponentContext,
  type ComponentReply,
} from "@karyl-chan/plugin-sdk";
import {
  GUILD_FEATURE_KEY,
  PLUGIN_KEY,
  PLUGIN_NAME,
  PLUGIN_VERSION,
} from "./constants.js";
import { t } from "./i18n/index.js";
import { handleStart } from "./flow/start.js";
import { handleStop } from "./flow/stop.js";
import { handleBoard } from "./flow/board-cmd.js";
import { handleStatus } from "./flow/status-cmd.js";
import { handleWebui } from "./flow/webui-cmd.js";
import { handleResign } from "./flow/resign.js";
import { handleDraw } from "./flow/draw.js";
import { handleTakeback } from "./flow/takeback.js";
import { handlePgn } from "./flow/pgn-cmd.js";
import { handleManage } from "./flow/manage-cmd.js";
import { onComponent } from "./flow/dispatcher.js";
import { registerWebRoutes, setPublicUrlEnvFallback } from "./web-routes.js";
import { onGuildMessageCreate } from "./flow/move-watcher.js";

// Propagate env fallback into web-routes.ts at module init time so
// effectiveBase() can use it before any SDK wiring happens. Matches the
// quest-game / radio plugins' pattern of doing this at the top of
// plugin.ts (not in index.ts).
const PUBLIC_URL_ENV = process.env.XIANGQI_PUBLIC_URL
  ? process.env.XIANGQI_PUBLIC_URL.replace(/\/+$/, "")
  : undefined;
setPublicUrlEnvFallback(PUBLIC_URL_ENV);

/**
 * Karyl Xiangqi — Chinese chess as a guild feature.
 *
 *  • `/xiangqi` is registered only on guilds where an admin enabled the
 *    `xiangqi` guild feature (matches quest-game / radio plugins).
 *  • The feature subscribes to `guild.message_create` so the plugin can
 *    parse moves typed into the channel — delivery is via the SDK's
 *    built-in `eventHandlers` (Lockdown L-1); no custom /events route.
 *  • Components stay plugin-level (track 2) so a game in progress stays
 *    interactive even if an admin disables the feature mid-game.
 */
export function buildPlugin() {
  return definePlugin({
    key: PLUGIN_KEY,
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: t(undefined, "plugin.description"),
    author: "0Miles",
    rpcMethodsUsed: [
      "messages.send",
      "messages.edit",
      "messages.delete",
      "messages.add_reaction",
      "interactions.respond",
      "interactions.followup",
      "auth.session",
      "members.get",
    ],
    guildFeatures: [
      defineGuildFeature({
        key: GUILD_FEATURE_KEY,
        name: "Karyl Xiangqi",
        description: t(undefined, "feature.description"),
        enabledByDefault: false,
        eventsSubscribed: ["guild.message_create"],
        commands: [
          definePluginCommand({
            name: "xiangqi",
            description: t(undefined, "cmd.description"),
            scope: "guild",
            integrationTypes: ["guild_install"],
            contexts: ["Guild"],
            options: [
              {
                type: "sub_command",
                name: "start",
                description: t(undefined, "cmd.start.description"),
                options: [
                  {
                    type: "user",
                    name: "opponent",
                    description: t(undefined, "cmd.start.opponentOption"),
                    required: false,
                  },
                  {
                    type: "string",
                    name: "ai",
                    description: t(undefined, "cmd.start.aiLevelOption"),
                    required: false,
                    choices: [
                      { name: "easy", value: "easy" },
                      { name: "normal", value: "normal" },
                      { name: "hard", value: "hard" },
                    ],
                  },
                  {
                    type: "string",
                    name: "side",
                    description: t(undefined, "cmd.start.sideOption"),
                    required: false,
                    choices: [
                      { name: "red", value: "red" },
                      { name: "black", value: "black" },
                    ],
                  },
                  {
                    type: "string",
                    name: "clock",
                    description: t(undefined, "cmd.start.clockOption"),
                    required: false,
                  },
                  {
                    type: "boolean",
                    name: "show_board",
                    description: t(undefined, "cmd.start.showBoardOption"),
                    required: false,
                  },
                ],
              },
              { type: "sub_command", name: "stop", description: t(undefined, "cmd.stop.description") },
              { type: "sub_command", name: "board", description: t(undefined, "cmd.board.description") },
              { type: "sub_command", name: "status", description: t(undefined, "cmd.status.description") },
              { type: "sub_command", name: "webui", description: t(undefined, "cmd.webui.description") },
              { type: "sub_command", name: "resign", description: t(undefined, "cmd.resign.description") },
              { type: "sub_command", name: "draw", description: t(undefined, "cmd.draw.description") },
              {
                type: "sub_command",
                name: "takeback",
                description: t(undefined, "cmd.takeback.description"),
              },
              { type: "sub_command", name: "pgn", description: t(undefined, "cmd.pgn.description") },
              { type: "sub_command", name: "manage", description: t(undefined, "cmd.manage.description") },
            ],
            handler: async (ctx: CommandContext): Promise<CommandReply> => {
              const sub = ctx.subCommandName;
              switch (sub) {
                case "start":
                  return handleStart(ctx);
                case "stop":
                  return handleStop(ctx);
                case "board":
                  return handleBoard(ctx);
                case "status":
                  return handleStatus(ctx);
                case "webui":
                  return handleWebui(ctx);
                case "resign":
                  return handleResign(ctx);
                case "draw":
                  return handleDraw(ctx);
                case "takeback":
                  return handleTakeback(ctx);
                case "pgn":
                  return handlePgn(ctx);
                case "manage":
                  return handleManage(ctx);
                default:
                  return { content: "Unknown subcommand", ephemeral: true };
              }
            },
          }),
        ],
      }),
    ],
    components: [
      definePluginComponent({
        id: "acc",
        handler: (ctx: ComponentContext): Promise<ComponentReply> => onComponent(ctx, "acc"),
      }),
      definePluginComponent({
        id: "dec",
        handler: (ctx: ComponentContext): Promise<ComponentReply> => onComponent(ctx, "dec"),
      }),
      definePluginComponent({
        id: "cancel",
        handler: (ctx: ComponentContext): Promise<ComponentReply> => onComponent(ctx, "cancel"),
      }),
      definePluginComponent({
        id: "join-r",
        handler: (ctx: ComponentContext): Promise<ComponentReply> => onComponent(ctx, "join-r"),
      }),
      definePluginComponent({
        id: "join-b",
        handler: (ctx: ComponentContext): Promise<ComponentReply> => onComponent(ctx, "join-b"),
      }),
      definePluginComponent({
        id: "inv-cancel",
        handler: (ctx: ComponentContext): Promise<ComponentReply> => onComponent(ctx, "inv-cancel"),
      }),
      definePluginComponent({
        id: "draw-acc",
        handler: (ctx: ComponentContext): Promise<ComponentReply> => onComponent(ctx, "draw-acc"),
      }),
      definePluginComponent({
        id: "draw-dec",
        handler: (ctx: ComponentContext): Promise<ComponentReply> => onComponent(ctx, "draw-dec"),
      }),
      definePluginComponent({
        id: "tb-acc",
        handler: (ctx: ComponentContext): Promise<ComponentReply> => onComponent(ctx, "tb-acc"),
      }),
      definePluginComponent({
        id: "tb-dec",
        handler: (ctx: ComponentContext): Promise<ComponentReply> => onComponent(ctx, "tb-dec"),
      }),
    ],
    capabilities: [
      definePluginCapability({
        key: "manage",
        description: "Access the Karyl Xiangqi admin WebUI (list / force-stop games).",
      }),
    ],
    eventHandlers: {
      // SDK verifies HMAC + parses JSON; we narrow + forward to the
      // move-watcher. Throws inside the handler are caught and logged
      // by the SDK so a bad payload can't take the plugin process down.
      "guild.message_create": async (_ctx, data) => {
        const payload = data as Parameters<typeof onGuildMessageCreate>[0];
        if (!payload || typeof payload.channel_id !== "string") return;
        await onGuildMessageCreate(payload);
      },
    },
    onReady: async (server) => {
      await registerWebRoutes(server);
    },
  });
}
