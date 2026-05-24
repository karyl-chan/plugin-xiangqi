import type { ComponentContext, ComponentReply } from "@karyl-chan/plugin-sdk";
import {
  handleAcceptButton,
  handleCancelDirectButton,
  handleCancelOpenButton,
  handleDeclineButton,
  handleJoinBlackButton,
  handleJoinRedButton,
} from "./accept.js";
import {
  handleDrawAcceptButton,
  handleDrawDeclineButton,
} from "./draw.js";
import {
  handleTakebackAcceptButton,
  handleTakebackDeclineButton,
} from "./takeback.js";

/**
 * Component custom_id routing. The SDK strips the `kc:karyl-xiangqi:`
 * prefix and passes us `componentId` plus `ctx.tail` (the part after
 * the second colon — typically the sessionId or inviteId).
 *
 * Buttons we handle:
 *   acc / dec / cancel         — direct invite (named opponent)
 *   join-r / join-b / inv-cancel — public invite (open to anyone)
 *   draw-acc / draw-dec
 *   tb-acc / tb-dec
 */
export async function onComponent(
  ctx: ComponentContext,
  componentId: string,
): Promise<ComponentReply> {
  const tail = ctx.tail;
  switch (componentId) {
    case "acc":
      return handleAcceptButton(ctx, tail);
    case "dec":
      return handleDeclineButton(ctx, tail);
    case "cancel":
      return handleCancelDirectButton(ctx, tail);
    case "join-r":
      return handleJoinRedButton(ctx, tail);
    case "join-b":
      return handleJoinBlackButton(ctx, tail);
    case "inv-cancel":
      return handleCancelOpenButton(ctx, tail);
    case "draw-acc":
      return handleDrawAcceptButton(ctx, tail);
    case "draw-dec":
      return handleDrawDeclineButton(ctx, tail);
    case "tb-acc":
      return handleTakebackAcceptButton(ctx, tail);
    case "tb-dec":
      return handleTakebackDeclineButton(ctx, tail);
    default:
      return { content: "Unknown action" };
  }
}
