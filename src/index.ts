import { buildPlugin } from "./plugin.js";
import { wireRuntime } from "./runtime.js";
import { setPublicBaseUrl, setSessionVerifyKey } from "./web-routes.js";

const started = await buildPlugin().start();

wireRuntime({
  botRpc: started.botRpc,
  discord: started.discord,
  voice: started.voice,
  log: {
    info: (msg, meta) => started.server.log.info(meta ?? {}, msg),
    warn: (msg, meta) => started.server.log.warn(meta ?? {}, msg),
    error: (msg, meta) => started.server.log.error(meta ?? {}, msg),
  },
  publicBaseUrl: () => started.getPublicBaseUrl(),
  sessionVerifyKey: () => started.getSessionVerifyPublicKey(),
});

setSessionVerifyKey(() => started.getSessionVerifyPublicKey());
setPublicBaseUrl(() => started.getPublicBaseUrl());
