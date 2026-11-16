import { selectStore } from "@/lib/family/server/store";

import { importVapid, type VapidKeys } from "../vapid";
import { fetchSender, type PushDeps, type Sender } from "./handler";
import { selectPushStore } from "./store";

/**
 * Lo que la ruta de avisos necesita, desde el entorno. Con `FAMILY_STORE=memory` (CI y
 * e2e) el registro es el doble y el emisor TAMBIÉN: cuenta los toques sin salir a la red.
 * Las llaves VAPID y las de firma del disparador llegan por variables; en la CI son de
 * prueba. Sin ellas, la ruta contesta 503 y la app dice que los avisos no están disponibles.
 */

type Env = Record<string, string | undefined>;

const g = globalThis as { __nkPushSent?: string[] };

/** El emisor doble: anota a quién habría tocado (en memoria) y contesta «entregado». */
export const memorySender: Sender = async (endpoint) => {
  (g.__nkPushSent ??= []).push(endpoint);
  return 201;
};

let cached: { key: string; vapid: Promise<VapidKeys | null> } | null = null;
function vapidFrom(env: Env): Promise<VapidKeys | null> {
  const pub = env.VAPID_PUBLIC_KEY ?? "";
  const priv = env.VAPID_PRIVATE_KEY ?? "";
  const subject = env.VAPID_SUBJECT ?? "";
  if (!pub || !priv || !subject) return Promise.resolve(null);
  const key = `${pub}|${subject}`;
  if (cached?.key !== key)
    cached = { key, vapid: importVapid(pub, priv, subject) };
  return cached.vapid;
}

export async function pushDeps(env: Env): Promise<PushDeps> {
  const memory = env.FAMILY_STORE === "memory";
  return {
    store: selectPushStore(env),
    family: selectStore(env),
    vapid: await vapidFrom(env),
    signingKeys: [
      env.QSTASH_CURRENT_SIGNING_KEY ?? "",
      env.QSTASH_NEXT_SIGNING_KEY ?? "",
    ].filter(Boolean),
    sender: memory ? memorySender : fetchSender(),
    ipSalt: env.VAPID_PRIVATE_KEY ?? "",
  };
}
