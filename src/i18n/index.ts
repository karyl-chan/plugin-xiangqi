/**
 * Handwritten i18n runtime for the xiangqi plugin.
 *
 * Mirrors the bot's pattern (`packages/bot/src/i18n/index.ts`):
 *   • Locales = "en" | "zh-TW" | "zh-CN"
 *   • `resolveLocale(interaction)` collapses BCP-47 tags (`en-US`,
 *     `zh-Hant-HK`, …) into one of the three supported tags, falling
 *     back through `interaction.locale → interaction.guildLocale → "en"`.
 *   • `t(locale, key, vars)` looks up a flat dotted key with simple
 *     `{var}` interpolation. Missing key warns + returns the English
 *     value (or the key itself when even English is missing).
 *   • `localizedDescriptions(key, vars?)` returns a Discord-shaped
 *     `LocalizationMap` covering all three locales for slash command
 *     `description_localizations` fields.
 *
 * Dictionaries live in sibling files (`en.ts`, `zh-TW.ts`, `zh-CN.ts`).
 * `sideLabel(locale, side)` returns the locale-aware side label
 * ("Red" / "紅方" / "红方").
 */

import { en } from "./en.js";
import { zhTW } from "./zh-TW.js";
import { zhCN } from "./zh-CN.js";

export const SUPPORTED_LOCALES = ["en", "zh-TW", "zh-CN"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Locale used to (a) fill in missing keys on look-ups and (b) describe
 * commands when a caller passes `undefined`. We default to English so
 * Discord shows a sensible canonical description in every guild before
 * the per-user locale overrides it.
 */
const DEFAULT_LOCALE: Locale = "en";

export const DICTIONARIES: Record<Locale, Record<string, string>> = {
  en,
  "zh-TW": zhTW,
  "zh-CN": zhCN,
};

function isSupportedLocale(tag: string): tag is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(tag);
}

/**
 * Map any BCP-47 tag (Discord sends `en-US`, `zh-TW`, `zh-Hans-CN`,
 * `ja`, …) onto one of our supported locales. Script subtags
 * (Hant/Hans) take precedence over region heuristics. Returns null
 * when the tag is unsupported — the caller (resolveLocale) then steps
 * down the fallback chain.
 */
function normalizeTag(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  if (isSupportedLocale(tag)) return tag;
  const n = tag.toLowerCase();
  if (n.startsWith("en")) return "en";
  if (n.startsWith("zh")) {
    if (n.includes("hant") || /-(tw|hk|mo)\b/.test(n)) return "zh-TW";
    if (n.includes("hans") || /-(cn|sg|my)\b/.test(n)) return "zh-CN";
    // Bare "zh" — default to Simplified (more common globally).
    return "zh-CN";
  }
  return null;
}

/**
 * Resolve a Discord interaction (or any object exposing `locale` +
 * optional `guildLocale`) to one of our supported locales.
 *
 * Fallback chain (matches bot/src/i18n/index.ts):
 *   1. interaction.locale     — user's Discord client locale
 *   2. interaction.guildLocale — preferred server locale
 *   3. "en"
 */
export function resolveLocale(interaction: {
  locale?: string | null;
  guildLocale?: string | null;
}): Locale {
  const fromUser = normalizeTag(interaction.locale);
  if (fromUser) return fromUser;
  const fromGuild = normalizeTag(interaction.guildLocale);
  if (fromGuild) return fromGuild;
  return DEFAULT_LOCALE;
}

/**
 * Translate `key` to `locale`. `vars` is the `{var}` interpolation
 * bag. Missing keys fall back to English, then to the raw key — and
 * log a warning so typos surface in dev.
 */
export function t(
  locale: Locale | undefined,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTIONARIES[locale ?? DEFAULT_LOCALE];
  let s = dict[key];
  if (s === undefined) {
    s = DICTIONARIES[DEFAULT_LOCALE][key];
    if (s === undefined) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing key "${key}" for locale "${locale ?? DEFAULT_LOCALE}"`);
      return key;
    }
  }
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`,
  );
}

/** Discord `LocalizationMap`-shaped object. Inlined to avoid a hard
 *  dependency on discord-api-types in this module. */
export type LocalizationMap = Partial<Record<string, string>>;

/**
 * Build a Discord `description_localizations` map covering every
 * supported locale. Discord uses `en-US` (not `en`) as the English
 * key, so we expand on the way out. Use at slash-command registration
 * sites alongside `description: t("en", "…")`.
 */
export function localizedDescriptions(
  key: string,
  vars?: Record<string, string | number>,
): LocalizationMap {
  return {
    "en-US": t("en", key, vars),
    "zh-TW": t("zh-TW", key, vars),
    "zh-CN": t("zh-CN", key, vars),
  };
}

/**
 * Locale-aware side label (e.g. "Red" / "紅方" / "红方"). Pass the
 * resolved interaction locale for ephemeral replies and the game's
 * stored locale for shared channel messages.
 */
export function sideLabel(locale: Locale | undefined, side: "red" | "black"): string {
  return t(locale, side === "red" ? "side.red" : "side.black");
}
