import {
  defineGuildFeature,
  definePlugin,
  definePluginCapability,
  definePluginCommand,
  definePluginComponent,
  type CommandContext,
  type CommandOption,
  type CommandReply,
  type ComponentContext,
  type ComponentReply,
  type PluginCommandDefinition,
} from "@karyl-chan/plugin-sdk";
import {
  GUILD_FEATURE_KEY,
  PLUGIN_KEY,
  PLUGIN_NAME,
  PLUGIN_VERSION,
} from "./constants.js";
import { t, localizedDescriptions } from "./i18n/index.js";
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
 * Build a slash command option that carries both the canonical English
 * `description` and a Discord-shaped `descriptionLocalizations` map so
 * Discord renders the option's help text in the user's client locale.
 *
 * The SDK's `CommandOption` interface doesn't yet declare the field;
 * it's intersected here so the literal compiles while the (extra) field
 * still survives the manifest spread + reaches Discord at register time.
 */
type LocalizedOption = CommandOption & {
  descriptionLocalizations?: ReturnType<typeof localizedDescriptions>;
};

function locOption(opt: CommandOption, key: string): LocalizedOption {
  return {
    ...opt,
    description: t("en", key),
    descriptionLocalizations: localizedDescriptions(key),
  };
}

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
    description: t("en", "plugin.description"),
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
        description: t("en", "feature.description"),
        enabledByDefault: false,
        eventsSubscribed: ["guild.message_create"],
        commands: [
          // descriptionLocalizations is an "extra" alongside `description`
          // — the SDK's manifest builder spreads the command object's
          // options array through to the manifest, so the field reaches
          // Discord without an SDK change. The top-level command literal
          // is widened to `PluginCommandDefinition & { … }` so the extra
          // field on the command object survives too.
          ({
            ...definePluginCommand({
              name: "xiangqi",
              description: t("en", "cmd.description"),
              scope: "guild",
              integrationTypes: ["guild_install"],
              contexts: ["Guild"],
              options: [
                locOption(
                  {
                    type: "sub_command",
                    name: "start",
                    description: "",
                    options: [
                      locOption(
                        {
                          type: "user",
                          name: "opponent",
                          description: "",
                          required: false,
                        },
                        "cmd.start.opponentOption",
                      ),
                      locOption(
                        {
                          type: "string",
                          name: "ai",
                          description: "",
                          required: false,
                          choices: [
                            { name: "easy", value: "easy" },
                            { name: "normal", value: "normal" },
                            { name: "hard", value: "hard" },
                          ],
                        },
                        "cmd.start.aiLevelOption",
                      ),
                      locOption(
                        {
                          type: "string",
                          name: "side",
                          description: "",
                          required: false,
                          choices: [
                            { name: "red", value: "red" },
                            { name: "black", value: "black" },
                          ],
                        },
                        "cmd.start.sideOption",
                      ),
                      locOption(
                        {
                          type: "string",
                          name: "clock",
                          description: "",
                          required: false,
                        },
                        "cmd.start.clockOption",
                      ),
                      locOption(
                        {
                          type: "boolean",
                          name: "show_board",
                          description: "",
                          required: false,
                        },
                        "cmd.start.showBoardOption",
                      ),
                    ],
                  },
                  "cmd.start.description",
                ),
                locOption(
                  { type: "sub_command", name: "stop", description: "" },
                  "cmd.stop.description",
                ),
                locOption(
                  { type: "sub_command", name: "board", description: "" },
                  "cmd.board.description",
                ),
                locOption(
                  { type: "sub_command", name: "status", description: "" },
                  "cmd.status.description",
                ),
                locOption(
                  { type: "sub_command", name: "webui", description: "" },
                  "cmd.webui.description",
                ),
                locOption(
                  { type: "sub_command", name: "resign", description: "" },
                  "cmd.resign.description",
                ),
                locOption(
                  { type: "sub_command", name: "draw", description: "" },
                  "cmd.draw.description",
                ),
                locOption(
                  { type: "sub_command", name: "takeback", description: "" },
                  "cmd.takeback.description",
                ),
                locOption(
                  { type: "sub_command", name: "pgn", description: "" },
                  "cmd.pgn.description",
                ),
                locOption(
                  { type: "sub_command", name: "manage", description: "" },
                  "cmd.manage.description",
                ),
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
            descriptionLocalizations: localizedDescriptions("cmd.description"),
          } as PluginCommandDefinition & {
            descriptionLocalizations: ReturnType<typeof localizedDescriptions>;
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
