import type { FamilyApi, PushResult } from "./client";
import { deriveKeys, newSalt, type FamilyKeys } from "./crypto";
import {
  newFamilyCode,
  newPhrase,
  normalizeCode,
  normalizePhrase,
} from "./phrase";
import { openNamed, sealNamed, type Named } from "./records";

/**
 * Los pasos de la familia sobre la red, sin pantalla ni almacenamiento: crear, entrar,
 * bajar, subir, cambiar la frase y borrar lo compartido. Todo se cifra o descifra aquí,
 * en el aparato; al cliente solo le llegan registros sellados.
 */

export type FamilyCtx = { family: string; epoch: number; keys: FamilyKeys };
export type Failure =
  | "offline"
  | "unavailable"
  | "wrong-code"
  | "wrong-phrase"
  | "denied"
  | "busy"
  | "full"
  | "error";

type Res<T> = { ok: true; value: T } | { ok: false; reason: Failure };

function reason(status: number, error: string): Failure {
  if (status === 0) return "offline";
  if (status === 503) return error === "full" ? "full" : "unavailable";
  if (status === 403) return "denied";
  if (status === 404) return "wrong-code";
  if (status === 429) return "busy";
  if (status === 507) return "full";
  return "error";
}

/** Crea la familia: código y frase nuevos (la frase se muestra una vez y no se guarda). */
export async function createFamily(
  api: FamilyApi,
): Promise<Res<{ ctx: FamilyCtx; phrase: string }>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const family = newFamilyCode();
    const phrase = newPhrase();
    const salt = newSalt();
    const keys = await deriveKeys(normalizePhrase(phrase)!, salt);
    const r = await api.create(family, salt, keys.token);
    if (r.ok)
      return {
        ok: true,
        value: { ctx: { family, epoch: r.data.epoch, keys }, phrase },
      };
    if (r.status !== 409)
      return { ok: false, reason: reason(r.status, r.error) };
  }
  return { ok: false, reason: "error" };
}

/** Entra con código y frase. Una frase equivocada no descifra ni autoriza: «wrong-phrase». */
export async function joinFamily(
  api: FamilyApi,
  codeInput: string,
  phraseInput: string,
): Promise<Res<FamilyCtx>> {
  const family = normalizeCode(codeInput);
  const phrase = normalizePhrase(phraseInput);
  if (!family) return { ok: false, reason: "wrong-code" };
  if (!phrase) return { ok: false, reason: "wrong-phrase" };
  const meta = await api.join(family);
  if (!meta.ok) return { ok: false, reason: reason(meta.status, meta.error) };
  const keys = await deriveKeys(phrase, meta.data.salt);
  const probe = await api.pull(
    family,
    meta.data.epoch,
    Number.MAX_SAFE_INTEGER,
    keys.token,
  );
  if (!probe.ok) {
    return {
      ok: false,
      reason:
        probe.status === 403
          ? "wrong-phrase"
          : reason(probe.status, probe.error),
    };
  }
  return { ok: true, value: { family, epoch: meta.data.epoch, keys } };
}

export type Pulled = { named: Named; ver: number };

/** Baja todo lo cambiado desde `since`, página por página. Lo que no abre se cuenta y se deja. */
export async function pullSince(
  api: FamilyApi,
  ctx: FamilyCtx,
  since: number,
): Promise<Res<{ seq: number; items: Pulled[]; unreadable: number }>> {
  const items: Pulled[] = [];
  let unreadable = 0;
  let cursor = since;
  for (let page = 0; page < 1000; page++) {
    const r = await api.pull(ctx.family, ctx.epoch, cursor, ctx.keys.token);
    if (!r.ok) return { ok: false, reason: reason(r.status, r.error) };
    for (const rec of r.data.records) {
      const named = await openNamed(ctx.keys, ctx.family, ctx.epoch, rec);
      if (named) items.push({ named, ver: rec.ver });
      else unreadable++;
    }
    const last = r.data.records.at(-1);
    if (!r.data.more || !last)
      return { ok: true, value: { seq: r.data.seq, items, unreadable } };
    cursor = last.seq;
  }
  return { ok: false, reason: "error" };
}

/** Lo que se sube: el registro y la versión que este teléfono vio (0 = nuevo). */
export type Outgoing = { named: Named; ver: number };
export type Pushed = {
  name: Named["name"];
  status: PushResult["status"];
  ver: number;
};

const BATCH_BYTES = 900 * 1024;
const BATCH_COUNT = 50;

/** Sella y sube en tandas que caben en una petición. 409 por registro, nunca por tanda. */
export async function pushNamed(
  api: FamilyApi,
  ctx: FamilyCtx,
  outgoing: Outgoing[],
): Promise<Res<Pushed[]>> {
  const sealed = await Promise.all(
    outgoing.map(async (o) => ({
      name: o.named.name,
      wire: {
        ...(await sealNamed(ctx.keys, ctx.family, ctx.epoch, o.named)),
        ver: o.ver,
      },
    })),
  );
  const out: Pushed[] = [];
  let i = 0;
  while (i < sealed.length) {
    const batch: typeof sealed = [];
    let bytes = 0;
    while (i < sealed.length && batch.length < BATCH_COUNT) {
      const size = sealed[i].wire.ct.length + 200;
      if (batch.length > 0 && bytes + size > BATCH_BYTES) break;
      batch.push(sealed[i]);
      bytes += size;
      i++;
    }
    const r = await api.push(
      ctx.family,
      ctx.epoch,
      batch.map((b) => b.wire),
      ctx.keys.token,
    );
    const results = r.ok ? r.data.results : r.data?.results;
    if (!results)
      return { ok: false, reason: reason(r.status, r.ok ? "" : r.error) };
    results.forEach((res, k) =>
      out.push({ name: batch[k].name, status: res.status, ver: res.ver }),
    );
  }
  return { ok: true, value: out };
}

/**
 * Frase nueva (al sacar un teléfono, o si se perdió): sal y claves nuevas, el servidor
 * borra todo lo guardado y este teléfono vuelve a subir `keep` cifrado con la clave nueva.
 * El teléfono sacado ya no autoriza (403) ni puede abrir lo nuevo.
 */
export async function rotateFamily(
  api: FamilyApi,
  ctx: FamilyCtx,
  keep: Named[],
): Promise<Res<{ ctx: FamilyCtx; phrase: string; pushed: Pushed[] }>> {
  const phrase = newPhrase();
  const salt = newSalt();
  const keys = await deriveKeys(normalizePhrase(phrase)!, salt);
  const r = await api.rotate(
    ctx.family,
    ctx.epoch,
    salt,
    keys.token,
    ctx.keys.token,
  );
  if (!r.ok) return { ok: false, reason: reason(r.status, r.error) };
  const next: FamilyCtx = { family: ctx.family, epoch: r.data.epoch, keys };
  const pushed: Res<Pushed[]> = keep.length
    ? await pushNamed(
        api,
        next,
        keep.map((named) => ({ named, ver: 0 })),
      )
    : { ok: true, value: [] };
  // La frase ya cambió: aunque la subida falle, el nuevo contexto es el que vale (se reintenta).
  return {
    ok: true,
    value: { ctx: next, phrase, pushed: pushed.ok ? pushed.value : [] },
  };
}

/** Borra lo compartido del servidor. Cada teléfono conserva su copia. */
export async function destroyFamily(
  api: FamilyApi,
  ctx: FamilyCtx,
): Promise<Res<null>> {
  const r = await api.destroy(ctx.family, ctx.keys.token);
  return r.ok
    ? { ok: true, value: null }
    : { ok: false, reason: reason(r.status, r.error) };
}
